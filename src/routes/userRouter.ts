import express, { Request, Response } from 'express';
import { User } from '../models/User'; // Import the User model
import mongoose from 'mongoose';
import { removeOldImage, DEFAULT_PROFILE_IMAGE_ID, DEFAULT_PROFILE_IMAGE_URL, streamUploadProfileImage, upload } from '../utils/cloudinaryHelper';

const router = express.Router();

// POST /insert route
router.post('/insert', async (req: Request, res: Response) => {
  try {
    console.log('inserting');
    // Extract user data from the request body
    const { username, email, first_name, last_name, gender, birth_date, /*profile_picture,*/ bio, facebook_link, instagram_link, role, firebase_id } =
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
      profile_picture: {
        url: DEFAULT_PROFILE_IMAGE_URL,
        image_id: DEFAULT_PROFILE_IMAGE_ID,
      },
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

// GET /:mongoId - Get a user by ID or Firebase ID
router.get('/:mongoId', async (req: Request, res: Response) => {
  try {
    const { mongoId } = req.params;
    const firebase = req.query.firebase === 'true'; // Default is false if not provided
    console.log(mongoId, ' xxxx ', firebase);
    let user;
    if (mongoId === 'all') {
      console.log('Get all user');
      user = await User.find({});
    } else {
      if (firebase) {
        // Search for the user by Firebase UID
        console.log('Get user with firebase id');
        user = await User.findOne({ firebase_id: mongoId });
      } else {
        // Search for the user by MongoDB ID
        console.log('Get user with monogo id');
        user = await User.findById(mongoId);
      }
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

// POST /:id/update - Edit a user by ID
router.post('/:id/update', async (req: Request, res: Response) => {
  try {
    console.log('Update user');

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
// DELETE /:id/delete - Delete a user by ID
router.delete('/:id/delete', async (req: Request, res: Response) => {
  try {
    console.log('Delete user');
    const userId = req.params.id;
    console.log('User ID:', userId);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user id provided' });
    }

    // Find the user by ID and delete
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove the profile picture from Cloudinary if it exists and is not the default image.
    await removeOldImage(deletedUser.profile_picture?.image_id, DEFAULT_PROFILE_IMAGE_ID);

    res.status(200).json({ message: 'User deleted successfully', user: deletedUser });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /:id/upload-profile-picture
// This endpoint receives an image file, uploads it to Cloudinary, updates the user in MongoDB,
// and then deletes the old image from Cloudinary. If any step fails, all changes are rolled back.
router.post('/:id/upload-profile-picture', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const userId: string = req.params.id;

    // First, get the current user from MongoDB to retrieve the current image id.
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldImageId = user.profile_picture?.image_id;

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Upload new image file to Cloudinary.
    const result = await streamUploadProfileImage(req.file.buffer);
    if (!result.secure_url || !result.public_id) {
      return res.status(500).json({ error: 'Failed to upload image to Cloudinary' });
    }

    // Log the new image ID and URL.
    console.log('old image ID:', oldImageId);
    console.log('New uploaded image ID:', result.public_id);
    console.log('New uploaded image URL:', result.secure_url);

    // Update the user's profile_picture in MongoDB.
    user.profile_picture = {
      url: result.secure_url,
      image_id: result.public_id,
    };
    user.updated_on = new Date();
    await user.save();

    // If an old image exists, delete it from Cloudinary.
    await removeOldImage(oldImageId, DEFAULT_PROFILE_IMAGE_ID);

    res.status(200).json(user);
  } catch (error: any) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id/delete-profile-picture', async (req: Request, res: Response) => {
  try {
    const userId: string = req.params.id;

    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Save the current image id to delete if necessary
    const oldImageId = user.profile_picture?.image_id;

    // Update the user's profile_picture to the default values
    user.profile_picture = {
      url: DEFAULT_PROFILE_IMAGE_URL,
      image_id: DEFAULT_PROFILE_IMAGE_ID,
    };
    user.updated_on = new Date();
    await user.save();

    // Delete the old image from Cloudinary if it exists and isn't the default one
    if (oldImageId && oldImageId !== DEFAULT_PROFILE_IMAGE_ID) {
      await removeOldImage(oldImageId, DEFAULT_PROFILE_IMAGE_ID);
    }

    res.status(200).json(user);
  } catch (error: any) {
    console.error('Error deleting profile picture:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
