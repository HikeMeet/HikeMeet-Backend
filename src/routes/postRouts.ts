import express, { Request, Response } from 'express';
import { Post } from '../models/Post';
import { User } from '../models/User';

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

export default router;
