import mongoose, { Document, Model, Schema, model } from 'mongoose';
// import { removeOldImage } from '../helpers/cloudinaryHelper';

export interface IImageModel {
  url: string;
  image_id: string;
  type?: 'image' | 'video';
  video_sceenshot_url?: string;
  delete_token?: string;
}

export interface ITripRating {
  /** The user who rated */
  user: string; // user _id
  /** 1–5 */
  value: number;
}
export const TripRatingSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    value: { type: Number, min: 1, max: 5, required: true },
  },
  {
    _id: false,
  },
);

export interface ITrip extends Document {
  name: string;
  location: {
    address: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  description?: string;
  images?: IImageModel[];
  main_image?: IImageModel;
  tags?: string[];
  createdBy: mongoose.Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  /** All user‐submitted ratings on this trip */
  ratings: ITripRating[];
  /** Average of `ratings.value` (0 if none) */
  avg_rating?: number;
}

export const ImageModalSchema = new Schema<IImageModel>(
  {
    url: { type: String },
    image_id: { type: String },
    type: { type: String, enum: ['image', 'video'] },
    video_sceenshot_url: { type: String },
    delete_token: { type: String },
  },
  { _id: false },
);

type ITripModel = Model<ITrip>;

const tripSchema = new Schema(
  {
    name: { type: String, required: true },
    location: {
      address: { type: String, required: true },
      coordinates: {
        type: [Number],
        required: true,
        index: '2dsphere', // Allows geospatial queries
      },
    },
    description: { type: String },
    images: [ImageModalSchema],
    ratings: [TripRatingSchema],
    avg_rating: { type: Number, default: 0.0, min: 0.0, max: 5.0 },
    main_image: ImageModalSchema,
    tags: [{ type: String, index: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// tripSchema.pre('findOneAndDelete', async function (next) {
//   const docToDelete = await this.model.findOne(this.getFilter());

//   if (!docToDelete) return next();

//   // Remove each image in images[]
//   if (docToDelete.images && docToDelete.images.length > 0) {
//     for (const img of docToDelete.images) {
//       const publicId = img.image_id;
//       if (publicId) {
//         await removeOldImage(publicId);
//       }
//     }
//   }

//   // Remove main image
//   if (docToDelete.main_image && docToDelete.main_image.image_id) {
//     await removeOldImage(docToDelete.main_image.image_id);
//   }

//   next();
// });

export const Trip: ITripModel = model<ITrip, ITripModel>('Trip', tripSchema);
