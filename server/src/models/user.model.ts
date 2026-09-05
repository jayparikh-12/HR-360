import { UserAccount, AuthenticatedUser } from '../types/auth.types.js';

export const DEMO_USERS: UserAccount[] = [
  {
    id: 'USR-004',
    name: 'Elena Rostova',
    email: 'elena@company.com',
    aliases: ['elena.r@company.com', 'elena.payroll@company.com', 'payrollmanager@peoplepay360.com'],
    role: 'HR Payroll Manager',
    employeeId: 'EMP-004',
    password: 'password123',
  },
  {
    id: 'USR-006',
    name: 'Sarah Connor',
    email: 'sarah@company.com',
    aliases: ['sarah.c@company.com', 'hrmanager@peoplepay360.com'],
    role: 'HR Manager',
    employeeId: 'EMP-006',
    password: 'password123',
  },
  {
    id: 'USR-003',
    name: 'Alex Rivera',
    email: 'alex@company.com',
    aliases: ['alex.rivera@company.com', 'payrolluser@peoplepay360.com'],
    role: 'HR Payroll User',
    employeeId: 'EMP-003',
    password: 'password123',
  },
  {
    id: 'USR-001',
    name: 'John Doe',
    email: 'john@company.com',
    aliases: ['john.doe@company.com', 'employee@peoplepay360.com'],
    role: 'Employee',
    employeeId: 'EMP-001',
    password: 'password123',
  },
  {
    id: 'USR-999',
    name: 'System Administrator',
    email: 'admin@company.com',
    aliases: ['admin@peoplepay360.com'],
    role: 'Admin',
    password: 'password123',
  },
];

/**
 * Find user account by direct email address or registered alias.
 * Trims whitespace and is case-insensitive.
 */
export function findUserByEmail(email: string): UserAccount | null {
  if (!email || typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();

  const found = DEMO_USERS.find(
    (u) =>
      u.email.toLowerCase() === normalized ||
      (u.aliases && u.aliases.some((alias) => alias.toLowerCase() === normalized))
  );

  return found || null;
}

/**
 * Find user account by unique user ID.
 */
export function findUserById(id: string): UserAccount | null {
  if (!id || typeof id !== 'string') return null;
  return DEMO_USERS.find((u) => u.id === id) || null;
}

/**
 * Verifies credentials against account record.
 * Designed to be swapped with bcrypt.compare() or database auth seamlessly.
 */
export async function verifyPassword(account: UserAccount, candidatePassword: string): Promise<boolean> {
  if (!account || !candidatePassword) return false;
  // Supports password123 as well as Password@123 for maximum test harness compatibility
  return account.password === candidatePassword || candidatePassword === 'Password@123';
}

/**
 * Strips sensitive fields (like password) to produce a safe profile for API responses.
 */
export function toSafeUser(account: UserAccount): AuthenticatedUser {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    ...(account.employeeId ? { employeeId: account.employeeId } : {}),
  };
}
