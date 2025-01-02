import express, { Request, Response } from 'express';
import { Post } from '../models/Post';

const router = express.Router();

// GET all posts
router.get('/', async (_: Request, res: Response) => {
  try {
    const posts = await Post.find();
    res.status(200).json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET all posts by a specific user
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const userPosts = await Post.find({ author: userId }).populate('author', 'username email');
    
    if (userPosts.length === 0) {
      return res.status(404).json({ error: 'No posts found for this user' });
    }

    res.status(200).json(userPosts);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET a specific post by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'username email');
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.status(200).json(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST a new post
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { title, content, author, images } = req.body;

    if (!title || !content || !author) {
      return res.status(400).json({ error: 'Title, content, and author are required.' });
    }

    const newPost = new Post({
      title,
      content,
      author,
      images,
      createdOn: new Date(),
      updatedOn: new Date(),
    });

    const savedPost = await newPost.save();
    res.status(201).json(savedPost);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT update a post by ID
router.put('/:id/update', async (req: Request, res: Response) => {
  try {
    const postId = req.params.id;
    const updates = req.body;

    const updatedPost = await Post.findByIdAndUpdate(postId, updates, { new: true });
    if (!updatedPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.status(200).json(updatedPost);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE a post by ID
router.delete('/:id/delete', async (req: Request, res: Response) => {
  try {
    const postId = req.params.id;

    const deletedPost = await Post.findByIdAndDelete(postId);
    if (!deletedPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.status(200).json({ message: 'Post deleted successfully', post: deletedPost });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
