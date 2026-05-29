/**
 * Connection Routes
 * POST   /connections/request/:userId — send connection request
 * PUT    /connections/:id/accept       — accept request
 * PUT    /connections/:id/reject       — reject request
 * DELETE /connections/:id             — cancel/remove connection
 * GET    /connections/pending          — list pending requests
 * GET    /connections                  — list accepted connections
 */

import { Router, Request, Response } from 'express';
import { protect } from '../middleware/auth';
import { connectionRateLimiter } from '../middleware/security';
import Connection from '../models/Connection';
import User from '../models/User';
import Notification from '../models/Notification';
import logger from '../utils/logger';

const router = Router();

// ──────────────────────────────────────────────
// POST /connections/request/:userId
// ──────────────────────────────────────────────
router.post('/request/:userId', protect, connectionRateLimiter, async (req: Request, res: Response) => {
  try {
    const requesterId = req.user!.id;
    const recipientId = req.params.userId;

    if (String(requesterId) === String(recipientId)) {
      return res.status(400).json({ success: false, message: 'Cannot connect with yourself' });
    }

    // Check recipient exists
    const recipient = await User.findById(recipientId).select('_id firstName lastName isActive');
    if (!recipient || !recipient.isActive) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check for existing connection in either direction
    const existing = await Connection.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId },
      ],
    });

    if (existing) {
      if (existing.status === 'pending') {
        return res.status(409).json({ success: false, message: 'Connection request already sent' });
      }
      if (existing.status === 'accepted') {
        return res.status(409).json({ success: false, message: 'Already connected' });
      }
      if (existing.status === 'rejected') {
        // Allow re-request after rejection — reset the record
        existing.status = 'pending';
        existing.requester = requesterId;
        existing.recipient = recipientId as any;
        await existing.save();

        await Notification.create({
          recipient: recipientId,
          sender: requesterId,
          type: 'connection_request',
          title: 'Connection request',
          message: 'sent you a connection request',
          reference: existing._id,
          referenceModel: 'Connection',
          data: { connectionId: String(existing._id) },
        }).catch(() => {});

        return res.status(200).json({ success: true, data: existing, message: 'Connection request sent' });
      }
    }

    const connection = await Connection.create({
      requester: requesterId,
      recipient: recipientId,
      status: 'pending',
    });

    // Create notification for recipient
    await Notification.create({
      recipient: recipientId,
      sender: requesterId,
      type: 'connection_request',
      title: 'Connection request',
      message: 'sent you a connection request',
      reference: connection._id,
      referenceModel: 'Connection',
      data: { connectionId: String(connection._id) },
    }).catch(() => {});

    return res.status(201).json({ success: true, data: connection, message: 'Connection request sent' });
  } catch (error) {
    logger.error('Send connection request error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// PUT /connections/:id/accept
// ──────────────────────────────────────────────
router.put('/:id/accept', protect, async (req: Request, res: Response) => {
  try {
    const connection = await Connection.findById(req.params.id);
    if (!connection) {
      return res.status(404).json({ success: false, message: 'Connection not found' });
    }

    // Only the recipient can accept
    if (String(connection.recipient) !== String(req.user!.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to accept this request' });
    }

    if (connection.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Connection is not in pending state' });
    }

    connection.status = 'accepted';
    await connection.save();

    // Add each user to the other's connections array
    await User.findByIdAndUpdate(connection.requester, {
      $addToSet: { connections: connection.recipient },
    });
    await User.findByIdAndUpdate(connection.recipient, {
      $addToSet: { connections: connection.requester },
    });

    // Notify the original requester
    await Notification.create({
      recipient: connection.requester,
      sender: connection.recipient,
      type: 'connection_accepted',
      title: 'Connection accepted',
      message: 'accepted your connection request',
    }).catch(() => {});

    return res.json({ success: true, data: connection, message: 'Connection accepted' });
  } catch (error) {
    logger.error('Accept connection error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// PUT /connections/:id/reject
// ──────────────────────────────────────────────
router.put('/:id/reject', protect, async (req: Request, res: Response) => {
  try {
    const connection = await Connection.findById(req.params.id);
    if (!connection) {
      return res.status(404).json({ success: false, message: 'Connection not found' });
    }

    if (String(connection.recipient) !== String(req.user!.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to reject this request' });
    }

    connection.status = 'rejected';
    await connection.save();

    return res.json({ success: true, message: 'Connection request rejected' });
  } catch (error) {
    logger.error('Reject connection error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// DELETE /connections/:id — cancel or remove
// ──────────────────────────────────────────────
router.delete('/:id', protect, async (req: Request, res: Response) => {
  try {
    const connection = await Connection.findById(req.params.id);
    if (!connection) {
      return res.status(404).json({ success: false, message: 'Connection not found' });
    }

    const userId = String(req.user!.id);
    if (String(connection.requester) !== userId && String(connection.recipient) !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Remove from both users' connections arrays if accepted
    if (connection.status === 'accepted') {
      await User.findByIdAndUpdate(connection.requester, {
        $pull: { connections: connection.recipient },
      });
      await User.findByIdAndUpdate(connection.recipient, {
        $pull: { connections: connection.requester },
      });
    }

    await connection.deleteOne();
    return res.json({ success: true, message: 'Connection removed' });
  } catch (error) {
    logger.error('Remove connection error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /connections/pending — pending received requests
// ──────────────────────────────────────────────
router.get('/pending', protect, async (req: Request, res: Response) => {
  try {
    const requests = await Connection.find({
      recipient: req.user!.id,
      status: 'pending',
    })
      .populate('requester', 'firstName lastName profilePicture headline location')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: requests, count: requests.length });
  } catch (error) {
    logger.error('Get pending connections error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /connections — accepted connections list (paginated)
// ──────────────────────────────────────────────
router.get('/', protect, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
    const skip = (page - 1) * limit;

    const filter = {
      $or: [{ requester: req.user!.id }, { recipient: req.user!.id }],
      status: 'accepted',
    };

    const [connections, total] = await Promise.all([
      Connection.find(filter)
        .populate('requester', 'firstName lastName profilePicture headline location')
        .populate('recipient', 'firstName lastName profilePicture headline location')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Connection.countDocuments(filter),
    ]);

    // Return the "other user" in each connection
    const data = connections.map((c) => {
      const other =
        String((c.requester as any)._id) === String(req.user!.id) ? c.recipient : c.requester;
      return { connectionId: c._id, user: other, connectedAt: c.updatedAt };
    });

    return res.json({ success: true, data, count: data.length, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    logger.error('Get connections error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /connections/suggestions — people you may know (2nd-degree connections)
// ──────────────────────────────────────────────
router.get('/suggestions', protect, async (req: Request, res: Response) => {
  try {
    const me = await User.findById(req.user!.id).select('connections skills industry').lean();
    if (!me) return res.status(404).json({ success: false, message: 'User not found' });

    const myId = String(req.user!.id);
    const myConnectionIds = (me.connections || []).map(String);
    const excludeIds = new Set([myId, ...myConnectionIds]);

    // Collect 2nd-degree connection IDs with mutual count
    const mutualCounts: Record<string, number> = {};

    if (myConnectionIds.length > 0) {
      // For each 1st-degree friend, get THEIR connections
      const friends = await User.find({ _id: { $in: myConnectionIds } })
        .select('connections')
        .lean();

      for (const friend of friends) {
        for (const cid of (friend.connections || []).map(String)) {
          if (!excludeIds.has(cid)) {
            mutualCounts[cid] = (mutualCounts[cid] || 0) + 1;
          }
        }
      }
    }

    const secondDegreeIds = Object.keys(mutualCounts);

    let suggestions: any[] = [];

    if (secondDegreeIds.length > 0) {
      // Sort 2nd-degree candidates by mutual connection count (desc)
      const sorted = secondDegreeIds.sort((a, b) => mutualCounts[b] - mutualCounts[a]).slice(0, 15);
      const users = await User.find({ _id: { $in: sorted }, isActive: true })
        .select('firstName lastName profilePicture headline location industry skills connections')
        .lean();

      suggestions = users.map((u) => ({
        ...u,
        mutualConnections: mutualCounts[String(u._id)] || 0,
      }));
      // Re-sort by mutual count (DB may return in any order)
      suggestions.sort((a, b) => b.mutualConnections - a.mutualConnections);
    }

    // If still not enough suggestions, backfill with industry/skills match
    if (suggestions.length < 5) {
      const alreadySuggested = new Set([...excludeIds, ...suggestions.map((s) => String(s._id))]);
      const fallback = await User.find({
        _id: { $nin: [...alreadySuggested] },
        isActive: true,
        $or: [
          { industry: me.industry || '__none__' },
          { skills: { $in: me.skills || [] } },
        ],
      })
        .select('firstName lastName profilePicture headline location industry skills')
        .limit(10 - suggestions.length)
        .lean();

      suggestions = [...suggestions, ...fallback.map((u) => ({ ...u, mutualConnections: 0 }))];
    }

    return res.json({ success: true, data: suggestions.slice(0, 10) });
  } catch (error) {
    logger.error('Suggestions error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
