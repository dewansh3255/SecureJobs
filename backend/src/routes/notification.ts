/**
 * Notification Routes
 * GET    /notifications          — list notifications
 * PATCH  /notifications/:id/read — mark one as read
 * PATCH  /notifications/read-all — mark all as read
 * GET    /notifications/unread-count — badge count
 */

import { Router, Request, Response } from 'express';
import { protect } from '../middleware/auth';
import Notification from '../models/Notification';
import logger from '../utils/logger';

const router = Router();

// ──────────────────────────────────────────────
// GET /notifications/unread-count
// ──────────────────────────────────────────────
router.get('/unread-count', protect, async (req: Request, res: Response) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user!.id,
      read: false,
    });
    return res.json({ success: true, data: { count } });
  } catch (error) {
    logger.error('Unread count error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /notifications
// ──────────────────────────────────────────────
router.get('/', protect, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(50, parseInt(String(req.query.limit || '20')));
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ recipient: req.user!.id })
      .populate('sender', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({ success: true, data: notifications, page, limit });
  } catch (error) {
    logger.error('Get notifications error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// PATCH /notifications/:id/read
// ──────────────────────────────────────────────
router.patch('/:id/read', protect, async (req: Request, res: Response) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user!.id },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    return res.json({ success: true, data: notification });
  } catch (error) {
    logger.error('Mark read error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// PATCH /notifications/read-all
// ──────────────────────────────────────────────
router.patch('/read-all', protect, async (req: Request, res: Response) => {
  try {
    await Notification.updateMany(
      { recipient: req.user!.id, read: false },
      { read: true, readAt: new Date() }
    );
    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    logger.error('Mark all read error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
