/**
 * PeoplePay360 — Authentication Middleware
 *
 * Validates the Bearer token from the Authorization header and attaches the
 * decoded user payload to `req.user` for downstream middleware and route
 * handlers.
 *
 * This module owns ONLY authentication (token validity).
 * Authorization (permission checking) is handled separately in authorize.ts.
 */

import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import type { UserPayload } from '../routes/auth.routes.js';

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'peoplepay360-hackathon-secure-secret-2026';

/**
 * Verifies a pp360 session token.
 * Returns the decoded UserPayload on success, null on any failure.
 */
function verifyToken(token: string): UserPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'pp360') return null;

    const [, payloadB64, signature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(payloadB64)
      .digest('base64url');

    // Timing-safe comparison to prevent timing attacks
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      employeeId: payload.employeeId,
    };
  } catch {
    return null;
  }
}

/**
 * authenticateToken — Express middleware
 *
 * Reads `Authorization: Bearer <token>` from the request header.
 * On success: attaches decoded user to `req.user` and calls `next()`.
 * On failure: responds 401 immediately.
 *
 * Usage:
 *   router.get('/protected', authenticateToken, handler)
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in.',
    });
    return;
  }

  const token = authHeader.slice(7); // Strip "Bearer "
  const user = verifyToken(token);

  if (!user) {
    res.status(401).json({
      success: false,
      message: 'Session has expired or is invalid. Please sign in again.',
    });
    return;
  }

  req.user = user;
  next();
}
