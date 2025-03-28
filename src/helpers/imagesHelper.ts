import { Document, Model } from 'mongoose';
import { streamUploadImage, uploadMultipleImages } from './cloudinaryHelper';

/**
 * Generic function to upload and update the main image for any document.
 * @param model - The Mongoose model (e.g., User or Trip).
 * @param id - The document's ID to update.
 * @param fileBuffer - The image file buffer.
 * @param uploadFn - A function that uploads the image. It should accept (buffer, folder, options) and return a promise resolving with an object containing secure_url and public_id.
 * @param removeFn - A function that removes an image from Cloudinary.
 * @param defaultImageID - The default image ID (so that if the old image matches, it isn’t removed).
 * @param updateDateField - The field to update with the current date (e.g., "updatedAt" or "updated_on").
 * @param folderName - The folder name to pass to the upload function.
 * @param options - Optional additional options for the upload.
 * @returns The updated document.
 */
export async function uploadProfilePictureGeneric<T extends Document>(
  model: Model<T>,
  id: string,
  fileBuffer: Buffer,
  removeFn: (imageId: string, defaultImageID?: string) => Promise<void>,
  defaultImageID: string,
  updateDateField: string,
  imageField: string,
  folderName: string,
  options: Record<string, any> = {},
): Promise<T> {
  const doc = await model.findById(id);
  if (!doc) {
    throw new Error('Document not found');
  }
  // Cast to any to allow dynamic property assignment.
  const docAny = doc as any;
  const oldImageId = docAny[imageField]?.image_id;

  // Call the generic upload function with the provided folder and options.
  const result = await streamUploadImage(fileBuffer, folderName, options);
  if (!result.secure_url || !result.public_id) {
    throw new Error('Failed to upload image');
  }
  // Update the main image field.
  docAny[imageField] = {
    url: result.secure_url,
    image_id: result.public_id,
  };
  // Update the timestamp field.
  docAny[updateDateField] = new Date();

  await doc.save();

  // Remove old image if it exists and is not the default.
  if (oldImageId && oldImageId !== defaultImageID) {
    await removeFn(oldImageId, defaultImageID);
  }
  return doc;
}

export async function uploadImagesGeneric<T extends Document>(
  model: Model<T>,
  id: string,
  fileBuffers: Buffer[],
  maxAllowed: number,
  imageField: string,
  folderName: string,
  options: Record<string, any> = {},
): Promise<T> {
  const doc = await model.findById(id);
  if (!doc) {
    throw new Error('Document not found');
  }
  // Allow dynamic access to the image field.
  const docAny = doc as any;
  const existingImages: any[] = docAny[imageField] || [];

  // Check if adding these images exceeds the allowed count.
  if (existingImages.length + fileBuffers.length > maxAllowed) {
    throw new Error(`Cannot upload more than ${maxAllowed} images`);
  }

  // Upload all images using the generic multiple upload function.
  const uploadResults = await uploadMultipleImages(fileBuffers, folderName, options);

  // Map upload results to image objects.
  const newImages = uploadResults.map((result) => ({
    url: result.secure_url,
    image_id: result.public_id,
  }));

  // Append the new images to the existing images array.
  docAny[imageField] = [...existingImages, ...newImages];
  await doc.save();
  return doc;
}
