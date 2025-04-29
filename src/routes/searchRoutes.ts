import express, { Request, Response } from 'express';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { Group } from '../models/Group';
import { Post } from '../models/Post';

const router = express.Router();

// Search Users
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { query } = req.query;

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

    // Find users based on the criteria.
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

//can be used in the future
// Search Posts
router.get('/posts', async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    const searchCriteria = query && typeof query === 'string' ? { content: { $regex: query, $options: 'i' } } : {};

    const posts = await Post.find(searchCriteria);
    res.status(200).json({ posts });
  } catch (error) {
    console.error('Error searching posts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
