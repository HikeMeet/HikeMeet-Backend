// cloudinaryService.ts

import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary using environment variables

// Set up Multer to store files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

const streamUploadImage = (buffer: Buffer, folder: string, options: Record<string, any> = {}): Promise<{ secure_url: string; public_id: string }> => {
  return new Promise((resolve, reject) => {
    const uploadOptions = { folder, ...options };
    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error: any, result: any) => {
      if (result) resolve(result);
      else reject(error);
    });
    stream.end(buffer);
  });
};

// Function to upload a list of file buffers
export const uploadMultipleImages = async (
  buffers: Buffer[],
  folder: string,
  options: Record<string, any> = {},
): Promise<{ secure_url: string; public_id: string }[]> => {
  const uploadPromises = buffers.map((buffer) => streamUploadImage(buffer, folder, options));
  return Promise.all(uploadPromises);
};

// Default image constants
const DEFAULT_PROFILE_IMAGE_ID = 'profile_images/tpyngwygeoykeur0hgre';
const DEFAULT_PROFILE_IMAGE_URL = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/v1742156351/profile_images/tpyngwygeoykeur0hgre.jpg`;
const DEFAULT_TRIP_IMAGE_ID = 'trip_images/pxn2u29twifmjcjq7whv';
const DEFAULT_TRIP_IMAGE_URL = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/v1742664563/trip_images/pxn2u29twifmjcjq7whv.png`;
const DEFAULT_GROUP_IMAGE_ID = 'group-defoult_deek7k';
const DEFAULT_GROUP_IMAGE_URL = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/v1745951012/group-defoult_deek7k.jpg`;

async function removeOldImage(oldImageId: string | undefined, defaultImageId?: string): Promise<void> {
  if (oldImageId && oldImageId !== defaultImageId) {
    const deletionResult: any = await cloudinary.uploader.destroy(oldImageId);
    if (deletionResult.result !== 'ok') {
      console.error('Failed to delete old image from Cloudinary:', deletionResult);
    }
  }
}
export {
  upload,
  DEFAULT_PROFILE_IMAGE_ID,
  DEFAULT_PROFILE_IMAGE_URL,
  DEFAULT_TRIP_IMAGE_URL,
  DEFAULT_TRIP_IMAGE_ID,
  DEFAULT_GROUP_IMAGE_ID,
  DEFAULT_GROUP_IMAGE_URL,
  cloudinary,
  removeOldImage,
  streamUploadImage,
};
