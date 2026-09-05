/**
 * Payroll Calculation Snapshot Service — PeoplePay360
 *
 * Sits strictly between the pure deterministic PayrollEngine and the database repository.
 *
 * Architecture:
 *   PayrollEngine.compute()
 *         ↓
 *   CalculatedPayslip (pure result)
 *         ↓
 *   PayrollSnapshotService (this service)
 *         ↓
 *   PayrollSnapshotRepository
 *         ↓
 *   MySQL (payslips table with historical snapshot JSON)
 *
 * Responsibilities:
 * - Assembles structured earnings and deductions breakdowns from Phase 4 calculation output.
 * - Constructs immutable historical snapshots containing period, wage, breakdowns, and summaries.
 * - Enforces application-level immutability against finalized snapshots ('VALIDATED', 'PAID').
 * - Handles idempotent recalculation for 'DRAFT' and 'COMPUTED' payruns.
 */

import { PoolConnection } from 'mysql2/promise';
import {
  type CalculatedPayslip,
  type PayrollPeriod,
} from './payrollEngine.js';
import {
  createOrUpdatePayrollSnapshot,
  getPayrollSnapshotById,
  getPayrollSnapshotsByPayrun,
  getPayrollSnapshotsByPayrunIds,
  getPayrollHistoryByEmployee,
  findExistingSnapshot,
  type PayrollSnapshotRecord,
  type BreakdownItem,
} from '../repositories/payrollSnapshot.repository.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PersistSnapshotParams {
  payrunId: string;
  employeeId: string;
  employeeName?: string;
  department?: string;
  contractWage: number;
  period?: PayrollPeriod | { startDate?: string | null; endDate?: string | null } | null;
  calculatedPayslip: CalculatedPayslip;
  status?: string;
  warning?: string | null;
  connection?: PoolConnection;
}

export interface FullCalculationSnapshotPayload {
  version: number;
  calculatedAt: string;
  period: {
    startDate: string | null;
    endDate: string | null;
  };
  employee: {
    id: string;
    name: string;
    department: string;
  };
  contract: {
    wage: number;
  };
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  earnings: BreakdownItem[];
  deductions: BreakdownItem[];
  rulesByCategory?: Record<string, number>;
  rulesByCode?: Record<string, number>;
  attendanceSummary?: Record<string, unknown>;
  timeOffSummary?: Record<string, unknown>;
}

// ── Breakdown Extraction Functions ───────────────────────────────────────────

/**
 * Extracts structured earnings breakdown items from calculation output.
 */
export function extractEarningsBreakdown(calculated: CalculatedPayslip): BreakdownItem[] {
  // If calculation used Phase 4 ordered salary rules, pull from contributions
  if (calculated.rulesResult && Array.isArray(calculated.rulesResult.contributions)) {
    const earningContributions = calculated.rulesResult.contributions
      .filter((c: any) => c.categoryType === 'EARNING')
      .map((c: any) => ({
        ruleCode: c.ruleCode,
        ruleName: c.ruleName,
        category: c.category,
        amount: c.amount,
      }));

    if (earningContributions.length > 0) {
      return earningContributions;
    }
  }

  // Fallback to standard deterministic 3-tier earnings components
  return [
    {
      ruleCode: 'BASIC',
      ruleName: 'Basic Salary',
      category: 'BASIC',
      amount: calculated.basic,
    },
    {
      ruleCode: 'HRA',
      ruleName: 'House Rent Allowance',
      category: 'ALLOWANCE',
      amount: calculated.hra,
    },
    {
      ruleCode: 'ALLOWANCE',
      ruleName: 'Special Allowance',
      category: 'ALLOWANCE',
      amount: calculated.allowance,
    },
  ];
}

/**
 * Extracts structured deductions breakdown items from calculation output.
 */
export function extractDeductionsBreakdown(calculated: CalculatedPayslip): BreakdownItem[] {
  const items: BreakdownItem[] = [];

  // If calculation used Phase 4 ordered salary rules
  if (calculated.rulesResult && Array.isArray(calculated.rulesResult.contributions)) {
    const deductionContributions = calculated.rulesResult.contributions
      .filter((c: any) => c.categoryType === 'DEDUCTION')
      .map((c: any) => ({
        ruleCode: c.ruleCode,
        ruleName: c.ruleName,
        category: c.category,
        amount: c.amount,
      }));

    items.push(...deductionContributions);

    // If unpaid leave deduction was applied and not already present as a rule contribution
    const hasUnpaidRule = items.some((i) => i.ruleCode.toUpperCase() === 'UNPAID_LEAVE');
    if (!hasUnpaidRule && calculated.unpaidLeaveDeduction && calculated.unpaidLeaveDeduction > 0) {
      items.push({
        ruleCode: 'UNPAID_LEAVE',
        ruleName: 'Unpaid Leave Deduction',
        category: 'DEDUCTION',
        amount: calculated.unpaidLeaveDeduction,
      });
    }

    if (items.length > 0) {
      return items;
    }
  }

  // Fallback to standard deductions
  items.push({
    ruleCode: 'TAX',
    ruleName: 'Income Tax',
    category: 'DEDUCTION',
    amount: calculated.tax,
  });

  items.push({
    ruleCode: 'PF',
    ruleName: 'Social Security / PF',
    category: 'DEDUCTION',
    amount: calculated.otherDeductions,
  });

  if (calculated.unpaidLeaveDeduction && calculated.unpaidLeaveDeduction > 0) {
    items.push({
      ruleCode: 'UNPAID_LEAVE',
      ruleName: 'Unpaid Leave Deduction',
      category: 'DEDUCTION',
      amount: calculated.unpaidLeaveDeduction,
    });
  }

  return items;
}

/**
 * Builds the complete immutable JSON snapshot payload.
 */
export function buildCalculationSnapshotPayload(
  params: PersistSnapshotParams,
  earnings: BreakdownItem[],
  deductions: BreakdownItem[],
  version: number
): FullCalculationSnapshotPayload {
  const { calculatedPayslip, employeeId, employeeName, department, contractWage, period } = params;

  return {
    version,
    calculatedAt: new Date().toISOString(),
    period: {
      startDate: period?.startDate || null,
      endDate: period?.endDate || null,
    },
    employee: {
      id: employeeId,
      name: employeeName || calculatedPayslip.employeeName || employeeId,
      department: department || calculatedPayslip.department || 'General',
    },
    contract: {
      wage: contractWage,
    },
    grossSalary: calculatedPayslip.grossSalary !== undefined ? calculatedPayslip.grossSalary : calculatedPayslip.gross,
    totalDeductions:
      calculatedPayslip.totalCalculatedDeductions !== undefined
        ? calculatedPayslip.totalCalculatedDeductions
        : calculatedPayslip.totalDeductions,
    netSalary: calculatedPayslip.netSalary !== undefined ? calculatedPayslip.netSalary : calculatedPayslip.net,
    earnings,
    deductions,
    ...(calculatedPayslip.rulesResult?.byCategory
      ? { rulesByCategory: calculatedPayslip.rulesResult.byCategory }
      : {}),
    ...(calculatedPayslip.rulesResult?.byRuleCode
      ? { rulesByCode: calculatedPayslip.rulesResult.byRuleCode }
      : {}),
    ...(calculatedPayslip.attendanceSummary
      ? { attendanceSummary: calculatedPayslip.attendanceSummary as unknown as Record<string, unknown> }
      : {}),
    ...(calculatedPayslip.timeOffSummary
      ? { timeOffSummary: calculatedPayslip.timeOffSummary as unknown as Record<string, unknown> }
      : {}),
  };
}

// ── Service Class ────────────────────────────────────────────────────────────

export class PayrollSnapshotService {
  /**
   * Persists a calculation snapshot.
   * Enforces immutability: Rejects attempts to overwrite finalized ('VALIDATED' or 'PAID') snapshots.
   */
  public static async persistSnapshot(params: PersistSnapshotParams): Promise<PayrollSnapshotRecord> {
    const {
      payrunId,
      employeeId,
      contractWage,
      period,
      calculatedPayslip,
      status = 'DRAFT',
      warning,
      connection,
    } = params;

    // Check immutability
    const existing = await findExistingSnapshot(payrunId, employeeId, connection);
    if (existing && (existing.status === 'VALIDATED' || existing.status === 'PAID')) {
      throw new Error(
        `IMMUTABLE_SNAPSHOT_FINALIZED: Cannot overwrite finalized calculation snapshot for employee '${employeeId}' in payrun '${payrunId}' (status: ${existing.status}).`
      );
    }

    const version = existing ? (existing.calculationVersion || 1) + 1 : 1;
    const earningsBreakdown = extractEarningsBreakdown(calculatedPayslip);
    const deductionsBreakdown = extractDeductionsBreakdown(calculatedPayslip);

    const snapshotPayload = buildCalculationSnapshotPayload(
      params,
      earningsBreakdown,
      deductionsBreakdown,
      version
    );

    const grossSalary =
      calculatedPayslip.grossSalary !== undefined ? calculatedPayslip.grossSalary : calculatedPayslip.gross;
    const totalDeductions =
      calculatedPayslip.totalCalculatedDeductions !== undefined
        ? calculatedPayslip.totalCalculatedDeductions
        : calculatedPayslip.totalDeductions;
    const netSalary =
      calculatedPayslip.netSalary !== undefined ? calculatedPayslip.netSalary : calculatedPayslip.net;

    return createOrUpdatePayrollSnapshot(
      {
        payrunId,
        employeeId,
        periodStart: period?.startDate || null,
        periodEnd: period?.endDate || null,
        contractWage,
        basic: calculatedPayslip.basic,
        hra: calculatedPayslip.hra,
        allowance: calculatedPayslip.allowance,
        gross: grossSalary,
        tax: calculatedPayslip.tax,
        otherDeductions: calculatedPayslip.otherDeductions,
        net: netSalary,
        earningsBreakdown,
        deductionsBreakdown,
        calculationSnapshot: snapshotPayload as unknown as Record<string, unknown>,
        calculationVersion: version,
        status,
        warning: warning !== undefined ? warning : null,
      },
      connection
    );
  }

  /**
   * Batch persists snapshots for a payrun.
   */
  public static async persistBatchSnapshots(
    payrunId: string,
    items: PersistSnapshotParams[]
  ): Promise<PayrollSnapshotRecord[]> {
    const results: PayrollSnapshotRecord[] = [];
    for (const item of items) {
      const record = await PayrollSnapshotService.persistSnapshot(item);
      results.push(record);
    }
    return results;
  }

  /**
   * Retrieves a single snapshot by primary key.
   */
  public static async getSnapshotById(id: string): Promise<PayrollSnapshotRecord | null> {
    return getPayrollSnapshotById(id);
  }

  /**
   * Retrieves all historical calculation snapshots for a Payrun.
   */
  public static async getSnapshotsForPayrun(payrunId: string): Promise<PayrollSnapshotRecord[]> {
    return getPayrollSnapshotsByPayrun(payrunId);
  }

  /**
   * Retrieves snapshots for multiple Payruns in a single batch query (eliminates N+1).
   */
  public static async getSnapshotsForPayrunIds(payrunIds: string[]): Promise<PayrollSnapshotRecord[]> {
    return getPayrollSnapshotsByPayrunIds(payrunIds);
  }

  /**
   * Retrieves chronological payroll history for an Employee.
   */
  public static async getHistoryForEmployee(employeeId: string): Promise<PayrollSnapshotRecord[]> {
    return getPayrollHistoryByEmployee(employeeId);
  }
}
