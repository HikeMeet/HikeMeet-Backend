import mongoose, { Document, Model, Schema, model } from 'mongoose';
import { DEFAULT_TRIP_IMAGE_ID, DEFAULT_TRIP_IMAGE_URL, removeOldImage } from '../helpers/cloudinaryHelper';

export interface IImageModel {
  url: string;
  image_id: string;
  type?: 'image' | 'video';
  video_sceenshot_url?: string;
  delete_token?: string;
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
    main_image: ImageModalSchema,
    tags: [{ type: String, index: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

tripSchema.pre('findOneAndDelete', async function (next) {
  const docToDelete = await this.model.findOne(this.getFilter());

  if (!docToDelete) return next();

  // Remove each image in images[]
  if (docToDelete.images && docToDelete.images.length > 0) {
    for (const img of docToDelete.images) {
      const publicId = img.image_id;
      if (publicId) {
        await removeOldImage(publicId);
      }
    }
  }

  // Remove main image
  if (docToDelete.main_image && docToDelete.main_image.image_id) {
    await removeOldImage(docToDelete.main_image.image_id);
  }

  next();
});

tripSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as any;

  // If main_image is not provided or is empty, set default values.
  if (!update.main_image || Object.keys(update.main_image).length === 0) {
    update.main_image = {
      url: DEFAULT_TRIP_IMAGE_URL,
      image_id: DEFAULT_TRIP_IMAGE_ID,
      delete_token: '',
    };
  }

  // Also update the updated_at field.
  update.updated_at = new Date();
  next();
});

export const Trip: ITripModel = model<ITrip, ITripModel>('Trip', tripSchema);
