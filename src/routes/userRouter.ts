import express, { Request, Response } from 'express';
import { User } from '../models/User'; // Import the User model
import mongoose from 'mongoose';
import { DEFAULT_PROFILE_IMAGE_ID, DEFAULT_PROFILE_IMAGE_URL } from '../helpers/cloudinaryHelper';
import { authenticate } from '../middlewares/authenticate';
import { getRankByExp } from '../helpers/expHelper';

const router = express.Router();

// POST /insert route
router.post('/insert', async (req: Request, res: Response) => {
  try {
    console.log('inserting');
    // Extract user data from the request body
    const {
      username,
      email,
      first_name,
      last_name,
      gender,
      birth_date,
      /*profile_picture,*/ bio,
      facebook_link,
      instagram_link,
      role,
      firebase_id,
      pushTokens,
    } = req.body;

    // Validate required fields
    const requiredFields = ['username', 'email', 'first_name', 'last_name', 'firebase_id'];
    const missingFields = requiredFields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      const missingFieldsList = missingFields.join(', ');
      return res.status(400).json({
        error: `Missing required fields: ${missingFieldsList}`,
        missing_fields: missingFields,
      });
    }

    // Check if the user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      const conflictMessages = [];

      // Check if the conflict is due to email
      if (existingUser.email === email) {
        conflictMessages.push('Email already exists.');
      }

      // Check if the conflict is due to username
      if (existingUser.username === username) {
        conflictMessages.push('Username already exists.');
      }

      // Return appropriate message(s)
      return res.status(409).json({
        error: conflictMessages.join(' '), // Combine all conflict messages
      });
    }

    // Create a new user
    const newUser = new User({
      username,
      email,
      first_name,
      last_name,
      gender: gender || '',
      birth_date: birth_date || '',
      profile_picture: {
        url: DEFAULT_PROFILE_IMAGE_URL,
        image_id: DEFAULT_PROFILE_IMAGE_ID,
      },
      bio: bio || '',
      exp: 0,
      rank: getRankByExp(0),
      facebook_link: facebook_link || '',
      instagram_link: instagram_link || '',
      role: role || 'user', // Default to 'user'
      firebase_id,
      social: {
        total_likes: 0,
        total_shares: 0,
        total_saves: 0,
      },
      created_on: new Date(),
      updated_on: new Date(),
      pushTokens: pushTokens || [],
      privacySettings: {
        postVisibility: 'public',
      },
    });

    // Save the user to the database
    await newUser.save();

    // Send a success response
    res.status(200).json({ message: 'User registered successfully', user: newUser });
  } catch (error) {
    console.error('Error inserting user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/user/list-by-ids?ids=id1,id2,id3
router.get('/list-by-ids', async (req: Request, res: Response) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ error: 'No ids provided' });
    }

    // Convert the comma-separated string to an array of strings.
    const idsArray = typeof ids === 'string' ? ids.split(',') : [];

    const users = await User.find({ _id: { $in: idsArray } });
    return res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error });
  }
});

// GET /partial-all - Get all users with partial fields as per the IUser interface
router.get('/partial-all', async (_req: Request, res: Response) => {
  try {
    // Query all users and select only the required fields:
    // _id, username, profile_picture, first_name, and last_name.
    const users = await User.find({}).select('username profile_picture first_name last_name firebase_id');

    // Return the users array as the response
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching partial user data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/user/register-token
// Body: { token: string }
router.post('/register-token', authenticate, async (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };
  try {
    if (!token) {
      return res.status(400).json({ error: 'Missing token in request body' });
    }
    if (!req.user) {
      return res.status(404).json({ error: 'Missing user data' });
    }
    // Add to pushTokens array only if it doesn't already exist
    await User.findOneAndUpdate({ firebase_id: req.user.uid }, { $addToSet: { pushTokens: token } });
    return res.sendStatus(204);
  } catch (err) {
    console.error('Error registering push token:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/user/unregister-token
router.delete('/unregister-token', authenticate, async (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    return res.status(400).json({ error: 'Missing token in request body' });
  }
  try {
    if (!req.user) {
      return res.status(404).json({ error: 'Missing user data' });
    }
    await User.findOneAndUpdate({ firebase_id: req.user.uid }, { $pull: { pushTokens: token } });
    return res.sendStatus(204);
  } catch (err) {
    console.error('Error unregistering push token:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export interface Friend {
  id: string;
  status: string;
  data?: IUser;
}

interface IUser {
  _id: string;
  username: string;
  profile_picture: { url: string; image_id: string };
  first_name?: string;
  last_name?: string;
}
// GET /:mongoId - Get a user by ID or Firebase ID
router.get('/:mongoId', async (req: Request, res: Response) => {
  try {
    const { mongoId } = req.params;
    const firebase = req.query.firebase === 'true'; // Default is false if not provided
    let user;

    // Populate friend user data with only the selected fields
    const populateOptions = [
      {
        path: 'friends.id',
        select: '_id username profile_picture first_name last_name firebase_id',
      },
      {
        path: 'chatrooms_with',
        select: '_id username profile_picture first_name last_name firebase_id',
      },
      {
        path: 'chatrooms_groups',
        select: '_id name main_image members',
      },
    ];

    if (mongoId === 'all') {
      console.log('Get all users');
      user = await User.find({}).populate(populateOptions);
    } else {
      if (firebase) {
        console.log('Get user with firebase id');
        user = await User.findOne({ firebase_id: mongoId }).populate(populateOptions);
      } else {
        console.log('Get user with mongo id');
        user = await User.findById(mongoId).populate(populateOptions);
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If fetching a single user, user is a document. If fetching all users, it's an array.
    let userObj;
    if (Array.isArray(user)) {
      userObj = user.map((doc) => doc.toObject());
    } else {
      userObj = user.toObject();
    }

    // Map friends to match the Friend interface:
    // { id: string, status: string, data?: IUser }
    const mapFriends = (userData: any) => {
      if (userData.friends && Array.isArray(userData.friends)) {
        userData.friends = userData.friends
          .filter((friend: any) => friend.id) // still skip truly broken entries
          .map((friend: any) => {
            const isPopulated = typeof friend.id === 'object' && friend.id._id;

            return {
              id: isPopulated ? friend.id._id.toString() : friend.id.toString?.() || String(friend.id),
              status: friend.status,
              data: isPopulated
                ? {
                    _id: friend.id._id,
                    username: friend.id.username,
                    profile_picture: friend.id.profile_picture,
                    first_name: friend.id.first_name,
                    last_name: friend.id.last_name,
                  }
                : undefined,
            };
          });
      }

      return userData;
    };

    if (Array.isArray(userObj)) {
      userObj = userObj.map(mapFriends);
    } else {
      userObj = mapFriends(userObj);
    }
    res.status(200).json(userObj);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /:id/update - Edit a user by ID
router.post('/:id/update', async (req: Request, res: Response) => {
  try {
    console.log('Update user');

    const userId = req.params.id;
    const updates = req.body; // Updates from the request body
    // Find the user and update
    const populateOptions = {
      path: 'friends.id',
      select: '_id username profile_picture first_name last_name firebase_id',
    };
    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true }).populate(populateOptions).exec();
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// DELETE /:id/delete - Delete a user by ID
router.delete('/:id/delete', async (req: Request, res: Response) => {
  try {
    console.log('Delete user');
    const userId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user id provided' });
    }

    // Find the user by ID and delete
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ message: 'User deleted successfully', user: deletedUser });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
