// You can place this function in a file like src/utils/cloudinaryHelper.ts
import { v2 as cloudinary } from 'cloudinary';

export async function removeOldImage(oldImageId: string | undefined, defaultImageId: string): Promise<void> {
  if (oldImageId && oldImageId !== defaultImageId) {
    const deletionResult: any = await cloudinary.uploader.destroy(oldImageId);
    if (deletionResult.result !== 'ok') {
      console.error('Failed to delete old image from Cloudinary:', deletionResult);
    }
  }
}
