import express, { Request, Response } from 'express';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

// GET /api/notification
// Returns all notifications for the authenticated user
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(404).json({ error: 'Missing user data' });
    }
    // Find the Mongo _id for this Firebase user
    const user = await User.findOne({ firebase_id: req.user.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch notifications, most recent first
    const notifications = await Notification.find({ to: user._id })
      .sort({ created_on: -1 })
      .populate({
        path: 'from',
        select: 'username profile_picture',
        model: 'User',
      })
      .populate({
        path: 'data.groupId',
        select: 'name main_image',
        model: 'Group',
      })
      .lean();
    return res.status(200).json({ notifications });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

//PATCH /api/notification/:id/read
//Mark a notification as read (if it isn’t already) and decrement the user's unreadNotifications count.

router.patch('/:id/read', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    if (!req.user) {
      return res.status(404).json({ error: 'Missing user data' });
    }
    // 1) Lookup the Mongo user document by Firebase UID
    const user = await User.findOne({ firebase_id: req.user.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2) Fetch the notification
    const note = await Notification.findById(id);
    if (!note) {
      return res.status(405).json({ error: 'Notification not found' });
    }

    // 3) Ensure this notification actually belongs to the user
    if (!note.to === user._id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 4) If it was unread, mark it read and decrement the counter
    if (!note.read) {
      note.read = true;
      await note.save();

      // Only decrement if unreadNotifications > 0
      await User.updateOne({ _id: user._id, unreadNotifications: { $gt: 0 } }, { $inc: { unreadNotifications: -1 } });
    }

    // 5) Return the updated notification
    return res.status(200).json(note);
  } catch (err) {
    console.error('Error marking notification read:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// — PATCH /api/notification/read-all
// Mark *all* of this user’s unread notifications as read, reset counter to zero
router.patch('/read-all', authenticate, async (_req: Request, res: Response) => {
  try {
    if (!_req.user) {
      return res.status(404).json({ error: 'Missing user data' });
    }
    const firebaseUid = _req.user.uid;
    const user = await User.findOne({ firebase_id: firebaseUid });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // mark all unread as read
    await Notification.updateMany({ to: user._id, read: false }, { $set: { read: true } });
    // reset unread count
    await User.updateOne({ _id: user._id }, { $set: { unreadNotifications: 0 } });

    return res.sendStatus(204);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// — DELETE /api/notification/:id
// Delete one notification; if it was unread, decrement counter
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(404).json({ error: 'Missing user data' });
    }
    const firebaseUid = req.user.uid;
    const user = await User.findOne({ firebase_id: firebaseUid });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const note = await Notification.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Notification not found' });
    if (!note.to === user._id) return res.status(403).json({ error: 'Forbidden' });

    // if unread, decrement counter
    if (!note.read) {
      await User.updateOne({ _id: user._id, unreadNotifications: { $gt: 0 } }, { $inc: { unreadNotifications: -1 } });
    }

    await note.deleteOne();
    return res.sendStatus(204);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// — DELETE /api/notification/
// Clear *all* notifications for this user and reset counter
router.delete('/', authenticate, async (_req: Request, res: Response) => {
  try {
    if (!_req.user) {
      return res.status(404).json({ error: 'Missing user data' });
    }
    const firebaseUid = _req.user.uid;
    const user = await User.findOne({ firebase_id: firebaseUid });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // delete all notifications
    await Notification.deleteMany({ to: user._id });
    // reset unread count
    await User.updateOne({ _id: user._id }, { $set: { unreadNotifications: 0 } });

    return res.sendStatus(204);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
