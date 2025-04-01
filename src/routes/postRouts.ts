import express, { Request, Response } from 'express';
import { Post } from '../models/Post';

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
    // Read privacy from the query parameters.
    // If privacy is provided, filter by it; otherwise, no privacy filter.
    const { privacy } = req.query;
    const filter = privacy ? { privacy } : {};

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
    if (origPost && origPost.privacy === 'private') {
      return res.status(400).json({ error: 'Cannot share a private post.' });
    }
    // If the provided post is already a shared post and has an original_post,
    // then use that as the original.
    const finalOriginalPostId = origPost && origPost.is_shared && origPost.original_post ? origPost.original_post : original_post;

    // Create the shared post document using the determined original post ID.
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
      original_post: finalOriginalPostId || undefined,
      privacy: privacy || 'public',
    });

    // Populate the author and original_post fields.
    const sharedPost = await Post.findById(sharedPostDoc._id)
      .populate({ path: 'author', select: 'username profile_picture' })
      .populate({
        path: 'original_post',
        select: '-likes -shares -saves -comments -is_shared -original_post',
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
  /////// need to add remove media from cloudianry
  try {
    const { id } = req.params;

    // Attempt to delete the post with the given ID.
    const deletedPost = await Post.findByIdAndDelete(id);
    if (!deletedPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

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
