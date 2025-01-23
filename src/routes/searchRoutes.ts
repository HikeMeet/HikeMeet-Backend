import express, { Request, Response } from 'express';
import { User } from '../models/User';

const router = express.Router();

//  GET /api/search/friends
router.get('/friends', async (req: Request, res: Response) => {
  try {
    const { query } = req.query;

    let searchCriteria = {};

    if (query && typeof query === 'string') {
      searchCriteria = {
        $or: [
          { username: { $regex: query, $options: 'i' } },
          { first_name: { $regex: query, $options: 'i' } },
          { last_name: { $regex: query, $options: 'i' } },
        ],
      };
    }
    const users = await User.find(searchCriteria);

    res.status(200).json({ friends: users });
  } catch (error) {
    console.error('Error searching for friends:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
