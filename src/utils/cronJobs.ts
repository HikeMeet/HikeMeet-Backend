// import { Group } from 'src/models/Group';
// import * as cron from 'node-cron';

// const parseHHMMToDate = (timeStr: string): Date => {
//   const [hours, minutes] = timeStr.split(':').map(Number);
//   const now = new Date();
//   return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
// };
// // Schedule a job to run every minute. Adjust the schedule as needed.
// cron.schedule('* * * * *', async () => {
//   const now = new Date();
//   try {
//     // Update groups that should become active.
//     await Group.updateMany(
//       {
//         status: 'planned',
//         $or: [
//           { scheduled_start: { $lte: now } },
//           { embarked_at: { $lte: now } }, // Ensure embarked_at is stored as a date
//         ],
//       },
//       { $set: { status: 'active' } },
//     );

//     // Update groups that should become completed.
//     await Group.updateMany(
//       {
//         status: 'active',
//         scheduled_end: { $lte: now },
//       },
//       { $set: { status: 'completed' } },
//     );
//     console.log('Cron job executed: group statuses updated at', now);
//   } catch (error) {
//     console.error('Cron job error updating group statuses:', error);
//   }
// });
