import express, { Request, Response } from 'express';
import { User } from '../models/User'; // Import the User model

const router = express.Router();

// POST /insert route
router.post('/insert', async (req: Request, res: Response) => {
  try {
    console.log('inserting');
    // Extract user data from the request body
    const { username, email, first_name, last_name, gender, birth_date, profile_picture, bio, facebook_link, instagram_link, role, firebase_id } =
      req.body;

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
      profile_picture: profile_picture || '',
      bio: bio || '',
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

// GET /user/:id - Get a user by ID
router.get('/:mongoId', async (req: Request, res: Response) => {
  try {
    const { mongoId } = req.params;
    const firebase = req.query.firebase === 'true'; // Default is false if not provided
    console.log(mongoId, ' xxxx ', firebase);
    let user;

    if (firebase) {
      // Search for the user by Firebase UID
      user = await User.findOne({ firebase_id: mongoId }); // Assuming 'firebaseUid' is the field in your schema
    } else {
      // Search for the user by MongoDB ID
      user = await User.findById(mongoId);
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /user/:id/update - Edit a user by ID
router.post('/:id/update', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const updates = req.body; // Updates from the request body
    updates.updated_on = new Date();
    // Find the user and update
    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /user/:id/delete - Delete a user by ID
router.delete('/:id/delete', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;

    // Find and delete the user
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
