import mongoose, { Document, Model, Schema, model } from 'mongoose';
import { IImageModel, ImageModalSchema } from './Trip';

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
    main_image: ImageModalSchema,
    tags: [{ type: String }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const ArchivedTrip: IArchivedTripModel = model<IArchivedTrip, IArchivedTripModel>('ArchivedTrip', archivedTripSchema);
