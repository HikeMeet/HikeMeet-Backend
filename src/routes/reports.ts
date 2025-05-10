import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Report } from '../models/Report';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

// POST /api/report - Submit a new report
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUid = req.user?.uid;
    const { targetId, targetType, reason } = req.body;

    if (!firebaseUid) {
      return res.status(401).json({ error: 'Unauthorized - no UID' });
    }

    const reporter = await User.findOne({ firebase_id: firebaseUid });
    if (!reporter) {
      return res.status(404).json({ error: 'Reporter not found' });
    }

    if (!targetId || !targetType || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newReport = await Report.create({
      reporter: reporter._id,
      targetId: new mongoose.Types.ObjectId(targetId),
      targetType,
      reason,
      status: 'pending',
    });

    // Notify all admins via Notification collection
    const admins = await User.find({ role: 'admin' });

    for (const admin of admins) {
      await Notification.create({
        to: admin._id,
        from: reporter._id,
        type: 'report_submitted',
        title: '🚨 New Report Submitted',
        body: `A ${targetType} has been reported and requires your attention.`,
        data: {
          reportId: newReport._id,
          targetId,
          targetType,
        },
      });

      // Increment their unread notification counter
      await User.updateOne({ _id: admin._id }, { $inc: { unreadNotifications: 1 } });
    }

    return res.status(201).json({ message: 'Report submitted successfully', report: newReport });
  } catch (error) {
    console.error('Error submitting report:', error);
    return res.status(500).json({ error: 'Failed to submit report' });
  }
});

// GET /api/report - Admins fetch all reports
router.get('/all', authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUid = req.user?.uid;

    const currentUser = await User.findOne({ firebase_id: firebaseUid });

    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const reports = await Report.find().populate('reporter', 'username profile_picture').sort({ createdAt: -1 });

    res.status(200).json({ reports });
  } catch (error) {
    console.error('❌ Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// PATCH /api/report/:id - Admin updates report status
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUid = req.user?.uid;
    const currentUser = await User.findOne({ firebase_id: firebaseUid });
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const updatedReport = await Report.findByIdAndUpdate(id, { status }, { new: true });

    if (!updatedReport) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.status(200).json({ message: 'Report status updated', report: updatedReport });
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

export default router;
