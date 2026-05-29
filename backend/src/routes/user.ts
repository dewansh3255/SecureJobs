/**
 * User Routes
 * GET /users/:id — view profile
 * GET /users/me — own profile
 * PUT /users/me — update profile
 * GET /users/search — search users
 * POST /users/me/photo — upload profile picture
 * POST /users/me/cover — upload cover image
 * POST /users/me/resume — upload ZK-encrypted resume (PDF/DOCX, already encrypted by browser)
 * GET  /users/me/resume — download raw ciphertext resume (TOTP-gated; browser decrypts)
 * DELETE /users/me/resume — delete resume
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { protect, optionalAuth } from '../middleware/auth';
import { uploadRateLimiter, searchRateLimiter } from '../middleware/security';
import User from '../models/User';
import Connection from '../models/Connection';
import AuditLog from '../models/AuditLog';
import logger, { logSecurityEvent } from '../utils/logger';
import { verifyTOTPOnce, type TOTPVerifyResult } from '../utils/totp';
import { getRedisClient } from '../config/redis';

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
const resumesDir = path.join(process.cwd(), 'uploads', 'resumes');

const ensureDirs = async () => {
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.mkdir(coversDir, { recursive: true });
  await fs.mkdir(resumesDir, { recursive: true });
};
ensureDirs().catch((e) => logger.error('Could not create upload dirs', e));

// Multer for resume uploads — the body is AES-GCM ciphertext from the browser.
// Accept any binary content (limit 10MB); MIME type from the encrypted blob is
// 'application/octet-stream'. We validate the *original* MIME from a FormData field.
const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ──────────────────────────────────────────────
// Helper: apply field-level privacy filter
// ──────────────────────────────────────────────
type PrivacyLevel = 'public' | 'connections' | 'private';

interface PrivacySettings {
  email?: PrivacyLevel;
  phone?: PrivacyLevel;
  headline?: PrivacyLevel;
  about?: PrivacyLevel;
  experience?: PrivacyLevel;
  education?: PrivacyLevel;
  skills?: PrivacyLevel;
  connections?: PrivacyLevel;
  resume?: PrivacyLevel;
}

function applyPrivacyFilter(profile: Record<string, unknown>, settings: PrivacySettings, isConnected: boolean): void {
  const fields: (keyof PrivacySettings)[] = ['email', 'phone', 'headline', 'about', 'experience', 'education', 'skills', 'resume'];
  for (const field of fields) {
    const level: PrivacyLevel = settings[field] ?? 'public';
    if (level === 'private') {
      delete profile[field];
    } else if (level === 'connections' && !isConnected) {
      delete profile[field];
    }
  }
  // connections list (array of connection objects) uses its own setting key
  const connLevel: PrivacyLevel = settings.connections ?? 'connections';
  if (connLevel === 'private') {
    delete profile['connections'];
  } else if (connLevel === 'connections' && !isConnected) {
    delete profile['connections'];
  }
}

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
      'phone',
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
// PATCH /users/me/account-type — switch candidate ↔ recruiter
// ANY direction requires a valid TOTP code (security-sensitive role change).
// Wrong TOTP is tracked in Redis: 3 failures → 15-min lockout.
// Uses HTTP 422 (not 401) so the frontend interceptor won't trigger a token refresh.
// ──────────────────────────────────────────────
const TOTP_MAX_ATTEMPTS = 3;
const TOTP_LOCKOUT_SECONDS = 15 * 60; // 15 minutes

router.patch('/me/account-type', protect, async (req: Request, res: Response) => {
  try {
    const { accountType, totpCode } = req.body;
    if (!['candidate', 'recruiter'].includes(accountType)) {
      return res.status(400).json({ success: false, message: 'accountType must be candidate or recruiter' });
    }

    // Prevent switching to the same type
    const currentUser = await User.findById(req.user!.id).select('accountType twoFactorEnabled +twoFactorSecret');
    if (!currentUser) return res.status(404).json({ success: false, message: 'User not found' });

    if ((currentUser.accountType ?? 'candidate') === accountType) {
      return res.status(400).json({ success: false, message: `You are already a ${accountType}.` });
    }

    // TOTP required for any account type change
    const redis = getRedisClient();
    const userId = String(req.user!.id);
    const lockKey = `acct_type_totp_locked:${userId}`;
    const attemptsKey = `acct_type_totp_attempts:${userId}`;

    // Check if currently locked out
    if (redis) {
      const lockedUntil = await redis.get(lockKey);
      if (lockedUntil) {
        const secs = Math.ceil((parseInt(lockedUntil) - Date.now()) / 1000);
        return res.status(429).json({
          success: false,
          locked: true,
          lockSeconds: Math.max(0, secs),
          message: `Too many failed attempts. Try again in ${Math.ceil(secs / 60)} minute(s).`,
        });
      }
    }

    if (!currentUser.twoFactorEnabled || !currentUser.twoFactorSecret) {
      return res.status(403).json({
        success: false,
        message: 'You must have 2FA enabled to change your account type.',
      });
    }

    if (!totpCode) {
      return res.status(422).json({
        success: false,
        attemptsLeft: TOTP_MAX_ATTEMPTS,
        message: `TOTP code is required to change your account type.`,
      });
    }

    const totpResult: TOTPVerifyResult = await verifyTOTPOnce(String(totpCode), currentUser.twoFactorSecret, userId);

    if (totpResult !== 'ok') {
      logSecurityEvent('account_type_switch_invalid_totp', { userId, reason: totpResult, targetType: accountType }, 'warn', req as any);

      if (totpResult === 'replay') {
        return res.status(422).json({
          success: false,
          attemptsLeft: null,
          message: 'This code has already been used. Please wait for a new code from your authenticator app.',
        });
      }

      // Track failed attempts in Redis
      let attemptsLeft = TOTP_MAX_ATTEMPTS - 1;
      if (redis) {
        const current = await redis.incr(attemptsKey);
        await redis.expire(attemptsKey, TOTP_LOCKOUT_SECONDS);
        attemptsLeft = Math.max(0, TOTP_MAX_ATTEMPTS - current);

        if (current >= TOTP_MAX_ATTEMPTS) {
          const lockUntil = Date.now() + TOTP_LOCKOUT_SECONDS * 1000;
          await redis.set(lockKey, String(lockUntil), { EX: TOTP_LOCKOUT_SECONDS });
          await redis.del(attemptsKey);
          logSecurityEvent('account_type_switch_totp_lockout', { userId }, 'warn', req as any);
          return res.status(429).json({
            success: false,
            locked: true,
            lockSeconds: TOTP_LOCKOUT_SECONDS,
            message: `Too many failed attempts. Locked out for 15 minutes.`,
          });
        }
      }

      return res.status(422).json({
        success: false,
        attemptsLeft,
        message: `Invalid TOTP code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
      });
    }

    // Correct TOTP — clear any attempt counters
    if (redis) {
      await redis.del(attemptsKey);
      await redis.del(lockKey);
    }

    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { $set: { accountType } },
      { new: true }
    ).select('-password -refreshToken -csrfSecret -resetPasswordToken -resetPasswordExpires');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    logSecurityEvent('account_type_changed', { userId: req.user!.id, accountType }, 'info', req as any);

    // Write to AuditLog for forensics
    await AuditLog.create({
      event: 'account_type_changed',
      userId: req.user!.id,
      action: 'account_type_changed',
      severity: 'info',
      details: { old: currentUser.accountType ?? 'candidate', new: accountType },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }).catch(() => {});

    return res.json({ success: true, data: user, message: `Switched to ${accountType} mode` });
  } catch (error) {
    logger.error('Account type switch error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// PATCH /users/me/privacy — update field-level privacy settings
// ──────────────────────────────────────────────
const PRIVACY_FIELDS = ['email', 'phone', 'headline', 'about', 'experience', 'education', 'skills', 'connections', 'resume'] as const;
const VALID_LEVELS = ['public', 'connections', 'private'] as const;

router.patch('/me/privacy', protect, async (req: Request, res: Response) => {
  try {
    const updates: Record<string, string> = {};
    for (const field of PRIVACY_FIELDS) {
      if (req.body[field] !== undefined) {
        if (!(VALID_LEVELS as readonly string[]).includes(req.body[field])) {
          return res.status(400).json({
            success: false,
            message: `Invalid value for ${field}: must be 'public', 'connections', or 'private'`,
          });
        }
        updates[`privacySettings.${field}`] = req.body[field];
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('privacySettings');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, data: user.privacySettings, message: 'Privacy settings updated' });
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    logger.error('Update privacy settings error', error);
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

    // Enrich with connection status for authenticated viewers
    let isConnected = false;
    let isPending = false;
    const isSelf = req.user && String(req.user.id) === String(user._id);

    if (req.user && !isSelf) {
      const connection = await Connection.findOne({
        $or: [
          { requester: req.user.id, recipient: user._id },
          { requester: user._id, recipient: req.user.id },
        ],
      });
      if (connection) {
        isConnected = connection.status === 'accepted';
        isPending = connection.status === 'pending' && String(connection.requester) === String(req.user.id);
      }
    }

    // Convert to plain object for mutation
    const profile = user.toObject() as unknown as Record<string, unknown>;

    // Apply field-level privacy filter for non-owners
    if (!isSelf) {
      applyPrivacyFilter(profile, (user.privacySettings as PrivacySettings | undefined) ?? {}, isConnected);
    }

    return res.json({ success: true, data: { ...profile, isConnected, isPending } });
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

/* ── E2E Encryption: Key Exchange ─────────────────────────── */

// POST /users/me/keys — store ECDH public key for E2E encryption
router.post('/me/keys', protect, async (req: Request, res: Response) => {
  try {
    const { publicKey } = req.body as { publicKey: string };
    if (!publicKey || typeof publicKey !== 'string' || publicKey.length > 1024) {
      res.status(400).json({ success: false, message: 'Invalid public key' }); return;
    }

    await User.findByIdAndUpdate((req as any).user.id, { publicKey });
    res.json({ success: true, message: 'Public key stored' });
  } catch (err) {
    logger.error('Error storing public key:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /users/:id/public-key — retrieve ECDH public key for a user
router.get('/:id/public-key', protect, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('+publicKey').lean();
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    if (!user.publicKey) { res.status(404).json({ success: false, message: 'User has no public key' }); return; }

    res.json({ success: true, data: { publicKey: user.publicKey } });
  } catch (err) {
    logger.error('Error fetching public key:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── Resume: Zero-Knowledge Upload / Download / Delete ─────── */

// POST /users/me/resume — store ZK-encrypted resume from browser
// Body is multipart/form-data:
//   resume:       encrypted binary blob (ciphertext, already AES-256-GCM encrypted by browser)
//   salt:         hex string — PBKDF2 salt, generated by browser
//   iv:           hex string — AES-GCM IV, generated by browser
//   originalName: original filename (e.g. "cv.pdf")
//   mimeType:     original MIME ("application/pdf" or docx MIME)
router.post(
  '/me/resume',
  protect,
  uploadRateLimiter,
  resumeUpload.single('resume'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No resume file provided' });
      }

      const { salt, iv, originalName, mimeType } = req.body as {
        salt?: string; iv?: string; originalName?: string; mimeType?: string;
      };

      // Validate required ZK metadata fields
      if (!salt || !iv || !originalName || !mimeType) {
        return res.status(400).json({ success: false, message: 'Missing encryption metadata (salt, iv, originalName, mimeType)' });
      }

      // Validate that the original file type was PDF or DOCX
      const allowedMimes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowedMimes.includes(mimeType)) {
        return res.status(400).json({ success: false, message: 'Only PDF and DOCX files are allowed' });
      }

      // Validate hex format for salt (32 hex chars = 16 bytes) and iv (24 hex chars = 12 bytes)
      if (!/^[0-9a-f]{32}$/i.test(salt)) {
        return res.status(400).json({ success: false, message: 'Invalid salt format' });
      }
      if (!/^[0-9a-f]{24}$/i.test(iv)) {
        return res.status(400).json({ success: false, message: 'Invalid iv format' });
      }

      // Remove old resume ciphertext if one exists
      const existing = await User.findById(req.user!.id).select('resume').lean();
      if (existing?.resume?.encryptedPath) {
        fs.unlink(existing.resume.encryptedPath).catch(() => {});
      }

      // Save the raw ciphertext bytes to disk (server cannot decrypt this)
      const filename = `${req.user!.id}_${Date.now()}.zk`;
      const encryptedPath = path.join(resumesDir, filename);
      await fs.writeFile(encryptedPath, req.file.buffer);

      // Persist metadata — no encryption key is stored here (zero-knowledge)
      await User.findByIdAndUpdate(req.user!.id, {
        resume: {
          encryptedPath,
          originalName,
          mimeType,
          salt,
          iv,
          uploadedAt: new Date(),
        },
      });

      return res.json({
        success: true,
        message: 'Encrypted resume stored',
        data: { originalName, mimeType, uploadedAt: new Date() },
      });
    } catch (error) {
      logger.error('Resume upload error', error);
      return res.status(500).json({ success: false, message: 'Resume upload failed' });
    }
  }
);

// GET /users/me/resume/raw — return raw ciphertext for re-encryption (no TOTP; auth only)
// Used by the job apply flow to re-encrypt the resume for a specific recruiter.
// Safe because: (1) user is authenticated, (2) browser only receives ciphertext it already uploaded, (3) browser needs passphrase to actually decrypt
router.get('/me/resume/raw', protect, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('resume').lean();
    if (!user?.resume?.encryptedPath) {
      return res.status(404).json({ success: false, message: 'No resume found' });
    }
    const { encryptedPath, salt, iv } = user.resume as {
      encryptedPath: string; salt: string; iv: string;
    };
    if (!salt || !iv) {
      return res.status(410).json({ success: false, message: 'Resume uses old encryption — please re-upload' });
    }
    const ciphertext = await fs.readFile(encryptedPath);
    res.setHeader('X-Resume-Salt', salt);
    res.setHeader('X-Resume-Iv', iv);
    res.setHeader('Content-Type', 'application/octet-stream');
    return res.send(ciphertext);
  } catch (error) {
    logger.error('Resume raw fetch error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /users/me/resume — return raw ciphertext bytes with salt/iv headers (TOTP-gated)
// The browser receives these bytes and decrypts them locally using the user's passphrase.
router.get('/me/resume', protect, async (req: Request, res: Response) => {
  try {
    // ── TOTP verification required ──
    const { totp } = req.query as { totp?: string };
    if (!totp) {
      return res.status(403).json({ success: false, message: 'TOTP code required to download resume', requireTotp: true });
    }

    const userForTotp = await User.findById(req.user!.id).select('+twoFactorSecret twoFactorEnabled').lean();
    if (!userForTotp?.twoFactorEnabled || !userForTotp?.twoFactorSecret) {
      return res.status(403).json({ success: false, message: '2FA must be enabled to download resume' });
    }

    const result: TOTPVerifyResult = await verifyTOTPOnce(totp, userForTotp.twoFactorSecret, String(req.user!.id));
    if (result !== 'ok') {
      logSecurityEvent('Resume download blocked - invalid TOTP', { userId: req.user!.id }, 'warn');
      return res.status(401).json({ success: false, message: result === 'replay' ? 'TOTP code already used' : 'Invalid TOTP code' });
    }

    // Find a mongo query that also selects encrypted fields (not excluded by toJSON)
    const user = await User.findById(req.user!.id).select('resume').lean();
    if (!user?.resume?.encryptedPath) {
      return res.status(404).json({ success: false, message: 'No resume found' });
    }

    const { encryptedPath, originalName, salt, iv } = user.resume as {
      encryptedPath: string; originalName: string; salt: string; iv: string;
    };

    if (!salt || !iv) {
      // Legacy server-side encrypted resume — no longer supported
      return res.status(410).json({ success: false, message: 'This resume was encrypted with the old server-side key and can no longer be downloaded. Please re-upload.' });
    }

    // Read raw ciphertext — server CANNOT decrypt this, only the browser can
    const ciphertext = await fs.readFile(encryptedPath);

    logSecurityEvent('Resume downloaded (ZK ciphertext)', { userId: req.user!.id }, 'info');

    // Send ZK metadata as response headers so the browser can derive the decryption key
    res.setHeader('X-Resume-Salt', salt);
    res.setHeader('X-Resume-Iv', iv);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}.enc"`);
    return res.send(ciphertext);
  } catch (error) {
    logger.error('Resume download error', error);
    return res.status(500).json({ success: false, message: 'Resume download failed' });
  }
});

// DELETE /users/me/resume — remove resume
router.delete('/me/resume', protect, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('resume').lean();
    if (!user?.resume?.encryptedPath) {
      return res.status(404).json({ success: false, message: 'No resume found' });
    }
    fs.unlink(user.resume.encryptedPath).catch(() => {});
    await User.findByIdAndUpdate(req.user!.id, { $unset: { resume: '' } });
    return res.json({ success: true, message: 'Resume deleted' });
  } catch (error) {
    logger.error('Resume delete error', error);
    return res.status(500).json({ success: false, message: 'Resume delete failed' });
  }
});

// ──────────────────────────────────────────────
// DELETE /users/me — permanent account deletion (requires TOTP + password)
// ──────────────────────────────────────────────
router.delete('/me', protect, async (req: Request, res: Response) => {
  try {
    const { password, totpCode } = req.body as { password?: string; totpCode?: string };

    if (!password || !totpCode) {
      return res.status(400).json({ success: false, message: 'Password and TOTP code are required for account deletion' });
    }

    const userDoc = await User.findById(req.user!.id).select('+password +twoFactorSecret twoFactorEnabled email firstName lastName');
    if (!userDoc) return res.status(404).json({ success: false, message: 'User not found' });

    // Verify password
    const bcrypt = await import('bcryptjs');
    const passwordValid = await bcrypt.compare(password, userDoc.password);
    if (!passwordValid) {
      logSecurityEvent('Account deletion blocked - wrong password', { userId: req.user!.id }, 'warn');
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    // Verify TOTP
    if (!userDoc.twoFactorEnabled || !userDoc.twoFactorSecret) {
      return res.status(403).json({ success: false, message: '2FA must be enabled to delete account' });
    }

    const totpResult: TOTPVerifyResult = await verifyTOTPOnce(totpCode, userDoc.twoFactorSecret, String(req.user!.id));
    if (totpResult !== 'ok') {
      logSecurityEvent('Account deletion blocked - invalid TOTP', { userId: req.user!.id }, 'warn');
      return res.status(401).json({ success: false, message: totpResult === 'replay' ? 'TOTP code already used' : 'Invalid TOTP code' });
    }

    // Delete resume file if exists
    const resumeData = await User.findById(req.user!.id).select('resume').lean();
    if (resumeData?.resume?.encryptedPath) {
      fs.unlink(resumeData.resume.encryptedPath).catch(() => {});
    }

    // Invalidate all sessions by clearing refresh token
    const redis = getRedisClient();
    if (redis) {
      // Clear all auth tokens for this user
      await redis.del(`refresh:${req.user!.id}`).catch(() => {});
    }

    // Soft delete: mark inactive + scramble PII
    const anonEmail = `deleted_${Date.now()}@deleted.invalid`;
    await User.findByIdAndUpdate(req.user!.id, {
      isActive: false,
      email: anonEmail,
      firstName: 'Deleted',
      lastName: 'User',
      $unset: { twoFactorSecret: '', resume: '', profilePicture: '', coverPhoto: '', about: '', headline: '' },
    });

    logSecurityEvent('Account deleted', { userId: req.user!.id, email: userDoc.email }, 'warn');

    // Clear the auth cookie
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    return res.json({ success: true, message: 'Account permanently deleted' });
  } catch (error) {
    logger.error('Account deletion error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /users/me/notification-prefs — get notification preferences
// ──────────────────────────────────────────────
router.get('/me/notification-prefs', protect, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.id)
      .select('notificationPreferences emailNotifications')
      .lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, data: user.notificationPreferences });
  } catch (error) {
    logger.error('Get notification prefs error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// PATCH /users/me/notification-prefs — update notification preferences
// ──────────────────────────────────────────────
router.patch('/me/notification-prefs', protect, async (req: Request, res: Response) => {
  try {
    const { email, push } = req.body as {
      email?: Partial<Record<string, boolean>>;
      push?: Partial<Record<string, boolean>>;
    };

    const allowedEmailKeys = [
      'connectionRequest', 'connectionAccepted', 'newMessage',
      'postReaction', 'postComment', 'jobApplication', 'jobStatusUpdate',
    ];
    const allowedPushKeys = ['connectionRequest', 'newMessage', 'postReaction', 'postComment'];

    const updateFields: Record<string, boolean> = {};

    if (email && typeof email === 'object') {
      for (const key of allowedEmailKeys) {
        if (typeof email[key] === 'boolean') {
          updateFields[`notificationPreferences.email.${key}`] = email[key] as boolean;
        }
      }
    }

    if (push && typeof push === 'object') {
      for (const key of allowedPushKeys) {
        if (typeof push[key] === 'boolean') {
          updateFields[`notificationPreferences.push.${key}`] = push[key] as boolean;
        }
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid preferences provided' });
    }

    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { $set: updateFields },
      { new: true }
    ).select('notificationPreferences');

    return res.json({ success: true, data: user?.notificationPreferences });
  } catch (error) {
    logger.error('Update notification prefs error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
