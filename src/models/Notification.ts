import mongoose, { Document, Schema, model } from 'mongoose';

export interface INotification extends Document {
  to: mongoose.Types.ObjectId; // recipient user
  from?: mongoose.Types.ObjectId; // optional sender (e.g. user who triggered it)
  type: string; // e.g. 'friend_request', 'trip_reminder'
  title: string;
  body: string;
  data?: Record<string, any>; // any extra payload
  read: boolean;
  created_on: Date;
}

const notificationSchema = new Schema<INotification>({
  to: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  from: { type: Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  data: { type: Schema.Types.Mixed },
  read: { type: Boolean, default: false },
  created_on: { type: Date, default: Date.now },
});

export const Notification = model<INotification>('Notification', notificationSchema);
