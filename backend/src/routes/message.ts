/**
 * Messaging Routes
 * GET    /messages/conversations         — list conversations
 * POST   /messages/conversations         — create/get direct conversation
 * GET    /messages/conversations/:id     — single conversation with messages
 * POST   /messages/conversations/:id     — send message to conversation
 * PATCH  /messages/conversations/:id/read — mark messages as read
 */

import { Router, Request, Response } from 'express';
import { protect } from '../middleware/auth';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import logger from '../utils/logger';

const router = Router();

// ──────────────────────────────────────────────
// GET /messages/conversations — list user's conversations
// ──────────────────────────────────────────────
router.get('/conversations', protect, async (req: Request, res: Response) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user!.id,
      isActive: true,
    })
      .populate('participants', 'firstName lastName profilePicture headline isOnline')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 })
      .lean();

    return res.json({ success: true, data: conversations });
  } catch (error) {
    logger.error('List conversations error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// POST /messages/conversations — create or get direct conversation
// ──────────────────────────────────────────────
router.post('/conversations', protect, async (req: Request, res: Response) => {
  try {
    const { participantId, groupName } = req.body;

    if (req.body.type === 'group') {
      // Group conversation
      const { participantIds } = req.body;
      if (!Array.isArray(participantIds) || participantIds.length < 2) {
        return res.status(400).json({ success: false, message: 'Group needs at least 2 other participants' });
      }

      const allParticipants = [String(req.user!.id), ...participantIds.map(String)];

      const conversation = await Conversation.create({
        type: 'group',
        participants: allParticipants,
        name: groupName || 'Group Chat',
        admin: req.user!.id,
      });

      await conversation.populate('participants', 'firstName lastName profilePicture');
      return res.status(201).json({ success: true, data: conversation });
    }

    // Direct conversation
    if (!participantId) {
      return res.status(400).json({ success: false, message: 'participantId is required' });
    }

    if (String(participantId) === String(req.user!.id)) {
      return res.status(400).json({ success: false, message: 'Cannot message yourself' });
    }

    // Check if a direct conversation already exists (application-level duplicate check)
    const existing = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [req.user!.id, participantId], $size: 2 },
    }).populate('participants', 'firstName lastName profilePicture');

    if (existing) {
      return res.json({ success: true, data: existing });
    }

    const conversation = await Conversation.create({
      type: 'direct',
      participants: [req.user!.id, participantId],
    });

    await conversation.populate('participants', 'firstName lastName profilePicture');
    return res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    logger.error('Create conversation error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /messages/conversations/:id — messages in conversation
// ──────────────────────────────────────────────
router.get('/conversations/:id', protect, async (req: Request, res: Response) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user!.id,
    }).populate('participants', 'firstName lastName profilePicture headline');

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(50, parseInt(String(req.query.limit || '30')));
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      conversation: req.params.id,
      isDeleted: false,
    })
      .populate('sender', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      data: {
        conversation,
        messages: messages.reverse(),
      },
      page,
      limit,
    });
  } catch (error) {
    logger.error('Get conversation error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// POST /messages/conversations/:id — send message
// ──────────────────────────────────────────────
router.post('/conversations/:id', protect, async (req: Request, res: Response) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user!.id,
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const { content, messageType } = req.body;

    if (!content || String(content).trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    if (String(content).length > 5000) {
      return res.status(400).json({ success: false, message: 'Message too long (max 5000 chars)' });
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user!.id,
      content: String(content).trim(),
      messageType: messageType || 'text',
      readBy: [{ user: req.user!.id, readAt: new Date() }],
    });

    // Update conversation's lastMessage + lastMessageAt
    conversation.lastMessage = message._id as any;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    await message.populate('sender', 'firstName lastName profilePicture');

    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    logger.error('Send message error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// PATCH /messages/conversations/:id/read — mark messages as read
// ──────────────────────────────────────────────
router.patch('/conversations/:id/read', protect, async (req: Request, res: Response) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user!.id,
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Mark all unread messages in this conversation as read by current user
    await Message.updateMany(
      {
        conversation: req.params.id,
        'readBy.user': { $ne: req.user!.id },
        isDeleted: false,
      },
      {
        $push: { readBy: { user: req.user!.id, readAt: new Date() } },
      }
    );

    return res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    logger.error('Mark read error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
