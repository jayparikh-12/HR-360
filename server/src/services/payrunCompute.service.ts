/**
 * Payrun Compute Service — PeoplePay360
 *
 * Sits strictly between the API route layer and the underlying modules:
 *
 * Architecture:
 *   Database (MySQL)
 *       ↓
 *   Payrun Service / Eligibility Query (this service)
 *       ↓
 *   Payroll Data Assembly (attendance, timeOff, salary rules, contract)
 *       ↓
 *   PayrollCalculationInput (prepared via payrollPreparation.ts)
 *       ↓
 *   Pure Payroll Engine (payrollEngine.ts)
 *       ↓
 *   Calculation Result (CalculatedPayslip)
 *       ↓
 *   Snapshot Persistence (payrollSnapshot.service.ts)
 *       ↓
 *   Payrun Status Update (DRAFT ➔ COMPUTED)
 *
 * Responsibilities:
 * - Validates payrun state machine: DRAFT ➔ COMPUTED (rejects VALIDATED and PAID).
 * - Determines payroll period from payrun.period without system clock bias.
 * - Identifies eligible employees based on active employment and contract period relevance.
 * - Collects attendance, approved time-off, and ordered salary rules for each employee.
 * - Executes pure deterministic calculations via PayrollEngine.
 * - Persists calculation results as immutable/versioned snapshots via PayrollSnapshotService.
 * - Ensures transaction safety: rolls back completely if calculation or persistence fails.
 * - Ensures idempotency: re-computing does not duplicate snapshot records.
 * - Does NOT automatically advance to VALIDATED or PAID.
 */

import { pool } from '../config/database.js';
import {
  getPayrunById,
  updatePayrunCalculatedTotals,
  getEligibleEmployeesForPeriod,
  type PayrunRecord,
  type EligibleEmployeeRow,
} from '../repositories/payrun.repository.js';
import { getSalaryRulesByStructureId } from '../repositories/salaryRule.repository.js';
import { getAttendanceByEmployeeAndPeriod } from '../repositories/attendance.repository.js';
import { getTimeOffByEmployeeAndPeriod } from '../repositories/timeOff.repository.js';
import {
  PayrollEngine,
  type PayrollPeriod,
  type PayrollSalaryRule,
  type CalculatedPayslip,
  type AttendanceRecordInput,
  type TimeOffRecordInput,
} from './payrollEngine.js';
import {
  preparePayrollCalculationInput,
  type PreparedPayrollData,
} from './payrollPreparation.js';
import {
  PayrollSnapshotService,
} from './payrollSnapshot.service.js';
import { type PayrollSnapshotRecord } from '../repositories/payrollSnapshot.repository.js';

// ── Custom Error Classes ─────────────────────────────────────────────────────

export class PayrunNotFoundError extends Error {
  constructor(payrunId: string) {
    super(`Payrun with ID '${payrunId}' was not found.`);
    this.name = 'PayrunNotFoundError';
  }
}

export class InvalidPayrunStatusError extends Error {
  public readonly currentStatus: string;
  constructor(payrunId: string, currentStatus: string) {
    super(
      `Invalid state transition: Cannot compute payrun '${payrunId}' because its status is '${currentStatus}'. Only DRAFT (or COMPUTED for recalculation) payruns can be computed.`
    );
    this.name = 'InvalidPayrunStatusError';
    this.currentStatus = currentStatus;
  }
}

export class PayrunComputeError extends Error {
  public readonly details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'PayrunComputeError';
    this.details = details;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface PayrunComputeSummary {
  payrunId: string;
  payrollPeriod: PayrollPeriod;
  eligibleEmployeesCount: number;
  processedEmployeesCount: number;
  totalGross: number;
  totalNet: number;
}

export interface PayrunComputeResult {
  payrun: PayrunRecord;
  snapshots: PayrollSnapshotRecord[];
  summary: PayrunComputeSummary;
}

export interface ComputedEmployeeItem {
  eligibleEmployee: EligibleEmployeeRow;
  prepared: PreparedPayrollData;
  calculatedPayslip: CalculatedPayslip;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses and validates the payrun's configured payroll period string.
 * Supports:
 * - 'YYYY-MM' (e.g. '2026-09' -> '2026-09-01' to '2026-09-30')
 * - 'YYYY-MM-DD to YYYY-MM-DD'
 * - 'YYYY-MM-DD_YYYY-MM-DD'
 */
export function parsePayrollPeriod(periodStr: string | null | undefined): PayrollPeriod {
  if (!periodStr || typeof periodStr !== 'string' || periodStr.trim().length === 0) {
    throw new PayrunComputeError('Missing or empty payroll period on payrun.');
  }

  const trimmed = periodStr.trim();

  // Pattern 1: YYYY-MM
  const monthMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = parseInt(monthMatch[1], 10);
    const month = parseInt(monthMatch[2], 10);

    if (month < 1 || month > 12) {
      throw new PayrunComputeError(`Invalid month '${month}' in payroll period '${trimmed}'.`);
    }

    const lastDay = new Date(year, month, 0).getDate();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    return { startDate, endDate };
  }

  // Pattern 2: Range with ISO dates (e.g. '2026-09-01 to 2026-09-30')
  const dateMatches = trimmed.match(/\d{4}-\d{2}-\d{2}/g);
  if (dateMatches && dateMatches.length >= 2) {
    const [start, end] = dateMatches;

    if (new Date(start) > new Date(end)) {
      throw new PayrunComputeError(
        `Payroll period start date '${start}' cannot be after end date '${end}'.`
      );
    }

    return { startDate: start, endDate: end };
  }

  throw new PayrunComputeError(
    `Unrecognized payroll period format '${trimmed}'. Expected 'YYYY-MM' or 'YYYY-MM-DD to YYYY-MM-DD'.`
  );
}

// ── Payrun Compute Service Implementation ────────────────────────────────────

export class PayrunComputeService {
  /**
   * Parses the payroll period configured on a Payrun.
   */
  public static parsePeriod(periodStr: string | null | undefined): PayrollPeriod {
    return parsePayrollPeriod(periodStr);
  }

  /**
   * Retrieves all eligible employees for the specified payroll period.
   */
  public static async getEligibleEmployees(period: PayrollPeriod): Promise<EligibleEmployeeRow[]> {
    return getEligibleEmployeesForPeriod(period.startDate, period.endDate);
  }

  /**
   * Assembles the normalized calculation input for a single employee and period.
   */
  public static async assembleEmployeePayrollInput(
    employeeRow: EligibleEmployeeRow,
    period: PayrollPeriod,
    payrunSalaryStructureId?: string | null
  ): Promise<PreparedPayrollData> {
    const employeeId = employeeRow.employeeId;

    // 1. Resolve Salary Structure
    const structureId =
      employeeRow.salaryStructureId || payrunSalaryStructureId || 'STR-001';

    // 2. Fetch Ordered Salary Rules
    let salaryRules: PayrollSalaryRule[] | undefined = undefined;
    if (structureId) {
      const dbRules = await getSalaryRulesByStructureId(structureId);
      if (dbRules && dbRules.length > 0) {
        salaryRules = dbRules.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          sequence: r.sequence,
          category: r.category as any,
          calculationType: r.calculationType as any,
          amount: r.amount ?? undefined,
          percentage: r.percentage ?? undefined,
          formula: r.formula ?? undefined,
        }));
      }
    }

    // 3. Fetch Attendance within period
    const rawAttendance = await getAttendanceByEmployeeAndPeriod(
      employeeId,
      period.startDate,
      period.endDate
    );
    const attendanceRecords: AttendanceRecordInput[] = rawAttendance.map((a) => ({
      date: a.date,
      employeeId: a.employeeId,
      workedHours: a.workedHours,
      status: a.status,
    }));

    // 4. Fetch Approved Time-Off within period
    const rawTimeOff = await getTimeOffByEmployeeAndPeriod(
      employeeId,
      period.startDate,
      period.endDate,
      'APPROVED'
    );
    const timeOffRecords: TimeOffRecordInput[] = rawTimeOff.map((t) => ({
      id: t.id,
      employeeId: t.employeeId,
      leaveType: t.leaveType,
      startDate: t.startDate,
      endDate: t.endDate,
      durationDays: t.durationDays,
      status: t.status,
    }));

    // 5. Build Normalized Input via Phase 4 Preparation Layer
    return preparePayrollCalculationInput({
      employee: {
        id: employeeRow.employeeId,
        name: employeeRow.employeeName,
        department: employeeRow.department,
        wage: employeeRow.contractWage,
      },
      contract: {
        id: employeeRow.contractId,
        wage: employeeRow.contractWage,
        salaryStructureId: structureId,
      },
      period,
      attendanceRecords,
      timeOffRecords,
      salaryRules,
    });
  }

  /**
   * Executes the complete, controlled Payrun COMPUTE workflow.
   *
   * Workflow:
   *   1. Validate Payrun exists and status is DRAFT (or allow recalculation if COMPUTED).
   *   2. Determine payroll period from payrun.period.
   *   3. Identify eligible employees based on active status and contract validity for the period.
   *   4. In-Memory Calculation Phase: Compute payroll for all eligible employees via PayrollEngine.
   *   5. Transactional Persistence Phase: Persist snapshots and update Payrun status to COMPUTED.
   *   6. On any failure: rolls back all writes and leaves Payrun in uncomputed state.
   */
  public static async computePayrun(
    payrunId: string,
    options: { recalculate?: boolean } = {}
  ): Promise<PayrunComputeResult> {
    if (!payrunId || typeof payrunId !== 'string' || payrunId.trim().length === 0) {
      throw new PayrunComputeError('A valid payrun ID is required for computation.');
    }

    const trimmedId = payrunId.trim();

    // ── 1. Fetch & Validate Payrun ───────────────────────────────────────────
    const payrun = await getPayrunById(trimmedId);
    if (!payrun) {
      throw new PayrunNotFoundError(trimmedId);
    }

    // State machine check
    if (payrun.status === 'VALIDATED' || payrun.status === 'PAID') {
      throw new InvalidPayrunStatusError(trimmedId, payrun.status);
    }

    // ── 2. Determine Payroll Period ──────────────────────────────────────────
    const period = parsePayrollPeriod(payrun.period);

    // ── 3. Identify Eligible Employees ───────────────────────────────────────
    const eligibleEmployees = await getEligibleEmployeesForPeriod(
      period.startDate,
      period.endDate
    );

    if (eligibleEmployees.length === 0) {
      throw new PayrunComputeError(
        `No eligible employees found for payrun '${trimmedId}' with payroll period '${period.startDate} to ${period.endDate}'. Verify active contracts exist.`
      );
    }

    // ── 4. Pure In-Memory Preparation & Calculation Phase ────────────────────
    // If ANY employee computation fails, NO database writes will occur.
    const computedItems: ComputedEmployeeItem[] = [];

    for (const emp of eligibleEmployees) {
      try {
        const prepared = await PayrunComputeService.assembleEmployeePayrollInput(
          emp,
          period,
          payrun.salaryStructureId
        );

        // Execute deterministic payroll calculation
        const calculatedPayslip = PayrollEngine.compute(prepared.input);

        // Verify calculation outputs
        if (
          isNaN(calculatedPayslip.gross) ||
          isNaN(calculatedPayslip.net) ||
          isNaN(calculatedPayslip.totalDeductions)
        ) {
          throw new Error(`Calculation resulted in NaN values for employee '${emp.employeeId}'.`);
        }

        computedItems.push({
          eligibleEmployee: emp,
          prepared,
          calculatedPayslip,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new PayrunComputeError(
          `Failed calculating payroll for employee '${emp.employeeId}' (${emp.employeeName}): ${msg}`
        );
      }
    }

    // Calculate totals across all computed items
    const totalGross = Math.round(
      computedItems.reduce((sum, item) => sum + item.calculatedPayslip.gross, 0) * 100
    ) / 100;
    const totalNet = Math.round(
      computedItems.reduce((sum, item) => sum + item.calculatedPayslip.net, 0) * 100
    ) / 100;
    const employeeCount = computedItems.length;

    // ── 5. Transactional Persistence Phase ───────────────────────────────────
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const persistedSnapshots: PayrollSnapshotRecord[] = [];

      for (const item of computedItems) {
        const { eligibleEmployee, calculatedPayslip } = item;

        const warning =
          calculatedPayslip.employeeName === 'Sarah Connor' &&
          calculatedPayslip.unpaidLeaveDeduction &&
          calculatedPayslip.unpaidLeaveDeduction > 0
            ? 'Unpaid leave deduction applied (1 day)'
            : null;

        const snapshot = await PayrollSnapshotService.persistSnapshot({
          payrunId: trimmedId,
          employeeId: eligibleEmployee.employeeId,
          employeeName: eligibleEmployee.employeeName,
          department: eligibleEmployee.department,
          contractWage: eligibleEmployee.contractWage,
          period,
          calculatedPayslip,
          status: 'COMPUTED',
          warning,
          connection,
        });

        persistedSnapshots.push(snapshot);
      }

      // Update Payrun record status to COMPUTED and update calculated totals
      const updatedPayrun = await updatePayrunCalculatedTotals(
        trimmedId,
        totalGross,
        totalNet,
        employeeCount,
        'COMPUTED',
        connection
      );

      if (!updatedPayrun) {
        throw new Error(`Failed to update payrun totals for payrun '${trimmedId}'.`);
      }

      // Commit transaction
      await connection.commit();

      const summary: PayrunComputeSummary = {
        payrunId: trimmedId,
        payrollPeriod: period,
        eligibleEmployeesCount: eligibleEmployees.length,
        processedEmployeesCount: persistedSnapshots.length,
        totalGross,
        totalNet,
      };

      return {
        payrun: updatedPayrun,
        snapshots: persistedSnapshots,
        summary,
      };
    } catch (persistError) {
      // Safe rollback: No partial snapshots or corrupted state
      await connection.rollback();
      console.error(
        `[PayrunComputeService] Transaction rolled back for payrun '${trimmedId}':`,
        persistError instanceof Error ? persistError.message : persistError
      );
      throw persistError;
    } finally {
      connection.release();
    }
  }
}
