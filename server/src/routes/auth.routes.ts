import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { findUserByEmail, verifyPassword, toSafeUser } from '../models/user.model.js';
import { LoginRequest, LoginResponse, MeResponse, TokenPayload } from '../types/auth.types.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'peoplepay360-hackathon-jwt-secret-2026';
const TOKEN_EXPIRY = '8h';

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

    // Authenticate against demo user repository
    const userAccount = findUserByEmail(normalizedEmail);
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

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

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

export default router;
