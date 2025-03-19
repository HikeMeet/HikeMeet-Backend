import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INotification extends Document {
  user: mongoose.Schema.Types.ObjectId; // The recipient of the notification
  type: 'group_invite' | 'friend_request' | string;
  group?: mongoose.Schema.Types.ObjectId; // Optional, if this notification relates to a group
  message: string;
  status: 'unread' | 'read' | 'dismissed';
  user_triggered?: mongoose.Schema.Types.ObjectId; // Optional: the user who triggered the notification
  created_at: Date;
  updated_at: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    message: { type: String, required: true },
    status: { type: String, enum: ['unread', 'read', 'dismissed'], default: 'unread' },
    user_triggered: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const Notification: Model<INotification> = mongoose.model<INotification>('Notification', notificationSchema);
