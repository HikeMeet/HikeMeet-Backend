import mongoose, { Document, Model, Schema, model } from 'mongoose';
import { IImageModel, ImageModalSchema, ITripRating, TripRatingSchema } from './Trip';

export interface IArchivedTrip extends Document {
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

type IArchivedTripModel = Model<IArchivedTrip>;

const archivedTripSchema = new Schema(
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

export const ArchivedTrip: IArchivedTripModel = model<IArchivedTrip, IArchivedTripModel>('ArchivedTrip', archivedTripSchema);
