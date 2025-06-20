import cron from 'node-cron';
import { Group } from '../models/Group'; // adjust the path as needed
import { User } from '../models/User';

// Run the cron job every 10 seconds
cron.schedule(' * * * * *', async () => {
  const now = new Date();
  const adjustedTime = new Date(now);
  adjustedTime.setUTCHours(now.getUTCHours() + 3);
  console.log(adjustedTime);
  try {
    // Revert any active or completed groups whose start is still in the future back to "planned"
    const revertToPlanned = await Group.updateMany(
      { status: { $in: ['active', 'completed'] }, scheduled_start: { $gt: adjustedTime } },
      { $set: { status: 'planned' } },
    );
    console.log(`Reverted ${revertToPlanned.modifiedCount} groups back to planned (start > now)`);

    // Reactivate any "completed" groups that are actually still in their scheduled window
    const revertToActive = await Group.updateMany(
      {
        status: 'completed',
        scheduled_start: { $lte: adjustedTime },
        scheduled_end: { $gt: adjustedTime },
      },
      { $set: { status: 'active' } },
    );
    console.log(`Reactivated ${revertToActive.modifiedCount} groups back to active (start ≤ now < end)`);

    // Change groups from "planned" to "active" if scheduled_start time has arrived
    const activateResult = await Group.updateMany({ status: 'planned', scheduled_start: { $lte: adjustedTime } }, { $set: { status: 'active' } });
    console.log(`Activated ${activateResult.modifiedCount} groups`);
    const completeResultGroups = await Group.find({ status: 'active', scheduled_end: { $lte: adjustedTime } });

    // Change groups from "active" to "completed" if scheduled_end time has arrived
    const completeResult = await Group.updateMany({ status: 'active', scheduled_end: { $lte: adjustedTime } }, { $set: { status: 'completed' } });
    console.log(`Completed ${completeResult.modifiedCount} groups`);
    if (completeResultGroups.length > 0) {
      for (const group of completeResultGroups) {
        // For each member in the group, add a trip history entry if not already added.
        for (const member of group.members) {
          const user = await User.findById(member.user);
          if (user) {
            // Check if the trip is already in the user's history
            const newCompletedDate = group.scheduled_end || adjustedTime;
            const alreadyAdded = user.trip_history.some((entry) => {
              // Compare trip IDs and completed_at times (as timestamps)
              return entry.trip.toString() === group.trip.toString() && new Date(entry.completed_at).getTime() === newCompletedDate.getTime();
            });
            if (!alreadyAdded) {
              user.trip_history.push({
                trip: group.trip,
                completed_at: newCompletedDate,
              });
              await user.save();
              console.log(`Added trip history for user ${user._id} from group ${group._id}`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error updating group statuses:', error);
  }
});
