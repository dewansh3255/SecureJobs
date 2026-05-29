/**
 * Company Routes
 * CRUD for company pages, membership management, follow toggle, logo upload, job listing
 */

import path from 'path';
import fs from 'fs/promises';
import mongoose from 'mongoose';
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { protect, optionalAuth } from '../middleware/auth';
import { uploadRateLimiter } from '../middleware/security';
import Company from '../models/Company';
import Job from '../models/Job';
import User from '../models/User';
import logger from '../utils/logger';

const router = Router();

// ──────────────────────────────────────────────
// Multer — logo uploads (memory storage, 2 MB, images only)
// ──────────────────────────────────────────────
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  },
});

// Ensure logo uploads directory exists
const logosDir = path.join(process.cwd(), 'uploads', 'logos');
fs.mkdir(logosDir, { recursive: true }).catch((e) => logger.error('Could not create logos dir', e));

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function isCompanyAdmin(company: { admin: unknown; members: { user: unknown; role: string }[] }, userId: string): boolean {
  return (
    String(company.admin) === userId ||
    company.members.some((m) => String(m.user) === userId && m.role === 'admin')
  );
}

// ──────────────────────────────────────────────
// POST /companies — create company
// ──────────────────────────────────────────────
router.post('/', protect, async (req: Request, res: Response) => {
  try {
    const poster = await User.findById(req.user!.id).select('accountType role').lean();
    if (!poster) return res.status(401).json({ success: false, message: 'Not authenticated' });
    if (poster.accountType !== 'recruiter' && !['admin', 'moderator'].includes(poster.role)) {
      return res.status(403).json({ success: false, message: 'Only recruiters can create company pages' });
    }

    const { name, description, industry, website, location, size, founded, specialties } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Company name is required' });

    const company = await Company.create({
      name: String(name).trim(),
      description: description ? String(description).trim() : undefined,
      industry: industry ? String(industry).trim() : undefined,
      website: website ? String(website).trim() : undefined,
      location: location ? String(location).trim() : undefined,
      size: size || undefined,
      founded: founded ? Number(founded) : undefined,
      specialties: Array.isArray(specialties) ? specialties : [],
      admin: req.user!.id,
      members: [{ user: req.user!.id, role: 'admin', addedAt: new Date() }],
    });

    return res.status(201).json({ success: true, data: company });
  } catch (error: any) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'A company with that name already exists' });
    if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
    logger.error('Create company error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /companies — list companies (public, paginated)
// ──────────────────────────────────────────────
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(20, parseInt(String(req.query.limit || '10')));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (req.query.q) {
      const q = String(req.query.q).slice(0, 100);
      filter.$text = { $search: q };
    }
    if (req.query.industry) {
      filter.industry = new RegExp(
        String(req.query.industry).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100),
        'i'
      );
    }

    // Filter by mine (companies the user admins or is a member of)
    if (req.query.mine === 'true' && req.user) {
      filter.$or = [
        { admin: req.user.id },
        { 'members.user': req.user.id },
      ];
    }

    const [companies, total] = await Promise.all([
      Company.find(filter)
        .populate('admin', 'firstName lastName profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Company.countDocuments(filter),
    ]);

    return res.json({ success: true, data: companies, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    logger.error('List companies error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /companies/:id — get company details (public)
// ──────────────────────────────────────────────
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate('admin', 'firstName lastName profilePicture headline')
      .populate('members.user', 'firstName lastName profilePicture headline')
      .lean();

    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    let isFollowing = false;
    let isMember = false;
    let memberRole: string | null = null;

    if (req.user) {
      isFollowing = company.followers.some((f) => String(f) === String(req.user!.id));
      const member = company.members.find((m) => String((m.user as any)?._id ?? m.user) === String(req.user!.id));
      if (member) {
        isMember = true;
        memberRole = member.role;
      }
    }

    return res.json({ success: true, data: { ...company, isFollowing, isMember, memberRole } });
  } catch (error) {
    logger.error('Get company error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// PUT /companies/:id — update company
// ──────────────────────────────────────────────
router.put('/:id', protect, async (req: Request, res: Response) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const userId = String(req.user!.id);
    if (!isCompanyAdmin(company, userId) && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this company' });
    }

    const allowed = ['name', 'description', 'industry', 'website', 'location', 'size', 'founded', 'specialties', 'coverImage'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Only site admins can verify companies
    if (req.body.isVerified !== undefined && req.user!.role === 'admin') {
      updates.isVerified = req.body.isVerified;
    }

    const updated = await Company.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'A company with that name already exists' });
    if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
    logger.error('Update company error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// DELETE /companies/:id — delete company
// ──────────────────────────────────────────────
router.delete('/:id', protect, async (req: Request, res: Response) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const userId = String(req.user!.id);
    if (String(company.admin) !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the company creator or site admin can delete this company' });
    }

    await Company.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Company deleted' });
  } catch (error) {
    logger.error('Delete company error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// POST /companies/:id/members — add member
// ──────────────────────────────────────────────
router.post('/:id/members', protect, async (req: Request, res: Response) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    if (!isCompanyAdmin(company, String(req.user!.id))) {
      return res.status(403).json({ success: false, message: 'Only company admins can add members' });
    }

    const { userId, role } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });

    const targetUser = await User.findById(userId).select('_id').lean();
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

    const alreadyMember = company.members.some((m) => String(m.user) === String(userId));
    if (alreadyMember) return res.status(409).json({ success: false, message: 'User is already a member' });

    company.members.push({ user: targetUser._id as mongoose.Types.ObjectId, role: role === 'admin' ? 'admin' : 'recruiter', addedAt: new Date() });
    await company.save();

    return res.json({ success: true, data: company });
  } catch (error) {
    logger.error('Add member error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// DELETE /companies/:id/members/:userId — remove member
// ──────────────────────────────────────────────
router.delete('/:id/members/:userId', protect, async (req: Request, res: Response) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    if (!isCompanyAdmin(company, String(req.user!.id))) {
      return res.status(403).json({ success: false, message: 'Only company admins can remove members' });
    }

    const memberIndex = company.members.findIndex((m) => String(m.user) === String(req.params.userId));
    if (memberIndex === -1) return res.status(404).json({ success: false, message: 'Member not found' });

    company.members.splice(memberIndex, 1);
    await company.save();

    return res.json({ success: true, message: 'Member removed' });
  } catch (error) {
    logger.error('Remove member error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// POST /companies/:id/follow — toggle follow
// ──────────────────────────────────────────────
router.post('/:id/follow', protect, async (req: Request, res: Response) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const userId = req.user!.id;
    const isFollowing = company.followers.some((f) => String(f) === String(userId));

    if (isFollowing) {
      company.followers = company.followers.filter((f) => String(f) !== String(userId)) as typeof company.followers;
    } else {
      company.followers.push(userId);
    }

    await company.save();
    return res.json({ success: true, following: !isFollowing, followerCount: company.followers.length });
  } catch (error) {
    logger.error('Follow company error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /companies/:id/jobs — get jobs for this company
// ──────────────────────────────────────────────
router.get('/:id/jobs', optionalAuth, async (req: Request, res: Response) => {
  try {
    const company = await Company.findById(req.params.id).select('_id name').lean();
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const jobs = await Job.find({ companyRef: req.params.id, status: { $ne: 'draft' } })
      .populate('employer', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: jobs });
  } catch (error) {
    logger.error('Get company jobs error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// POST /companies/:id/logo — upload logo
// ──────────────────────────────────────────────
router.post('/:id/logo', protect, uploadRateLimiter, logoUpload.single('logo'), async (req: Request, res: Response) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    if (!isCompanyAdmin(company, String(req.user!.id)) && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only company admins can upload a logo' });
    }

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const ALLOWED_LOGO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const rawExt = path.extname(req.file.originalname).toLowerCase();
    const ext = ALLOWED_LOGO_EXTENSIONS.includes(rawExt) ? rawExt : '.jpg';
    const filename = `${company._id}_${Date.now()}${ext}`;
    const filepath = path.join(logosDir, filename);
    await fs.writeFile(filepath, req.file.buffer);

    company.logo = `/uploads/logos/${filename}`;
    await company.save();

    return res.json({ success: true, logo: company.logo });
  } catch (error) {
    logger.error('Logo upload error', error);
    return res.status(500).json({ success: false, message: 'Logo upload failed' });
  }
});

// ──────────────────────────────────────────────
// GET /companies/:id/members?page=1&limit=20
// ──────────────────────────────────────────────
router.get('/:id/members', optionalAuth, async (req: Request, res: Response) => {
  try {
    const company = await Company.findById(req.params.id).lean();
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(50, parseInt(String(req.query.limit || '20'), 10));
    const skip = (page - 1) * limit;

    const memberIds = [company.admin, ...(company.members || [])].filter(Boolean);
    const total = memberIds.length;

    const members = await User.find({ _id: { $in: memberIds.slice(skip, skip + limit) }, isActive: true })
      .select('firstName lastName profilePicture headline location')
      .lean();

    // Label the admin
    const enriched = members.map((m) => ({
      ...m,
      isAdmin: String(m._id) === String(company.admin),
    }));

    return res.json({
      success: true,
      data: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Company members error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
