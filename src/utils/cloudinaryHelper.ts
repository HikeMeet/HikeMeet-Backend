// cloudinaryService.ts
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Set up Multer to store files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper function to upload a file buffer to Cloudinary
const streamUploadProfileImage = (buffer: Buffer): Promise<any> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'profile_images' }, (error: any, result: any) => {
      if (result) resolve(result);
      else reject(error);
    });
    stream.end(buffer);
  });
};

// Function to upload a single file buffer to Cloudinary (trip_images folder)
const streamUploadTripImage = (buffer: Buffer): Promise<any> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'trip_images' }, (error: any, result: any) => {
      if (result) resolve(result);
      else reject(error);
    });
    stream.end(buffer);
  });
};

// Function to upload a list of file buffers
const uploadMultipleTripImages = async (buffers: Buffer[]): Promise<any[]> => {
  try {
    // Map each buffer to its upload promise
    const uploadPromises = buffers.map((buffer) => streamUploadTripImage(buffer));
    // Wait for all uploads to finish
    const results = await Promise.all(uploadPromises);
    return results;
  } catch (error) {
    throw error;
  }
};

// Default image constants
const DEFAULT_PROFILE_IMAGE_ID = 'profile_images/tpyngwygeoykeur0hgre';
const DEFAULT_PROFILE_IMAGE_URL = 'https://res.cloudinary.com/dyebkjnoc/image/upload/v1742156351/profile_images/tpyngwygeoykeur0hgre.jpg';
const DEFAULT_TRIP_IMAGE_ID = 'trip_images/pxn2u29twifmjcjq7whv';
const DEFAULT_TRIP_IMAGE_URL = 'https://res.cloudinary.com/dyebkjnoc/image/upload/v1742664563/trip_images/pxn2u29twifmjcjq7whv.png';

async function removeOldImage(oldImageId: string | undefined, defaultImageId: string): Promise<void> {
  if (oldImageId && oldImageId !== defaultImageId) {
    const deletionResult: any = await cloudinary.uploader.destroy(oldImageId);
    if (deletionResult.result !== 'ok') {
      console.error('Failed to delete old image from Cloudinary:', deletionResult);
    }
  }
}
export {
  upload,
  streamUploadTripImage,
  uploadMultipleTripImages,
  streamUploadProfileImage,
  DEFAULT_PROFILE_IMAGE_ID,
  DEFAULT_PROFILE_IMAGE_URL,
  DEFAULT_TRIP_IMAGE_URL,
  DEFAULT_TRIP_IMAGE_ID,
  cloudinary,
  removeOldImage,
};
