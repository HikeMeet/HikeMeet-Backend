import cron from 'node-cron';
import { Group } from '../models/Group'; // adjust the path as needed

// Run the cron job every 10 seconds
cron.schedule(' * * * * *', async () => {
  const now = new Date();

  // Manually adjust the time by adding 2 hours (for example)
  const adjustedTime = new Date(now);
  adjustedTime.setUTCHours(now.getUTCHours() + 2);
  console.log(`Adjusted time: ${adjustedTime}`);

  try {
    // Change groups from "planned" to "active" if scheduled_start time has arrived
    const activateResult = await Group.updateMany({ status: 'planned', scheduled_start: { $lte: adjustedTime } }, { $set: { status: 'active' } });
    console.log(`Activated ${activateResult.modifiedCount} groups`);

    // Change groups from "active" to "completed" if scheduled_end time has arrived
    const completeResult = await Group.updateMany({ status: 'active', scheduled_end: { $lte: adjustedTime } }, { $set: { status: 'completed' } });
    console.log(`Completed ${completeResult.modifiedCount} groups`);
  } catch (error) {
    console.error('Error updating group statuses:', error);
  }
});
