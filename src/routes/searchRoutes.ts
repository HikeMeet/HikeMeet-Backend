import express, { Request, Response } from 'express';
import { User } from '../models/User';

const router = express.Router();

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

export default router;
