import mongoose, { Document, Schema, Model, model } from 'mongoose';
import { IImageModel, ImageModalSchema } from './Trip';

export interface IComment {
  user: mongoose.Schema.Types.ObjectId;
  text: string;
  created_at: Date;
  liked_by?: mongoose.Schema.Types.ObjectId[];
}

export interface IPost extends Document {
  author: mongoose.Schema.Types.ObjectId;
  content?: string;
  images?: IImageModel[];
  attached_trip?: mongoose.Schema.Types.ObjectId;
  attached_group?: mongoose.Schema.Types.ObjectId;
  likes: mongoose.Schema.Types.ObjectId[];
  shares: mongoose.Schema.Types.ObjectId[];
  saves: mongoose.Schema.Types.ObjectId[];
  comments: IComment[];
  is_shared: boolean;
  original_post?: mongoose.Schema.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const commentSchema = new Schema<IComment>({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  liked_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
});

const postSchema = new Schema<IPost>(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String },
    images: [ImageModalSchema],
    attached_trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
    attached_group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
    shares: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
    saves: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
    comments: [commentSchema],
    is_shared: { type: Boolean, default: false },
    original_post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const Post: Model<IPost> = model<IPost>('Post', postSchema);
