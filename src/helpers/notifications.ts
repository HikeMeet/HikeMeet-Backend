// services/notificationService.ts
import mongoose from 'mongoose';
import { Notification, INotification } from '../models/Notification';
import { User } from '../models/User';
import Expo, { ExpoPushMessage } from 'expo-server-sdk';
import { Group } from '../models/Group';

const expo = new Expo();
interface CreateNotificationOpts {
  to: mongoose.Types.ObjectId;
  from?: mongoose.Types.ObjectId;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}
export async function createNotification(opts: CreateNotificationOpts): Promise<INotification> {
  const noteId = new mongoose.Types.ObjectId();

  const recipient = await User.findById(opts.to).select('mutedGroups mutedNotificationTypes').lean();
  // 2) If there’s a triggering user, lookup their display info
  const actor = await User.findById(opts.from).select('username profile_picture.url').lean();
  // 2) If this is a group‑related notification, pull in group details
  const gid = opts.data?.groupId;
  const isGroupMuted = gid && recipient?.mutedGroups?.includes(gid.toString());
  const isTypeMuted = recipient?.mutedNotificationTypes?.includes(opts.type);
  const group = await Group.findById(gid).select('name main_image').lean();
  // 2) Merge in whatever data the caller passed, plus our `id`

  // 1) Create the notification document
  const note = await Notification.create({
    _id: noteId,
    to: opts.to,
    from: opts.from,
    type: opts.type,
    title: opts.title,
    body: opts.body,
    data: { ...opts.data, id: noteId },
    read: false,
    created_on: new Date(),
  });

  // 2) Increment unreadNotifications on the recipient
  await User.updateOne({ _id: opts.to }, { $inc: { unreadNotifications: 1 } });

  // 3) Send push via Expo
  if (!isGroupMuted && !isTypeMuted) {
    const user = await User.findById(opts.to).select('pushTokens').lean();
    if (user?.pushTokens?.length) {
      const messages: ExpoPushMessage[] = user.pushTokens.filter(Expo.isExpoPushToken).map((token) => {
        const username = actor?.username;
        const groupName = group?.name;
        const bodyText = [username, opts.body, groupName].filter(Boolean).join(' ');

        return {
          to: token,
          sound: 'default',
          title: opts.title,
          body: bodyText,
          data: { ...opts.data, id: noteId },
        };
      });

      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          const receipts = await expo.sendPushNotificationsAsync(chunk);
          console.log('Push receipts:', receipts);
        } catch (err) {
          console.error('Error sending Expo push:', err);
        }
      }
    }
  } else {
    console.warn('No Expo push tokens found for user', opts.to.toString());
  }

  return note;
}

export async function bumpNotificationTimestamp(notificationId: mongoose.Types.ObjectId | string): Promise<void> {
  // 1) Update the timestamp and get back the new document
  const note = await Notification.findByIdAndUpdate(notificationId, { $set: { created_on: new Date() } }, { new: true, lean: true });
  if (!note) return;

  // 2) (Optionally) increment their unread count again, if you want them to see it as “new”
  if (note.read) {
    await Notification.findByIdAndUpdate(notificationId, { $set: { read: false } });
    await User.updateOne({ _id: note.to }, { $inc: { unreadNotifications: 1 } });
  }

  // 3) Pull the recipient’s push tokens
  const user = await User.findById(note.to).select('pushTokens').lean();
  if (!user?.pushTokens?.length) {
    console.warn('No Expo push tokens for', note.to.toString());
    return;
  }

  // 4) Build and send Expo pushes
  const messages: ExpoPushMessage[] = user.pushTokens.filter(Expo.isExpoPushToken).map((token) => ({
    to: token,
    sound: 'default',
    title: note.title,
    body: note.body,
    data: note.data,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      console.log('Bump push receipts:', receipts);
    } catch (err) {
      console.error('Error re‑sending bump push:', err);
    }
  }
}

export async function notifyPostLiked(postAuthor: mongoose.Schema.Types.ObjectId, likingUserId: mongoose.Schema.Types.ObjectId, postId: string) {
  if (postAuthor.toString() === likingUserId.toString()) {
    return;
  }
  // 1) Load only the username
  const likingUser = await User.findById(likingUserId).select('username');
  if (!likingUser) return;

  // 2) Delegate to your core helper
  return createNotification({
    to: new mongoose.Types.ObjectId(postAuthor.toString()),
    from: new mongoose.Types.ObjectId(likingUserId.toString()),
    type: 'post_like',
    title: 'Your post was liked!',
    body: 'liked your post.',
    data: {
      postId,
      imageType: 'user',
      navigation: {
        name: 'PostStack',
        params: {
          screen: 'PostPage',
          params: { postId },
        },
      },
    },
  });
}

// Notify every other member of a group that a new post was created.
export async function notifyPostCreateInGroup(groupId: mongoose.Types.ObjectId, authorId: mongoose.Types.ObjectId, postId: string): Promise<void> {
  // 1) Load group info
  const group = await Group.findById(groupId).select('name members').lean();
  if (!group) return;

  // 3) For each member ≠ author, send a notification
  for (const member of group.members) {
    if (member.user.toString() === authorId.toString()) continue;

    await createNotification({
      to: new mongoose.Types.ObjectId(member.user.toString()),
      from: authorId,
      type: 'post_create_in_group',
      title: `New post in ${group.name}`,
      body: `added a post to `,
      data: {
        imageType: 'user',
        groupId: groupId.toString(),
        postId,
        navigation: {
          name: 'PostStack',
          params: {
            screen: 'PostPage',
            params: { postId },
          },
        },
      },
    });
  }
}

// Notify original author that their post was shared.
// If inGroupId is provided, sends 'post_shared_in_group'.
export async function notifyPostShared(
  postAuthorId: mongoose.Types.ObjectId,
  sharingUserId: mongoose.Types.ObjectId,
  newPostId: string,
  inGroupId?: string,
): Promise<void> {
  if (postAuthorId.toString() === sharingUserId.toString()) {
    return;
  }

  const sharer = await User.findById(sharingUserId).select('username').lean();
  if (!sharer) return;

  const isGroup = !!inGroupId;

  await createNotification({
    to: postAuthorId,
    from: sharingUserId,
    type: isGroup ? 'post_shared_in_group' : 'post_shared',
    title: isGroup ? 'Your post was shared in a group!' : 'Your post was shared!',
    body: isGroup ? 'shared your post in the group ' : 'shared your post.',
    data: {
      imageType: 'user',
      groupId: isGroup ? inGroupId : null,
      navigation: {
        name: 'PostStack',
        params: {
          screen: 'PostPage',
          params: { postId: newPostId },
        },
      },
    },
  });
}

//Notify a post’s author that someone commented on their post.
//Skips notifying if the commenter is also the author.
export async function notifyPostCommented(
  postAuthorId: mongoose.Types.ObjectId,
  commentingUserId: mongoose.Types.ObjectId,
  postId: string,
  commentId: string,
): Promise<void> {
  // 1) Don’t notify yourself
  if (postAuthorId.toString() === commentingUserId.toString()) {
    return;
  }

  // 2) Load commenter’s username
  const commenter = await User.findById(commentingUserId).select('username').lean();
  if (!commenter) return;

  // 3) Fire off notification
  await createNotification({
    to: postAuthorId,
    from: commentingUserId,
    type: 'post_comment',
    title: 'New comment on your post!',
    body: 'commented on your post.',
    data: {
      imageType: 'user',
      navigation: {
        name: 'PostStack',
        params: {
          screen: 'PostPage',
          params: { postId },
        },
      },
      postId,
      commentId, // so front‑end can scroll to it if desired
    },
  });
}

export async function notifyCommentLiked(
  commentAuthorId: mongoose.Types.ObjectId,
  likingUserId: mongoose.Types.ObjectId,
  postId: string,
  commentId: string,
): Promise<void> {
  // 1) Don’t notify yourself
  if (commentAuthorId.toString() === likingUserId.toString()) {
    return;
  }

  // 2) Load the liker’s username
  const liker = await User.findById(likingUserId).select('username').lean();
  if (!liker) return;

  // 3) Send the notification
  await createNotification({
    to: commentAuthorId,
    from: likingUserId,
    type: 'comment_like',
    title: 'Someone liked your comment!',
    body: 'liked your comment.',
    data: {
      imageType: 'user',
      navigation: {
        name: 'PostStack',
        params: {
          screen: 'PostPage',
          params: { postId },
        },
      },
      commentId,
      postId,
    },
  });
}

// Notify a user that someone has sent them a friend request.
// Skips notifying if you somehow request yourself.
export async function notifyFriendRequestSent(fromUserId: mongoose.Types.ObjectId, toUserId: mongoose.Types.ObjectId): Promise<void> {
  // Don’t notify yourself
  if (fromUserId.toString() === toUserId.toString()) {
    return;
  }

  // Load sender’s display info
  const sender = await User.findById(fromUserId).select('username profile_picture.url').lean();
  if (!sender) return;

  // Build navigation payload: take the receiver to the sender’s profile
  const navigation = {
    name: 'AccountStack',
    params: {
      screen: 'UserProfile',
      params: { userId: fromUserId.toString() },
    },
  };

  const existingNotification = await Notification.findOne({ to: toUserId, from: fromUserId, type: 'friend_request' });
  if (existingNotification) {
    await bumpNotificationTimestamp(existingNotification._id as string);
  } else {
    await createNotification({
      to: toUserId,
      from: fromUserId,
      type: 'friend_request',
      title: 'New Friend Request',
      body: 'sent you a friend request.',
      data: { navigation, imageType: 'user' },
    });
  }
}

// Notify the original requester that their friend request was accepted.
export async function notifyFriendRequestAccepted(accepterId: mongoose.Types.ObjectId, requesterId: mongoose.Types.ObjectId) {
  // Don’t notify yourself
  if (accepterId.toString() === requesterId.toString()) return;

  // 1) Mark the original friend_request as read (if still unread)
  const original = await Notification.findOneAndUpdate(
    {
      to: accepterId,
      from: requesterId,
      type: 'friend_request',
      read: false,
    },
    { $set: { read: true } },
    { new: true },
  );
  if (original) {
    // decrement that user’s unreadNotifications counter
    await User.updateOne({ _id: accepterId }, { $inc: { unreadNotifications: -1 } });
  }

  // Load accepter’s display info
  const accepter = await User.findById(accepterId).select('username profile_picture.url').lean();
  if (!accepter) return;

  // Build navigation payload to take the requester to the accepter’s profile
  const navigation = {
    name: 'AccountStack',
    params: {
      screen: 'UserProfile',
      params: { userId: accepterId.toString() },
    },
  };

  await createNotification({
    to: requesterId,
    from: accepterId,
    type: 'friend_accept',
    title: 'Friend Request Accepted',
    body: 'accepted your friend request.',
    data: { navigation, imageType: 'user' },
  });
}

export async function notifyGroupUpdated(
  toUserId: mongoose.Types.ObjectId,
  updatedById: mongoose.Types.ObjectId,
  groupId: mongoose.Types.ObjectId,
  changes: Record<string, any>,
  name: string,
): Promise<INotification | void> {
  // Don't notify yourself
  // if (toUserId.toString() === updatedById.toString()) return;

  // 1) Load updater’s info
  const updater = await User.findById(updatedById).select('username profile_picture.url').lean();
  if (!updater) return;

  // 3) Build navigation payload to take members to the group page
  const navigation = {
    name: 'GroupsStack',
    params: {
      screen: 'GroupPage',
      params: { groupId: groupId.toString() },
    },
  };

  // 4) Delegate to your core creator
  return createNotification({
    to: toUserId,
    from: updatedById,
    type: 'group_updated',
    title: `"${name}" updated`,
    body: `updated the group `,
    data: { imageType: 'group', groupId, navigation, updatedData: changes },
  });
}

export async function notifyGroupInvite(toUserId: mongoose.Types.ObjectId, fromUserId: mongoose.Types.ObjectId, groupId: mongoose.Types.ObjectId) {
  // Don’t notify yourself
  if (toUserId.toString() === fromUserId.toString()) return;

  // 1) Load inviter’s display info
  const inviter = await User.findById(fromUserId).select('username profile_picture.url').lean();
  if (!inviter) return;

  // 2) Build the “you’ve been invited” body

  // 3) Build a navigation payload into the GroupPage
  const navigation = {
    name: 'GroupsStack',
    params: {
      screen: 'GroupPage',
      params: { groupId: groupId.toString() },
    },
  };
  const group = await Group.findById(groupId);
  const existingNotification = await Notification.findOne({ to: toUserId, from: fromUserId, type: 'group_invite' });
  if (existingNotification) {
    await bumpNotificationTimestamp(existingNotification._id as string);
  } else {
    // 4) Delegate to your core helper
    return createNotification({
      to: toUserId,
      from: fromUserId,
      type: 'group_invite',
      title: 'New Group Invitation',
      body: `invited you to join the group `,
      data: { groupId, group, imageType: 'group', navigation },
    });
  }
}

// Notify the inviter that their invite was accepted.
export async function notifyGroupInviteAccepted(accepterId: mongoose.Types.ObjectId, groupId: mongoose.Types.ObjectId): Promise<void> {
  // 1) Find the original invite notif addressed to the accepter
  const inviteNotif = await Notification.findOne({
    to: accepterId,
    type: 'group_invite',
    'data.groupId': groupId,
  });

  if (!inviteNotif) return;

  // 2) If it was unread, mark it read & decrement their counter
  if (!inviteNotif.read) {
    await Notification.findByIdAndUpdate(inviteNotif._id, { read: true });
    await User.updateOne({ _id: accepterId }, { $inc: { unreadNotifications: -1 } });
  }

  // 3) Who invited them?
  const inviterId = inviteNotif.from as mongoose.Types.ObjectId;
  if (!inviterId) return;

  // 5) Build navigation to take inviter back into the group page
  const navigation = {
    name: 'GroupsStack',
    params: {
      screen: 'GroupPage',
      params: { groupId: groupId.toString() },
    },
  };
  const group = await Group.findById(groupId);
  // 6) Fire off the “invite accepted” notif
  await createNotification({
    to: inviterId,
    from: accepterId,
    type: 'group_invite_accepted',
    title: 'Group Invitation Accepted',
    body: 'accepted your invitation to group ',
    data: { imageType: 'user', navigation, groupId: groupId.toString(), group },
  });
}

export async function notifyGroupJoined(
  toUserId: mongoose.Types.ObjectId,
  joiningUserId: mongoose.Types.ObjectId,
  groupId: mongoose.Types.ObjectId,
): Promise<INotification | void> {
  // 1) don’t notify yourself
  if (toUserId.equals(joiningUserId)) return;

  // 2) build navigation payload
  const navigation = {
    name: 'GroupsStack',
    params: {
      screen: 'GroupPage',
      params: { groupId: groupId.toString() },
    },
  };
  const group = await Group.findById(groupId);

  // 3) fire core helper
  return createNotification({
    to: toUserId,
    from: joiningUserId,
    type: 'group_joined',
    title: 'New Member Joined Group',
    body: `joined your group `,
    data: { imageType: 'user', navigation, groupId: groupId, group },
  });
}

export async function notifyGroupJoinRequest(
  toUserId: mongoose.Types.ObjectId,
  joiningUserId: mongoose.Types.ObjectId,
  groupId: mongoose.Types.ObjectId,
): Promise<INotification | void> {
  if (toUserId.equals(joiningUserId)) return;

  const joiner = await User.findById(joiningUserId).select('username profile_picture.url').lean();
  if (!joiner) return;

  const existingNotification = await Notification.findOne({
    to: toUserId,
    from: joiningUserId,
    type: 'group_join_request',
    'data.groupId': groupId.toString(),
  });

  if (existingNotification) {
    await bumpNotificationTimestamp(existingNotification._id as string);
  } else {
    const navigation = {
      name: 'GroupsStack',
      params: {
        screen: 'GroupPage',
        params: { groupId: groupId.toString() },
      },
    };
    const group = await Group.findById(groupId);

    return createNotification({
      to: toUserId,
      from: joiningUserId,
      type: 'group_join_request',
      title: 'New Group Join Request',
      body: `requested to join your group `,
      data: { imageType: 'user', navigation, groupId: groupId.toString(), group },
    });
  }
}
export async function notifyGroupJoinApproved(
  toUserId: mongoose.Types.ObjectId,
  adminId: mongoose.Types.ObjectId,
  groupId: mongoose.Types.ObjectId,
  adminMemberIds: mongoose.Types.ObjectId[],
): Promise<void> {
  // Don’t notify yourself
  if (toUserId.equals(adminId)) return;

  // 1) Load the admin’s display info
  const admin = await User.findById(adminId).select('username profile_picture.url').lean();
  if (!admin) return;

  // 2) Build navigation payload
  const navigation = {
    name: 'GroupsStack' as const,
    params: {
      screen: 'GroupPage' as const,
      params: { groupId: groupId.toString() },
    },
  };

  // 3) Create the “approved” notification
  await createNotification({
    to: toUserId,
    from: adminId,
    type: 'group_join_approved',
    title: 'Group Join Request Approved',
    body: `approved your request to join group `,
    data: { imageType: 'group', navigation, groupId: groupId.toString() },
  });

  // 1) Only target the admins who actually have an *unread* join-request notif.
  const unreadAdmins = await Notification.find({
    to: { $in: adminMemberIds },
    type: 'group_join_request',
    'data.groupId': groupId.toString(),
    read: false,
  }).distinct('to'); // gives you a list of admin IDs

  // 2) Decrement each of their unreadNotifications by exactly 1, only if their notification is unread
  await User.updateMany({ _id: { $in: unreadAdmins }, unreadNotifications: { $gt: 0 } }, { $inc: { unreadNotifications: -1 } });

  // 3) Delete *all* join-request notifications for that group
  await Notification.deleteMany({
    to: { $in: adminMemberIds.filter((id) => !id.equals(adminId)) },
    type: 'group_join_request',
    'data.groupId': groupId.toString(),
  });
}

export async function handleJoinRequestCancelled(
  groupId: mongoose.Types.ObjectId | string,
  requesterId: mongoose.Types.ObjectId | string,
  cancelledById: mongoose.Types.ObjectId | string,
  adminIds: (mongoose.Types.ObjectId | string)[],
): Promise<void> {
  // 1) Find all matching “join request” notifications for those admins
  const notifs = await Notification.find({
    to: { $in: adminIds.map((id) => new mongoose.Types.ObjectId(id)) },
    type: 'group_join_request',
    'data.groupId': groupId.toString(),
  });

  for (const notif of notifs) {
    const toStr = notif.to.toString();
    const wasUnread = notif.read === false;

    // a) If the user themself cancelled:
    if (cancelledById.toString() === requesterId.toString()) {
      // delete every admin’s notification
      if (wasUnread) {
        await User.updateOne({ _id: notif.to, unreadNotifications: { $gt: 0 } }, { $inc: { unreadNotifications: -1 } });
      }
      await Notification.deleteOne({ _id: notif._id });

      // b) Else an admin cancelled on behalf of the user:
    } else if (cancelledById.toString() === toStr) {
      // mark *that* admin’s own notification read (if it was unread)
      if (wasUnread) {
        await Notification.updateOne({ _id: notif._id }, { $set: { read: true } });
        await User.updateOne({ _id: notif.to, unreadNotifications: { $gt: 0 } }, { $inc: { unreadNotifications: -1 } });
      }
      // leave it in the DB, just marked read

      // c) All the *other* admins:
    } else {
      // delete their stale notifications
      if (wasUnread) {
        await User.updateOne({ _id: notif.to, unreadNotifications: { $gt: 0 } }, { $inc: { unreadNotifications: -1 } });
      }
      await Notification.deleteOne({ _id: notif._id });
    }
  }
}

export async function notifyReportCreated(reporterId: mongoose.Types.ObjectId, targetType: string): Promise<void> {
  // 1) Load reporter’s username
  const reporter = await User.findById(reporterId).select('username').lean();
  if (!reporter) return;

  // 2) Find all admins
  const admins = await User.find({ role: 'admin' }).select('_id').lean();

  const navigation = {
    name: 'AccountStack',
    params: {
      screen: 'AdminSettings',
      params: { tab: 'reports' },
    },
  };
  // 3) Send each one a “report created” notification
  for (const admin of admins) {
    await createNotification({
      to: admin._id as mongoose.Types.ObjectId,
      from: reporterId,
      type: 'report_created',
      title: '🚨 New User Report',
      body: `reported a ${targetType}.`,
      data: {
        userId: reporterId.toString(),
        imageType: 'user',
        navigation,
      },
    });
  }
}
