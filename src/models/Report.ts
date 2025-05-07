import mongoose, { Schema, Document } from 'mongoose';

export type ReportType = 'user' | 'post' | 'trip';

export interface IReport extends Document {
  reporter: mongoose.Schema.Types.ObjectId;
  targetId: mongoose.Schema.Types.ObjectId;
  targetType: ReportType;
  reason: string;
  status: 'pending' | 'in_progress' | 'resolved';
  createdAt: Date;
}

const reportSchema = new Schema<IReport>({
  reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  targetType: { type: String, enum: ['user', 'post', 'trip'], required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'resolved'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

export const Report = mongoose.model<IReport>('Report', reportSchema);
