import mongoose, { Document, Model, Schema, model } from 'mongoose';

export interface IImageModel {
  url: string;
  image_id: string;
  type: 'image' | 'video';
  video_sceenshot_url?: string;
}

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
}

export const ImageModalSchema = new Schema<IImageModel>(
  {
    url: { type: String },
    image_id: { type: String },
    type: { type: String, enum: ['image', 'video'] },
    video_sceenshot_url: { type: String },
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
    main_image: ImageModalSchema,
    tags: [{ type: String, index: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const Trip: ITripModel = model<ITrip, ITripModel>('Trip', tripSchema);
