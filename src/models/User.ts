import { hashSync, genSaltSync, compareSync } from 'bcrypt';
import mongoose, { Document, Model, Schema, model } from 'mongoose';

export interface IUser extends Document {
  username: string; // Added username
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  createdOn: Date;
  updatedOn: Date;
  encryptPassword: (password: string) => string;
  validPassword: (password: string) => boolean;
}

interface IUserModel extends Model<IUser> {}

const schema = new Schema({
  username: { type: String, required: true, unique: true }, // Added username field
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: false },
  lastName: { type: String, required: false },
  gender: { type: String, required: false },
  birthDate: { type: Date, required: false },
  profilePicture: { type: String, required: false },
  bio: { type: String, required: false },
  facebookLink: { type: String, required: false },
  instagramLink: { type: String, required: false },
  role: { type: String, required: true, enum: ['user', 'admin'], default: 'user' },
  social: {
    postsSaved: { type: [mongoose.Schema.Types.ObjectId], required: false },
    postsLiked: { type: [mongoose.Schema.Types.ObjectId], required: false },
    totalLikes: { type: Number, required: false },
    totalShare: { type: Number, required: false },
    totalSaves: { type: Number, required: false },
  },
  friends: {
    status: { type: String, required: false },
    _id: { type: String, required: false },
  },
  createdOn: { required: true, type: Date },
  updatedOn: { required: true, type: Date, default: Date.now },
});

schema.methods.encryptPassword = (password: string) => hashSync(password, genSaltSync(10));

schema.methods.validPassword = function (password: string) {
  return compareSync(password, this.password);
};

export const User: IUserModel = model<IUser, IUserModel>('User', schema);
