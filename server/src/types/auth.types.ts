export type UserRole =
  | 'Employee'
  | 'HR Manager'
  | 'HR Payroll User'
  | 'HR Payroll Manager'
  | 'Admin';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string;
}

export interface UserAccount extends AuthenticatedUser {
  password: string;
  aliases?: string[];
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  email?: string;
  password?: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: AuthenticatedUser;
  message?: string;
}

export interface MeResponse {
  success: boolean;
  user?: AuthenticatedUser;
  message?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
