import express, { Request, Response } from 'express';
import { Post } from '../models/Post';
import { User } from '../models/User';
import mongoose from 'mongoose';

const router = express.Router();

router.post('/create', async (req: Request, res: Response) => {
  try {
    // Destructure the expected fields from the request body.
    // We assume `images` is an array of media objects sent from the frontend.
    const { author, content, images, attached_trip, attached_group, type, privacy, in_group } = req.body;

    // Create a new post using the provided data.
    const newPost = await Post.create({
      author,
      in_group: in_group || undefined,
      content,
      images: images || [], // Expecting an array of IImageModel objects
      attached_trip: attached_trip || undefined,
      attached_group: attached_group || undefined,
      likes: [],
      shares: [],
      saves: [],
      comments: [],
      is_shared: false,
      type: type || 'regular',
      privacy: privacy || 'public',
    });

    res.status(201).json({ message: 'Post created successfully', post: newPost });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get liked posts for a given user
router.get('/liked/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    // Find posts that have the userId in the likes array
    const likedPosts = await Post.find({ likes: userId })
      .populate({ path: 'author', select: 'username profile_picture' })
      .populate({
        path: 'original_post',
        select: 'content images author created_at',
        populate: { path: 'author', select: 'username profile_picture' },
      })
      .populate('attached_trip')
      .populate('attached_group')
      .sort({ created_at: -1 })
      .exec();

    res.status(200).json({ posts: likedPosts });
  } catch (error) {
    console.error('Error fetching liked posts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get saved posts for a given user
router.get('/saved/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    // Find posts that have the userId in the saves array
    const savedPosts = await Post.find({ saves: userId })
      .populate({ path: 'author', select: 'username profile_picture' })
      .populate({
        path: 'original_post',
        select: 'content images author created_at',
        populate: { path: 'author', select: 'username profile_picture' },
      })
      .populate('attached_trip')
      .populate('attached_group')
      .sort({ created_at: -1 })
      .exec();

    res.status(200).json({ posts: savedPosts });
  } catch (error) {
    console.error('Error fetching saved posts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/all', async (req: Request, res: Response) => {
  try {
    const { privacy, inGroup: groupId, userId } = req.query;
    let filter: any = {};

    if (privacy) {
      filter.privacy = privacy;
    }
    if (userId) {
      filter.author = userId;
    }

    if (groupId) {
      filter.in_group = groupId;
    } else {
      // Return only posts that do not have an in_group field
      filter.in_group = { $exists: false };
    }

    const posts = await Post.find(filter)
      .populate({ path: 'author', select: 'username profile_picture' })
      .populate({
        path: 'original_post',
        select: 'content images author created_at',
        populate: { path: 'author', select: 'username profile_picture' },
      })
      .populate('attached_trip')
      .populate('attached_group')

      .sort({ created_at: -1 })
      .exec();

    res.status(200).json({ posts });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/share', async (req: Request, res: Response) => {
  try {
    const { author, content, original_post, images, attached_trip, attached_group, in_group, privacy } = req.body;

    if (!original_post) {
      return res.status(400).json({ error: 'Original post ID is required for sharing.' });
    }

    // Retrieve the original post document.
    const origPost = await Post.findById(original_post).lean();
    if (origPost && origPost.privacy === 'private' && !origPost.in_group) {
      return res.status(400).json({ error: 'Cannot share a private post.' });
    }

    // Use the post that was clicked as the original_post, even if it’s already shared.
    const finalOriginalPostId = original_post;

    // Create the shared post document using the clicked post's ID.
    const sharedPostDoc = await Post.create({
      author,
      in_group: in_group || undefined,
      content, // Optional commentary by the sharing user.
      images: images || [],
      attached_trip: attached_trip || undefined,
      attached_group: attached_group || undefined,
      likes: [],
      shares: [],
      saves: [],
      comments: [],
      is_shared: true,
      original_post: finalOriginalPostId,
      privacy: privacy || 'public',
    });
    await Post.findByIdAndUpdate(finalOriginalPostId, { $addToSet: { shares: author } });

    // Populate fields.
    const sharedPost = await Post.findById(sharedPostDoc._id)
      .populate({ path: 'author', select: 'username profile_picture' })
      .populate({
        path: 'original_post',
        select: '-likes -shares -saves -comments ',
        populate: { path: 'author', select: 'username profile_picture' },
      })
      .populate('attached_trip')
      .populate('attached_group')
      .exec();

    res.status(201).json({ message: 'Post shared successfully', post: sharedPost });
  } catch (error) {
    console.error('Error sharing post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/update', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Update the post document with new data and return the updated document
    const updatedPost = await Post.findByIdAndUpdate(id, updateData, { new: true });
    if (!updatedPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Populate relevant fields
    const populatedPost = await Post.findById(id)
      .populate({ path: 'author', select: 'username profile_picture' })
      .populate({
        path: 'original_post',
        select: 'content images author created_at',
        populate: { path: 'author', select: 'username profile_picture' },
      })
      .populate('attached_trip')
      .populate('attached_group')
      .exec();

    res.status(200).json({ message: 'Post updated successfully', post: populatedPost });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/delete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Authorization check: only the author or an admin can delete
    const isAuthor = post.author.toString() === userId;
    const user = await User.findById(userId);
    const isAdmin = user?.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    // Will trigger the pre('findOneAndDelete') hook to delete media
    const deletedPost = await Post.findByIdAndDelete(id);

    res.status(200).json({ message: 'Post deleted successfully', post: deletedPost });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id)
      .populate({ path: 'author', select: 'username profile_picture' })
      .populate({
        path: 'original_post',
        select: 'content images author created_at',
        populate: { path: 'author', select: 'username profile_picture' },
      })

      .populate('attached_trip')
      .populate('attached_group')
      .exec();

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.status(200).json({ post });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/like', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const { id: postId } = req.params;

    // Retrieve the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if the user already liked the post
    if (post.likes.includes(userId)) {
      return res.status(400).json({ error: 'Post already liked by this user' });
    }

    // Add user to the post's likes array
    post.likes.push(userId);
    await post.save();

    // Update the liking user's document: add the post ID to social.posts_liked
    await User.findByIdAndUpdate(userId, {
      $addToSet: { 'social.posts_liked': postId },
    });

    // Update the post author's document: increment total_likes by 1
    await User.findByIdAndUpdate(post.author, {
      $inc: { 'social.total_likes': 1 },
    });

    res.status(200).json({ message: 'Post liked successfully', likes: post.likes });
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/like', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const { id: postId } = req.params;

    // Retrieve the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if the user has liked the post
    if (!post.likes.includes(userId)) {
      return res.status(400).json({ error: 'Like not found for this user' });
    }

    // Remove the user from the post's likes array
    post.likes = post.likes.filter((like: mongoose.Schema.Types.ObjectId) => like.toString() !== userId);
    await post.save();

    // Update the liking user's document: remove the post ID from social.posts_liked
    await User.findByIdAndUpdate(userId, {
      $pull: { 'social.posts_liked': postId },
    });

    // Update the post author's document: decrement total_likes by 1
    await User.findByIdAndUpdate(post.author, {
      $inc: { 'social.total_likes': -1 },
    });

    res.status(200).json({ message: 'Post unliked successfully', likes: post.likes });
  } catch (error) {
    console.error('Error unliking post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/save', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const { id: postId } = req.params;

    // Retrieve the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if the user already saved the post
    if (post.saves.includes(userId)) {
      return res.status(400).json({ error: 'Post already saved by this user' });
    }

    // Add user to the post's saves array
    post.saves.push(userId);
    await post.save();

    // Update the liking user's document: add the post ID to social.posts_saved
    await User.findByIdAndUpdate(userId, {
      $addToSet: { 'social.posts_saved': postId },
    });

    // Update the post author's document: increment total_saves by 1
    await User.findByIdAndUpdate(post.author, {
      $inc: { 'social.total_saves': 1 },
    });

    res.status(200).json({ message: 'Post saved successfully', saves: post.saves });
  } catch (error) {
    console.error('Error saving post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/save', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const { id: postId } = req.params;

    // Retrieve the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if the user has saved the post
    if (!post.saves.includes(userId)) {
      return res.status(400).json({ error: 'save not found for this user' });
    }

    // Remove the user from the post's saves array
    post.saves = post.saves.filter((save: mongoose.Schema.Types.ObjectId) => save.toString() !== userId);
    await post.save();

    // Update the liking user's document: remove the post ID from social.posts_saved
    await User.findByIdAndUpdate(userId, {
      $pull: { 'social.posts_saved': postId },
    });

    // Update the post author's document: decrement total_saves by 1
    await User.findByIdAndUpdate(post.author, {
      $inc: { 'social.total_saves': -1 },
    });

    res.status(200).json({ message: 'Post unsaved successfully', saves: post.saves });
  } catch (error) {
    console.error('Error unsaving post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
