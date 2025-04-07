import express, { Request, Response } from 'express';
import { Trip } from '../models/Trip'; // Adjust the path if needed
import { ArchivedTrip } from '../models/ArchiveTrip'; // Adjust the path if needed
import mongoose from 'mongoose';
import { DEFAULT_TRIP_IMAGE_URL, DEFAULT_TRIP_IMAGE_ID, upload, removeOldImage } from '../helpers/cloudinaryHelper';
import { uploadImagesGeneric } from '../helpers/imagesHelper';

const router = express.Router();
const MAX_IMAGE_COUNT = 5;
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

router.post('/:id/upload-trip-images', upload.array('images', MAX_IMAGE_COUNT), async (req: Request, res: Response) => {
  try {
    const tripId: string = req.params.id;

    // Ensure files are provided.
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    // Extract file buffers from the uploaded files.
    const buffers: Buffer[] = req.files.map((file: Express.Multer.File) => file.buffer);

    // Use the generic helper to upload images and update the trip's images field.
    const updatedTrip = await uploadImagesGeneric(
      Trip,
      tripId,
      buffers,
      MAX_IMAGE_COUNT,
      'images', // The field in Trip model where images are stored.
      'trip_images', // The Cloudinary folder for trip images.
    );

    res.status(200).json(updatedTrip);
  } catch (error: any) {
    console.error('Error uploading trip images:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id/delete-trip-images', async (req: Request, res: Response) => {
  try {
    const tripId: string = req.params.id;
    const { imageIds } = req.body; // Expecting { imageIds: string[] }

    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ error: 'No image IDs provided' });
    }

    // Find the trip by ID
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Filter the images to remove based on the provided image IDs
    const imagesToRemove = trip.images?.filter((image) => imageIds.includes(image.image_id)) || [];

    // Remove each image from Cloudinary
    for (const image of imagesToRemove) {
      await removeOldImage(image.image_id);
    }

    // Remove the images from the trip's images array
    trip.images = trip.images?.filter((image) => !imageIds.includes(image.image_id));
    await trip.save();

    res.status(200).json(trip);
  } catch (error: any) {
    console.error('Error deleting trip images:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id/delete-profile-picture', async (req: Request, res: Response) => {
  try {
    const tripId: string = req.params.id;

    // Find the user by ID
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'trip not found' });
    }

    // Save the current image id to delete if necessary
    const oldImageId = trip.main_image?.image_id;

    // Update the trip's main_image to the default values
    trip.main_image = {
      url: DEFAULT_TRIP_IMAGE_URL,
      image_id: DEFAULT_TRIP_IMAGE_ID,
      type: 'image',
    };
    trip.updatedAt = new Date();
    await trip.save();

    // Delete the old image from Cloudinary if it exists and isn't the default one
    if (oldImageId && oldImageId !== DEFAULT_TRIP_IMAGE_ID) {
      await removeOldImage(oldImageId, DEFAULT_TRIP_IMAGE_ID);
    }

    res.status(200).json(trip);
  } catch (error: any) {
    console.error('Error deleting profile picture:', error);
    res.status(500).json({ error: 'Internal Server Error' });
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
