import express, { Request, Response } from 'express';
import { User } from '../models/User';
import { authenticate } from '../middlewares/authenticate';
import mongoose from 'mongoose';
import { Group } from '../models/Group';

const router = express.Router();

// GET /api/chatrooms
// Returns an array of your chat partners' Mongo IDs and profile info.
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
    const groups = await User.find({ _id: { $in: me.chatrooms_groups } }, '_id name main_image members');

    // 3) Return them
    return res.json({ chatrooms_with: partners, chatrooms_groups: groups });
  } catch (err) {
    console.error('Error fetching chatrooms:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/chat/:partnerId
// Add a partner's Mongo _id to your chatrooms_with array.
router.post('/user/:partnerId', authenticate, async (req: Request, res: Response) => {
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
    const partners = await User.find({ _id: { $in: me?.chatrooms_with } }, '_id username profile_picture first_name last_name firebase_id');

    return res.json({ chatrooms_with: partners });
  } catch (err) {
    console.error('Error adding chatroom:', err);
    return res.status(500).json({ error: 'Could not add chatroom' });
  }
});

// DELETE /api/chat/:partnerId
// Remove a partner's Mongo _id from your chatrooms_with array.
router.delete('/user/:partnerId', authenticate, async (req: Request, res: Response) => {
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

    return res.json({ chatrooms_with: partners });
  } catch (err) {
    console.error('Error removing chatroom:', err);
    return res.status(500).json({ error: 'Could not remove chatroom' });
  }
});

// POST /api/chat/group/:groupId
// Join/join back a group chat
router.post('/group/:groupId', authenticate, async (req: Request, res: Response) => {
  if (!req.user) return res.status(404).json({ error: 'Missing user data' });
  const meUid = req.user.uid;
  const groupId = req.params.groupId;

  if (!mongoose.isValidObjectId(groupId)) {
    return res.status(400).json({ error: 'Invalid groupId' });
  }

  try {
    // ensure group exists
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // add to your chatrooms_groups
    await User.updateOne({ firebase_id: meUid }, { $addToSet: { chatrooms_groups: groupId } });

    // return updated list of groups
    const me = await User.findOne({ firebase_id: meUid }, 'chatrooms_groups');
    const groups = await Group.find({ _id: { $in: me?.chatrooms_groups } }, '_id name main_image members');

    return res.json({ chatrooms_groups: groups });
  } catch (err) {
    console.error('Error adding group chatroom:', err);
    return res.status(500).json({ error: 'Could not add group chatroom' });
  }
});

// DELETE /api/chat/group/:groupId
// Leave a group chat
router.delete('/group/:groupId', authenticate, async (req: Request, res: Response) => {
  if (!req.user) return res.status(404).json({ error: 'Missing user data' });
  const meUid = req.user.uid;
  const groupId = req.params.groupId;

  try {
    // pull out of your chatrooms_groups
    await User.updateOne({ firebase_id: meUid }, { $pull: { chatrooms_groups: groupId } });

    // return updated list of groups
    const me = await User.findOne({ firebase_id: meUid }, 'chatrooms_groups');
    const groups = await Group.find({ _id: { $in: me?.chatrooms_groups } }, '_id name main_image members');

    return res.json({ chatrooms_groups: groups });
  } catch (err) {
    console.error('Error removing group chatroom:', err);
    return res.status(500).json({ error: 'Could not remove group chatroom' });
  }
});

// POST /api/chat/mute/:roomId
router.post('/mute/:roomId', authenticate, async (req: Request, res: Response) => {
  if (!req.user) return res.status(404).json({ error: 'Missing user data' });
  const meUid = req.user.uid;
  const roomId = req.params.roomId;

  try {
    await User.updateOne({ firebase_id: meUid }, { $addToSet: { muted_chats: roomId } });
    return res.json({ message: 'Chat muted successfully' });
  } catch (err) {
    console.error('Error muting chat:', err);
    return res.status(500).json({ error: 'Could not mute chat' });
  }
});

// DELETE /api/chat/mute/:roomId
router.delete('/mute/:roomId', authenticate, async (req: Request, res: Response) => {
  if (!req.user) return res.status(404).json({ error: 'Missing user data' });
  const meUid = req.user.uid;
  const roomId = req.params.roomId;

  try {
    await User.updateOne({ firebase_id: meUid }, { $pull: { muted_chats: roomId } });
    return res.json({ message: 'Chat unmuted successfully' });
  } catch (err) {
    console.error('Error unmuting chat:', err);
    return res.status(500).json({ error: 'Could not unmute chat' });
  }
});

router.get('/push-tokens', authenticate, async (req: Request, res: Response) => {
  try {
    const { ids, roomId } = req.query;
    if (!ids || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'Missing `ids` or `roomId`' });
    }

    // Normalize idsParam to a string
    const idsString = Array.isArray(ids) ? ids.join(',') : String(ids);
    const userIds = idsString
      .split(',')
      .map((s) => s.trim())
      .filter((id) => mongoose.isValidObjectId(id));

    if (userIds.length === 0) {
      return res.status(400).json({ error: 'No valid user IDs provided' });
    }

    // Fetch each user’s pushTokens and muted_chats
    const users = await User.find({ _id: { $in: userIds } }, { pushTokens: 1, muted_chats: 1 }).lean();

    // Flatten and dedupe tokens, skipping users who muted this room
    const tokensSet = new Set<string>();
    for (const user of users) {
      if (Array.isArray(user.pushTokens) && !Array.isArray(user.muted_chats) ? true : !user.muted_chats.includes(roomId)) {
        user.pushTokens.forEach((t) => tokensSet.add(t));
      }
    }

    return res.json({ tokens: Array.from(tokensSet) });
  } catch (err) {
    console.error('Error in GET /push-tokens:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
