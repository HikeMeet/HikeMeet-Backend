import express, { Request, Response } from 'express';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { Group } from '../models/Group';
import mongoose from 'mongoose';

const router = express.Router();

// Search Users
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { query, userId } = req.query;

    // If query is provided, build the search criteria; otherwise, return all users.
    const searchCriteria =
      query && typeof query === 'string'
        ? {
            $or: [
              { username: { $regex: query, $options: 'i' } },
              { first_name: { $regex: query, $options: 'i' } },
              { last_name: { $regex: query, $options: 'i' } },
            ],
          }
        : {};

    let blockedUserIds: string[] = [];

    if (userId) {
      const currentUser = await User.findById(userId);
      if (currentUser) {
        const blockedByMe = currentUser.friends.filter((f) => f.status === 'blocked').map((f) => f.id.toString());

        const blockedMeDocs = await User.find({
          friends: {
            $elemMatch: {
              id: new mongoose.Types.ObjectId(userId as string),
              status: 'blocked',
            },
          },
        }).select('_id');

        const blockedMe = blockedMeDocs.map((doc) => String(doc._id));

        blockedUserIds = [...new Set([...blockedByMe, ...blockedMe])];

        Object.assign(searchCriteria, { _id: { $nin: blockedUserIds } });
      }
    }

    const users = await User.find(searchCriteria);

    // Return an empty array if no users are found.
    res.status(200).json({ friends: users });
  } catch (error) {
    console.error('Error searching for friends:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Search Trips
router.get('/trips', async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    const searchCriteria = query && typeof query === 'string' ? { name: { $regex: query, $options: 'i' } } : {};

    const trips = await Trip.find(searchCriteria);
    res.status(200).json({ trips });
  } catch (error) {
    console.error('Error searching trips:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Search Groups
router.get('/groups', async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    const searchCriteria = query && typeof query === 'string' ? { name: { $regex: query, $options: 'i' } } : {};

    const groups = await Group.find(searchCriteria);
    res.status(200).json({ groups });
  } catch (error) {
    console.error('Error searching groups:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/all', async (req: Request, res: Response) => {
  try {
    const { query, userId } = req.query;

    const userCriteria =
      query && typeof query === 'string'
        ? {
            $or: [
              { username: { $regex: query, $options: 'i' } },
              { first_name: { $regex: query, $options: 'i' } },
              { last_name: { $regex: query, $options: 'i' } },
            ],
          }
        : {};

    // Add blocked users filter if userId is provided
    if (userId) {
      const currentUser = await User.findById(userId);
      if (currentUser) {
        const blockedByMe = currentUser.friends.filter((f) => f.status === 'blocked').map((f) => f.id.toString());

        const blockedMeDocs = await User.find({
          friends: {
            $elemMatch: {
              id: new mongoose.Types.ObjectId(userId as string),
              status: 'blocked',
            },
          },
        }).select('_id');

        const blockedMe = blockedMeDocs.map((doc) => String(doc._id));
        const blockedUserIds = [...new Set([...blockedByMe, ...blockedMe])];

        Object.assign(userCriteria, { _id: { $nin: blockedUserIds } });
      }
    }

    const tripCriteria = query && typeof query === 'string' ? { name: { $regex: query, $options: 'i' } } : {};

    const groupCriteria = query && typeof query === 'string' ? { name: { $regex: query, $options: 'i' } } : {};

    const [users, trips, groups] = await Promise.all([User.find(userCriteria), Trip.find(tripCriteria), Group.find(groupCriteria)]);

    res.status(200).json({
      friends: users,
      trips,
      groups,
    });
  } catch (error) {
    console.error('Error searching everything:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
