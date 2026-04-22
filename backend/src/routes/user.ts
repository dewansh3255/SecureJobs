/**
 * User Routes
 * GET /users/:id — view profile
 * GET /users/me — own profile
 * PUT /users/me — update profile
 * GET /users/search — search users
 * POST /users/me/photo — upload profile picture
 * POST /users/me/cover — upload cover image
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { protect, optionalAuth } from '../middleware/auth';
import { uploadRateLimiter, searchRateLimiter } from '../middleware/security';
import User from '../models/User';
import logger, { logSecurityEvent } from '../utils/logger';

const router = Router();

// Multer: store in memory, validate type & size
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG and WebP images are allowed'));
    }
  },
});

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
const coversDir = path.join(process.cwd(), 'uploads', 'covers');

const ensureDirs = async () => {
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.mkdir(coversDir, { recursive: true });
};
ensureDirs().catch((e) => logger.error('Could not create upload dirs', e));

// ──────────────────────────────────────────────
// GET /users/me — own full profile
// ──────────────────────────────────────────────
router.get('/me', protect, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select(
      '-password -refreshToken -csrfSecret -resetPasswordToken -resetPasswordExpires'
    );
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Get own profile error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// PUT /users/me — update profile
// ──────────────────────────────────────────────
router.put('/me', protect, async (req: Request, res: Response) => {
  try {
    const allowed = [
      'firstName',
      'lastName',
      'headline',
      'about',
      'location',
      'website',
      'industry',
      'skills',
      'experience',
      'education',
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    // Reject attempts to escalate role via this endpoint
    if (req.body.role || req.body.isAdmin) {
      logSecurityEvent('Profile role escalation attempt', {
        userId: req.user!.id,
        ip: req.ip,
      }, 'warn');
      return res.status(403).json({ success: false, message: 'Cannot update role via this endpoint' });
    }

    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -refreshToken -csrfSecret -resetPasswordToken -resetPasswordExpires');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, data: user, message: 'Profile updated successfully' });
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    logger.error('Update profile error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /users/search — search users by name/headline
// ──────────────────────────────────────────────
router.get('/search', optionalAuth, searchRateLimiter, async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || '').trim().slice(0, 100);
    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || '10'))));
    const skip = (page - 1) * limit;

    const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const filter: Record<string, unknown> = {
      isActive: true,
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { headline: searchRegex },
        { industry: searchRegex },
      ],
    };

    // Never return the requesting user in search results
    if (req.user?.id) {
      filter._id = { $ne: req.user.id };
    }

    const users = await User.find(filter)
      .select('firstName lastName profilePicture headline location industry')
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({ success: true, data: users, page, limit });
  } catch (error) {
    logger.error('User search error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /users/:id — view public profile
// ──────────────────────────────────────────────
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select(
      '-password -refreshToken -csrfSecret -resetPasswordToken -resetPasswordExpires -loginAttempts -lockUntil'
    );

    if (!user || !user.isActive) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Respect profile visibility settings
    if (user.settings.profileVisibility === 'private' && String(req.user?.id) !== String(user._id)) {
      return res.status(403).json({ success: false, message: 'This profile is private' });
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Get user profile error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// POST /users/me/photo — upload profile picture
// ──────────────────────────────────────────────
router.post('/me/photo', protect, uploadRateLimiter, upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const filename = `avatar-${req.user!.id}-${Date.now()}.webp`;
    const filepath = path.join(uploadsDir, filename);

    // Resize & convert to WebP for consistency + strip EXIF metadata (privacy)
    await sharp(req.file.buffer)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toFile(filepath);

    const photoUrl = `/uploads/avatars/${filename}`;
    await User.findByIdAndUpdate(req.user!.id, { profilePicture: photoUrl });

    return res.json({ success: true, data: { profilePicture: photoUrl }, message: 'Profile picture updated' });
  } catch (error) {
    logger.error('Photo upload error', error);
    return res.status(500).json({ success: false, message: 'Photo upload failed' });
  }
});

// ──────────────────────────────────────────────
// POST /users/me/cover — upload cover image
// ──────────────────────────────────────────────
router.post('/me/cover', protect, uploadRateLimiter, upload.single('cover'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const filename = `cover-${req.user!.id}-${Date.now()}.webp`;
    const filepath = path.join(coversDir, filename);

    await sharp(req.file.buffer)
      .resize(1200, 300, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toFile(filepath);

    const coverUrl = `/uploads/covers/${filename}`;
    await User.findByIdAndUpdate(req.user!.id, { coverImage: coverUrl });

    return res.json({ success: true, data: { coverImage: coverUrl }, message: 'Cover image updated' });
  } catch (error) {
    logger.error('Cover upload error', error);
    return res.status(500).json({ success: false, message: 'Cover upload failed' });
  }
});

export default router;
