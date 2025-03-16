import mongoose, { Document, Model, Schema, model } from 'mongoose';

export interface ITrip extends Document {
  name: string;
  location: {
    address: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  description?: string;
  images?: string[];
  tags?: string[];
  createdBy: mongoose.Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

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
    images: [{ type: String }],
    tags: [{ type: String }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const Trip: ITripModel = model<ITrip, ITripModel>('Trip', tripSchema);
