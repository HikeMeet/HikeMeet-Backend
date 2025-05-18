import express, { Request, Response } from 'express';
import { User } from '../models/User';

const router = express.Router();

// PUT /api/privacy/update-privacy
router.put('/update-privacy', async (req: Request, res: Response) => {
  try {
    const { userId, postVisibility } = req.body;

    if (!userId || !postVisibility) {
      return res.status(400).json({ error: 'Missing userId or postVisibility' });
    }

    if (!['public', 'private'].includes(postVisibility)) {
      return res.status(400).json({ error: 'Invalid postVisibility value' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'privacySettings.postVisibility': postVisibility,
          updated_on: new Date(),
        },
      },
      { new: true },
    ).select('privacySettings');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      message: 'Post visibility updated successfully',
      privacySettings: updatedUser.privacySettings,
    });
  } catch (error) {
    console.error('Error updating post visibility:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
