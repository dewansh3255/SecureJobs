/**
 * Post / Feed Routes
 * GET    /posts/feed                          — personalized feed
 * POST   /posts                               — create post
 * GET    /posts/:id                           — single post
 * PUT    /posts/:id                           — edit post (owner only)
 * DELETE /posts/:id                           — soft delete (owner/admin)
 * POST   /posts/:id/react                     — add/change/remove reaction
 * POST   /posts/:id/comments                  — add comment
 * DELETE /posts/:id/comments/:commentId       — delete comment
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { protect, optionalAuth } from '../middleware/auth';
import { postRateLimiter } from '../middleware/security';
import Post from '../models/Post';
import Comment from '../models/Comment';
import Notification from '../models/Notification';
import User from '../models/User';
import logger from '../utils/logger';

const router = Router();

// Helper: create notification (fire-and-forget, never throws)
const notify = async (params: {
  recipient: mongoose.Types.ObjectId | string;
  sender: mongoose.Types.ObjectId | string;
  type: string;
  title: string;
  message: string;
  reference?: mongoose.Types.ObjectId | string;
  referenceModel?: string;
}) => {
  try {
    await Notification.create(params);
  } catch (e) {
    logger.warn('Notification create failed', e);
  }
};

// ──────────────────────────────────────────────
// GET /posts/feed
// ──────────────────────────────────────────────
router.get('/feed', protect, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || '10'))));
    const skip = (page - 1) * limit;

    const me = await User.findById(req.user!.id).select('connections following').lean();
    const relevantAuthors = [
      req.user!.id,
      ...(me?.connections || []).map(String),
      ...(me?.following || []).map(String),
    ];

    const [posts, total] = await Promise.all([
      Post.find({
        author: { $in: relevantAuthors },
        visibility: { $in: ['public', 'connections'] },
        isDeleted: false,
      })
        .populate('author', 'firstName lastName profilePicture headline')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments({
        author: { $in: relevantAuthors },
        visibility: { $in: ['public', 'connections'] },
        isDeleted: false,
      }),
    ]);

    // Attach comment counts
    const postIds = posts.map((p) => p._id);
    const commentCounts = await Comment.aggregate([
      { $match: { post: { $in: postIds }, isDeleted: false } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(commentCounts.map((c) => [String(c._id), c.count]));

    const enriched = posts.map((p) => ({
      ...p,
      commentCount: countMap.get(String(p._id)) || p.commentCount || 0,
    }));

    return res.json({
      success: true,
      data: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Feed error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// POST /posts
// ──────────────────────────────────────────────
router.post('/', protect, postRateLimiter, async (req: Request, res: Response) => {
  try {
    const { content, visibility, tags } = req.body;

    if (!content || String(content).trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Post content is required' });
    }
    if (String(content).length > 5000) {
      return res.status(400).json({ success: false, message: 'Post exceeds 5000 characters' });
    }

    const post = await Post.create({
      author: req.user!.id,
      content: String(content).trim(),
      visibility: visibility || 'public',
      tags: Array.isArray(tags) ? tags.slice(0, 10).map(String) : [],
    });

    await post.populate('author', 'firstName lastName profilePicture headline');
    return res.status(201).json({ success: true, data: post });
  } catch (error) {
    logger.error('Create post error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /posts/:id
// ──────────────────────────────────────────────
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, isDeleted: false }).populate(
      'author',
      'firstName lastName profilePicture headline location'
    );

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const comments = await Comment.find({ post: post._id, isDeleted: false, parentComment: null })
      .populate('author', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.json({ success: true, data: { ...post.toObject(), comments } });
  } catch (error) {
    logger.error('Get post error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// PUT /posts/:id
// ──────────────────────────────────────────────
router.put('/:id', protect, async (req: Request, res: Response) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    if (String(post.author) !== String(req.user!.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this post' });
    }

    const { content, visibility } = req.body;
    if (content) {
      if (String(content).length > 5000) {
        return res.status(400).json({ success: false, message: 'Post exceeds 5000 characters' });
      }
      post.content = String(content).trim();
      post.isEdited = true;
    }
    if (visibility) post.visibility = visibility;

    await post.save();
    await post.populate('author', 'firstName lastName profilePicture headline');
    return res.json({ success: true, data: post });
  } catch (error) {
    logger.error('Edit post error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// DELETE /posts/:id
// ──────────────────────────────────────────────
router.delete('/:id', protect, async (req: Request, res: Response) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const isOwner = String(post.author) === String(req.user!.id);
    const isMod = ['admin', 'moderator'].includes(req.user!.role);
    if (!isOwner && !isMod) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    post.isDeleted = true;
    await post.save();
    return res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    logger.error('Delete post error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// POST /posts/:id/react
// ──────────────────────────────────────────────
router.post('/:id/react', protect, async (req: Request, res: Response) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const validTypes = ['like', 'celebrate', 'support', 'love', 'insightful', 'curious'] as const;
    const { type } = req.body;
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid reaction type' });
    }

    const userId = req.user!.id as unknown as mongoose.Types.ObjectId;
    const reactionList = post.reactions[type as keyof typeof post.reactions] as mongoose.Types.ObjectId[];
    const alreadyReacted = reactionList.some((id) => id.toString() === userId.toString());

    if (alreadyReacted) {
      post.removeReaction(userId);
    } else {
      post.addReaction(userId, type);

      if (String(post.author) !== String(userId)) {
        await notify({
          recipient: post.author,
          sender: userId,
          type: 'post_reaction',
          title: 'New reaction',
          message: `reacted to your post`,
          reference: post._id as mongoose.Types.ObjectId,
          referenceModel: 'Post',
        });
      }
    }

    await post.save();
    return res.json({ success: true, data: { reactionCount: post.reactionCount } });
  } catch (error) {
    logger.error('React error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// POST /posts/:id/comments
// ──────────────────────────────────────────────
router.post('/:id/comments', protect, async (req: Request, res: Response) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const { content } = req.body;
    if (!content || String(content).trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    const comment = await Comment.create({
      post: post._id,
      author: req.user!.id,
      content: String(content).trim(),
    });

    await comment.populate('author', 'firstName lastName profilePicture');

    // Update comment count on post
    post.incrementCommentCount();
    await post.save();

    if (String(post.author) !== String(req.user!.id)) {
      await notify({
        recipient: post.author,
        sender: req.user!.id,
        type: 'comment',
        title: 'New comment',
        message: 'commented on your post',
        reference: post._id as mongoose.Types.ObjectId,
        referenceModel: 'Post',
      });
    }

    return res.status(201).json({ success: true, data: comment });
  } catch (error) {
    logger.error('Add comment error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// DELETE /posts/:id/comments/:commentId
// ──────────────────────────────────────────────
router.delete('/:id/comments/:commentId', protect, async (req: Request, res: Response) => {
  try {
    const comment = await Comment.findOne({ _id: req.params.commentId, post: req.params.id });
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    const isOwner = String(comment.author) === String(req.user!.id);
    const isMod = ['admin', 'moderator'].includes(req.user!.role);
    if (!isOwner && !isMod) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    comment.isDeleted = true;
    await comment.save();

    // Decrement count on post
    const post = await Post.findById(req.params.id);
    if (post) {
      post.decrementCommentCount();
      await post.save();
    }

    return res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    logger.error('Delete comment error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
