import mongoose, { Document, Schema, Model, model } from 'mongoose';
import { IImageModel, ImageModalSchema } from './Trip';
import { removeOldImage } from '../helpers/cloudinaryHelper';
import { Notification } from './Notification';
import { User } from './User';

export interface IComment {
  _id?: mongoose.Types.ObjectId; // ← add this
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

  if (!docToDelete) {
    return next();
  }

  // Remove each image in images[]
  if (docToDelete.images && docToDelete.images.length > 0) {
    for (const img of docToDelete.images) {
      const publicId = img.image_id;
      if (publicId) {
        await removeOldImage(publicId);
      }
    }
  }

  const postIdStr = docToDelete._id.toString();
  const orFilter = [
    { type: 'post_like', 'data.postId': postIdStr },
    { type: 'post_comment', 'data.postId': postIdStr },
    { type: 'comment_like', 'data.postId': postIdStr },
    { type: 'post_create_in_group', 'data.postId': postIdStr },
  ];

  // first, decrement unread counts for those _unread_ notes
  const notes = await Notification.find({
    $or: orFilter,
    read: false,
  })
    .select('to')
    .lean();

  if (notes.length) {
    notes.map(async (n) => await User.updateMany({ _id: { $in: n.to } }, { $inc: { unreadNotifications: -1 } }));
  }

  // then delete them all (read or unread)
  await Notification.deleteMany({
    $or: orFilter,
  });

  next();
});

postSchema.pre('deleteMany', { document: false, query: true }, async function (next) {
  // 1) get the filter used in deleteMany()
  const filter = this.getFilter();

  // 2) load all posts matching that filter (we need images & IDs)
  const postsToDelete = await this.model.find(filter).select('_id images').lean();

  if (postsToDelete.length) {
    // 3) remove each post's images from Cloudinary
    for (const post of postsToDelete) {
      for (const img of post.images) {
        if (img.image_id) {
          await removeOldImage(img.image_id);
        }
      }
    }

    // 4) build notification filter for all these posts
    const postIds = postsToDelete.map((p) => p._id?.toString());
    const notifFilter = [
      { type: 'post_like', 'data.postId': { $in: postIds } },
      { type: 'post_comment', 'data.postId': { $in: postIds } },
      { type: 'comment_like', 'data.postId': { $in: postIds } },
      { type: 'post_create_in_group', 'data.postId': { $in: postIds } },
    ];

    // 5) find ALL unread notifications for these posts
    const notes = await Notification.find({
      $or: notifFilter,
      read: false,
    })
      .select('to')
      .lean();

    if (notes.length) {
      // 6) tally counts per user
      const countsByUser = notes.reduce<Record<string, number>>((acc, { to }) => {
        const uid = to.toString();
        acc[uid] = (acc[uid] || 0) + 1;
        return acc;
      }, {});

      // 7) bulk-decrement each user's unreadNotifications
      const bulkOps = Object.entries(countsByUser).map(([uid, cnt]) => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(uid) },
          update: { $inc: { unreadNotifications: -cnt } },
        },
      }));
      if (bulkOps.length) {
        await User.bulkWrite(bulkOps);
      }
    }

    // 8) delete all notifications for these posts
    await Notification.deleteMany({ $or: notifFilter });
  }

  next();
});
export const Post: Model<IPost> = model<IPost>('Post', postSchema);
