/**
 * Recommendations Route
 * Pure MongoDB aggregation — no external AI APIs needed.
 *
 * GET /recommendations/connections — "People You May Know"
 *   Score formula: (shared connections × 3) + (skill overlap × 2) + (same industry × 1)
 *
 * GET /recommendations/jobs — Personalised job feed
 *   Score formula: (skill match count × 3) + (industry match × 2) + (location match × 1)
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { protect } from '../middleware/auth';
import User from '../models/User';
import Job from '../models/Job';
import logger from '../utils/logger';

const router = Router();
router.use(protect);

/* ─────────────────────────────────────────────────────────────
   GET /recommendations/connections
───────────────────────────────────────────────────────────── */
router.get('/connections', async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { id: string };
    const myId = new mongoose.Types.ObjectId(me.id);
    const limit = Math.min(20, parseInt(String(req.query.limit || '10'), 10) || 10);

    // Get my full profile: connections list, skills, industry
    const myProfile = await User.findById(myId)
      .select('connections skills industry blockedUsers')
      .lean();

    if (!myProfile) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    const mySkills: string[] = myProfile.skills ?? [];
    const myIndustry: string = (myProfile as any).industry ?? '';

    // Gather 2nd-degree connections (connections of my connections)
    const secondDegree = await User.aggregate([
      // Start from my direct connections
      { $match: { _id: { $in: myProfile.connections } } },
      { $project: { connections: 1 } },
      { $unwind: '$connections' },
      // Group to count how many of MY connections know each candidate
      { $group: { _id: '$connections', mutualCount: { $sum: 1 } } },
      // Exclude: me, my existing connections, blocked users
      {
        $match: {
          _id: {
            $ne: myId,
            $nin: [...myProfile.connections, ...myProfile.blockedUsers],
          },
        },
      },
    ]);

    const candidateIds = secondDegree.map((s: any) => s._id);
    const mutualCountMap: Record<string, number> = {};
    secondDegree.forEach((s: any) => {
      mutualCountMap[String(s._id)] = s.mutualCount;
    });

    // Get candidate profiles
    const candidateFilter: Record<string, unknown> = {
      _id: { $ne: myId, $nin: myProfile.connections },
    };
    if (candidateIds.length) {
      (candidateFilter._id as Record<string, unknown>)['$in'] = candidateIds;
    }
    const candidates = await User.find(candidateFilter)
      .select('firstName lastName headline location profilePicture industry skills connections')
      .limit(100)
      .lean();

    // Score each candidate
    type ScoredUser = typeof candidates[0] & { score: number; mutualConnections: number; sharedSkills: string[] };
    const scored: ScoredUser[] = candidates.map((c) => {
      const cId = String(c._id);
      const mutual = mutualCountMap[cId] ?? 0;
      const cSkills: string[] = c.skills ?? [];
      const sharedSkills = cSkills.filter((s) => mySkills.includes(s));
      const industryBonus = (c as any).industry && (c as any).industry === myIndustry ? 1 : 0;
      const score = mutual * 3 + sharedSkills.length * 2 + industryBonus;
      return { ...c, score, mutualConnections: mutual, sharedSkills };
    });

    // If we have few 2nd-degree suggestions, supplement with random users
    if (scored.length < limit) {
      const extras = await User.find({
        _id: { $ne: myId, $nin: [...myProfile.connections, ...candidateIds] },
        active: { $ne: false },
      })
        .select('firstName lastName headline location profilePicture industry skills')
        .limit(limit - scored.length)
        .lean();
      extras.forEach((u) => {
        const cSkills: string[] = u.skills ?? [];
        const sharedSkills = cSkills.filter((s) => mySkills.includes(s));
        scored.push({ ...u, score: sharedSkills.length * 2, mutualConnections: 0, sharedSkills });
      });
    }

    scored.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      data: scored.slice(0, limit).map(({ score: _s, ...rest }) => rest),
    });
  } catch (err) {
    logger.error('Error getting connection recommendations:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /recommendations/jobs
───────────────────────────────────────────────────────────── */
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { id: string };
    const limit = Math.min(20, parseInt(String(req.query.limit || '10'), 10) || 10);

    const myProfile = await User.findById(me.id)
      .select('skills industry location')
      .lean();

    if (!myProfile) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    const mySkills: string[] = myProfile.skills ?? [];
    const myIndustry: string = (myProfile as any).industry ?? '';
    const myLocation: string = (myProfile as any).location ?? '';

    // Fetch active jobs (cap at 200 for scoring)
    const jobs = await Job.find({ status: 'active' })
      .select('title company location industry requiredSkills type remote experienceLevel salary postedBy createdAt')
      .populate('postedBy', 'firstName lastName profilePicture')
      .limit(200)
      .lean();

    // Score each job
    type ScoredJob = typeof jobs[0] & { score: number; matchedSkills: string[] };
    const scored: ScoredJob[] = jobs.map((job) => {
      const reqSkills: string[] = (job as any).requiredSkills ?? [];
      const matchedSkills = reqSkills.filter((s: string) =>
        mySkills.some((ms) => ms.toLowerCase() === s.toLowerCase())
      );
      const industryBonus = (job as any).industry && (job as any).industry === myIndustry ? 2 : 0;
      const locationBonus =
        myLocation && (job as any).location?.toLowerCase().includes(myLocation.toLowerCase()) ? 1 : 0;
      const remoteBonus = (job as any).remote ? 0.5 : 0;
      const score = matchedSkills.length * 3 + industryBonus + locationBonus + remoteBonus;
      return { ...job, score, matchedSkills };
    });

    scored.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      data: scored.slice(0, limit).map(({ score: _s, ...rest }) => rest),
    });
  } catch (err) {
    logger.error('Error getting job recommendations:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
