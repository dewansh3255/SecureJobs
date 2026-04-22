/**
 * Admin Routes
 * All endpoints require `role: 'admin'`.
 *
 * GET  /admin/users           — paginated user list with filters
 * GET  /admin/users/:id       — single user detail + security flags
 * PATCH /admin/users/:id/ban  — ban / unban a user
 * PATCH /admin/users/:id/role — change role (user ↔ moderator ↔ admin)
 * DELETE /admin/users/:id     — hard-delete user (GDPR)
 *
 * GET  /admin/posts           — paginated post list
 * DELETE /admin/posts/:id     — remove post
 *
 * GET  /admin/jobs            — paginated job list
 * DELETE /admin/jobs/:id      — remove job
 *
 * GET  /admin/audit-logs      — paginated security audit log
 * GET  /admin/stats           — dashboard stats (users, posts, jobs, errors today)
 */

import { Router, Request, Response } from 'express';
import { protect, restrictTo } from '../middleware/auth';
import User from '../models/User';
import Post from '../models/Post';
import Job from '../models/Job';
import AuditLog from '../models/AuditLog';
import logger, { logSecurityEvent } from '../utils/logger';

const router = Router();

// All admin routes require authentication + admin role
router.use(protect);
router.use(restrictTo('admin'));

/* ───────────────── helpers ───────────────── */

function parsePageSize(query: { page?: string; limit?: string }) {
  const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/* ───────────────── users ───────────────── */

// GET /admin/users?page=1&limit=20&search=&role=&banned=
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = parsePageSize(req.query as Record<string, string>);
    const { search, role, banned } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (role) filter.role = role;
    if (banned !== undefined) filter.active = banned === 'true' ? false : true;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('firstName lastName email role active twoFactorEnabled loginAttempts lockUntil createdAt lastLogin')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    logger.error('Admin: error fetching users', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /admin/users/:id
router.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -twoFactorSecret -backupCodes')
      .lean();
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    const recentActivity = await AuditLog.find({ userId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, data: { user, recentActivity } });
  } catch (err) {
    logger.error('Admin: error fetching user detail', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /admin/users/:id/ban  { banned: true|false, reason?: string }
router.patch('/users/:id/ban', async (req: Request, res: Response) => {
  try {
    const { banned, reason } = req.body as { banned: boolean; reason?: string };
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { active: !banned },
      { new: true }
    ).select('firstName lastName email active');

    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    logSecurityEvent(
      banned ? 'user_banned' : 'user_unbanned',
      { targetUserId: req.params.id, adminId: (req as any).user?.id, reason },
      'warn',
      req as any
    );

    res.json({
      success: true,
      message: `User ${banned ? 'banned' : 'unbanned'} successfully`,
      data: user,
    });
  } catch (err) {
    logger.error('Admin: error banning user', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /admin/users/:id/role  { role: 'user'|'moderator'|'admin' }
router.patch('/users/:id/role', async (req: Request, res: Response) => {
  try {
    const { role } = req.body as { role: string };
    const allowed = ['user', 'moderator', 'admin'];
    if (!allowed.includes(role)) {
      res.status(400).json({ success: false, message: 'Invalid role' }); return;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('firstName lastName email role');

    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    logSecurityEvent(
      'user_role_changed',
      { targetUserId: req.params.id, newRole: role, adminId: (req as any).user?.id },
      'warn',
      req as any
    );

    res.json({ success: true, message: 'Role updated', data: user });
  } catch (err) {
    logger.error('Admin: error updating role', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /admin/users/:id (hard delete — GDPR erasure)
router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    logSecurityEvent(
      'user_deleted',
      { targetUserId: req.params.id, adminId: (req as any).user?.id },
      'error',
      req as any
    );

    res.json({ success: true, message: 'User deleted permanently' });
  } catch (err) {
    logger.error('Admin: error deleting user', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ───────────────── posts ───────────────── */

router.get('/posts', async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = parsePageSize(req.query as Record<string, string>);
    const [posts, total] = await Promise.all([
      Post.find()
        .populate('author', 'firstName lastName email')
        .select('content author reactions createdAt isDeleted')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments(),
    ]);
    res.json({
      success: true,
      data: { posts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    logger.error('Admin: error fetching posts', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/posts/:id', async (req: Request, res: Response) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) { res.status(404).json({ success: false, message: 'Post not found' }); return; }
    logSecurityEvent('post_deleted_by_admin', { postId: req.params.id, adminId: (req as any).user?.id }, 'warn', req as any);
    res.json({ success: true, message: 'Post removed' });
  } catch (err) {
    logger.error('Admin: error deleting post', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ───────────────── jobs ───────────────── */

router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = parsePageSize(req.query as Record<string, string>);
    const [jobs, total] = await Promise.all([
      Job.find()
        .populate('postedBy', 'firstName lastName email')
        .select('title company location status postedBy createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Job.countDocuments(),
    ]);
    res.json({
      success: true,
      data: { jobs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    logger.error('Admin: error fetching jobs', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) { res.status(404).json({ success: false, message: 'Job not found' }); return; }
    res.json({ success: true, message: 'Job removed' });
  } catch (err) {
    logger.error('Admin: error deleting job', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ───────────────── audit log ───────────────── */

// GET /admin/audit-logs?page=1&limit=50&severity=&action=&userId=
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = parsePageSize(req.query as Record<string, string>);
    const { severity, action, userId } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (severity) filter.severity = severity;
    if (action) filter.action = { $regex: action, $options: 'i' };
    if (userId) filter.userId = userId;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    logger.error('Admin: error fetching audit logs', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ───────────────── dashboard stats ───────────────── */

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      newUsersToday,
      totalPosts,
      postsToday,
      totalJobs,
      securityErrors,
      securityWarnings,
      bannedUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: today } }),
      Post.countDocuments(),
      Post.countDocuments({ createdAt: { $gte: today } }),
      Job.countDocuments(),
      AuditLog.countDocuments({ severity: 'error', createdAt: { $gte: today } }),
      AuditLog.countDocuments({ severity: 'warn', createdAt: { $gte: today } }),
      User.countDocuments({ active: false }),
    ]);

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, newToday: newUsersToday, banned: bannedUsers },
        posts: { total: totalPosts, today: postsToday },
        jobs: { total: totalJobs },
        security: { errorsToday: securityErrors, warningsToday: securityWarnings },
      },
    });
  } catch (err) {
    logger.error('Admin: error fetching stats', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
