/**
 * Job Routes — aligned with Job model (employer, type, status, applicationCount)
 */

import { Router, Request, Response } from 'express';
import { protect, optionalAuth } from '../middleware/auth';
import { jobApplyRateLimiter } from '../middleware/security';
import Job from '../models/Job';
import Application, { IApplication } from '../models/Application';
import Notification from '../models/Notification';
import Company from '../models/Company';
import User from '../models/User';
import logger, { logSecurityEvent } from '../utils/logger';
import { sendEmail } from '../utils/email';

const router = Router();

// ──────────────────────────────────────────────
// GET /jobs
// ──────────────────────────────────────────────
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(50, parseInt(String(req.query.limit || '10')));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    // If employer=me, show only this recruiter's jobs (all statuses)
    if (req.query.employer === 'me' && req.user) {
      filter.employer = req.user.id;
    } else {
      filter.status = 'active';
    }

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

    // Salary range filter
    if (req.query.minSalary || req.query.maxSalary) {
      const salaryFilter: Record<string, number> = {};
      if (req.query.minSalary) salaryFilter.$gte = parseInt(String(req.query.minSalary), 10);
      if (req.query.maxSalary) salaryFilter.$lte = parseInt(String(req.query.maxSalary), 10);
      filter['salary.min'] = salaryFilter;
    }

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
// GET /jobs/:id/applications  (recruiter/employer view)
// ──────────────────────────────────────────────
router.get('/:id/applications', protect, async (req: Request, res: Response) => {
  try {
    const job = await Job.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    const isOwner = String(job.employer) === String(req.user!.id);
    const isAdmin = req.user!.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { status, page: pageStr = '1', limit: limitStr = '20' } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(pageStr));
    const limit = Math.min(50, parseInt(limitStr));
    const filter: Record<string, unknown> = { job: req.params.id };
    if (status) filter.status = status;

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .populate('applicant', 'firstName lastName email profilePicture headline')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Application.countDocuments(filter),
    ]);

    return res.json({ success: true, data: applications, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    logger.error('Get job applications error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// PATCH /jobs/applications/:appId/status  (recruiter updates status)
// ──────────────────────────────────────────────
router.patch('/applications/:appId/status', protect, async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body as { status?: string; notes?: string };
    const validStatuses = ['pending', 'reviewed', 'interviewing', 'offered', 'accepted', 'rejected', 'withdrawn'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const application = await Application.findById(req.params.appId).populate('job', 'employer title');
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    const job = application.job as unknown as { employer: unknown; title: string };
    const isEmployer = String(job.employer) === String(req.user!.id);
    const isApplicant = String(application.applicant) === String(req.user!.id);
    const isAdmin = req.user!.role === 'admin';

    // Employer can set any status; applicant can only withdraw their own
    if (!isEmployer && !isAdmin && !(isApplicant && status === 'withdrawn')) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const oldStatus = application.status;
    application.status = status as IApplication['status'];
    if (notes !== undefined) application.notes = notes;
    await application.save();

    // Notify applicant of status change (except withdrawal by themselves)
    if (!isApplicant) {
      const statusLabels: Record<string, string> = {
        reviewed: 'Your application has been reviewed',
        interviewing: '🎉 You have been shortlisted for an interview',
        offered: '🎊 Congratulations! You have received an offer',
        rejected: 'Your application status has been updated',
        accepted: 'Your application has been accepted',
      };
      const msg = statusLabels[status] || `Application status updated to "${status}"`;

      // In-app notification
      await Notification.create({
        recipient: application.applicant,
        sender: req.user!.id,
        type: 'system',
        title: 'Application Update',
        message: `${msg} for "${job.title}"`,
        data: { applicationId: application._id, jobTitle: job.title, newStatus: status, oldStatus },
      }).catch(() => {});

      // Email notification — fire-and-forget
      User.findById(application.applicant).select('email firstName').lean().then(applicant => {
        if (!applicant?.email) return;
        const statusBadge: Record<string, string> = {
          reviewed: '#3b82f6',
          interviewing: '#8b5cf6',
          offered: '#10b981',
          accepted: '#10b981',
          rejected: '#ef4444',
        };
        const badgeColor = statusBadge[status] || '#6b7280';
        sendEmail({
          to: applicant.email,
          subject: `Application Update: ${job.title}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;border-radius:12px;overflow:hidden;">
              <div style="background:#0a66c2;padding:24px 32px;">
                <h1 style="color:#fff;margin:0;font-size:20px;">Nexus — Application Update</h1>
              </div>
              <div style="padding:32px;">
                <p style="font-size:16px;color:#1e293b;">Hi ${applicant.firstName},</p>
                <p style="font-size:15px;color:#334155;">${msg} for the role:</p>
                <div style="background:#fff;border-radius:8px;padding:16px 20px;margin:20px 0;border-left:4px solid ${badgeColor};">
                  <p style="margin:0;font-weight:600;color:#1e293b;font-size:16px;">${job.title}</p>
                  <p style="margin:4px 0 0;color:#64748b;font-size:14px;">Status: <span style="font-weight:600;color:${badgeColor};text-transform:capitalize;">${status}</span></p>
                  ${notes ? `<p style="margin:8px 0 0;color:#64748b;font-size:14px;">Note: ${notes}</p>` : ''}
                </div>
                <p style="font-size:14px;color:#64748b;">Log in to Nexus to view your full application status.</p>
              </div>
            </div>`,
        }).catch(() => {});
      }).catch(() => {});
    }

    return res.json({ success: true, data: application, message: 'Status updated' });
  } catch (error) {
    logger.error('Update application status error', error);
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

    const { title, company, location, description, requirements, type, experienceLevel, salary, skills, benefits, remote, applicationDeadline, companyRef } = req.body;

    if (!title || !company || !location || !description || !type || !experienceLevel) {
      return res.status(400).json({ success: false, message: 'title, company, location, description, type and experienceLevel are required' });
    }

    // If posting under a company page, verify the poster is admin or recruiter member
    if (companyRef) {
      const companyDoc = await Company.findById(companyRef).select('admin members').lean();
      if (!companyDoc) return res.status(404).json({ success: false, message: 'Company not found' });

      const userId = String(req.user!.id);
      const isAdmin = String(companyDoc.admin) === userId;
      const isMember = companyDoc.members.some(
        (m) => String(m.user) === userId && (m.role === 'admin' || m.role === 'recruiter')
      );

      if (!isAdmin && !isMember) {
        return res.status(403).json({ success: false, message: 'You must be an admin or recruiter member of this company to post jobs under it' });
      }
    }

    const job = await Job.create({
      title: String(title).trim(),
      company: String(company).trim(),
      companyRef: companyRef || undefined,
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

    const allowed = ['title', 'company', 'companyRef', 'location', 'description', 'requirements', 'type', 'experienceLevel', 'salary', 'skills', 'benefits', 'remote', 'applicationDeadline', 'status'];
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

    const {
      coverLetter,
      resumeCiphertext,
      resumeIv,
      resumeOriginalName,
      resumeMimeType,
      applicantPublicKey,
    } = req.body;

    // Validate E2EE resume fields — if one is present, all must be present
    const hasResume = resumeCiphertext || resumeIv || resumeOriginalName || resumeMimeType || applicantPublicKey;
    if (hasResume && !(resumeCiphertext && resumeIv && resumeOriginalName && resumeMimeType && applicantPublicKey)) {
      return res.status(400).json({ success: false, message: 'All resume fields are required when attaching a resume (ciphertext, iv, originalName, mimeType, applicantPublicKey)' });
    }

    // Validate allowed MIME types (the value was set by the browser before encryption)
    if (resumeMimeType) {
      const allowedMimes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowedMimes.includes(resumeMimeType)) {
        return res.status(400).json({ success: false, message: 'Only PDF and DOCX resume files are allowed' });
      }
    }

    const application = await Application.create({
      job: req.params.id,
      applicant: req.user!.id,
      employer: job.employer,
      coverLetter: coverLetter ? String(coverLetter).trim() : undefined,
      resumeCiphertext: resumeCiphertext ? String(resumeCiphertext) : undefined,
      resumeIv: resumeIv ? String(resumeIv) : undefined,
      resumeOriginalName: resumeOriginalName ? String(resumeOriginalName) : undefined,
      resumeMimeType: resumeMimeType ? String(resumeMimeType) : undefined,
      applicantPublicKey: applicantPublicKey ? String(applicantPublicKey) : undefined,
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

// GET /jobs/:id/employer-key — return employer's ECDH public key so applicant can encrypt resume for them
router.get('/:id/employer-key', protect, async (req: Request, res: Response) => {
  try {
    const job = await Job.findById(req.params.id).select('employer').lean();
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    const employer = await User.findById(job.employer).select('publicKey').lean() as { publicKey?: string } | null;
    if (!employer?.publicKey) {
      return res.status(404).json({ success: false, message: 'Employer has not set up encryption keys' });
    }
    return res.json({ success: true, data: { publicKey: employer.publicKey } });
  } catch (error) {
    logger.error('Get employer key error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /jobs/applications/:appId/resume — recruiter/employer downloads E2EE resume ciphertext
router.get('/applications/:appId/resume', protect, async (req: Request, res: Response) => {
  try {
    const application = await Application.findById(req.params.appId)
      .populate('job', 'employer title')
      .lean() as (IApplication & { job: { employer: unknown; title: string } | null }) | null;

    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    // Only the employer of the job can access the resume
    const job = application.job as { employer: unknown; title: string } | null;
    if (!job || String(job.employer) !== String(req.user!.id)) {
      logSecurityEvent('Unauthorised resume access attempt', { userId: req.user!.id, appId: req.params.appId }, 'warn');
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!application.resumeCiphertext) {
      return res.status(404).json({ success: false, message: 'No resume attached to this application' });
    }

    return res.json({
      success: true,
      data: {
        resumeCiphertext: application.resumeCiphertext,
        resumeIv: application.resumeIv,
        resumeOriginalName: application.resumeOriginalName,
        resumeMimeType: application.resumeMimeType,
        applicantPublicKey: application.applicantPublicKey,
      },
    });
  } catch (error) {
    logger.error('Get application resume error', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
