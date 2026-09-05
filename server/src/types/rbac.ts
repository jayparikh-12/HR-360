/**
 * PeoplePay360 — Centralized RBAC Types
 *
 * Single source of truth for role and permission types.
 * Import from here; never scatter raw string literals in route files.
 */

// ---------------------------------------------------------------------------
// Roles — must match exactly what is embedded inside the session token
// ---------------------------------------------------------------------------
export const ROLES = {
  ADMIN: 'ADMIN',
  HR_PAYROLL_MANAGER: 'HR_PAYROLL_MANAGER',
  HR_MANAGER: 'HR_MANAGER',
  HR_PAYROLL_USER: 'HR_PAYROLL_USER',
  EMPLOYEE: 'EMPLOYEE',
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: readonly AppRole[] = Object.values(ROLES) as AppRole[];

// ---------------------------------------------------------------------------
// Permissions — granular named capabilities
// ---------------------------------------------------------------------------
export const PERMISSIONS = {
  // Employee records
  EMPLOYEE_READ: 'EMPLOYEE_READ',
  EMPLOYEE_WRITE: 'EMPLOYEE_WRITE',

  // Contracts
  CONTRACT_READ: 'CONTRACT_READ',
  CONTRACT_WRITE: 'CONTRACT_WRITE',

  // Attendance
  ATTENDANCE_READ: 'ATTENDANCE_READ',
  ATTENDANCE_WRITE: 'ATTENDANCE_WRITE',

  // Time off
  TIMEOFF_READ: 'TIMEOFF_READ',
  TIMEOFF_APPROVE: 'TIMEOFF_APPROVE',

  // Payroll
  PAYRUN_READ: 'PAYRUN_READ',
  PAYRUN_CREATE: 'PAYRUN_CREATE',
  PAYRUN_VALIDATE: 'PAYRUN_VALIDATE',
  PAYRUN_PAY: 'PAYRUN_PAY',

  // Own payslip self-service
  PAYSLIP_READ: 'PAYSLIP_READ',

  // System-level
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
} as const;

export type AppPermission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly AppPermission[] = Object.values(
  PERMISSIONS
) as AppPermission[];
