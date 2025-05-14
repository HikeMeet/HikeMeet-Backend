import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Report } from '../models/Report';
import { User } from '../models/User';
import { authenticate } from '../middlewares/authenticate';
import { notifyReportCreated } from '../helpers/notifications';

const router = express.Router();

//POST /api/report     the user send report
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUid = req.user?.uid;
    const { targetId, targetType, reason } = req.body;

    if (!firebaseUid) return res.status(401).json({ error: 'Unauthorized - no UID' });

    const reporter = await User.findOne({ firebase_id: firebaseUid });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    if (!targetId || !targetType || !reason) return res.status(400).json({ error: 'Missing required fields' });

    const newReport = await Report.create({
      reporter: reporter._id,
      targetId: new mongoose.Types.ObjectId(targetId),
      targetType,
      reason,
      status: 'pending',
    });

    notifyReportCreated(reporter._id as mongoose.Types.ObjectId, targetType);

    return res.status(201).json({ message: 'Report submitted successfully', report: newReport });
  } catch (error) {
    console.error('Error submitting report:', error);
    return res.status(500).json({ error: 'Failed to submit report' });
  }
});

// GET /api/report/all
router.get('/all', authenticate, async (_req: Request, res: Response) => {
  try {
    const reports = await Report.aggregate([
      { $sort: { createdAt: -1 } },

      // the reporter
      {
        $lookup: {
          from: 'users',
          localField: 'reporter',
          foreignField: '_id',
          pipeline: [{ $project: { username: 1, profile_picture: 1 } }],
          as: 'reporter',
        },
      },
      { $unwind: '$reporter' },

      // user
      {
        $lookup: {
          from: 'users',
          localField: 'targetId',
          foreignField: '_id',
          pipeline: [{ $project: { username: 1 } }],
          as: 'targetUser',
        },
      },

      //post
      {
        $lookup: {
          from: 'posts',
          localField: 'targetId',
          foreignField: '_id',
          pipeline: [
            /* owner (to display “Post owner”) */
            {
              $lookup: {
                from: 'users',
                localField: 'author',
                foreignField: '_id',
                pipeline: [{ $project: { username: 1 } }],
                as: 'owner',
              },
            },
            { $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } },

            /*  preview: first ~40 chars of content  |  fallback text   */
            {
              $project: {
                preview: {
                  $cond: [
                    { $gt: [{ $strLenCP: '$content' }, 0] },
                    { $substrCP: ['$content', 0, 40] }, // first 40 chars
                    'Post without text',
                  ],
                },
                ownerName: '$owner.username',
              },
            },
          ],
          as: 'targetPost',
        },
      },

      //trip
      {
        $lookup: {
          from: 'trips',
          localField: 'targetId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }],
          as: 'targetTrip',
        },
      },

      // choose targetName and targetOwner
      {
        $addFields: {
          targetName: {
            $switch: {
              branches: [
                {
                  case: { $eq: ['$targetType', 'user'] },
                  then: { $arrayElemAt: ['$targetUser.username', 0] },
                },
                {
                  case: { $eq: ['$targetType', 'post'] },
                  then: { $arrayElemAt: ['$targetPost.preview', 0] },
                },
                {
                  case: { $eq: ['$targetType', 'trip'] },
                  then: { $arrayElemAt: ['$targetTrip.name', 0] },
                },
              ],
              default: '',
            },
          },
          targetOwner: {
            $cond: [{ $eq: ['$targetType', 'post'] }, { $arrayElemAt: ['$targetPost.ownerName', 0] }, null],
          },
        },
      },

      // send only what we need
      {
        $project: {
          reporter: 1,
          targetId: 1,
          targetType: 1,
          targetName: 1,
          targetOwner: 1,
          reason: 1,
          status: 1,
          createdAt: 1,
        },
      },
    ]).exec();

    return res.json({ reports });
  } catch (err) {
    console.error('❌ Error fetching reports:', err);
    return res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

//PATCH /api/report/resolve-all – Admin:
router.patch('/resolve-all', authenticate, async (req: Request, res: Response) => {
  try {
    const currentUser = await User.findOne({ firebase_id: req.user?.uid });
    if (!currentUser || currentUser.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    await Report.updateMany({}, { status: 'resolved' });
    return res.status(200).json({ message: 'All reports marked as resolved' });
  } catch (err) {
    console.error('Error resolving all:', err);
    return res.status(500).json({ error: 'Bulk resolve failed' });
  }
});

//DELETE /api/report/resolved  – Admin: delete all resolved
router.delete('/resolved', authenticate, async (req: Request, res: Response) => {
  try {
    const currentUser = await User.findOne({ firebase_id: req.user?.uid });
    if (!currentUser || currentUser.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    await Report.deleteMany({ status: 'resolved' });
    return res.status(200).json({ message: 'Resolved reports removed' });
  } catch (err) {
    console.error('Error deleting resolved:', err);
    return res.status(500).json({ error: 'Bulk delete failed' });
  }
});

//PATCH /api/report/:id        – Admin: update status of resolved
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const currentUser = await User.findOne({ firebase_id: req.user?.uid });
    if (!currentUser || currentUser.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'in_progress', 'resolved'].includes(status)) return res.status(400).json({ error: 'Invalid status value' });

    const updated = await Report.findByIdAndUpdate(id, { status }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Report not found' });

    return res.status(200).json({ message: 'Report status updated', report: updated });
  } catch (err) {
    console.error('Error updating report:', err);
    return res.status(500).json({ error: 'Failed to update report' });
  }
});

//DELETE /api/report/:id       – Admin: deleting a single report
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const currentUser = await User.findOne({ firebase_id: req.user?.uid });
    if (!currentUser || currentUser.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const { id } = req.params;
    const deleted = await Report.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Report not found' });

    return res.status(200).json({ message: 'Report deleted' });
  } catch (err) {
    console.error('Error deleting report:', err);
    return res.status(500).json({ error: 'Failed to delete report' });
  }
});

export default router;
