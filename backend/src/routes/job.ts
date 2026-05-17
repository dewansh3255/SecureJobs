/**
 * Job Routes — aligned with Job model (employer, type, status, applicationCount)
 */

import { Router, Request, Response } from 'express';
import { protect, optionalAuth } from '../middleware/auth';
import { jobApplyRateLimiter } from '../middleware/security';
import Job from '../models/Job';
import Application from '../models/Application';
import Notification from '../models/Notification';
import logger from '../utils/logger';

const router = Router();

// ──────────────────────────────────────────────
// GET /jobs
// ──────────────────────────────────────────────
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(20, parseInt(String(req.query.limit || '10')));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { status: 'active' };

    if (req.query.q) {
      const q = String(req.query.q).slice(0, 100);
      filter.$text = { $search: q };
    }

    if (req.query.location) {
      filter.location = new RegExp(
        String(req.query.location).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100), 'i'
      );
    }

    if (req.query.type) filter.type = req.query.type;
    if (req.query.level) filter.experienceLevel = req.query.level;
    if (req.query.remote === 'true') filter.remote = true;

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .populate('employer', 'firstName lastName profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Job.countDocuments(filter),
    ]);

    return res.json({ success: true, data: jobs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    logger.error('List jobs error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /jobs/applications/mine
// ──────────────────────────────────────────────
router.get('/applications/mine', protect, async (req: Request, res: Response) => {
  try {
    const applications = await Application.find({ applicant: req.user!.id })
      .populate('job', 'title company location type')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, data: applications });
  } catch (error) {
    logger.error('Get applications error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// POST /jobs
// ──────────────────────────────────────────────
router.post('/', protect, async (req: Request, res: Response) => {
  try {
    // Only recruiters and admins can post jobs
    const poster = await (await import('../models/User')).default.findById(req.user!.id).select('accountType role').lean();
    if (!poster) return res.status(401).json({ success: false, message: 'Not authenticated' });
    if (poster.accountType !== 'recruiter' && !['admin', 'moderator'].includes(poster.role)) {
      return res.status(403).json({ success: false, message: 'You must be a recruiter to post jobs. Switch to recruiter mode in Settings.' });
    }

    const { title, company, location, description, requirements, type, experienceLevel, salary, skills, benefits, remote, applicationDeadline } = req.body;

    if (!title || !company || !location || !description || !type || !experienceLevel) {
      return res.status(400).json({ success: false, message: 'title, company, location, description, type and experienceLevel are required' });
    }

    const job = await Job.create({
      title: String(title).trim(),
      company: String(company).trim(),
      location: String(location).trim(),
      description: String(description).trim(),
      requirements: Array.isArray(requirements) ? requirements : [],
      type,
      experienceLevel,
      salary,
      skills: Array.isArray(skills) ? skills : [],
      benefits: Array.isArray(benefits) ? benefits : [],
      remote: remote || false,
      applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : undefined,
      employer: req.user!.id,
      status: 'active',
    });

    return res.status(201).json({ success: true, data: job });
  } catch (error: any) {
    if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
    logger.error('Create job error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// GET /jobs/:id
// ──────────────────────────────────────────────
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, status: { $ne: 'draft' } })
      .populate('employer', 'firstName lastName profilePicture headline')
      .lean();

    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    let hasApplied = false;
    if (req.user) {
      hasApplied = !!(await Application.findOne({ job: req.params.id, applicant: req.user.id }));
    }

    return res.json({ success: true, data: { ...job, hasApplied } });
  } catch (error) {
    logger.error('Get job error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// PUT /jobs/:id
// ──────────────────────────────────────────────
router.put('/:id', protect, async (req: Request, res: Response) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    if (String(job.employer) !== String(req.user!.id) && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const allowed = ['title', 'company', 'location', 'description', 'requirements', 'type', 'experienceLevel', 'salary', 'skills', 'benefits', 'remote', 'applicationDeadline', 'status'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const updated = await Job.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Update job error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// DELETE /jobs/:id
// ──────────────────────────────────────────────
router.delete('/:id', protect, async (req: Request, res: Response) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    if (String(job.employer) !== String(req.user!.id) && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    job.status = 'closed';
    await job.save();
    return res.json({ success: true, message: 'Job closed' });
  } catch (error) {
    logger.error('Delete job error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// POST /jobs/:id/apply
// ──────────────────────────────────────────────
router.post('/:id/apply', protect, jobApplyRateLimiter, async (req: Request, res: Response) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, status: 'active' });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found or no longer active' });

    if (String(job.employer) === String(req.user!.id)) {
      return res.status(400).json({ success: false, message: 'Cannot apply to your own job posting' });
    }

    const existing = await Application.findOne({ job: req.params.id, applicant: req.user!.id });
    if (existing) return res.status(409).json({ success: false, message: 'Already applied for this job' });

    const { coverLetter, resumeUrl } = req.body;

    const application = await Application.create({
      job: req.params.id,
      applicant: req.user!.id,
      employer: job.employer,
      coverLetter: coverLetter ? String(coverLetter).trim() : undefined,
      resumeUrl: resumeUrl ? String(resumeUrl).trim() : undefined,
    });

    await Job.findByIdAndUpdate(req.params.id, { $inc: { applicationCount: 1 } });

    // Notify job poster
    await Notification.create({
      recipient: job.employer,
      sender: req.user!.id,
      type: 'job_application',
      title: 'New application',
      message: `applied to your job: ${job.title}`,
      reference: job._id,
      referenceModel: 'Job',
    }).catch(() => {});

    return res.status(201).json({ success: true, data: application, message: 'Application submitted' });
  } catch (error) {
    logger.error('Apply error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
