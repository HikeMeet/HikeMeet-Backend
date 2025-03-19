import express, { Request, Response } from 'express';
import { Group } from '../models/Group';
import mongoose from 'mongoose';
import { Trip } from '../models/Trip';
import { User } from '../models/User';

const router = express.Router();

// POST /create - Create a new group
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { name, trip, max_members, privacy, difficulty, description, created_by, scheduled_start, scheduledEnd, meeting_point } = req.body;

    // Validate required fields
    if (!name || !trip || !max_members || !created_by) {
      return res.status(400).json({ error: 'Missing required fields: name, trip, max_members, created_by' });
    }

    // Check if the trip exists
    const tripExists = await Trip.findById(trip);
    if (!tripExists) {
      return res.status(400).json({ error: 'Trip does not exist' });
    }
    // Check if the user exists
    const userExists = await User.findById(trip);
    if (!userExists) {
      return res.status(400).json({ error: 'User does not exist' });
    }

    // Automatically add the creator as an admin member
    const initialMembers = [
      {
        user: created_by,
        role: 'admin',
        joined_at: new Date(),
      },
    ];

    // Create a new group instance
    const newGroup = new Group({
      name,
      trip,
      max_members,
      privacy,
      difficulty,
      description,
      created_by,
      members: initialMembers,
      pending: [], // pending list is initially empty
      scheduled_start,
      scheduledEnd,
      meeting_point,
    });

    const savedGroup = await newGroup.save();
    return res.status(201).json(savedGroup);
  } catch (err) {
    console.error('Error creating group:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

// POST /:id/update/ - Update an existing group
router.post('/:id/update/', async (req: Request, res: Response) => {
  try {
    const groupId = req.params.id;
    const updateData = req.body;

    // Optionally, add validations for updateData

    const updatedGroup = await Group.findByIdAndUpdate(groupId, updateData, { new: true });
    if (!updatedGroup) {
      return res.status(404).json({ error: 'Group not found' });
    }
    return res.status(200).json(updatedGroup);
  } catch (err) {
    console.error('Error updating group:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

/**
 * POST /:groupId/invite/:userId - Invite a user to join the group.
 */
router.post('/:groupId/invite/:userId', async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params;

    // Find the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if the user is already invited (pending with origin 'invite' or 'request') or is already a member
    const alreadyPending = group.pending.some(
      (pending) => pending.user.toString() === userId && (pending.origin === 'invite' || pending.origin === 'request'),
    );
    const alreadyMember = group.members.some((member) => member.user.toString() === userId);

    if (alreadyPending || alreadyMember) {
      return res.status(400).json({ error: 'User is already invited or has already requested to join, or is a member' });
    }

    // Convert the userId string to a Mongoose ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId) as any as mongoose.Schema.Types.ObjectId;

    // Add the pending entry for invite
    group.pending.push({
      user: userObjectId,
      origin: 'invite',
      status: 'pending',
      created_at: new Date(),
    });

    const updatedGroup = await group.save();
    return res.status(200).json(updatedGroup);
  } catch (err) {
    console.error('Error inviting user:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

/**
 * POST /:groupId/cancel-invite/:userId - Cancel an invitation for a user.
 */
router.post('/:groupId/cancel-invite/:userId', async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params;

    // Find the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Find the pending entry with origin 'invite'
    const pendingIndex = group.pending.findIndex((pending) => pending.user.toString() === userId && pending.origin === 'invite');
    if (pendingIndex === -1) {
      return res.status(400).json({ error: 'Invitation not found for this user' });
    }

    // Remove the pending invitation
    group.pending.splice(pendingIndex, 1);

    const updatedGroup = await group.save();
    return res.status(200).json(updatedGroup);
  } catch (err) {
    console.error('Error cancelling invitation:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

/**
 * POST /:groupId/remove-member/:userId - Remove a member from the group.
 */
router.post('/:groupId/remove-member/:userId', async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params;

    // Find the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if the user is a member
    const memberIndex = group.members.findIndex((member) => member.user.toString() === userId);
    if (memberIndex === -1) {
      return res.status(400).json({ error: 'User is not a member of this group' });
    }

    // Remove the member from the group
    group.members.splice(memberIndex, 1);

    const updatedGroup = await group.save();
    return res.status(200).json(updatedGroup);
  } catch (err) {
    console.error('Error removing member:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

/**
 * POST /:groupId/accept-invite/:userId - Accept an invitation to join a group.
 */
router.post('/:groupId/accept-invite/:userId', async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params;

    // Find the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Find the pending invitation (origin: 'invite' and status: 'pending')
    const pendingIndex = group.pending.findIndex(
      (pending) => pending.user.toString() === userId && pending.origin === 'invite' && pending.status === 'pending',
    );
    if (pendingIndex === -1) {
      return res.status(400).json({ error: 'Invitation not found or already processed' });
    }

    // Remove the pending invitation
    group.pending.splice(pendingIndex, 1);

    // Check if the user is already a member; if not, add to members
    const alreadyMember = group.members.some((member) => member.user.toString() === userId);
    if (!alreadyMember) {
      const userObjectId = new mongoose.Types.ObjectId(userId) as any as mongoose.Schema.Types.ObjectId;
      group.members.push({
        user: userObjectId,
        role: 'companion',
        joined_at: new Date(),
      });
    }

    const updatedGroup = await group.save();
    return res.status(200).json(updatedGroup);
  } catch (err) {
    console.error('Error accepting invitation:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

/**
 * POST /:groupId/join - Join a group.
 * For public groups, the user is immediately added as a member.
 * For private groups, a join request is added to the pending list.
 * Expected to receive { "userId": "..." } in the body.
 */
router.post('/:groupId/join/:userid', async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params;

    // Find the group by its ID
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if the user is already a member or has a pending request/invite
    const alreadyMember = group.members.some((member) => member.user.toString() === userId);
    const alreadyPending = group.pending.some((pending) => pending.user.toString() === userId);
    if (alreadyMember || alreadyPending) {
      return res.status(400).json({ error: 'User is already a member or has a pending request/invite' });
    }

    // Convert userId to ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId) as any as mongoose.Schema.Types.ObjectId;

    if (group.privacy === 'public') {
      // Public group: add user directly to members
      group.members.push({
        user: userObjectId,
        role: 'companion',
        joined_at: new Date(),
      });
      await group.save();
      return res.status(200).json({ message: 'User added to group', group });
    } else {
      // Private group: add a join request to the pending list
      group.pending.push({
        user: userObjectId,
        origin: 'request',
        status: 'pending',
        created_at: new Date(),
      });
      await group.save();
      return res.status(200).json({ message: 'Join request sent. Awaiting approval.', group });
    }
  } catch (err) {
    console.error('Error joining group:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

/**
 * POST /:groupId/approve-join/:userId - Approve a join request (for private groups).
 * This should be restricted to admins of the group.
 */
router.post('/:groupId/approve-join/:userId', async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params;
    const { adminId } = req.body;

    // Find the group by its ID
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if the approving person is an admin
    const isAdmin = group.members.some((member) => member.user.toString() === adminId && member.role === 'admin');
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only an admin can approve join requests' });
    }

    // // Find the pending join request with origin 'request'
    // const pendingIndex = group.pending.findIndex(
    //   (pending) => pending.user.toString() === userId && pending.origin === 'request' && pending.status === 'pending',
    // );
    // if (pendingIndex === -1) {
    //   return res.status(400).json({ error: 'Join request not found or already processed' });
    // }

    // // Remove the pending join request
    // group.pending.splice(pendingIndex, 1);
    // Remove the pending join request using .pull()

    // group.pending.pull({
    //   user: new mongoose.Types.ObjectId(userId),
    //   origin: 'request',
    //   status: 'pending',
    // });

    // group.pending = group.pending.filter(
    //   (pending) => !(pending.user.toString() === userId && pending.origin === 'request' && pending.status === 'pending'),
    // );

    const updatedGroup = await Group.findByIdAndUpdate(
      groupId,
      {
        $pull: {
          pending: {
            user: new mongoose.Types.ObjectId(userId),
            origin: 'request',
            status: 'pending',
          },
        },
      },
      { new: true },
    );

    // Check if the user is already a member (shouldn't be, but double-check)
    const alreadyMember = group.members.some((member) => member.user.toString() === userId);
    if (!alreadyMember) {
      const userObjectId = new mongoose.Types.ObjectId(userId) as any as mongoose.Schema.Types.ObjectId;
      group.members.push({
        user: userObjectId,
        role: 'companion',
        joined_at: new Date(),
      });
    }

    // const updatedGroup = await group.save();
    return res.status(200).json({ message: 'Join request approved', group: updatedGroup });
  } catch (err) {
    console.error('Error approving join request:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

/**
 * POST /:groupId/cancel-join/:userId - Cancel a join request.
 */
router.post('/:groupId/cancel-join/:userId', async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params;

    // Find the group by its ID
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Find the pending join request with origin 'request'
    const pendingIndex = group.pending.findIndex(
      (pending) => pending.user.toString() === userId && pending.origin === 'request' && pending.status === 'pending',
    );

    if (pendingIndex === -1) {
      return res.status(400).json({ error: 'Join request not found or already processed' });
    }

    // Remove the pending join request
    group.pending.splice(pendingIndex, 1);

    const updatedGroup = await group.save();
    return res.status(200).json({ message: 'Join request cancelled', group: updatedGroup });
  } catch (err) {
    console.error('Error cancelling join request:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

/**
 * GET /:id - Get group by ID.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    return res.status(200).json(group);
  } catch (err) {
    console.error('Error getting group by ID:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

/**
 * GET /list - Get all groups.
 * Query options:
 *   - privacy: "public" or "private"
 *   - status: "planned", "active", or "completed"
 * Example: GET /list?privacy=public&status=active
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const { privacy, status } = req.query;
    const filter: { [key: string]: any } = {};

    if (privacy) {
      filter.privacy = privacy;
    }
    if (status) {
      filter.status = status;
    }

    const groups = await Group.find(filter);
    return res.status(200).json(groups);
  } catch (err) {
    console.error('Error getting groups:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

export default router;
