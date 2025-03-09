import express, { Request, Response } from 'express';
import { Trip } from '../models/Trip'; // Adjust the path if needed
import { ArchivedTrip } from '../models/ArchiveTrip'; // Adjust the path if needed
import mongoose from 'mongoose';

const router = express.Router();

// POST /trips/create - Create a new trip
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { name, location, description, images, tags, createdBy } = req.body;

    // Basic validation for required fields
    if (!name || !location || !location.address || !location.coordinates || !createdBy) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Create a new Trip document
    const trip = new Trip({
      name,
      location,
      description,
      images,
      tags,
      createdBy,
    });

    // Save to the database
    const savedTrip = await trip.save();

    return res.status(201).json(savedTrip);
  } catch (error) {
    console.error('Error creating trip:', error);
    return res.status(500).json({ message: 'Server Error' });
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
    const result = await ArchivedTrip.deleteOne({ _id: archivedTripId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Archived trip not found' });
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
export default router;
