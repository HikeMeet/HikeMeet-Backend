import mongoose, { Document, Schema, Model, model } from 'mongoose';
import { IImageModel, ImageModalSchema } from './Trip';
import { removeOldImage } from '../helpers/cloudinaryHelper';

export interface IComment {
  user: mongoose.Schema.Types.ObjectId;
  text: string;
  created_at: Date;
  liked_by?: mongoose.Schema.Types.ObjectId[];
}

export interface IPost extends Document {
  author: mongoose.Schema.Types.ObjectId;
  in_group?: mongoose.Schema.Types.ObjectId;
  content?: string;
  images?: IImageModel[];
  attached_trips?: mongoose.Schema.Types.ObjectId[];
  attached_groups?: mongoose.Schema.Types.ObjectId[];
  likes: mongoose.Schema.Types.ObjectId[];
  shares: mongoose.Schema.Types.ObjectId[];
  saves: mongoose.Schema.Types.ObjectId[];
  comments: IComment[];
  is_shared: boolean;
  original_post?: mongoose.Schema.Types.ObjectId;
  type: 'regular' | 'share_trip' | 'share_group';
  privacy: 'public' | 'private';
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
    in_group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    content: { type: String },
    images: [ImageModalSchema],
    attached_trips: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: [] }],
    attached_groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: [] }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
    shares: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
    saves: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
    comments: [commentSchema],
    is_shared: { type: Boolean, default: false },
    privacy: { type: String, enum: ['public', 'private'], default: 'public' },
    original_post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    type: { type: String, enum: ['regular', 'share_group', 'share_trip'], default: 'regular' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

postSchema.pre('findOneAndDelete', async function (next) {
  const docToDelete = await this.model.findOne(this.getFilter());

  if (!docToDelete || !docToDelete.images || docToDelete.images.length === 0) {
    return next();
  }

  for (const img of docToDelete.images) {
    // Assuming Cloudinary public_id is stored in `img.image_id`
    const publicId = img.image_id;
    if (publicId) {
      await removeOldImage(publicId);
    }
  }

  next();
});

export const Post: Model<IPost> = model<IPost>('Post', postSchema);
