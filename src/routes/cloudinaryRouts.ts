import express, { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';

const router = express.Router();

router.get('/cloudinary-signature', (req: Request, res: Response) => {
  const folder = req.query.folder || 'default_folder';
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = { timestamp, folder, return_delete_token: 'true' };
  try {
    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET!);
    console.log(':::::: ', signature);
    res.json({
      signature,
      timestamp,
      api_key: process.env.CLOUDINARY_API_KEY,
      folder,
    });
  } catch (error) {
    console.error('Error generating signature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
export default router;
