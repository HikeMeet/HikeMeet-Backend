import { hashSync, genSaltSync, compareSync } from 'bcrypt';

import mongoose, { Document, Model, Schema, model } from 'mongoose';


export interface IUser extends Document {
  /** Username */
  username: string;
  /** Email */
  email: string;
  /** First Name */
  firstName?: string;
  /** Last Name */
  lastName?: string;
  /** Gender */
  gender?: string;
  /** Birth Date */
  birthDate?: Date;
  /** Profile Picture */
  profilePicture?: string;
  /** Bio */
  bio?: string;
  /** Facebook Link */
  facebookLink?: string;
  /** Instagram Link */
  instagramLink?: string;
  /** Role */
  role: "user" | "admin";
  /** Social Data */
  social?: {
    postsSaved?: string[]; // ObjectIds as strings for saved posts
    postsLiked?: string[]; // ObjectIds as strings for liked posts
    totalLikes?: number;
    totalShare?: number;
    totalSaves?: number;
  };
  /** Friends Data */
  friends?: {
    status?: "active" | "pending" | "blocked"; // Status of friendship
    _id?: string; // Friend's ObjectId as a string
  };
  /** Created On */
  createdOn: Date;
  /** Updated On */
  updatedOn: Date;
  /** Encrypt Password Method */
  encryptPassword: (password: string) => string;
  /** Validate Password Method */
  validPassword: (password: string) => boolean;
}

interface IUserModel extends Model<IUser> { }

const schema = new Schema({
  username: {type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  firstName: { type: String, required: false},
  lastName: { type: String, required: false},
  gender: { type: String, required: false},
  birthDate: { type: Date, required: false}, 
  profilePicture: { type: String, required: false},
  bio: { type: String, required: false},
  facebookLink: { type: String, required: false},
  instagramLink: { type: String, required: false},
  //Notification: { type: String, required: false},  //can be json
  role: { type: String, required: true ,enum: ['user', 'admin'], default: 'user'},  //user, admin

  
  //location: { type: String, required: false},  //json object with all location info
  social:{
    postsSaved: { type: [mongoose.Schema.Types.ObjectId], required: false}, //post that I saved
    postsLiked: {  type: [mongoose.Schema.Types.ObjectId], required: false}, //_id of post I like
    totalLikes: { type: Number, required: false},
    totalShare: { type: Number, required: false},
    totalSaves: { type: Number, required: false},
  },

  friends: {
    status: { type: String, required: false},  //active, pending, blocked
    _id: { type: String, required: false}, //_id of friend
  },

  createdOn: {
    required: true,
    type: Date
  },
  updatedOn: {
    required: true,
    type: Date,
    default: Date.now
  }

});

schema.methods.encryptPassword = (password: string) => hashSync(password, genSaltSync(10));

schema.methods.validPassword = function (password: string) {
  return compareSync(password, this.password);
};

export const User: IUserModel = model<IUser, IUserModel>('User', schema);
