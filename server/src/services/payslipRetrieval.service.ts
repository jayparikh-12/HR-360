/**
 * Payslip Retrieval Service — PeoplePay360
 *
 * Exposes persisted historical payroll calculation snapshots as clean, secure Payslip APIs.
 *
 * Responsibilities:
 * - Read-only queries against historical stored snapshots in MySQL (`payslips`, `employees`, `payruns`).
 * - ZERO recalculation: Never invokes `PayrollEngine`, never modifies salary rules, never modifies attendance.
 * - Enforces Employee Data Isolation: Employees can strictly view only their own payslips (EMP-A cannot view EMP-B).
 * - Provides itemized breakdown: Rule code, rule name, category, and amount for earnings & deductions.
 * - Formats dates, status, base salary, gross salary, total deductions, and net salary.
 */

import {
  getDetailedPayslipById,
  getDetailedPayslipByPayrunAndEmployee,
  getDetailedHistoryByEmployee,
  type DetailedPayslipRecord,
  type BreakdownItem,
} from '../repositories/payrollSnapshot.repository.js';
import { type AuthenticatedUser } from '../types/auth.types.js';
import { normalizeRoleString, roleHasPermission } from '../config/permissions.js';
import { PERMISSIONS } from '../types/rbac.js';

// ── Custom Error Classes ─────────────────────────────────────────────────────

export class PayslipNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Payslip '${identifier}' was not found.`);
    this.name = 'PayslipNotFoundError';
  }
}

export class EmployeeNotFoundError extends Error {
  constructor(employeeId: string) {
    super(`Employee '${employeeId}' was not found.`);
    this.name = 'EmployeeNotFoundError';
  }
}

export class ForbiddenEmployeeAccessError extends Error {
  constructor(message: string = 'Forbidden: You do not have permission to view this payslip.') {
    super(message);
    this.name = 'ForbiddenEmployeeAccessError';
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface DetailedPayslipResponse {
  payslipId: string;
  payrunId: string;
  payrunName: string;
  employee: {
    id: string;
    employeeId: string;
    name: string;
    department: string;
    position: string;
  };
  payrollPeriod: {
    start: string | null;
    end: string | null;
  };
  status: string;
  baseSalary: number;
  earnings: BreakdownItem[];
  deductions: BreakdownItem[];
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  calculatedAt: string;
  validatedAt: string | null;
  paidAt: string | null;
  paymentReference?: string | null;
  warning?: string | null;
}

export interface EmployeePayslipHistoryItem {
  payslipId: string;
  payrunId: string;
  payrunName: string;
  payrollPeriod: {
    start: string | null;
    end: string | null;
  };
  status: string;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  calculatedAt: string;
  paidAt: string | null;
}

// ── Authorization & Access Control Helper ────────────────────────────────────

function checkEmployeeAccess(
  requestingUser: AuthenticatedUser | undefined,
  targetEmployeeId: string
): void {
  if (!requestingUser) {
    throw new ForbiddenEmployeeAccessError('Unauthorized: Authentication required.');
  }

  // 1. Employee self-service check: user's employeeId matches requested employeeId
  if (
    requestingUser.employeeId &&
    requestingUser.employeeId.trim().toUpperCase() === targetEmployeeId.trim().toUpperCase()
  ) {
    return;
  }

  // 2. Privileged access: Check if role has PAYRUN_READ permission (Admin, HR Payroll Manager, HR Payroll User)
  const canonicalRole = normalizeRoleString(requestingUser.role);
  if (canonicalRole && roleHasPermission(canonicalRole, PERMISSIONS.PAYRUN_READ)) {
    return;
  }

  // 3. Reject unauthorized cross-employee access
  throw new ForbiddenEmployeeAccessError(
    `Forbidden: You do not have permission to view payroll records for employee '${targetEmployeeId}'.`
  );
}

function formatPayslipResponse(record: DetailedPayslipRecord): DetailedPayslipResponse {
  return {
    payslipId: record.payslipId,
    payrunId: record.payrunId,
    payrunName: record.payrunName,
    employee: {
      id: record.employee.id,
      employeeId: record.employee.employeeId,
      name: record.employee.name,
      department: record.employee.department,
      position: record.employee.position,
    },
    payrollPeriod: {
      start: record.payrollPeriod.start,
      end: record.payrollPeriod.end,
    },
    status: record.status,
    baseSalary: record.baseSalary,
    earnings: record.earnings,
    deductions: record.deductions,
    grossSalary: record.grossSalary,
    totalDeductions: record.totalDeductions,
    netSalary: record.netSalary,
    calculatedAt: record.calculatedAt,
    validatedAt: record.validatedAt,
    paidAt: record.paidAt,
    paymentReference: record.paymentReference || null,
    warning: record.warning || null,
  };
}

// ── Service Implementation ──────────────────────────────────────────────────

export class PayslipRetrievalService {
  /**
   * Retrieves a detailed payslip by payslip primary key ID.
   * Enforces data isolation so Employee A cannot view Employee B's payslip.
   */
  public static async getPayslipById(
    payslipId: string,
    requestingUser?: AuthenticatedUser,
    options?: { bypassAuth?: boolean }
  ): Promise<DetailedPayslipResponse> {
    const trimmedId = payslipId?.trim();
    if (!trimmedId) {
      throw new PayslipNotFoundError(payslipId);
    }

    const payslip = await getDetailedPayslipById(trimmedId);
    if (!payslip) {
      throw new PayslipNotFoundError(trimmedId);
    }

    if (!options?.bypassAuth) {
      checkEmployeeAccess(requestingUser, payslip.employee.employeeId);
    }

    return formatPayslipResponse(payslip);
  }

  /**
   * Retrieves a detailed payslip by payrun ID and employee ID.
   * Enforces data isolation so Employee A cannot view Employee B's payslip.
   */
  public static async getPayslipByPayrunAndEmployee(
    payrunId: string,
    employeeId: string,
    requestingUser?: AuthenticatedUser,
    options?: { bypassAuth?: boolean }
  ): Promise<DetailedPayslipResponse> {
    const trimmedPayrunId = payrunId?.trim();
    const trimmedEmployeeId = employeeId?.trim();

    if (!trimmedPayrunId || !trimmedEmployeeId) {
      throw new PayslipNotFoundError(`${trimmedPayrunId}/${trimmedEmployeeId}`);
    }

    if (!options?.bypassAuth) {
      checkEmployeeAccess(requestingUser, trimmedEmployeeId);
    }

    const payslip = await getDetailedPayslipByPayrunAndEmployee(trimmedPayrunId, trimmedEmployeeId);
    if (!payslip) {
      throw new PayslipNotFoundError(`Payrun: ${trimmedPayrunId}, Employee: ${trimmedEmployeeId}`);
    }

    return formatPayslipResponse(payslip);
  }

  /**
   * Retrieves all historical payslips for an employee, sorted newest first.
   * Enforces data isolation so Employee A cannot view Employee B's history.
   */
  public static async getEmployeePayslipHistory(
    employeeId: string,
    requestingUser?: AuthenticatedUser,
    options?: { bypassAuth?: boolean }
  ): Promise<EmployeePayslipHistoryItem[]> {
    const trimmedEmployeeId = employeeId?.trim();
    if (!trimmedEmployeeId) {
      throw new EmployeeNotFoundError(employeeId);
    }

    if (!options?.bypassAuth) {
      checkEmployeeAccess(requestingUser, trimmedEmployeeId);
    }

    const historyRecords = await getDetailedHistoryByEmployee(trimmedEmployeeId);

    return historyRecords.map((r) => ({
      payslipId: r.payslipId,
      payrunId: r.payrunId,
      payrunName: r.payrunName,
      payrollPeriod: {
        start: r.payrollPeriod.start,
        end: r.payrollPeriod.end,
      },
      status: r.status,
      grossSalary: r.grossSalary,
      totalDeductions: r.totalDeductions,
      netSalary: r.netSalary,
      calculatedAt: r.calculatedAt,
      paidAt: r.paidAt,
    }));
  }
}
