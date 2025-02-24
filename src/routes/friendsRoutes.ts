import express, { Request, Response } from 'express';
import { User } from '../models/User';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let friends = user.friends || [];
    if (status) {
      friends = friends.filter((friend) => friend.status === status);
    }

    res.status(200).json({ friends });
  } catch (error) {
    console.error('Error getting friends:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Send Friend Request
router.post('/send-request', async (req: Request, res: Response) => {
  try {
    console.log(':::::::', 'currentUserId');
    const { currentUserId, targetUserId } = req.body;

    // Validate request body
    if (!currentUserId || !targetUserId) {
      return res.status(400).json({ message: 'Both currentUserId and targetUserId are required.' });
    }

    // Fetch both sender and receiver
    const sender = await User.findById(currentUserId);
    const receiver = await User.findById(targetUserId);

    if (!sender || !receiver) {
      return res.status(404).json({ message: 'One or both users were not found.' });
    }

    // Check if a friend request or friendship already exists
    const existingRequest = sender.friends?.find((friend) => friend.id?.toString() === targetUserId);
    if (existingRequest) {
      return res.status(400).json({ message: 'Friend request already sent or users are already connected.' });
    }

    // Update the sender's friends array with a "request_sent" status
    sender.friends = sender.friends || [];
    sender.friends.push({
      id: receiver._id as mongoose.Schema.Types.ObjectId,
      status: 'request_sent',
    });

    // Update the receiver's friends array with a "request_received" status
    receiver.friends = receiver.friends || [];
    receiver.friends.push({
      id: sender._id as mongoose.Schema.Types.ObjectId,
      status: 'request_received',
    });

    // Save both users
    await sender.save();
    await receiver.save();

    res.status(200).json({ message: 'Friend request sent successfully.' });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Cancel Friend Request
router.post('/cancel-request', async (req: Request, res: Response) => {
  try {
    const { currentUserId, targetUserId } = req.body;
    if (!currentUserId || !targetUserId) {
      return res.status(400).json({ message: 'Both currentUserId and targetUserId are required.' });
    }

    const sender = await User.findById(currentUserId);
    const receiver = await User.findById(targetUserId);
    if (!sender || !receiver) {
      return res.status(404).json({ message: 'One or both users were not found.' });
    }

    // Check that sender has a pending request with status "request_sent"
    const senderFriend = sender.friends?.find((friend) => friend.id?.toString() === targetUserId);
    if (!senderFriend || senderFriend.status !== 'request_sent') {
      return res.status(400).json({ message: 'Sender does not have a pending friend request to cancel.' });
    }

    // Check that receiver has the corresponding pending request with status "request_received"
    const receiverFriend = receiver.friends?.find((friend) => friend.id?.toString() === currentUserId);
    if (!receiverFriend || receiverFriend.status !== 'request_received') {
      return res.status(400).json({ message: 'Receiver does not have a pending friend request to cancel.' });
    }

    // Remove the pending friend request entries if statuses are correct
    sender.friends = sender.friends?.filter((friend) => !(friend.id?.toString() === targetUserId && friend.status === 'request_sent'));
    receiver.friends = receiver.friends?.filter((friend) => !(friend.id?.toString() === currentUserId && friend.status === 'request_received'));

    await sender.save();
    await receiver.save();
    res.status(200).json({ message: 'Friend request cancelled successfully.' });
  } catch (error) {
    console.error('Error cancelling friend request:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Accept friend request
router.post('/accept-request', async (req: Request, res: Response) => {
  try {
    const { currentUserId, targetUserId } = req.body; // currentUserId is receiver; targetUserId is sender
    if (!currentUserId || !targetUserId) {
      return res.status(400).json({ message: 'Both currentUserId and targetUserId are required.' });
    }

    const receiver = await User.findById(currentUserId);
    const sender = await User.findById(targetUserId);
    if (!sender || !receiver) {
      return res.status(404).json({ message: 'One or both users were not found.' });
    }

    // Find the pending request in both user documents
    const senderRequest = sender.friends?.find((friend) => friend.id?.toString() === currentUserId && friend.status === 'request_sent');
    const receiverRequest = receiver.friends?.find((friend) => friend.id?.toString() === targetUserId && friend.status === 'request_received');

    if (!senderRequest || !receiverRequest) {
      return res.status(400).json({ message: 'No pending friend request found to accept.' });
    }

    // Update status to accepted in both documents
    sender.friends = sender.friends?.map((friend) => {
      if (friend.id?.toString() === currentUserId && friend.status === 'request_sent') {
        return { ...friend, status: 'accepted' };
      }
      return friend;
    });

    receiver.friends = receiver.friends?.map((friend) => {
      if (friend.id?.toString() === targetUserId && friend.status === 'request_received') {
        return { ...friend, status: 'accepted' };
      }
      return friend;
    });

    await sender.save();
    await receiver.save();
    res.status(200).json({ message: 'Friend request accepted successfully.' });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Remove friend
router.post('/remove', async (req: Request, res: Response) => {
  try {
    const { currentUserId, targetUserId } = req.body;
    if (!currentUserId || !targetUserId) {
      return res.status(400).json({ message: 'Both currentUserId and targetUserId are required.' });
    }

    const user = await User.findById(currentUserId);
    const friendUser = await User.findById(targetUserId);
    if (!user || !friendUser) {
      return res.status(404).json({ message: 'One or both users were not found.' });
    }

    // Remove friend relationship from both users regardless of current status
    user.friends = user.friends?.filter((friend) => friend.id?.toString() !== targetUserId);
    friendUser.friends = friendUser.friends?.filter((friend) => friend.id?.toString() !== currentUserId);

    await user.save();
    await friendUser.save();
    res.status(200).json({ message: 'Friend removed successfully.' });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Revokek request
router.post('/revoke-request', async (req: Request, res: Response) => {
  try {
    const { currentUserId, targetUserId } = req.body; // currentUserId is the receiver rejecting the request
    if (!currentUserId || !targetUserId) {
      return res.status(400).json({ message: 'Both currentUserId and targetUserId are required.' });
    }

    const receiver = await User.findById(currentUserId);
    const sender = await User.findById(targetUserId);
    if (!sender || !receiver) {
      return res.status(404).json({ message: 'One or both users were not found.' });
    }

    // Check that sender has a pending request with status "request_sent" targeted to the receiver
    const senderFriend = sender.friends?.find((friend) => friend.id?.toString() === currentUserId && friend.status === 'request_sent');
    if (!senderFriend) {
      return res.status(400).json({ message: 'No pending friend request found in sender data.' });
    }

    // Check that receiver has the corresponding pending request with status "request_received" from the sender
    const receiverFriend = receiver.friends?.find((friend) => friend.id?.toString() === targetUserId && friend.status === 'request_received');
    if (!receiverFriend) {
      return res.status(400).json({ message: 'No pending friend request found in receiver data.' });
    }

    // Remove the pending friend request from both sides if statuses are correct
    sender.friends = sender.friends?.filter((friend) => !(friend.id?.toString() === currentUserId && friend.status === 'request_sent'));
    receiver.friends = receiver.friends?.filter((friend) => !(friend.id?.toString() === targetUserId && friend.status === 'request_received'));

    await sender.save();
    await receiver.save();
    res.status(200).json({ message: 'Friend request revoked successfully.' });
  } catch (error) {
    console.error('Error revoking friend request:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
