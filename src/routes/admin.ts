import express, { Request, Response } from 'express';
import admin from 'firebase-admin';
import { User } from '../models/User'; // Import the User model

const router = express.Router();

router.delete('/:id/delete', async (req: Request, res: Response) => {
  try {
    console.log('Delete Firebase user');

    // Get the Firebase UID from the route parameters
    const uid = req.params.id;

    // Delete the user with the Firebase Admin SDK
    await admin.auth().deleteUser(uid);

    // Delete the corresponding user in MongoDB using the firebase_id field
    const deletedUser = await User.findOneAndDelete({ firebase_id: uid });
    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found in MongoDB' });
    }

    res.status(200).json({ message: 'Firebase user deleted successfully', user: deletedUser });
  } catch (error) {
    console.error('Error deleting Firebase user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
