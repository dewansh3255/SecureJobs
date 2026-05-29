/**
 * Custom CSRF Protection Middleware
 *
 * Replaces deprecated `csurf` package with a clean, SPA-compatible implementation.
 *
 * Strategy: Double-Submit Signed Cookie
 *   1. On every request: generate an HMAC-signed token, set as `XSRF-TOKEN` readable cookie
 *   2. On state-changing requests (POST/PUT/PATCH/DELETE): verify `X-CSRF-Token` header
 *      matches the signed cookie using timing-safe comparison
 *
 * Why this is secure:
 *   - Attacker on evil.com cannot READ our cookies (same-origin policy)
 *   - Therefore cannot forge the matching header
 *   - Combined with SameSite=Strict JWT cookies → double protection
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import config from '../config';

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Generate a signed CSRF token: `timestamp.random.hmac` */
function generateToken(): string {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(18).toString('base64url');
  const payload = `${ts}.${rand}`;
  const sig = crypto
    .createHmac('sha256', config.csrf.secret)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

/** Verify a token is genuine and not older than TOKEN_TTL_MS */
function verifyToken(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [tsB36, rand, sig] = parts;
    const payload = `${tsB36}.${rand}`;
    const expected = crypto
      .createHmac('sha256', config.csrf.secret)
      .update(payload)
      .digest('base64url');

    const sigBuf = Buffer.from(sig, 'base64url');
    const expectedBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expectedBuf.length) return false;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

    // Check token age
    const ts = parseInt(tsB36, 36);
    if (Date.now() - ts > TOKEN_TTL_MS) return false;

    return true;
  } catch {
    return false;
  }
}

/** Middleware: issue fresh CSRF cookie on every response */
export function csrfToken(req: Request, res: Response, next: NextFunction): void {
  const isProduction = config.server.isProduction;

  // Always refresh the token on safe requests or when missing
  if (SAFE_METHODS.has(req.method) || !req.cookies[CSRF_COOKIE]) {
    const token = generateToken();
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // Must be readable by JS
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax', // 'lax' for localhost dev
      maxAge: TOKEN_TTL_MS,
    });
  }

  next();
}

/** Middleware: enforce CSRF on state-changing requests */
export function csrfProtect(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();

  const cookieToken = req.cookies[CSRF_COOKIE] as string | undefined;
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;

  if (!cookieToken || !headerToken) {
    res.status(403).json({ success: false, message: 'CSRF token missing.' });
    return;
  }

  // Both must be the same valid token
  if (cookieToken !== headerToken || !verifyToken(headerToken)) {
    res.status(403).json({ success: false, message: 'Invalid CSRF token.' });
    return;
  }

  next();
}
