import express, { Request, Response } from "express";
import { User } from "../models/User";

const router = express.Router();
// Friend status
router.get("/status", async (req: Request, res: Response) => {
  try {
    const { userId, friendId } = req.query;

    if (!userId || !friendId) {
      return res.status(400).json({ error: "Missing parameters." });
    }

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const friend = currentUser.friends?.find((f) => f.id && f.id.toString() === friendId);

    if (!friend) {
      return res.status(200).json({ status: "none" });
    }

    res.status(200).json({ status: friend.status });
  } catch (error) {
    console.error("Error checking friend status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add friend
router.post("/add-friend", async (req: Request, res: Response) => {
  try {
    const { userId, friendId } = req.body;

    if (!userId || !friendId) {
      return res.status(400).json({ message: "Both userId and friendId are required." });
    }

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const friend = await User.findById(friendId);
    if (!friend) {
      return res.status(404).json({ message: "Friend not found." });
    }

    currentUser.friends?.push({ id: friend.id, status: "pending" });
    await currentUser.save();

    res.status(200).json({ message: "Friend request sent successfully." });
  } catch (error) {
    console.error("Error adding friend:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Cancel pending
router.post("/cancel-pending", async (req: Request, res: Response) => {
  try {
    const { userId, friendId } = req.body;

    if (!userId || !friendId) {
      return res.status(400).json({ message: "Both userId and friendId are required." });
    }

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      console.log("User not found with ID:", userId);
      return res.status(404).json({ message: "User not found." });
    }

    currentUser.friends = currentUser.friends?.filter((f) => {
      if (!f.id) {
        console.log("Friend ID is undefined. Skipping this friend.");
        return true;
      }
      return f.id.toString() !== friendId || f.status !== "pending";
    });
    
    await currentUser.save();

    res.status(200).json({ message: "Pending friend request cancelled successfully." });
  } catch (error) {
    console.error("Error cancelling pending friend request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Remove friend
router.post("/remove", async (req: Request, res: Response) => {
  try {
    const { userId, friendId } = req.body;

    if (!userId || !friendId) {
      console.log("Missing parameters:", { userId, friendId });
      return res.status(400).json({ message: "Both userId and friendId are required." });
    }

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      console.log("User not found with ID:", userId);
      return res.status(404).json({ message: "User not found." });
    }

    currentUser.friends = currentUser.friends?.filter((f) => {
      return f.id !== friendId;
    });

    await currentUser.save();

    res.status(200).json({ message: "Friend removed successfully." });
  } catch (error) {
    console.error("Error removing friend:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
