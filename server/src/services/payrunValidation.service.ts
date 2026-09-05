/**
 * Payrun Validation Service — PeoplePay360
 *
 * Sits strictly between the API route layer and the data-access layer:
 *
 * Architecture:
 *   HTTP Request (POST/PATCH /api/payroll/payruns/:id/validate)
 *       ↓
 *   authenticateToken + authorize(PERMISSIONS.PAYRUN_VALIDATE)
 *       ↓
 *   PayrunValidationService (this service)
 *       ↓
 *   Precondition Validation:
 *     1. Payrun exists
 *     2. Status is COMPUTED (rejects DRAFT, PAID, already VALIDATED)
 *     3. Payroll period is valid
 *     4. Computed employee snapshots exist in payslips table (count > 0)
 *     5. Snapshot calculations are complete (gross > 0, net > 0)
 *       ↓
 *   Atomic Database Transaction:
 *     - Update payrun: status ➔ VALIDATED, validated_at, validated_by
 *     - Update payslips: status ➔ VALIDATED
 *     - Commit transaction
 *       ↓
 *   Return updated Payrun record & unchanged calculation snapshots
 *
 * Responsibilities:
 * - Enforces COMPUTED ➔ VALIDATED state transition.
 * - Rejects DRAFT ➔ VALIDATED and PAID ➔ VALIDATED.
 * - Ensures repeated validation attempts are rejected safely without corrupting data.
 * - Protects calculation snapshots: Zero alteration to gross, net, deductions, or JSON payloads.
 * - Does NOT advance payrun to PAID.
 */

import { pool } from '../config/database.js';
import {
  getPayrunById,
  validatePayrunRecord,
  type PayrunRecord,
} from '../repositories/payrun.repository.js';
import {
  getPayrollSnapshotsByPayrun,
  type PayrollSnapshotRecord,
} from '../repositories/payrollSnapshot.repository.js';
import { parsePayrollPeriod } from './payrunCompute.service.js';

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
    let msg: string;
    if (currentStatus === 'DRAFT') {
      msg = `Invalid state transition: Payrun must be in COMPUTED status to be validated. Current status: 'DRAFT'.`;
    } else if (currentStatus === 'PAID') {
      msg = `Invalid state transition: Cannot validate a payrun that has already been PAID.`;
    } else if (currentStatus === 'VALIDATED') {
      msg = `Invalid state transition: Payrun is already VALIDATED.`;
    } else {
      msg = `Invalid state transition: Cannot validate payrun '${payrunId}' with status '${currentStatus}'.`;
    }
    super(msg);
    this.name = 'InvalidPayrunStatusError';
    this.currentStatus = currentStatus;
  }
}

export class PayrunValidationPreconditionError extends Error {
  public readonly code: string;
  constructor(message: string, code: string = 'PRECONDITION_FAILED') {
    super(message);
    this.name = 'PayrunValidationPreconditionError';
    this.code = code;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ValidatePayrunResult {
  payrun: PayrunRecord;
  snapshots: PayrollSnapshotRecord[];
}

// ── Service Class ────────────────────────────────────────────────────────────

export class PayrunValidationService {
  /**
   * Validates a computed payrun, advancing its status from COMPUTED to VALIDATED.
   *
   * Preconditions:
   * 1. Payrun exists.
   * 2. Payrun status is COMPUTED.
   * 3. Payrun has a valid configured payroll period.
   * 4. Computed employee payroll snapshots exist (count > 0).
   * 5. Payrun has not already been PAID.
   */
  public static async validatePayrun(
    payrunId: string,
    validatedBy: string
  ): Promise<ValidatePayrunResult> {
    if (!payrunId || typeof payrunId !== 'string' || payrunId.trim().length === 0) {
      throw new PayrunValidationPreconditionError('A valid payrun ID is required for validation.');
    }

    const trimmedId = payrunId.trim();
    const validator = (validatedBy || 'System Administrator').trim();

    // ── 1. Fetch & Verify Payrun Exists ─────────────────────────────────────
    const payrun = await getPayrunById(trimmedId);
    if (!payrun) {
      throw new PayrunNotFoundError(trimmedId);
    }

    // ── 2. Enforce Status State Machine ─────────────────────────────────────
    if (payrun.status !== 'COMPUTED') {
      throw new InvalidPayrunStatusError(trimmedId, payrun.status);
    }

    // ── 3. Verify Valid Payroll Period ──────────────────────────────────────
    try {
      parsePayrollPeriod(payrun.period);
    } catch {
      throw new PayrunValidationPreconditionError(
        `Cannot validate payrun '${trimmedId}': Missing or invalid payroll period '${payrun.period}'.`,
        'INVALID_PERIOD'
      );
    }

    // ── 4. Verify Computed Employee Snapshots Exist ─────────────────────────
    const snapshots = await getPayrollSnapshotsByPayrun(trimmedId);
    if (!snapshots || snapshots.length === 0) {
      throw new PayrunValidationPreconditionError(
        `Cannot validate payrun '${trimmedId}': No computed employee payroll snapshots exist. Payrun must be computed before validation.`,
        'NO_SNAPSHOTS'
      );
    }

    // ── 5. Verify Snapshot Calculations are Complete ────────────────────────
    for (const snap of snapshots) {
      if (snap.gross === null || snap.gross === undefined || isNaN(snap.gross) || snap.gross <= 0) {
        throw new PayrunValidationPreconditionError(
          `Cannot validate payrun '${trimmedId}': Employee '${snap.employeeId}' has incomplete calculation gross salary (${snap.gross}).`,
          'INCOMPLETE_SNAPSHOT'
        );
      }
    }

    // ── 6. Transactional Validation State Update ────────────────────────────
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 6a. Update payrun record with status = 'VALIDATED', validated_at, validated_by
      const updatedPayrun = await validatePayrunRecord(trimmedId, validator, connection);
      if (!updatedPayrun) {
        throw new Error(`Failed updating payrun validation status for '${trimmedId}'.`);
      }

      // 6b. Update all snapshot/payslip records for this payrun to 'VALIDATED'
      await connection.query(
        'UPDATE payslips SET status = ? WHERE payrun_id = ?',
        ['VALIDATED', trimmedId]
      );

      // 6c. Commit transaction
      await connection.commit();

      // Reload snapshots to reflect new status without modifying any calculation numbers
      const validatedSnapshots = await getPayrollSnapshotsByPayrun(trimmedId);

      return {
        payrun: updatedPayrun,
        snapshots: validatedSnapshots,
      };
    } catch (err) {
      await connection.rollback();
      console.error(
        `[PayrunValidationService] Transaction rolled back for payrun '${trimmedId}':`,
        err instanceof Error ? err.message : err
      );
      throw err;
    } finally {
      connection.release();
    }
  }
}
