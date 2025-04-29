import express, { Request, Response } from 'express';
import { Trip } from '../models/Trip'; // Adjust the path if needed
import { ArchivedTrip } from '../models/ArchiveTrip'; // Adjust the path if needed
import { updateUserExp } from '../helpers/expHelper';
import mongoose from 'mongoose';
import { DEFAULT_TRIP_IMAGE_URL, DEFAULT_TRIP_IMAGE_ID, removeOldImage } from '../helpers/cloudinaryHelper';

const router = express.Router();
// POST /trips/create - Create a new trip
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { name, location, description, tags, createdBy } = req.body;

    // Basic validation for required fields
    if (!name || !location || !location.address || !location.coordinates || !createdBy) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Create a new Trip document
    const trip = new Trip({
      name,
      location,
      description,
      main_image: {
        url: DEFAULT_TRIP_IMAGE_URL,
        image_id: DEFAULT_TRIP_IMAGE_ID,
      },
      tags,
      createdBy,
    });

    // Save to the database
    const savedTrip = await trip.save();

    // +10 EXP for creating a trip
    await updateUserExp(createdBy, 10);

    return res.status(201).json(savedTrip);
  } catch (error) {
    console.error('Error creating trip:', error);
    return res.status(500).json({ message: 'Server Error' });
  }
});

// GET /api/trips/list-by-ids?ids=id1,id2,id3
router.get('/list-by-ids', async (req: Request, res: Response) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ error: 'No ids provided' });
    }

    // Convert the comma-separated string to an array of strings.
    const idsArray = typeof ids === 'string' ? ids.split(',') : [];

    // Query for trips. If Trip is properly typed, you can cast the result.
    const trips = await Trip.find({ _id: { $in: idsArray } });

    // Create a mapping from trip _id to trip object.
    const tripMap: { [key: string]: any } = {};
    trips.forEach((trip) => {
      // Cast trip._id to any so we can call toString() on it.
      const idStr = (trip._id as any).toString();
      tripMap[idStr] = trip;
    });

    // Map over the original idsArray to create a result array that preserves duplicates and order.
    const result = idsArray.map((id) => tripMap[id]).filter((trip) => trip);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching trips:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error });
  }
});

// GET /api/trips/all - Retrieve all trips
router.get('/all', async (_req: Request, res: Response) => {
  try {
    const trips = await Trip.find().populate('createdBy', 'username email');
    return res.status(200).json(trips);
  } catch (error: any) {
    console.error('Error fetching trips:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/update', async (req, res) => {
  const tripId = req.params.id;
  const updateData = req.body;

  try {
    // Update the trip document with the provided fields.
    const updatedTrip = await Trip.findByIdAndUpdate(tripId, updateData, {
      new: true, // Return the updated document.
      runValidators: true, // Ensure updates meet schema validations.
    });

    if (!updatedTrip) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    res.json(updatedTrip);
  } catch (error) {
    console.error('Error updating trip:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/:tripId/rate', async (req: Request, res: Response) => {
  const { tripId } = req.params;
  const { value, userId } = req.body as { value: number; userId: string };

  // 1) Validate
  if (!mongoose.Types.ObjectId.isValid(tripId)) {
    return res.status(400).json({ error: 'Invalid tripId' });
  }
  if (typeof value !== 'number' || value < 1 || value > 5) {
    return res.status(400).json({ error: 'Rating must be an integer 1–5' });
  }

  try {
    // 2) Load the trip
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // 3) Upsert the rating in trip.ratings[]
    const existing = trip.ratings.find((r) => r.user.toString() === userId);
    if (existing) {
      existing.value = value;
    } else {
      trip.ratings.push({ user: userId, value });
    }

    // 4) Recompute avg_rating
    const sum = trip.ratings.reduce((acc, r) => acc + r.value, 0);
    trip.avg_rating = parseFloat((sum / trip.ratings.length).toFixed(2));

    // 5) Save and respond
    await trip.save();
    return res.json({
      avg_rating: trip.avg_rating,
      your_rating: value,
      total_ratings: trip.ratings.length,
    });
  } catch (err) {
    console.error('Error rating trip:', err);
    return res.status(500).json({ error: 'Failed to rate trip' });
  }
});

router.delete('/:id/delete', async (req: Request, res: Response) => {
  try {
    const tripId = req.params.id;

    // Find the group by its ID.
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Delete the group.
    const deletedTrip = await Trip.findByIdAndDelete(tripId);
    if (!deletedTrip) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // -10 EXP for deleting a trip
    await updateUserExp(trip.createdBy.toString(), -10);

    // Notify all group members (except the creator) that the group has been deleted.

    return res.status(200).json({ message: 'Trip deleted successfully', trip: deletedTrip });
  } catch (err) {
    console.error('Error deleting group:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err });
  }
});
// GET /api/trips/:id - Retrieve a specific trip by its ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tripId = req.params.id;
    console.log('::::::::', tripId);
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    res.status(200).json(trip);
  } catch (error: any) {
    console.error('Error fetching trip:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// move from Trips collection to ArchiveTrips collection
router.post('/archive/:id', async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tripId = req.params.id;
    // Find the trip to be archived using the session
    const trip = await Trip.findById(tripId).session(session);
    if (!trip) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Create a new ArchivedTrip document using the data from the found trip,
    // and assign the same _id.
    const archivedTrip = new ArchivedTrip({
      _id: trip._id, // explicitly set the _id to match the original trip
      name: trip.name,
      location: trip.location,
      description: trip.description,
      images: trip.images,
      tags: trip.tags,
      createdBy: trip.createdBy,
      archivedAt: new Date(),
    });

    // Save the archived trip with the session
    await archivedTrip.save({ session });

    // Delete the trip from the original collection using the session
    await trip.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Trip archived successfully', archivedTrip });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error archiving trip:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /trips/unarchive/:id - Move a trip from the ArchivedTrip collection back to the Trip collection
router.post('/unarchive/:id', async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tripId = req.params.id;
    // Find the archived trip using the session
    const archivedTrip = await ArchivedTrip.findById(tripId).session(session);
    if (!archivedTrip) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Archived trip not found' });
    }

    // Create a new Trip document using the data from the archived trip
    const trip = new Trip({
      _id: archivedTrip._id, // reusing the same _id if desired, otherwise omit to get a new one
      name: archivedTrip.name,
      location: archivedTrip.location,
      description: archivedTrip.description,
      images: archivedTrip.images,
      tags: archivedTrip.tags,
      createdBy: archivedTrip.createdBy,
      // Add any additional fields if needed
    });

    // Save the trip to the active trips collection with the session
    await trip.save({ session });
    // Delete the trip from the ArchivedTrip collection using the session
    await archivedTrip.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Trip unarchived successfully', trip });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error unarchiving trip:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /trips/archive/clear - Delete all archived trips
router.delete('/archive/clear', async (_req: Request, res: Response) => {
  try {
    const archivedTrips = await ArchivedTrip.find({});

    for (const trip of archivedTrips) {
      const imageId = trip.main_image?.image_id;
      if (imageId && imageId !== DEFAULT_TRIP_IMAGE_ID) {
        await removeOldImage(imageId, DEFAULT_TRIP_IMAGE_ID);
      }

      for (const image of trip.images || []) {
        await removeOldImage(image.image_id);
      }
    }
    await ArchivedTrip.deleteMany({});
    res.status(200).json({ message: 'All archived trips cleared' });
  } catch (error: any) {
    console.error('Error clearing archived trips:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /trips/archive/:id - Delete a single archived trip by its ID
router.delete('/archive/:id', async (req: Request, res: Response) => {
  try {
    const archivedTripId = req.params.id;
    const trip = await ArchivedTrip.findById({ archivedTripId });
    if (!trip) {
      return res.status(404).json({ error: 'Group not found' });
    }
    const result = await ArchivedTrip.deleteOne({ _id: archivedTripId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Archived trip not found' });
    }
    const imageId = trip.main_image?.image_id;
    if (imageId && imageId !== DEFAULT_TRIP_IMAGE_ID) {
      await removeOldImage(imageId, DEFAULT_TRIP_IMAGE_ID);
    }

    for (const image of trip.images || []) {
      await removeOldImage(image.image_id);
    }
    return res.status(200).json({ message: 'Archived trip deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting archived trip:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /trips/archive/all - Retrieve all archived trips
router.get('/archive/all', async (_req: Request, res: Response) => {
  try {
    const archivedTrips = await ArchivedTrip.find();
    res.status(200).json(archivedTrips);
  } catch (error: any) {
    console.error('Error fetching archived trips:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/trips/:id - Retrieve a specific trip by its ID
router.get('/archive/:id', async (req: Request, res: Response) => {
  try {
    const tripId = req.params.id;
    const archivedTrip = await ArchivedTrip.findById(tripId);
    if (!archivedTrip) {
      return res.status(404).json({ message: 'Archived trip not found' });
    }
    res.status(200).json(archivedTrip);
  } catch (error: any) {
    console.error('Error fetching archived trip:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
