import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/authorize.js';
import { findUserByEmail, findUserByEmailAsync, verifyPassword, toSafeUser } from '../models/user.model.js';
import { LoginRequest, LoginResponse, MeResponse, TokenPayload } from '../types/auth.types.js';
import { PERMISSIONS } from '../types/rbac.js';
import { getPermissionsForRole } from '../config/permissions.js';


import { JWT_SECRET, JWT_SIGN_OPTIONS } from '../config/jwt.config.js';
import { isValidEmail } from '../utils/validators.js';

const router = Router();

/**
 * POST /api/auth/login
 *
 * Authenticates user credentials and returns a signed JWT with safe user profile.
 * Mitigates user enumeration by returning identical generic error messages.
 */
router.post('/login', async (req: Request<{}, {}, LoginRequest>, res: Response<LoginResponse>): Promise<void> => {
  try {
    const { email, password } = req.body || {};

    // Validate presence of required fields
    if (!email || typeof email !== 'string' || !email.trim()) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
      return;
    }

    if (!password || typeof password !== 'string' || !password.trim()) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validate email format
    if (!isValidEmail(normalizedEmail)) {
      res.status(400).json({
        success: false,
        message: 'Invalid email address format',
      });
      return;
    }

    // Authenticate against database user repository
    const userAccount = (await findUserByEmailAsync(normalizedEmail)) || findUserByEmail(normalizedEmail);
    if (!userAccount) {
      // Return same generic message to prevent user enumeration
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    const isValidPassword = await verifyPassword(userAccount, password);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    // Generate minimal identity payload JWT
    const payload: TokenPayload = {
      userId: userAccount.id,
      email: userAccount.email,
      role: userAccount.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, JWT_SIGN_OPTIONS);

    // Safe user response (never leaking password)
    const safeUser = toSafeUser(userAccount);

    res.status(200).json({
      success: true,
      token,
      user: safeUser,
    });
  } catch (_error) {
    // Prevent internal details or stack traces from leaking
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during authentication. Please try again.',
    });
  }
});

/**
 * GET /api/auth/me
 *
 * Protected endpoint that returns the currently authenticated user's profile.
 */
router.get('/me', authenticateToken, (req: Request, res: Response<MeResponse>): void => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while retrieving user profile.',
    });
  }
});

/**
 * GET /api/auth/whoami
 * RBAC proof-of-concept endpoint (Part 1 validation only).
 *
 * Demonstrates the full middleware chain:
 *   authenticateToken → authorize(EMPLOYEE_READ) → handler
 *
 * Requires: Authorization: Bearer <token>
 * All authenticated users have EMPLOYEE_READ, so this is accessible to every
 * valid session. Remove or restrict this endpoint before production.
 */


router.get(
  '/whoami',
  authenticateToken,
  authorize(PERMISSIONS.ATTENDANCE_READ),
  (req: Request, res: Response) => {
    const user = req.user!;
    const permissions = [...getPermissionsForRole(user.role)];
    return res.json({
      success: true,
      user,
      permissions,
    });
  }
);

export default router;

