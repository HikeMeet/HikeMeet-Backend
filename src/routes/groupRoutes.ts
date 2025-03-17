import express, { Request, Response } from 'express';
import { Group } from '../models/Group';

const router = express.Router();

// POST /groups/create - Create a new group
router.post('/groups/create', async (req: Request, res: Response) => {
  try {
    // Destructure the fields from the request body
    const {
      name,
      trip,
      maxMembers,
      privacy,
      difficulty,
      description,
      createdBy,
      scheduledStart,
      scheduledEnd,
      meetingPoint,
      // You can include additional fields if needed
    } = req.body;

    // Validate required fields
    if (!name || !trip || !maxMembers || !createdBy) {
      return res.status(400).json({ error: 'Missing required fields: name, trip, maxMembers, createdBy' });
    }

    // Optionally, you might want to add the creator as an admin member automatically:
    const initialMembers = [
      {
        user: createdBy,
        role: 'admin',
        joinedAt: new Date(),
      },
    ];

    // Create a new group instance
    const newGroup = new Group({
      name,
      trip,
      maxMembers,
      privacy,
      difficulty,
      description,
      createdBy,
      members: initialMembers, // Automatically add creator as an admin
      invites: [],
      scheduledStart,
      scheduledEnd,
      meetingPoint,
      // embarkedAt and chatRoomId can be set later in the process
    });

    // Save the group document to the database
    const savedGroup = await newGroup.save();
    return res.status(201).json(savedGroup);
  } catch (err) {
    console.error('Error creating group:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

// POST /groups/update/:id - Update an existing group
router.post('/groups/update/:id', async (req: Request, res: Response) => {
  try {
    const groupId = req.params.id;
    const updateData = req.body;

    // add validate to updateData

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
export default router;
