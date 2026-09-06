import type { UserRole } from '../types';

// Route → tab key mapping (used by Sidebar and router)
export const PATH_TO_TAB: Record<string, string> = {
  '/dashboard':        'dashboard',
  '/employees':        'employees',
  '/contracts':        'contracts',
  '/schedules':        'schedules',
  '/attendance':       'attendance',
  '/time-off':         'time-off',
  '/payruns':          'payruns',
  '/payslips':         'payslips',
  '/salary-rules':     'salary-rules',
  '/settings':         'settings',
};

export const TAB_TO_PATH: Record<string, string> = Object.fromEntries(
  Object.entries(PATH_TO_TAB).map(([path, tab]) => [tab, path])
);

/**
 * Authoritative RBAC check for navigation tabs and frontend route protection.
 */
export const isTabAllowed = (tab: string, role: UserRole): boolean => {
  if (role === 'Admin') return true;
  if (role === 'HR Manager') {
    return ['dashboard', 'employees', 'contracts', 'schedules', 'attendance', 'time-off', 'payslips'].includes(tab);
  }
  if (role === 'HR Payroll Manager' || role === 'HR Payroll User') {
    return ['dashboard', 'employees', 'contracts', 'attendance', 'payruns', 'payslips'].includes(tab);
  }
  if (role === 'Employee') {
    return ['dashboard', 'attendance', 'time-off', 'payslips'].includes(tab);
  }
  return tab === 'dashboard';
};

/**
 * Resolves the primary workspace landing route for a user based on their active role.
 * Avoids hardcoding /dashboard if role lacks dashboard access.
 */
export const getDefaultWorkspacePath = (role?: UserRole | string | null, isAuthenticated?: boolean): string => {
  if (isAuthenticated === false || !role) {
    return '/login';
  }
  if (isTabAllowed('dashboard', role as UserRole)) {
    return '/dashboard';
  }
  if (isTabAllowed('attendance', role as UserRole)) {
    return '/attendance';
  }
  if (isTabAllowed('employees', role as UserRole)) {
    return '/employees';
  }
  if (isTabAllowed('payslips', role as UserRole)) {
    return '/payslips';
  }
  return '/dashboard';
};

