import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'peoplepay360-hackathon-secure-secret-2026';

export interface UserPayload {
  id: string;
  name: string;
  email: string;
  role: 'EMPLOYEE' | 'HR_MANAGER' | 'HR_PAYROLL_USER' | 'HR_PAYROLL_MANAGER' | 'ADMIN';
  employeeId?: string;
}

interface DemoAccount extends UserPayload {
  password: string;
  aliases?: string[];
}

// Demo accounts database
const demoAccounts: DemoAccount[] = [
  {
    id: 'USR-004',
    name: 'Elena Rostova',
    email: 'elena@company.com',
    aliases: ['elena.payroll@company.com', 'elena.r@company.com'],
    role: 'HR_PAYROLL_MANAGER',
    employeeId: 'EMP-004',
    password: 'password123',
  },
  {
    id: 'USR-006',
    name: 'Sarah Connor',
    email: 'sarah@company.com',
    aliases: ['sarah.c@company.com'],
    role: 'HR_MANAGER',
    employeeId: 'EMP-006',
    password: 'password123',
  },
  {
    id: 'USR-003',
    name: 'Alex Rivera',
    email: 'alex@company.com',
    aliases: ['alex.rivera@company.com'],
    role: 'HR_PAYROLL_USER',
    employeeId: 'EMP-003',
    password: 'password123',
  },
  {
    id: 'USR-001',
    name: 'John Doe',
    email: 'john@company.com',
    aliases: ['john.doe@company.com'],
    role: 'EMPLOYEE',
    employeeId: 'EMP-001',
    password: 'password123',
  },
  {
    id: 'USR-002',
    name: 'Maya Lin',
    email: 'maya.lin@company.com',
    role: 'EMPLOYEE',
    employeeId: 'EMP-002',
    password: 'password123',
  },
  {
    id: 'USR-005',
    name: 'David Kim',
    email: 'david.kim@company.com',
    role: 'EMPLOYEE',
    employeeId: 'EMP-005',
    password: 'password123',
  },
  {
    id: 'USR-999',
    name: 'System Administrator',
    email: 'admin@company.com',
    role: 'ADMIN',
    password: 'password123',
  },
];

// Helper: Sign token with HMAC-SHA256
function createSessionToken(user: UserPayload): string {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    employeeId: user.employeeId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `pp360.${payloadB64}.${signature}`;
}

// Helper: Verify session token
function verifySessionToken(token: string): UserPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'pp360') {
      return null;
    }
    const [, payloadB64, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(payloadB64)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

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
 * POST /api/auth/login
 * Request: { email, password }
 * Response: { success: true, token, user }
 */
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required.',
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Find user by direct email or alias
  const account = demoAccounts.find(
    (acc) =>
      acc.email.toLowerCase() === normalizedEmail ||
      (acc.aliases && acc.aliases.some((alias) => alias.toLowerCase() === normalizedEmail))
  );

  if (!account) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials. User account not found.',
    });
  }

  if (account.password !== password) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials. Incorrect password provided.',
    });
  }

  const user: UserPayload = {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    employeeId: account.employeeId,
  };

  const token = createSessionToken(user);

  return res.status(200).json({
    success: true,
    token,
    user,
  });
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 * Response: { success: true, user }
 */
router.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token is missing or malformed.',
    });
  }

  const token = authHeader.split(' ')[1];
  const user = verifySessionToken(token);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Session has expired or is invalid. Please sign in again.',
    });
  }

  return res.status(200).json({
    success: true,
    user,
  });
});

export default router;
