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
  // 1) Create the notification document
  const note = await Notification.create({
    to: opts.to,
    from: opts.from,
    type: opts.type,
    title: opts.title,
    body: opts.body,
    data: opts.data,
    read: false,
    created_on: new Date(),
  });

  // 2) Increment unreadNotifications on the recipient
  await User.updateOne({ _id: opts.to }, { $inc: { unreadNotifications: 1 } });

  // 3) Send push via Expo
  const user = await User.findById(opts.to).select('pushTokens');
  if (user?.pushTokens?.length) {
    // Build messages, filtering out any non‑Expo tokens
    const messages: ExpoPushMessage[] = user.pushTokens
      .filter((token) => Expo.isExpoPushToken(token))
      .map((token) => ({
        to: token,
        sound: 'default',
        title: opts.title,
        body: opts.body,
        data: opts.data,
      }));

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
    body: `${likingUser.username} liked your post.`,
    data: {
      name: 'PostStack',
      params: {
        screen: 'PostPage',
        params: { postId },
      },
    },
  });
}
