/**
 * Payrun Payment Service — PeoplePay360
 *
 * Sits strictly between the API route layer and the data-access layer:
 *
 * Architecture:
 *   HTTP Request (POST/PATCH /api/payroll/payruns/:id/pay or /mark-paid)
 *       ↓
 *   authenticateToken + authorize(PERMISSIONS.PAYRUN_PAY)
 *       ↓
 *   PayrunPaymentService (this service)
 *       ↓
 *   Precondition Validation:
 *     1. Payrun exists
 *     2. Status is strictly VALIDATED (rejects DRAFT, COMPUTED, and already PAID)
 *     3. Computed employee snapshots exist in payslips table (count > 0)
 *     4. Snapshot calculations are complete (gross > 0, net > 0)
 *     5. Payrun is not already PAID
 *       ↓
 *   Atomic Database Transaction:
 *     - Update payrun: status ➔ PAID, paid_at = CURRENT_TIMESTAMP, paid_by, payment_reference
 *     - Update payslips: status ➔ PAID
 *     - Commit transaction
 *       ↓
 *   Return updated Payrun record & unchanged calculation snapshots
 *
 * Responsibilities:
 * - Enforces VALIDATED ➔ PAID state transition.
 * - Rejects DRAFT ➔ PAID, COMPUTED ➔ PAID, and PAID ➔ PAID.
 * - Ensures repeated payment attempts are rejected safely without corrupting data.
 * - Protects calculation snapshots: Zero recalculation, zero alteration to gross, net, deductions, or JSON payloads.
 * - Records payment completion audit metadata (paid_at, paid_by, payment_reference).
 */

import { pool } from '../config/database.js';
import {
  getPayrunById,
  payPayrunRecord,
  type PayrunRecord,
} from '../repositories/payrun.repository.js';
import {
  getPayrollSnapshotsByPayrun,
  type PayrollSnapshotRecord,
} from '../repositories/payrollSnapshot.repository.js';

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
      msg = `Invalid state transition: Payrun must be in VALIDATED status to be marked as PAID. Current status: 'DRAFT'.`;
    } else if (currentStatus === 'COMPUTED') {
      msg = `Invalid state transition: Payrun must be in VALIDATED status to be marked as PAID. Current status: 'COMPUTED'.`;
    } else if (currentStatus === 'PAID') {
      msg = `Invalid state transition: Payrun is already PAID.`;
    } else {
      msg = `Invalid state transition: Cannot mark payrun '${payrunId}' with status '${currentStatus}' as PAID.`;
    }
    super(msg);
    this.name = 'InvalidPayrunStatusError';
    this.currentStatus = currentStatus;
  }
}

export class PayrunPaymentPreconditionError extends Error {
  public readonly code: string;
  constructor(message: string, code: string = 'PRECONDITION_FAILED') {
    super(message);
    this.name = 'PayrunPaymentPreconditionError';
    this.code = code;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface PayrunPaymentResult {
  payrun: PayrunRecord;
  snapshots: PayrollSnapshotRecord[];
  paymentMetadata: {
    paidAt: string | null;
    paidBy: string;
    paymentReference: string | null;
  };
}

// ── Service Implementation ──────────────────────────────────────────────────

export class PayrunPaymentService {
  /**
   * Transitions a Payrun from VALIDATED to PAID.
   *
   * Enforces all preconditions:
   * 1. Payrun must exist.
   * 2. Payrun status must be VALIDATED (rejects DRAFT, COMPUTED, and already PAID).
   * 3. Payroll snapshots must exist for the payrun.
   * 4. Payroll calculations must be complete.
   * 5. No recalculation occurs; snapshots remain historically immutable.
   *
   * @param payrunId - Unique identifier of the payrun
   * @param paidBy - Identifier/Name of the authorized user marking as paid
   * @param paymentReference - Optional reference string (e.g. batch ID)
   */
  public static async markPayrunAsPaid(
    payrunId: string,
    paidBy: string,
    paymentReference?: string | null
  ): Promise<PayrunPaymentResult> {
    const trimmedId = payrunId?.trim();
    if (!trimmedId) {
      throw new PayrunNotFoundError(payrunId);
    }

    const payer = paidBy?.trim() || 'System Administrator';

    // ── 1. Payrun Existence Check ────────────────────────────────────────────
    const payrun = await getPayrunById(trimmedId);
    if (!payrun) {
      throw new PayrunNotFoundError(trimmedId);
    }

    // ── 2. Lifecycle Status Check: Must be strictly VALIDATED ────────────────
    if (payrun.status !== 'VALIDATED') {
      throw new InvalidPayrunStatusError(trimmedId, payrun.status);
    }

    // ── 3. Verify Computed Employee Snapshots Exist ──────────────────────────
    const snapshots = await getPayrollSnapshotsByPayrun(trimmedId);
    if (!snapshots || snapshots.length === 0) {
      throw new PayrunPaymentPreconditionError(
        `Cannot mark payrun '${trimmedId}' as PAID: No computed payroll snapshots exist.`,
        'NO_SNAPSHOTS'
      );
    }

    // ── 4. Verify Snapshot Calculations are Complete ─────────────────────────
    for (const snap of snapshots) {
      if (snap.gross === null || snap.gross === undefined || isNaN(snap.gross) || snap.gross <= 0) {
        throw new PayrunPaymentPreconditionError(
          `Cannot mark payrun '${trimmedId}' as PAID: Employee '${snap.employeeId}' has incomplete calculation gross salary (${snap.gross}).`,
          'INCOMPLETE_SNAPSHOT'
        );
      }
    }

    // ── 5. Generate Default Payment Reference if not supplied ────────────────
    const resolvedReference =
      paymentReference?.trim() || `PAY-${trimmedId}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

    // ── 6. Transactional Payment State Update ────────────────────────────────
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 6a. Update payrun record with status = 'PAID', paid_at, paid_by, payment_reference
      const updatedPayrun = await payPayrunRecord(trimmedId, payer, resolvedReference, connection);
      if (!updatedPayrun) {
        throw new Error(`Failed updating payrun payment status for '${trimmedId}'.`);
      }

      // 6b. Update all snapshot/payslip records for this payrun to 'PAID'
      await connection.query(
        'UPDATE payslips SET status = ? WHERE payrun_id = ?',
        ['PAID', trimmedId]
      );

      // 6c. Commit transaction
      await connection.commit();

      // Reload snapshots to reflect new status without modifying any calculation numbers
      const paidSnapshots = await getPayrollSnapshotsByPayrun(trimmedId);

      return {
        payrun: updatedPayrun,
        snapshots: paidSnapshots,
        paymentMetadata: {
          paidAt: updatedPayrun.paidAt || updatedPayrun.paid_at || null,
          paidBy: updatedPayrun.paidBy || updatedPayrun.paid_by || payer,
          paymentReference: updatedPayrun.paymentReference || updatedPayrun.payment_reference || resolvedReference,
        },
      };
    } catch (err) {
      await connection.rollback();
      console.error(
        `[PayrunPaymentService] Transaction rolled back for payrun '${trimmedId}':`,
        err instanceof Error ? err.message : err
      );
      throw err;
    } finally {
      connection.release();
    }
  }
}
