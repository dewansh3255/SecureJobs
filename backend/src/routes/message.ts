/**
 * Messaging Routes
 * GET    /messages/contacts               — messageable contacts (accepted connections)
 * GET    /messages/conversations         — list conversations
 * GET    /messages/unread-count          — total unread message count
 * POST   /messages/conversations         — create/get direct conversation
 * GET    /messages/conversations/:id     — single conversation with messages
 * POST   /messages/conversations/:id     — send message to conversation
 * PATCH  /messages/conversations/:id/read — mark messages as read
 * POST   /messages/:id/verify            — verify ECDSA signature on a message
 */

import { Router, Request, Response } from 'express';
import { webcrypto } from 'node:crypto';
import crypto from 'node:crypto';
import { protect } from '../middleware/auth';
import { messagingRateLimiter } from '../middleware/security';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import User from '../models/User';
import Connection from '../models/Connection';
import { getRedisClient } from '../config/redis';
import logger from '../utils/logger';

const { subtle } = webcrypto;

const router = Router();

// ──────────────────────────────────────────────
// GET /messages/contacts — accepted connections you can message
// Returns basic profile info; frontend uses this to start new conversations
// ──────────────────────────────────────────────
router.get('/contacts', protect, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Find all accepted connections where this user is either requester or recipient
    const connections = await Connection.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: 'accepted',
    }).lean();

    const contactIds = connections.map(c =>
      String(c.requester) === String(userId) ? c.recipient : c.requester
    );

    const contacts = await User.find({ _id: { $in: contactIds }, isActive: { $ne: false } })
      .select('firstName lastName headline profilePicture lastSeen')
      .lean();

    return res.json({ success: true, data: contacts });
  } catch (error) {
    logger.error('Get contacts error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /messages/unread-count — total unread messages for current user
// ──────────────────────────────────────────────
router.get('/unread-count', protect, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    // Scope to conversations the user participates in to avoid counting foreign messages
    const userConversations = await Conversation.find({ participants: userId }).select('_id').lean();
    const convIds = userConversations.map((c) => c._id);
    const count = await Message.countDocuments({
      conversation: { $in: convIds },
      sender: { $ne: userId },
      'readBy.user': { $ne: userId },
    });
    return res.json({ success: true, data: { count } });
  } catch (error) {
    logger.error('Unread message count error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /messages/conversations — list user's conversations
// ──────────────────────────────────────────────
router.get('/conversations', protect, async (req: Request, res: Response) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user!.id,
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

    // Friends-only messaging: verify both users are connected
    const me = await User.findById(req.user!.id).select('connections').lean();
    const isConnected = me?.connections?.some((c) => String(c) === String(participantId));
    if (!isConnected) {
      return res.status(403).json({
        success: false,
        message: 'You can only message people you are connected with',
      });
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
router.post('/conversations/:id', protect, messagingRateLimiter, async (req: Request, res: Response) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user!.id,
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // For direct conversations, verify the users are still connected
    if (conversation.type === 'direct') {
      const otherId = conversation.participants.find(
        (p) => String(p) !== String(req.user!.id)
      );
      if (otherId) {
        const me = await User.findById(req.user!.id).select('connections').lean();
        const isConnected = me?.connections?.some((c) => String(c) === String(otherId));
        if (!isConnected) {
          return res.status(403).json({
            success: false,
            message: 'You can only message people you are connected with',
          });
        }
      }
    }

    const { content, messageType, signature, signerPublicKey } = req.body;

    if (!content || String(content).trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    if (String(content).length > 5000) {
      return res.status(400).json({ success: false, message: 'Message too long (max 5000 chars)' });
    }

    const messageData: Record<string, unknown> = {
      conversation: conversation._id,
      sender: req.user!.id,
      content: String(content).trim(),
      messageType: messageType || 'text',
      readBy: [{ user: req.user!.id, readAt: new Date() }],
    };

    if (signature && typeof signature === 'string') {
      // Replay protection: reject duplicate signatures within 2 hours
      const redis = getRedisClient();
      if (redis) {
        const sigHash = crypto.createHash('sha256').update(signature).digest('hex');
        const sigKey = `sig_used:${sigHash}`;
        const alreadyUsed = await redis.get(sigKey);
        if (alreadyUsed) {
          return res.status(409).json({ success: false, message: 'Duplicate message signature detected' });
        }
        await redis.setEx(sigKey, 7200, '1'); // 2h TTL
      }
      messageData.signature = signature;
    }
    if (signerPublicKey && typeof signerPublicKey === 'string') {
      messageData.signerPublicKey = signerPublicKey;
    }

    const message = await Message.create(messageData);

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

// ──────────────────────────────────────────────
// POST /messages/:id/verify — verify ECDSA signature on a message
// ──────────────────────────────────────────────
router.post('/:id/verify', protect, async (req: Request, res: Response) => {
  try {
    const message = await Message.findById(req.params.id).lean();

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Ensure the requester is a participant in the conversation
    const conversation = await Conversation.findOne({
      _id: message.conversation,
      participants: req.user!.id,
    }).lean();

    if (!conversation) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!message.signature || !message.signerPublicKey) {
      return res.json({ verified: false, reason: 'unsigned', messageId: req.params.id });
    }

    try {
      const jwk = JSON.parse(message.signerPublicKey) as Record<string, unknown>;
      const key = await subtle.importKey(
        'jwk',
        jwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );
      const sig = Buffer.from(message.signature, 'base64');
      const data = Buffer.from(message.content);
      const valid = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, data);
      return res.json({ verified: valid, messageId: req.params.id, timestamp: message.createdAt });
    } catch (cryptoErr) {
      logger.error('Signature verification crypto error', cryptoErr);
      return res.json({ verified: false, reason: 'invalid_signature', messageId: req.params.id });
    }
  } catch (error) {
    logger.error('Verify signature error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// PATCH /messages/read-all — mark all unread messages as read
// ──────────────────────────────────────────────
router.patch('/read-all', protect, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get all conversations the user is part of
    const conversations = await Conversation.find({
      participants: userId,
      isActive: true,
    }).select('_id').lean();

    const convIds = conversations.map((c) => c._id);

    const result = await Message.updateMany(
      {
        conversation: { $in: convIds },
        sender: { $ne: userId },
        'readBy.user': { $ne: userId },
        isDeleted: false,
      },
      {
        $addToSet: { readBy: { user: userId, readAt: new Date() } },
      }
    );

    return res.json({
      success: true,
      message: `Marked ${result.modifiedCount} messages as read`,
    });
  } catch (error) {
    logger.error('Mark all read error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /messages/search?q= — search messages/conversations
// ──────────────────────────────────────────────
router.get('/search', protect, async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (!q) return res.json({ success: true, data: { conversations: [], messages: [] } });

    // Escape regex metacharacters to prevent ReDoS
    const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const userId = req.user!.id;

    // Search conversation names
    const conversations = await Conversation.find({
      participants: userId,
      name: { $regex: safeQ, $options: 'i' },
    })
      .populate('participants', 'firstName lastName profilePicture')
      .limit(10)
      .lean();

    // Search message content
    const userConvIds = (
      await Conversation.find({ participants: userId }).select('_id').lean()
    ).map((c) => c._id);

    const messages = await Message.find({
      conversation: { $in: userConvIds },
      content: { $regex: safeQ, $options: 'i' },
      isDeleted: false,
    })
      .populate('sender', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.json({ success: true, data: { conversations, messages } });
  } catch (error) {
    logger.error('Message search error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
