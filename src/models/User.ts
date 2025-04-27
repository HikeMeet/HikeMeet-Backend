import mongoose, { Document, Model, Schema, model } from 'mongoose';
import { DEFAULT_PROFILE_IMAGE_ID, removeOldImage } from '../helpers/cloudinaryHelper';
export interface ITripHistoryEntry {
  trip: mongoose.Schema.Types.ObjectId;
  completed_at: Date;
}
const tripHistorySchema = new Schema<ITripHistoryEntry>(
  {
    trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    completed_at: { type: Date, default: Date.now },
  },
  { _id: false },
);
export interface IUser extends Document {
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  gender?: string;
  birth_date?: Date;
  profile_picture?: {
    url: string;
    image_id: string;
    delete_token?: string;
  };
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
  friends: {
    status: 'request_sent' | 'request_received' | 'accepted' | 'blocked';
    id: mongoose.Schema.Types.ObjectId;
  }[];
  trip_history: ITripHistoryEntry[];
  firebase_id: string;
  pushTokens: string[];
  unreadNotifications: number;
  updated_on: Date;
  mutedGroups: string[]; // list of Group IDs the user has muted
  mutedNotificationTypes: string[];
  favorite_trips: mongoose.Schema.Types.ObjectId[];
}

type IUserModel = Model<IUser>;

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  first_name: { type: String },
  last_name: { type: String },
  gender: { type: String },
  birth_date: { type: Date },
  profile_picture: {
    url: { type: String, required: true },
    image_id: { type: String, required: true },
    delete_token: { type: String },
  },
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
        enum: ['request_sent', 'request_received', 'accepted', 'blocked'],
        required: true,
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      _id: false, //cancel _id automatic (its was problem)
    },
  ],
  favorite_trips: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: [] }],
  trip_history: [tripHistorySchema],
  firebase_id: { type: String },
  pushTokens: { type: [String], default: [] },
  unreadNotifications: { type: Number, default: 0 },
  created_on: { type: Date, required: true, default: Date.now },
  updated_on: { type: Date, required: true, default: Date.now },
  mutedGroups: { type: [String], default: [] }, // list of Group IDs the user has muted
  mutedNotificationTypes: { type: [String], default: [] },
});

// Mongoose Middleware: Cleanup friend references after a user is deleted
// TODO: need to think what to do about Group creator field when deleting user

userSchema.post('findOneAndDelete', async function (this: any, deletedDoc, next) {
  if (deletedDoc) {
    try {
      // ✅ Remove user from others' friend lists
      await this.model.updateMany({ 'friends.id': deletedDoc._id }, { $pull: { friends: { id: deletedDoc._id } } });

      // ✅ Remove user's profile image from Cloudinary
      const publicId = deletedDoc.profile_picture?.image_id;
      if (publicId) {
        await removeOldImage(publicId, DEFAULT_PROFILE_IMAGE_ID);
      }

      next();
    } catch (error) {
      console.error('Error during user cleanup:', error);
      next(error);
    }
  } else {
    next();
  }
});

userSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updated_on: new Date() });
  next();
});

export const User: IUserModel = model<IUser, IUserModel>('User', userSchema);
