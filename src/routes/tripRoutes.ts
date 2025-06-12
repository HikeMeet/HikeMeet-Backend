import express, { Request, Response } from 'express';
import { Trip } from '../models/Trip'; // Adjust the path if needed
import { updateUserExp } from '../helpers/expHelper';
import mongoose from 'mongoose';
import { DEFAULT_TRIP_IMAGE_URL, DEFAULT_TRIP_IMAGE_ID, removeOldImage } from '../helpers/cloudinaryHelper';

export async function deleteTripImages(trip: { main_image?: { image_id?: string }; images?: { image_id: string }[] }): Promise<void> {
  // Delete main image if it's not the default
  if (trip.main_image?.image_id && trip.main_image.image_id !== DEFAULT_TRIP_IMAGE_ID) {
    await removeOldImage(trip.main_image.image_id, DEFAULT_TRIP_IMAGE_ID);
  }

  // Delete each image from the images[] array
  if (trip.images?.length) {
    for (const img of trip.images) {
      if (img.image_id) {
        await removeOldImage(img.image_id);
      }
    }
  }
}

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
      archived: false,
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
    const trips = await Trip.find({ _id: { $in: idsArray }, archived: false });

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
router.get('/all', async (req: Request, res: Response) => {
  try {
    const { getArchived = false } = req.query;
    const archived = getArchived === 'true';
    const trips = await Trip.find({ archived }).populate('createdBy', 'username email');
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
  try {
    const { id } = req.params;
    const trip = await Trip.findByIdAndUpdate(id, { archived: true }, { new: true });
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    return res.status(200).json({ trip });
  } catch (err) {
    console.error('Error archiving trip:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /trips/unarchive/:id -
router.post('/unarchive/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const trip = await Trip.findByIdAndUpdate(id, { archived: false }, { new: true });
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    return res.status(200).json({ trip });
  } catch (err) {
    console.error('Error unarchiving trip:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /trips/archive/clear - Delete all archived trips
router.delete('/archive/clear', async (_req: Request, res: Response) => {
  try {
    const result = await Trip.deleteMany({ archived: true });
    return res.status(200).json({
      message: 'All archived trips have been deleted',
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error('Error deleting archived trips:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
