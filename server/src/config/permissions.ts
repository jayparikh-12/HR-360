/**
 * PeoplePay360 — Centralized Permission Configuration
 *
 * Maps each AppRole to the set of AppPermissions it holds.
 *
 * Design rules:
 * - ADMIN always receives all permissions via explicit listing (no magic wildcard
 *   that can accidentally be bypassed by future refactors).
 * - Each role is independently defined; no implicit inheritance.
 * - To add a new permission: add it to PERMISSIONS in types/rbac.ts,
 *   then assign it to the appropriate role(s) here.
 */

import type { AppRole, AppPermission } from '../types/rbac.js';
import { ROLES, PERMISSIONS } from '../types/rbac.js';

// ---------------------------------------------------------------------------
// Role → Permission Map
// ---------------------------------------------------------------------------
export const ROLE_PERMISSIONS: Readonly<Record<AppRole, ReadonlySet<AppPermission>>> = {
  // ── ADMIN ──────────────────────────────────────────────────────────────
  // Full system access across all HR, Payroll, Structure and Admin domains.
  [ROLES.ADMIN]: new Set<AppPermission>([
    PERMISSIONS.EMPLOYEE_READ,
    PERMISSIONS.EMPLOYEE_WRITE,
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.CONTRACT_WRITE,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_WRITE,
    PERMISSIONS.TIMEOFF_READ,
    PERMISSIONS.TIMEOFF_APPROVE,
    PERMISSIONS.PAYRUN_READ,
    PERMISSIONS.PAYRUN_CREATE,
    PERMISSIONS.PAYRUN_VALIDATE,
    PERMISSIONS.PAYRUN_PAY,
    PERMISSIONS.STRUCTURE_READ,
    PERMISSIONS.STRUCTURE_WRITE,
    PERMISSIONS.SYSTEM_ADMIN,
  ]),

  // ── HR_PAYROLL_MANAGER ─────────────────────────────────────────────────
  // Full payroll lifecycle (create → compute → validate → mark paid).
  // Read-only access to employee and contract records for payroll calculation.
  // NO rights to modify employee/contract records, approve time-off, or edit salary rules.
  [ROLES.HR_PAYROLL_MANAGER]: new Set<AppPermission>([
    PERMISSIONS.EMPLOYEE_READ,
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.STRUCTURE_READ,
    PERMISSIONS.PAYRUN_READ,
    PERMISSIONS.PAYRUN_CREATE,
    PERMISSIONS.PAYRUN_VALIDATE,
    PERMISSIONS.PAYRUN_PAY,
  ]),

  // ── HR_MANAGER ─────────────────────────────────────────────────────────
  // People management (employees, contracts, working schedules) + attendance + time-off approval.
  // CANNOT touch payroll runs, validate/pay payruns, or edit salary structures/rules.
  [ROLES.HR_MANAGER]: new Set<AppPermission>([
    PERMISSIONS.EMPLOYEE_READ,
    PERMISSIONS.EMPLOYEE_WRITE,
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.CONTRACT_WRITE,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_WRITE,
    PERMISSIONS.TIMEOFF_READ,
    PERMISSIONS.TIMEOFF_APPROVE,
  ]),

  // ── HR_PAYROLL_USER ────────────────────────────────────────────────────
  // Operational payroll preparation: read employees, attendance, and draft/read payruns.
  // Cannot validate/pay payruns or modify HR records.
  [ROLES.HR_PAYROLL_USER]: new Set<AppPermission>([
    PERMISSIONS.EMPLOYEE_READ,
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.PAYRUN_READ,
    PERMISSIONS.PAYRUN_CREATE,
  ]),

  // ── EMPLOYEE ───────────────────────────────────────────────────────────
  // Self-service only: own attendance check-in/out, own time-off request, own payslips.
  // Cannot access employee directory, company payruns, contracts, or salary rules.
  [ROLES.EMPLOYEE]: new Set<AppPermission>([
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_WRITE,
    PERMISSIONS.TIMEOFF_READ,
    PERMISSIONS.PAYSLIP_READ,
  ]),
};

// ---------------------------------------------------------------------------
// Public helper — resolves permissions for a role string safely
// ---------------------------------------------------------------------------

export function normalizeRoleString(role: string | undefined | null): AppRole | null {
  if (!role) return null;
  const clean = role.trim().toUpperCase().replace(/\s+/g, '_');
  if (clean.includes('ADMIN')) return ROLES.ADMIN;
  if (clean.includes('PAYROLL_MANAGER') || clean === 'HR_PAYROLL_MANAGER') return ROLES.HR_PAYROLL_MANAGER;
  if (clean.includes('PAYROLL_USER') || clean === 'HR_PAYROLL_USER') return ROLES.HR_PAYROLL_USER;
  if (clean.includes('HR_MANAGER') || clean === 'HR_MANAGER') return ROLES.HR_MANAGER;
  if (clean.includes('EMPLOYEE') || clean === 'EMPLOYEE') return ROLES.EMPLOYEE;
  return null;
}

/**
 * Returns the permission Set for a given role string.
 * Returns an empty Set for any unknown or missing role — never throws.
 */
export function getPermissionsForRole(role: string | undefined | null): ReadonlySet<AppPermission> {
  if (!role) return new Set();
  const normalized = normalizeRoleString(role);
  if (!normalized) return new Set();
  const permissions = ROLE_PERMISSIONS[normalized];
  return permissions ?? new Set();
}

/**
 * Returns true if the given role holds the given permission.
 * Safe against unknown roles and unknown permission strings.
 */
export function roleHasPermission(
  role: string | undefined | null,
  permission: AppPermission
): boolean {
  return getPermissionsForRole(role).has(permission);
}
