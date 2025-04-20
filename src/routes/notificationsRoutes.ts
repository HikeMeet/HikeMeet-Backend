import express, { Request, Response } from 'express';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

// GET /api/notifications
// Returns all notifications for the authenticated user
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    // Find the Mongo _id for this Firebase user
    const user = await User.findOne({ firebase_id: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch notifications, most recent first
    const notifications = await Notification.find({ to: user._id }).sort({ created_on: -1 });

    return res.status(200).json({ notifications });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
