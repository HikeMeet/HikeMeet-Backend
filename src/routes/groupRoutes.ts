import express, { Request, Response } from 'express';
import { Group } from '../models/Group';
import mongoose from 'mongoose';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { Notification } from '../models/notification';

const router = express.Router();

// POST /create - Create a new group
// TODO: Conditions of creating group if location or name exist?
router.post('/create', async (req: Request, res: Response) => {
  try {
    console.log('Request Body:', req.body);
    const { name, trip, max_members, privacy, difficulty, description, created_by, scheduled_start, scheduled_end, meeting_point } = req.body;

    // Validate required fields
    if (!name || !trip || !max_members || !created_by) {
      return res.status(400).json({ error: 'Missing required fields: name, trip, max_members, created_by' });
    }
    if (!mongoose.Types.ObjectId.isValid(trip)) {
      return res.status(404).json({ error: 'Trip id is invalid' });
    }
    const found_trip = await Trip.findById(trip);
    if (!found_trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    let effective_meeting_point = meeting_point;
    if (!meeting_point) {
      effective_meeting_point = found_trip.location.address;
    }

    // Check if the creator user exists (using created_by)
    const userExists = await User.findById(created_by);
    if (!userExists) {
      return res.status(400).json({ error: 'User does not exist' });
    }

    // Automatically add the creator as an admin member
    const initial_members = [
      {
        user: created_by,
        role: 'admin',
        joined_at: new Date(),
      },
    ];

    // Create a new group instance
    const new_group = new Group({
      name,
      trip,
      max_members,
      privacy,
      difficulty,
      description,
      created_by,
      members: initial_members,
      pending: [], // pending list is initially empty
      scheduled_start,
      scheduled_end,
      meeting_point: effective_meeting_point,
      created_on: new Date(),
      updated_on: new Date(),
    });

    const saved_group = await new_group.save();
    return res.status(201).json(saved_group);
  } catch (err) {
    console.error('Error creating group:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

// POST /:id/update/ - Update an existing group
router.post('/:id/update', async (req: Request, res: Response) => {
  try {
    const groupId = req.params.id;
    // Extract updated_by from the request body and the rest of the updateData.
    const { updated_by, ...updateData } = req.body;

    // Validate that updated_by is provided and is a valid ObjectId.
    if (!updated_by || !mongoose.Types.ObjectId.isValid(updated_by)) {
      return res.status(400).json({ error: 'Missing or invalid updated_by field' });
    }

    // Define allowed fields (updated_by is not allowed to be updated in the group itself)
    const allowedFields = [
      'name',
      'trip',
      'max_members',
      'privacy',
      'difficulty',
      'description',
      'status',
      'scheduled_start',
      'scheduled_end',
      'meeting_point',
      'embarked_at',
      'chat_room_id',
    ];

    // Check that every key in updateData is allowed.
    const updateKeys = Object.keys(updateData);
    const disallowedKeys = updateKeys.filter((key) => !allowedFields.includes(key));
    if (disallowedKeys.length > 0) {
      return res.status(400).json({
        error: 'Invalid update fields',
        invalid_fields: disallowedKeys,
      });
    }

    // Find the group first.
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check that the user making the update is an admin in the group.
    const isAdmin = group.members.some((member) => member.user.toString() === updated_by && member.role === 'admin');
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only an admin can update the group' });
    }

    // Proceed to update the group.
    const updatedGroup = await Group.findByIdAndUpdate(groupId, updateData, { new: true });
    if (!updatedGroup) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Fetch the updating user's details for the notification message.
    const updater = await User.findById(updated_by);
    const updaterName = updater ? updater.username : 'An admin';

    // Notify all group members (except the updater) of the update.
    for (const member of updatedGroup.members) {
      if (member.user.toString() !== updated_by) {
        const notification = new Notification({
          user: member.user,
          type: 'group_updated',
          group: updatedGroup._id,
          message: `The group "${updatedGroup.name}" has been updated by ${updaterName}.`,
          user_triggered: new mongoose.Types.ObjectId(updated_by),
        });
        await notification.save();
      }
    }

    return res.status(200).json(updatedGroup);
  } catch (err) {
    console.error('Error updating group:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

// POST /:groupId/invite/:userId - Invite a user to join the group.
router.post('/:groupId/invite/:userId', async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params;
    const { user_triggered } = req.body; // user who triggers the invitation

    // Find the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if the user is already invited (pending with origin 'invite' or 'request') or is already a member
    const already_pending = group.pending.some(
      (pending) => pending.user.toString() === userId && (pending.origin === 'invite' || pending.origin === 'request'),
    );
    const already_member = group.members.some((member) => member.user.toString() === userId);
    if (already_pending || already_member) {
      return res.status(400).json({ error: 'User is already invited or is a member' });
    }

    // Convert userId string to a Mongoose ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId) as any as mongoose.Schema.Types.ObjectId;

    // Add the pending invitation in the group document
    group.pending.push({
      user: userObjectId,
      origin: 'invite',
      status: 'pending',
      created_at: new Date(),
    });
    await group.save();

    // Build the notification data.
    const notificationData: any = {
      user: userObjectId,
      type: 'group_invite',
      group: group._id,
    };

    // Determine the triggering user.
    let triggerUserId: mongoose.Schema.Types.ObjectId;
    if (req.body.hasOwnProperty('user_triggered')) {
      if (mongoose.Types.ObjectId.isValid(user_triggered)) {
        triggerUserId = new mongoose.Types.ObjectId(user_triggered) as any as mongoose.Schema.Types.ObjectId;
      } else {
        return res.status(400).json({ error: 'Invalid user_triggered value' });
      }
    } else {
      triggerUserId = group.created_by;
    }
    notificationData.user_triggered = triggerUserId;

    // Fetch the triggering user's details to include their name in the message.
    const triggerUser = await User.findById(triggerUserId);
    const triggerName = triggerUser && triggerUser.username ? triggerUser.username : 'Someone';

    // Set the notification message with the triggering user's name.
    notificationData.message = `${triggerName} has invited you to join the group "${group.name}".`;

    // Create and save the notification
    const notification = new Notification(notificationData);
    await notification.save();

    return res.status(200).json({ message: 'Invitation sent and notification created', group });
  } catch (err) {
    console.error('Error inviting user:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

//POST /:groupId/cancel-invite/:userId - Cancel an invitation for a user.
router.post('/:groupId/cancel-invite/:userId', async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params;
    const { cancelled_by } = req.body; // ID of the user who cancels the invitation

    // Validate cancelled_by
    if (!cancelled_by || !mongoose.Types.ObjectId.isValid(cancelled_by)) {
      return res.status(400).json({ error: 'Missing or invalid cancelled_by field' });
    }

    // Find the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Find the pending invitation with origin 'invite'
    const pendingIndex = group.pending.findIndex((pending) => pending.user.toString() === userId && pending.origin === 'invite');
    if (pendingIndex === -1) {
      return res.status(400).json({ error: 'Invitation not found for this user' });
    }

    // Fetch the invitation notification (if exists) to determine the inviter
    const inviteNotification = await Notification.findOne({
      user: new mongoose.Types.ObjectId(userId),
      type: 'group_invite',
      group: group._id,
    });

    // Remove the pending invitation from the group document
    group.pending.splice(pendingIndex, 1);
    const updatedGroup = await group.save();

    // Remove the corresponding invitation notification
    await Notification.deleteOne({
      user: new mongoose.Types.ObjectId(userId),
      type: 'group_invite',
      group: group._id,
    });

    // If the invited user cancels their own invitation,
    // send a notification to the inviting admin informing them that the invite was declined,
    // including who declined it.
    if (cancelled_by === userId && inviteNotification && inviteNotification.user_triggered) {
      // Fetch the details of the user who declined the invitation
      const declinedUser = await User.findById(userId);
      const declinedUserName = declinedUser ? declinedUser.username : 'The user';

      const declineNotification = new Notification({
        user: inviteNotification.user_triggered, // The inviter gets notified
        type: 'group_invite_declined',
        group: group._id,
        message: `${declinedUserName} has declined your invitation to join the group "${group.name}".`,
        user_triggered: new mongoose.Types.ObjectId(userId), // The user who declined
      });
      await declineNotification.save();
    }

    return res.status(200).json(updatedGroup);
  } catch (err) {
    console.error('Error cancelling invitation:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

// POST /:groupId/accept-invite/:userId - Accept an invitation to join a group.
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

    // Remove the invitation notification for this invited user
    const inviteNotification = await Notification.findOneAndDelete({
      user: new mongoose.Types.ObjectId(userId),
      type: 'group_invite',
      group: group._id,
    });

    // If invitation notification exists and it has a triggering user, send a notification to that user
    if (inviteNotification && inviteNotification.user_triggered) {
      // Fetch accepted user's details for a friendly message
      const acceptedUser = await User.findById(userId);
      const acceptedUserName = acceptedUser ? acceptedUser.username : 'A user';

      const acceptedNotification = new Notification({
        user: inviteNotification.user_triggered, // notify the inviter
        type: 'group_invite_accepted',
        group: group._id,
        message: `${acceptedUserName} has accepted your invitation to join the group "${group.name}".`,
        user_triggered: new mongoose.Types.ObjectId(userId),
      });
      await acceptedNotification.save();
    }

    return res.status(200).json(updatedGroup);
  } catch (err) {
    console.error('Error accepting invitation:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

// POST /:groupId/remove-member/:userId - Remove a member from the group.
router.post('/:groupId/remove-member/:userId', async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params;
    const { removed_by } = req.body;

    // Ensure that the request body includes 'removed_by'
    if (!removed_by) {
      return res.status(400).json({ error: 'Missing required field: removed_by' });
    }
    if (!mongoose.Types.ObjectId.isValid(removed_by)) {
      return res.status(400).json({ error: 'Invalid removed_by value' });
    }

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

    // Only allow removal if:
    // - the removed_by user is the same as the user being removed (self-removal)
    // OR
    // - the removed_by user is an admin of the group.
    if (removed_by !== userId) {
      const isAdmin = group.members.some((member) => member.user.toString() === removed_by && member.role === 'admin');
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only the user itself or an admin can remove a user' });
      }
    }

    // Remove the member from the group
    group.members.splice(memberIndex, 1);
    const updatedGroup = await group.save();

    // Create a notification for the removed member
    const removalNotification = new Notification({
      user: new mongoose.Types.ObjectId(userId),
      type: 'group_removed',
      group: group._id,
      message: `You have been removed from the group "${group.name}".`,
    });
    await removalNotification.save();

    return res.status(200).json(updatedGroup);
  } catch (err) {
    console.error('Error removing member:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

/**
 * POST /:groupId/join - Join a group.
 * For public groups, the user is immediately added as a member.
 * For private groups, a join request is added to the pending list.
 * Expected to receive { "userId": "..." } in the body.
 */
router.post('/:groupId/join/:userId', async (req: Request, res: Response) => {
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

    // Convert userId to ObjectId without extra casting
    const userObjectId = new mongoose.Types.ObjectId(userId) as any as mongoose.Schema.Types.ObjectId;

    // Fetch joining user's details for notification message
    const joiningUser = await User.findById(userId);
    const joiningUsername = joiningUser ? joiningUser.username : 'Someone';

    let notificationType = '';
    let responseMessage = '';

    if (group.privacy === 'public') {
      // Public group: add user directly to members
      group.members.push({
        user: userObjectId,
        role: 'companion',
        joined_at: new Date(),
      });
      await group.save();
      notificationType = 'group_joined';
      responseMessage = 'User added to group';
    } else {
      // Private group: add a join request to the pending list
      group.pending.push({
        user: userObjectId,
        origin: 'request',
        status: 'pending',
        created_at: new Date(),
      });
      await group.save();
      notificationType = 'group_join_request';
      responseMessage = 'Join request sent. Awaiting approval.';
    }

    // Find all admin members in the group
    const adminMembers = group.members.filter((member) => member.role === 'admin');

    // Loop over each admin to create a notification
    for (const admin of adminMembers) {
      const adminNotification = new Notification({
        user: admin.user,
        type: notificationType,
        group: group._id,
        message: `${joiningUsername} has ${group.privacy === 'public' ? 'joined' : 'requested to join'} the group "${group.name}".`,
        user_triggered: new mongoose.Types.ObjectId(userId),
      });
      await adminNotification.save();
    }

    return res.status(200).json({ message: responseMessage, group });
  } catch (err) {
    console.error('Error joining group:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

//POST /:groupId/approve-join/:userId - Approve a join request (for private groups).
router.post('/:groupId/approve-join/:userId', async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params;
    const { admin_id } = req.body;

    // Find the group by its ID
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if the approving person is an admin
    const isAdmin = group.members.some((member) => member.user.toString() === admin_id && member.role === 'admin');
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only an admin can approve join requests' });
    }

    // Remove the pending join request (using $pull)
    await Group.findByIdAndUpdate(
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

    // Check if the user is already a member; if not, add them as a member.
    if (!group.members.some((member) => member.user.toString() === userId)) {
      group.members.push({
        user: new mongoose.Types.ObjectId(userId) as any as mongoose.Schema.Types.ObjectId,
        role: 'companion',
        joined_at: new Date(),
      });
      await group.save();
    }

    // Fetch the admin user's details for the notification message.
    const adminUser = await User.findById(admin_id);
    const adminName = adminUser ? adminUser.username : 'An admin';

    // Create a notification for the user whose join request was approved.
    const approvedNotification = new Notification({
      user: new mongoose.Types.ObjectId(userId),
      type: 'group_join_approved',
      group: group._id,
      message: `Your join request for the group "${group.name}" has been approved by ${adminName}.`,
      user_triggered: new mongoose.Types.ObjectId(admin_id),
    });
    await approvedNotification.save();

    // Loop over each admin to remove notification
    const adminMembers = group.members.filter((member) => member.role === 'admin');
    for (const admin of adminMembers) {
      await Notification.deleteMany({
        group: group._id,
        type: 'group_join_request',
        user: admin.user,
        user_triggered: userId,
      });
    }
    return res.status(200).json({ message: 'Join request approved', group });
  } catch (err) {
    console.error('Error approving join request:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});

// POST /:groupId/cancel-join/:userId - Cancel a join request.
router.post('/:groupId/cancel-join/:userId', async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params;
    const { cancelled_by } = req.body;

    // Validate that cancelled_by is provided and valid
    if (!cancelled_by || !mongoose.Types.ObjectId.isValid(cancelled_by)) {
      return res.status(400).json({ error: 'Missing or invalid cancelled_by field' });
    }

    // Find the group by its ID
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if the pending join request exists
    const pendingIndex = group.pending.findIndex(
      (pending) => pending.user.toString() === userId && pending.origin === 'request' && pending.status === 'pending',
    );
    if (pendingIndex === -1) {
      return res.status(400).json({ error: 'Join request not found or already processed' });
    }

    // Authorization check: Only allow cancellation if the cancelled_by user is either
    // the user who requested to join or an admin of the group.
    if (cancelled_by !== userId) {
      const isAdmin = group.members.some((member) => member.user.toString() === cancelled_by && member.role === 'admin');
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only the user itself or an admin can cancel a join request' });
      }
    }

    // Remove the pending join request
    group.pending.splice(pendingIndex, 1);
    const updatedGroup = await group.save();

    // Determine cancellation type
    if (cancelled_by === userId) {
      // Find all admin members in the group
      const adminMembers = group.members.filter((member) => member.role === 'admin');

      // Loop over each admin to remove notification
      for (const admin of adminMembers) {
        await Notification.deleteMany({
          group: group._id,
          type: 'group_join_request',
          user: admin.user,
          user_triggered: userId,
        });
      }
    } else {
      // Admin cancellation (decline): Notify the joining user that their request was declined.
      // Fetch admin details to include their name in the notification.
      const adminUser = await User.findById(cancelled_by);
      const adminName = adminUser ? adminUser.username : 'An admin';

      const declineNotification = new Notification({
        user: new mongoose.Types.ObjectId(userId),
        type: 'group_join_request_declined',
        group: group._id,
        message: `Your join request for the group "${group.name}" has been declined by ${adminName}.`,
        user_triggered: new mongoose.Types.ObjectId(cancelled_by),
      });
      await declineNotification.save();
    }

    return res.status(200).json({ message: 'Join request cancelled', group: updatedGroup });
  } catch (err) {
    console.error('Error cancelling join request:', err);
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

// GET /:id - Get group by ID.
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

export default router;
