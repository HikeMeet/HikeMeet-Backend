import express, { Request, Response } from 'express';
import { Post } from '../models/Post';
import { User } from '../models/User';
import { updateUserExp } from '../helpers/expHelper';
import { Notification } from '../models/Notification';
import mongoose from 'mongoose';
import { notifyCommentLiked, notifyPostCommented, notifyPostCreateInGroup, notifyPostLiked, notifyPostShared } from '../helpers/notifications';

const router = express.Router();

router.post('/create', async (req: Request, res: Response) => {
  try {
    const { author, content, images, attached_trips, attached_groups, type, privacy, in_group } = req.body;

    // 1) Create the post
    const newPost = await Post.create({
      author,
      in_group: in_group || undefined,
      content,
      images: images || [],
      attached_trips: attached_trips || undefined,
      attached_groups,
      likes: [],
      shares: [],
      saves: [],
      comments: [],
      is_shared: false,
      type: type || 'regular',
      privacy: privacy || 'public',
    });

    // Give 8 EXP for creating a post
    await updateUserExp(author, 8);

    // 2) If this was in a group, notify the other members
    if (in_group && newPost._id) {
      await notifyPostCreateInGroup(new mongoose.Types.ObjectId(in_group), new mongoose.Types.ObjectId(author), newPost._id.toString());
    }
    // 3) Respond
    return res.status(201).json({ message: 'Post created successfully', post: newPost });
  } catch (error) {
    console.error('Error creating post:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
      .populate('attached_trips')
      .populate({ path: 'comments', populate: { path: 'liked_by', select: 'username profile_picture last_name first_name' } })
      .populate({ path: 'comments', populate: { path: 'user', select: 'username profile_picture last_name first_name' } })
      .populate({ path: 'likes', select: 'username profile_picture last_name first_name' })
      .populate('attached_groups')
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
      .populate({ path: 'comments', populate: { path: 'liked_by', select: 'username profile_picture last_name first_name' } })
      .populate({ path: 'comments', populate: { path: 'user', select: 'username profile_picture last_name first_name' } })
      .populate({ path: 'likes', select: 'username profile_picture last_name first_name' })
      .populate('attached_trips')
      .populate('attached_groups')
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
    const { privacy, inGroup: groupId, userId, friendsOnly } = req.query;
    let filter: any = {};

    if (privacy) {
      filter.privacy = privacy;
    }

    let blockedUserIds: string[] = [];
    if (userId) {
      const currentUser = await User.findById(userId);
      if (!currentUser) {
        return res.status(404).json({ error: 'Current user not found' });
      }

      ///////// A list of users who are blocked by me or who have blocked me.

      const blockedByMe = (currentUser.friends || []).filter((friend) => friend.status === 'blocked').map((friend) => friend.id.toString());

      const blockedMeDocs = await User.find({
        friends: {
          $elemMatch: {
            id: new mongoose.Types.ObjectId(userId as string),
            status: 'blocked',
          },
        },
      }).select('_id');

      const blockedMe = blockedMeDocs.map((doc) => String(doc._id));

      blockedUserIds = [...new Set([...blockedByMe, ...blockedMe])];

      ///////// END

      if (friendsOnly === 'true') {
        const acceptedFriendIds = (currentUser.friends || [])
          .filter((friend: any) => friend.status === 'accepted')
          .map((friend: any) => friend.id.toString());

        filter.author = {
          $in: acceptedFriendIds,
          $nin: blockedUserIds,
        };

        // all post without the block user's post
      } else {
        if (privacy === 'public') {
          filter.author = { $nin: blockedUserIds };
        } else {
          filter.author = {
            $eq: userId,
            $nin: blockedUserIds,
          };
        }
      }
    }

    //filter by group
    if (groupId) {
      filter.in_group = groupId;
    }
    //filter not in group
    else {
      filter.in_group = { $exists: false };
    }

    const posts = await Post.find(filter)
      .populate({ path: 'author', select: 'username profile_picture' })
      .populate({
        path: 'original_post',
        select: 'content images author created_at',
        populate: { path: 'author', select: 'username profile_picture' },
      })
      .populate('attached_trips')
      .populate('attached_groups')
      .populate({ path: 'likes', select: 'username profile_picture last_name first_name' })
      .populate({
        path: 'comments',
        populate: { path: 'user', select: 'username profile_picture last_name first_name' },
      })
      .populate({
        path: 'comments',
        populate: { path: 'liked_by', select: 'username profile_picture last_name first_name' },
      })
      .sort({ created_at: -1 })
      .exec();

    //filter comment of blocked users
    const filteredPosts = posts.map((post) => {
      if (!post.comments) return post;
      post.comments = post.comments.filter((comment: any) => {
        const commentUserId = comment.user?._id?.toString();
        return commentUserId && !blockedUserIds.includes(commentUserId);
      });
      return post;
    });

    res.status(200).json({ posts: filteredPosts });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/share', async (req: Request, res: Response) => {
  try {
    const { author, content, original_post, images, attached_trips, attached_groups, in_group, privacy } = req.body;

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
      attached_trips: attached_trips || undefined,
      attached_groups: attached_groups || undefined,
      likes: [],
      shares: [],
      saves: [],
      comments: [],
      is_shared: true,
      original_post: finalOriginalPostId,
      privacy: privacy || 'public',
    });
    await Post.findByIdAndUpdate(finalOriginalPostId, { $addToSet: { shares: author } });

    // The user who shared the post gets 10 EXP points
    await updateUserExp(author, 10);

    // The original author gets 5 EXP points
    const originalAuthor = origPost?.author?.toString();
    if (originalAuthor && originalAuthor !== author) {
      await updateUserExp(originalAuthor, 5);
    }

    // Notify original author
    const orig = await Post.findById(original_post).select('author');
    if (orig?.author && sharedPostDoc._id) {
      await notifyPostShared(
        new mongoose.Types.ObjectId(orig.author.toString()),
        new mongoose.Types.ObjectId(author),
        sharedPostDoc._id.toString(),
        in_group,
      );
    }

    // Populate fields.
    const sharedPost = await Post.findById(sharedPostDoc._id)
      .populate({ path: 'author', select: 'username profile_picture' })
      .populate({
        path: 'original_post',
        select: '-likes -shares -saves -comments ',
        populate: { path: 'author', select: 'username profile_picture' },
      })
      .populate('attached_trips')
      .populate('attached_groups')
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
      .populate('attached_trips')
      .populate('attached_groups')
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
      .populate({ path: 'likes', select: 'username profile_picture last_name first_name' })
      .populate({ path: 'comments', populate: { path: 'user', select: 'username profile_picture last_name first_name' } })
      .populate({ path: 'comments', populate: { path: 'liked_by', select: 'username profile_picture last_name first_name' } })
      .populate('attached_trips')
      .populate('attached_groups')
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

    await updateUserExp(post.author.toString(), 5); // add exp

    // 6) Persist & send a notification to the post author
    await notifyPostLiked(post.author, userId, postId);

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

    await updateUserExp(post.author.toString(), -5); // reduce exp

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

    // Reward post author for save
    await updateUserExp(post.author.toString(), 3);

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

    // Penalize post author for unsave
    await updateUserExp(post.author.toString(), -3);

    res.status(200).json({ message: 'Post unsaved successfully', saves: post.saves });
  } catch (error) {
    console.error('Error unsaving post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:postId/comment', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { userId, text } = req.body; // Expect user (as ObjectId string) and comment text
    if (!userId || !text) {
      return res.status(400).json({ error: 'User and text are required' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Create a new comment object (IComment)
    const comment = {
      user: userId,
      text,
      created_at: new Date(),
      liked_by: [],
    };

    // Push the comment into the post's comments array and save the post
    post.comments.push(comment);

    await post.save();

    // Get the newly added comment’s ID
    const addedComment = post.comments[post.comments.length - 1];

    if (addedComment._id) {
      //Notify the post’s author
      await notifyPostCommented(
        new mongoose.Types.ObjectId(post.author.toString()),
        new mongoose.Types.ObjectId(userId),
        postId,
        addedComment._id.toString(),
      );
    }

    const postRespond = await Post.findById(postId)
      .populate({ path: 'comments', populate: { path: 'user', select: 'username profile_picture' } })
      .exec();

    if (!postRespond) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Reward for commenting
    await updateUserExp(userId, 4);

    res.status(201).json({
      message: 'Comment added successfully',
      comment: postRespond.comments[postRespond.comments.length - 1],
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update the comment text
router.post('/:postId/comment/:commentId', async (req: Request, res: Response) => {
  try {
    const { postId, commentId } = req.params;
    const { text, userId } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Find the comment using Mongoose subdocument helper
    const comment = (post.comments as any).id(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.user.toString() !== userId) {
      return res.status(403).json({ error: 'You are not authorized to update this comment' });
    }
    // Update the comment text and save the post
    comment.text = text;
    await post.save();

    res.status(200).json({
      message: 'Comment updated successfully',
      comment,
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:postId/comment/:commentId', async (req: Request, res: Response) => {
  try {
    const { postId, commentId } = req.params;
    const { userId } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Find the comment subdocument
    const comment = (post.comments as any).id(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    // Check if the user is the author or a moderator
    if (comment.user.toString() !== userId && post.author.toString() !== userId) {
      return res.status(403).json({ error: 'You are not authorized to delete this comment' });
    }
    // Remove the comment and save the post
    post.comments = post.comments.filter((c: any) => c._id.toString() !== commentId);
    await post.save();

    // Remove all notifications associated with this comment
    await Notification.deleteMany({
      type: 'comment_like',
      data: { commentId, postId },
    });

    // Penalize for deleting own comment
    if (comment.user.toString() === userId) {
      await updateUserExp(userId, -4);
    }

    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:postId/comment/:commentId/like', async (req: Request, res: Response) => {
  try {
    const { postId, commentId } = req.params;
    const { userId } = req.body; // Expect the liking user's id in the body
    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comment = (post.comments as any).id(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if the user already liked the comment
    if (comment.liked_by.some((id: mongoose.Types.ObjectId) => id.toString() === userId)) {
      return res.status(400).json({ error: 'Comment already liked by this user' });
    }

    // Add userId to the liked_by array
    comment.liked_by.push(userId);
    await post.save();

    // Notify the comment’s author
    await notifyCommentLiked(comment.user, userId, postId, commentId);

    const populatedComment = await Post.findById(postId)
      .select({ comments: { $elemMatch: { _id: commentId } } })
      .populate({
        path: 'comments.liked_by',
        select: 'username first_name last_name profile_picture',
      })
      .exec();

    // Reward comment author for being liked
    await updateUserExp(comment.user.toString(), 2);

    res.status(200).json({
      message: 'Comment liked',
      liked_by: populatedComment?.comments[0]?.liked_by,
    });
  } catch (error) {
    console.error('Error liking comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:postId/comment/:commentId/like', async (req: Request, res: Response) => {
  try {
    const { postId, commentId } = req.params;
    const { userId } = req.body; // Expect the unliking user's id in the body
    console.log('::::::', userId);
    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comment = (post.comments as any).id(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if the user hasn't liked this comment already
    if (!comment.liked_by.some((id: any) => id.toString() === userId)) {
      return res.status(400).json({ error: 'User has not liked this comment yet' });
    }

    // Remove the userId from the liked_by array
    comment.liked_by = comment.liked_by.filter((id: any) => id.toString() !== userId);
    await post.save();

    // Penalize for losing a like
    await updateUserExp(comment.user.toString(), -2);

    res.status(200).json({ message: 'Comment unliked', comment });
  } catch (error) {
    console.error('Error unliking comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
