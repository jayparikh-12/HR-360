import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { TokenPayload } from '../types/auth.types.js';
import { findUserById, toSafeUser } from '../models/user.model.js';

const JWT_SECRET = process.env.JWT_SECRET || 'peoplepay360-hackathon-jwt-secret-2026';

/**
 * Authentication middleware that verifies JWT bearer tokens.
 *
 * Responsibilities:
 * - Read Authorization header.
 * - Require exact 'Bearer <token>' format.
 * - Reject missing or malformed headers.
 * - Verify JWT signature and expiration.
 * - Resolve existing user and attach safe profile to req.user.
 * - Return HTTP 401 with {"success": false, "message": "Unauthorized"} on any failure.
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1].trim()) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const token = parts[1].trim();

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err || !decoded || typeof decoded !== 'object') {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const payload = decoded as TokenPayload;
      if (!payload.userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const userAccount = findUserById(payload.userId);
      if (!userAccount) {
        // If the user referenced by the token no longer exists, reject
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      req.user = toSafeUser(userAccount);
      next();
    });
  } catch (_error) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
  }
}
