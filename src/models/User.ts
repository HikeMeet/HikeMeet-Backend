import mongoose, { Document, Model, Schema, model } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  gender?: string;
  birth_date?: Date;
  profile_picture?: string;
  bio?: string;
  facebook_link?: string;
  instagram_link?: string;
  role: 'user' | 'admin';
  social?: {
    posts_saved?: string[];
    posts_liked?: string[];
    total_likes?: number;
    total_shares?: number;
    total_saves?: number;
  };
  friends?: {
    status?: 'active' | 'pending' | 'blocked';
    id?: string;
  }[];
  firebase_id: string;
  created_on: Date;
  updated_on: Date;
}

type IUserModel = Model<IUser>;

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  first_name: { type: String },
  last_name: { type: String },
  gender: { type: String },
  birth_date: { type: Date },
  profile_picture: { type: String },
  bio: { type: String },
  facebook_link: { type: String },
  instagram_link: { type: String },
  role: { type: String, required: true, enum: ['user', 'admin'], default: 'user' },
  social: {
    posts_saved: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    posts_liked: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    total_likes: { type: Number },
    total_shares: { type: Number },
    total_saves: { type: Number },
  },
  friends: [
    {
      status: {
        type: String,
        enum: ['active', 'pending', 'blocked'],
        default: 'pending',
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
  ],
  firebase_id: { type: String },
  created_on: { type: Date, required: true, default: Date.now },
  updated_on: { type: Date, required: true, default: Date.now },
});

export const User: IUserModel = model<IUser, IUserModel>('User', userSchema);
