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

  // 2) If there’s a triggering user, lookup their display info
  const actorInfo: Record<string, any> = {};
  if (opts.from) {
    const actor = await User.findById(opts.from).select('username profile_picture.url').lean();
    if (actor) {
      actorInfo.actor = {
        id: actor._id.toString(),
        username: actor.username,
        profileImage: actor.profile_picture?.url,
      };
    }
  }
  // 2) If this is a group‑related notification, pull in group details
  let groupInfo: Record<string, any> = {};

  if (opts.type.includes('group') && opts.data?.groupId) {
    const gid = opts.data?.groupId;
    const group = await Group.findById(gid).select('name imageUrl').lean();
    if (group) {
      groupInfo.group = {
        id: group._id.toString(),
        name: group.name,
        imageUrl: group.main_image?.url,
      };
    }
  }

  // 2) Merge in whatever data the caller passed, plus our `id`
  const fullData = {
    ...(opts.data ?? {}), // e.g. { navigation: { … } }
    id: noteId.toString(), // always last so it wins
    ...actorInfo, // adds { actor: { … } } if present
    ...groupInfo, // { group: { … } } if applicable
  };
  console.log('fullData: ', fullData);
  // 1) Create the notification document
  const note = await Notification.create({
    _id: noteId,
    to: opts.to,
    from: opts.from,
    type: opts.type,
    title: opts.title,
    body: opts.body,
    data: fullData,
    read: false,
    created_on: new Date(),
  });

  // 2) Increment unreadNotifications on the recipient
  await User.updateOne({ _id: opts.to }, { $inc: { unreadNotifications: 1 } });

  // 3) Send push via Expo
  const user = await User.findById(opts.to).select('pushTokens');
  if (user?.pushTokens?.length) {
    // Build messages, filtering out any non‑Expo tokens
    const messages: ExpoPushMessage[] = user.pushTokens.filter(Expo.isExpoPushToken).map((token) => {
      // if we have an actor username, prefix it
      const username = actorInfo.actor?.username;
      const bodyText = username ? `${username} ${opts.body}` : opts.body;

      return {
        to: token,
        sound: 'default',
        title: opts.title,
        body: bodyText,
        data: fullData,
      };
    });

    // Chunk them into batches of 100 (Expo limit) and send
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const receipts = await expo.sendPushNotificationsAsync(chunk);
        console.log('Push receipts:', receipts);
      } catch (err) {
        console.error('Error sending Expo push:', err);
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
        groupId: groupId.toString(),
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
      navigation: {
        name: 'PostStack',
        params: {
          screen: 'PostPage',
          params: { postId },
        },
      },
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
      navigation: {
        name: 'PostStack',
        params: {
          screen: 'PostPage',
          params: { postId },
          commentId,
        },
      },
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
      data: { navigation },
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
    data: { navigation },
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

  // 2) Build a human‑readable summary of what changed
  const fields = Object.keys(changes);
  const changeList = fields.join(', ');
  const body = `updated the group (${changeList}).`;

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
    body,
    data: { navigation, updatedData: changes },
  });
}
