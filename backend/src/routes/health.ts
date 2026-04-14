/**
 * Health Check Routes
 * API health and status endpoints
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware';
import mongoose from 'mongoose';
import { getRedisClient } from '../config/redis';
import config from '../config';

const router = Router();

/**
 * GET /api/health
 * Basic health check
 */
router.get('/', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}));

/**
 * GET /api/health/ready
 * Readiness check - verifies database connections
 */
router.get('/ready', asyncHandler(async (req, res) => {
  const checks: Record<string, { status: string; message?: string }> = {};

  // Check MongoDB
  if (mongoose.connection.readyState === 1) {
    checks.mongodb = { status: 'healthy' };
  } else {
    checks.mongodb = { status: 'unhealthy', message: 'MongoDB not connected' };
  }

  // Check Redis (optional)
  const redisClient = getRedisClient();
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.ping();
      checks.redis = { status: 'healthy' };
    } catch {
      checks.redis = { status: 'degraded', message: 'Redis ping failed' };
    }
  } else {
    checks.redis = { status: 'optional', message: 'Redis not configured' };
  }

  const allHealthy = Object.values(checks).every(
    (check) => check.status === 'healthy' || check.status === 'optional'
  );

  const status = allHealthy ? 200 : 503;

  res.status(status).json({
    success: allHealthy,
    status: allHealthy ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  });
}));

/**
 * GET /api/health/live
 * Liveness check - just confirms the server is running
 */
router.get('/live', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    status: 'alive',
    version: '1.0.0',
    environment: config.server.env,
    timestamp: new Date().toISOString(),
  });
}));

export default router;
