// services/notificationService.ts
import mongoose from 'mongoose';
import { Notification, INotification } from '../models/Notification';
import { User } from '../models/User';
import Expo, { ExpoPushMessage } from 'expo-server-sdk';

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
  let actorInfo: Record<string, any> = {};
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

  // 2) Merge in whatever data the caller passed, plus our `id`
  const fullData = {
    ...(opts.data ?? {}), // e.g. { navigation: { … } }
    id: noteId.toString(), // always last so it wins
    ...actorInfo, // adds { actor: { … } } if present
  };
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

export async function notifyPostLiked(postAuthor: mongoose.Schema.Types.ObjectId, likingUserId: mongoose.Schema.Types.ObjectId, postId: string) {
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
