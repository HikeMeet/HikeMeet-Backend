import express, { Request, Response } from 'express';
import { User } from '../models/User';
import { authenticate } from '../middlewares/authenticate';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * GET /api/chatrooms
 * Returns an array of your chat partners' Mongo IDs and profile info.
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(404).json({ error: 'Missing user data' });
    }
    // 1) Find the logged-in user by their firebase_id
    const me = await User.findOne({ firebase_id: req.user.uid }, 'chatrooms_with');
    if (!me) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2) Fetch those partner documents, selecting only the needed fields
    const partners = await User.find({ _id: { $in: me.chatrooms_with } }, '_id username profile_picture first_name last_name firebase_id');

    // 3) Return them
    return res.json({ chatroomsWith: partners });
  } catch (err) {
    console.error('Error fetching chatrooms:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/chatrooms/:partnerId
 * Add a partner's Mongo _id to your chatrooms_with array.
 */
router.post('/:partnerId', authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(404).json({ error: 'Missing user data' });
  }
  const meFirebaseUid = req.user.uid;
  const partnerId = req.params.partnerId;

  if (!mongoose.isValidObjectId(partnerId)) {
    return res.status(400).json({ error: 'Invalid partner ID' });
  }

  try {
    // 1) Add partnerId to *your* chatrooms_with
    await User.updateOne({ firebase_id: meFirebaseUid }, { $addToSet: { chatrooms_with: partnerId } });

    // 2) Look up *your* Mongo _id
    const meDoc = await User.findOne({ firebase_id: meFirebaseUid }, '_id').lean();
    if (!meDoc) {
      return res.status(404).json({ error: 'Current user not found' });
    }

    // 3) Add your Mongo _id to partner's chatrooms_with
    await User.updateOne({ _id: partnerId }, { $addToSet: { chatrooms_with: meDoc._id } });

    // 4) Return the populated list
    const me = await User.findOne({ firebase_id: meFirebaseUid }, 'chatrooms_with');
    const partners = await User.find({ _id: { $in: me!.chatrooms_with } }, '_id username profile_picture first_name last_name firebase_id');

    return res.json({ chatroomsWith: partners });
  } catch (err) {
    console.error('Error adding chatroom:', err);
    return res.status(500).json({ error: 'Could not add chatroom' });
  }
});

/**
 * DELETE /api/chatrooms/:partnerId
 * Remove a partner's Mongo _id from your chatrooms_with array.
 */
router.delete('/:partnerId', authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(404).json({ error: 'Missing user data' });
  }
  const meUid = req.user.uid;
  const partnerId = req.params.partnerId;

  if (!mongoose.isValidObjectId(partnerId)) {
    return res.status(400).json({ error: 'Invalid partner ID' });
  }

  try {
    // Remove the partner's ID just from your document
    await User.updateOne({ firebase_id: meUid }, { $pull: { chatrooms_with: partnerId } });

    // Return your updated partner list
    const me = await User.findOne({ firebase_id: meUid }, 'chatrooms_with');
    const partners = await User.find({ _id: { $in: me?.chatrooms_with } }, '_id username profile_picture first_name last_name firebase_id');

    return res.json({ chatroomsWith: partners });
  } catch (err) {
    console.error('Error removing chatroom:', err);
    return res.status(500).json({ error: 'Could not remove chatroom' });
  }
});

export default router;
