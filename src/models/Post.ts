import mongoose, { Document, Model, Schema, model } from 'mongoose';

export interface IPost extends Document {
  title: string;
  content: string;
  author: string;
  date: Date;
  images: string[];
  likes: number;
  comments: Array<{
    user: string;
    text: string;
    date: Date;
  }>;
  createdOn: Date;
  updatedOn: Date;
}

type IPostModel = Model<IPost>;

const postSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true, default: Date.now },
  images: { type: [String], required: false },
  likes: { type: Number, required: true, default: 0 },
  comments: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      text: { type: String, required: true },
      date: { type: Date, required: true, default: Date.now },
    },
  ],
  createdOn: { type: Date, required: true, default: Date.now },
  updatedOn: { type: Date, required: true, default: Date.now },
});

export const Post: IPostModel = model<IPost, IPostModel>('Post', postSchema);
