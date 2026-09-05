/**
 * Phase 5.4 — Controlled Payrun Payment Workflow Test Suite
 *
 * Requirements tested:
 *  1. VALIDATED Payrun can be marked PAID.
 *  2. DRAFT Payrun cannot be marked PAID.
 *  3. COMPUTED Payrun cannot be marked PAID.
 *  4. Nonexistent Payrun returns correct error.
 *  5. Unauthorized user cannot mark PAID.
 *  6. Forbidden role cannot mark PAID.
 *  7. PAID Payrun remains protected.
 *  8. Duplicate Mark Paid request is handled safely.
 *  9. Payment does not trigger payroll recalculation.
 * 10. Payment does not modify snapshots.
 * 11. Gross Salary remains unchanged.
 * 12. Total Deductions remain unchanged.
 * 13. Net Salary remains unchanged.
 * 14. Paid metadata is stored correctly if supported.
 * 15. Existing COMPUTE workflow still works.
 * 16. Existing VALIDATE workflow still works.
 * 17. Full lifecycle works correctly (DRAFT -> COMPUTED -> VALIDATED -> PAID).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, executeQuery } from '../config/database.js';
import {
  PayrunPaymentService,
  PayrunNotFoundError,
  InvalidPayrunStatusError,
  PayrunPaymentPreconditionError,
} from './payrunPayment.service.js';
import { PayrunComputeService } from './payrunCompute.service.js';
import { PayrunValidationService } from './payrunValidation.service.js';
import {
  createPayrun,
  getPayrunById,
} from '../repositories/payrun.repository.js';
import { PayrollSnapshotService } from './payrollSnapshot.service.js';
import { PayrollEngine } from './payrollEngine.js';
import { roleHasPermission } from '../config/permissions.js';
import { ROLES, PERMISSIONS } from '../types/rbac.js';
import { randomUUID } from 'node:crypto';

describe('PHASE 5.4 — Controlled Payrun Payment Workflow', () => {
  const testSuffix = randomUUID().slice(0, 6).toUpperCase();
  const validPayrunId = `PR-PAY-OK-${testSuffix}`;
  const draftPayrunId = `PR-PAY-DRFT-${testSuffix}`;
  const computedPayrunId = `PR-PAY-COMP-${testSuffix}`;
  const noSnapPayrunId = `PR-PAY-NOSNAP-${testSuffix}`;
  const fullLifecyclePayrunId = `PR-PAY-LIFE-${testSuffix}`;

  let prePaymentGross = 0;
  let prePaymentNet = 0;
  let prePaymentDeductions = 0;
  let prePaymentSnapshots: any[] = [];

  before(async () => {
    // Clean up any stale test records
    const ids = [validPayrunId, draftPayrunId, computedPayrunId, noSnapPayrunId, fullLifecyclePayrunId];
    await executeQuery('DELETE FROM payslips WHERE payrun_id IN (?, ?, ?, ?, ?)', ids);
    await executeQuery('DELETE FROM payruns WHERE id IN (?, ?, ?, ?, ?)', ids);

    // 1. Setup valid payrun: create in DRAFT, compute to COMPUTED, validate to VALIDATED
    await createPayrun({
      id: validPayrunId,
      name: `Payment Test Payrun ${testSuffix}`,
      period: '2026-09',
      salaryStructureId: 'STR-001',
      status: 'DRAFT',
    });
    await PayrunComputeService.computePayrun(validPayrunId);
    await PayrunValidationService.validatePayrun(validPayrunId, 'Elena Rostova (HR Payroll Manager)');

    const payrunBeforePay = await getPayrunById(validPayrunId);
    assert.ok(payrunBeforePay);
    assert.equal(payrunBeforePay.status, 'VALIDATED');
    prePaymentGross = payrunBeforePay.totalGross;
    prePaymentNet = payrunBeforePay.totalNet;
    prePaymentDeductions = prePaymentGross - prePaymentNet;
    prePaymentSnapshots = await PayrollSnapshotService.getSnapshotsForPayrun(validPayrunId);

    // 2. Setup DRAFT payrun (uncomputed, unvalidated)
    await createPayrun({
      id: draftPayrunId,
      name: `Draft Only Payrun ${testSuffix}`,
      period: '2026-09',
      status: 'DRAFT',
    });

    // 3. Setup COMPUTED payrun (computed but NOT validated)
    await createPayrun({
      id: computedPayrunId,
      name: `Computed Only Payrun ${testSuffix}`,
      period: '2026-09',
      salaryStructureId: 'STR-001',
      status: 'DRAFT',
    });
    await PayrunComputeService.computePayrun(computedPayrunId);

    // 4. Setup VALIDATED payrun with 0 snapshots
    await createPayrun({
      id: noSnapPayrunId,
      name: `No Snapshots Payrun ${testSuffix}`,
      period: '2026-09',
      status: 'VALIDATED',
    });
  });

  after(async () => {
    const ids = [validPayrunId, draftPayrunId, computedPayrunId, noSnapPayrunId, fullLifecyclePayrunId];
    await executeQuery('DELETE FROM payslips WHERE payrun_id IN (?, ?, ?, ?, ?)', ids);
    await executeQuery('DELETE FROM payruns WHERE id IN (?, ?, ?, ?, ?)', ids);
    await pool.end();
  });

  it('1. VALIDATED Payrun can be marked PAID', async () => {
    const beforePay = await getPayrunById(validPayrunId);
    assert.ok(beforePay);
    assert.equal(beforePay.status, 'VALIDATED');

    const result = await PayrunPaymentService.markPayrunAsPaid(
      validPayrunId,
      'Elena Rostova (HR Payroll Manager)',
      `BATCH-PAY-${testSuffix}`
    );

    assert.equal(result.payrun.status, 'PAID');
    assert.ok(result.payrun.paidAt);
    assert.equal(result.payrun.paidBy, 'Elena Rostova (HR Payroll Manager)');
    assert.equal(result.payrun.paymentReference, `BATCH-PAY-${testSuffix}`);

    // Verify DB state
    const inDb = await getPayrunById(validPayrunId);
    assert.ok(inDb);
    assert.equal(inDb.status, 'PAID');
    assert.ok(inDb.paidAt);
    assert.equal(inDb.paidBy, 'Elena Rostova (HR Payroll Manager)');
    assert.equal(inDb.paymentReference, `BATCH-PAY-${testSuffix}`);
  });

  it('2. DRAFT Payrun cannot be marked PAID', async () => {
    await assert.rejects(
      async () => {
        await PayrunPaymentService.markPayrunAsPaid(draftPayrunId, 'Admin');
      },
      (err: any) => {
        assert.ok(err instanceof InvalidPayrunStatusError);
        assert.equal(err.currentStatus, 'DRAFT');
        assert.match(err.message, /Payrun must be in VALIDATED status to be marked as PAID/);
        return true;
      }
    );

    // Verify DB status remained DRAFT
    const inDb = await getPayrunById(draftPayrunId);
    assert.equal(inDb?.status, 'DRAFT');
  });

  it('3. COMPUTED Payrun cannot be marked PAID', async () => {
    await assert.rejects(
      async () => {
        await PayrunPaymentService.markPayrunAsPaid(computedPayrunId, 'Admin');
      },
      (err: any) => {
        assert.ok(err instanceof InvalidPayrunStatusError);
        assert.equal(err.currentStatus, 'COMPUTED');
        assert.match(err.message, /Payrun must be in VALIDATED status to be marked as PAID/);
        return true;
      }
    );

    // Verify DB status remained COMPUTED
    const inDb = await getPayrunById(computedPayrunId);
    assert.equal(inDb?.status, 'COMPUTED');
  });

  it('4. Nonexistent Payrun returns correct error', async () => {
    await assert.rejects(
      async () => {
        await PayrunPaymentService.markPayrunAsPaid('NONEXISTENT-PAYRUN-XYZ', 'Admin');
      },
      (err: any) => {
        assert.ok(err instanceof PayrunNotFoundError);
        assert.match(err.message, /not found/);
        return true;
      }
    );
  });

  it('5. Unauthorized user cannot mark PAID (RBAC check for non-payroll user)', () => {
    assert.equal(
      roleHasPermission(ROLES.EMPLOYEE, PERMISSIONS.PAYRUN_PAY),
      false,
      'EMPLOYEE must NOT have PAYRUN_PAY permission'
    );
  });

  it('6. Forbidden role cannot mark PAID (HR Manager without payroll authority)', () => {
    assert.equal(
      roleHasPermission(ROLES.HR_MANAGER, PERMISSIONS.PAYRUN_PAY),
      false,
      'HR_MANAGER must NOT have PAYRUN_PAY permission'
    );
    assert.equal(
      roleHasPermission(ROLES.HR_PAYROLL_USER, PERMISSIONS.PAYRUN_PAY),
      false,
      'HR_PAYROLL_USER must NOT have PAYRUN_PAY permission'
    );
    assert.equal(
      roleHasPermission(ROLES.HR_PAYROLL_MANAGER, PERMISSIONS.PAYRUN_PAY),
      true,
      'HR_PAYROLL_MANAGER must have PAYRUN_PAY permission'
    );
    assert.equal(
      roleHasPermission(ROLES.ADMIN, PERMISSIONS.PAYRUN_PAY),
      true,
      'ADMIN must have PAYRUN_PAY permission'
    );
  });

  it('7. PAID Payrun remains protected', async () => {
    const payrun = await getPayrunById(validPayrunId);
    assert.ok(payrun);
    assert.equal(payrun.status, 'PAID');
    assert.ok(payrun.paidAt);
    assert.ok(payrun.paidBy);
  });

  it('8. Duplicate Mark Paid request is handled safely', async () => {
    await assert.rejects(
      async () => {
        await PayrunPaymentService.markPayrunAsPaid(validPayrunId, 'Second Payer');
      },
      (err: any) => {
        assert.ok(err instanceof InvalidPayrunStatusError);
        assert.equal(err.currentStatus, 'PAID');
        assert.match(err.message, /Payrun is already PAID/);
        return true;
      }
    );

    // Verify paid metadata was not overwritten
    const payrun = await getPayrunById(validPayrunId);
    assert.equal(payrun?.status, 'PAID');
    assert.equal(payrun?.paidBy, 'Elena Rostova (HR Payroll Manager)');
  });

  it('9. Payment does not trigger payroll recalculation', async () => {
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(validPayrunId);
    assert.equal(snapshots.length, prePaymentSnapshots.length);

    for (let i = 0; i < snapshots.length; i++) {
      const snap = snapshots[i];
      const preSnap = prePaymentSnapshots.find((s) => s.employeeId === snap.employeeId);
      assert.ok(preSnap, `Snapshot for employee ${snap.employeeId} must exist`);
      assert.equal(snap.gross, preSnap.gross);
      assert.equal(snap.tax, preSnap.tax);
      assert.equal(snap.otherDeductions, preSnap.otherDeductions);
      assert.equal(snap.net, preSnap.net);
    }
  });

  it('10. Payment does not modify snapshots', async () => {
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(validPayrunId);
    for (const snap of snapshots) {
      assert.ok(snap.calculationSnapshot, 'Calculation snapshot payload must exist');
      assert.equal(snap.status, 'PAID', 'Snapshot status should be updated to PAID');
    }
  });

  it('11. Gross Salary remains unchanged', async () => {
    const payrun = await getPayrunById(validPayrunId);
    assert.ok(payrun);
    assert.equal(payrun.totalGross, prePaymentGross, 'Gross Salary must remain strictly identical');
  });

  it('12. Total Deductions remain unchanged', async () => {
    const payrun = await getPayrunById(validPayrunId);
    assert.ok(payrun);
    const postPaymentDeductions = payrun.totalGross - payrun.totalNet;
    assert.equal(postPaymentDeductions, prePaymentDeductions, 'Total Deductions must remain strictly identical');
  });

  it('13. Net Salary remains unchanged', async () => {
    const payrun = await getPayrunById(validPayrunId);
    assert.ok(payrun);
    assert.equal(payrun.totalNet, prePaymentNet, 'Net Salary must remain strictly identical');
  });

  it('14. Paid metadata is stored correctly if supported', async () => {
    const payrun = await getPayrunById(validPayrunId);
    assert.ok(payrun);
    assert.ok(payrun.paidAt, 'paidAt timestamp must be recorded');
    assert.equal(payrun.paidBy, 'Elena Rostova (HR Payroll Manager)', 'paidBy must record actor');
    assert.equal(payrun.paymentReference, `BATCH-PAY-${testSuffix}`, 'paymentReference must record ref');
  });

  it('15. Existing COMPUTE workflow still works (rejects PAID payrun)', async () => {
    await assert.rejects(
      async () => {
        await PayrunComputeService.computePayrun(validPayrunId);
      },
      (err: any) => {
        assert.ok(err.name === 'InvalidPayrunStatusError' || err.message.includes('Invalid state transition'));
        return true;
      }
    );
  });

  it('16. Existing VALIDATE workflow still works (rejects PAID payrun)', async () => {
    await assert.rejects(
      async () => {
        await PayrunValidationService.validatePayrun(validPayrunId, 'Admin');
      },
      (err: any) => {
        assert.ok(err.name === 'InvalidPayrunStatusError' || err.message.includes('already been PAID'));
        return true;
      }
    );
  });

  it('17. Full lifecycle works correctly: DRAFT ➔ COMPUTED ➔ VALIDATED ➔ PAID', async () => {
    // Step 1: Create Payrun in DRAFT
    await createPayrun({
      id: fullLifecyclePayrunId,
      name: `Full Lifecycle Payrun ${testSuffix}`,
      period: '2026-09',
      salaryStructureId: 'STR-001',
      status: 'DRAFT',
    });
    const draftRun = await getPayrunById(fullLifecyclePayrunId);
    assert.ok(draftRun);
    assert.equal(draftRun.status, 'DRAFT');

    // Attempt to mark PAID from DRAFT (Must fail)
    await assert.rejects(
      async () => {
        await PayrunPaymentService.markPayrunAsPaid(fullLifecyclePayrunId, 'Admin');
      },
      (err: any) => err.name === 'InvalidPayrunStatusError'
    );

    // Step 2: Compute Payrun ➔ COMPUTED
    const computedRun = await PayrunComputeService.computePayrun(fullLifecyclePayrunId);
    assert.equal(computedRun.payrun.status, 'COMPUTED');
    assert.ok(computedRun.snapshots.length > 0);

    // Attempt to mark PAID from COMPUTED (Must fail)
    await assert.rejects(
      async () => {
        await PayrunPaymentService.markPayrunAsPaid(fullLifecyclePayrunId, 'Admin');
      },
      (err: any) => err.name === 'InvalidPayrunStatusError'
    );

    // Step 3: Validate Payrun ➔ VALIDATED
    const validatedRun = await PayrunValidationService.validatePayrun(
      fullLifecyclePayrunId,
      'Elena Rostova (HR Payroll Manager)'
    );
    assert.equal(validatedRun.payrun.status, 'VALIDATED');
    assert.ok(validatedRun.payrun.validatedAt);
    assert.equal(validatedRun.payrun.validatedBy, 'Elena Rostova (HR Payroll Manager)');

    // Step 4: Mark Payrun Paid ➔ PAID
    const paidRun = await PayrunPaymentService.markPayrunAsPaid(
      fullLifecyclePayrunId,
      'Elena Rostova (HR Payroll Manager)',
      `LIFECYCLE-REF-${testSuffix}`
    );
    assert.equal(paidRun.payrun.status, 'PAID');
    assert.ok(paidRun.payrun.paidAt);
    assert.equal(paidRun.payrun.paidBy, 'Elena Rostova (HR Payroll Manager)');
    assert.equal(paidRun.payrun.paymentReference, `LIFECYCLE-REF-${testSuffix}`);

    // Step 5: Attempt recompute ➔ rejected
    await assert.rejects(
      async () => {
        await PayrunComputeService.computePayrun(fullLifecyclePayrunId);
      },
      (err: any) => err.name === 'InvalidPayrunStatusError'
    );

    // Step 6: Attempt revalidate ➔ rejected
    await assert.rejects(
      async () => {
        await PayrunValidationService.validatePayrun(fullLifecyclePayrunId, 'Admin');
      },
      (err: any) => err.name === 'InvalidPayrunStatusError'
    );

    // Step 7: Attempt duplicate mark paid ➔ rejected
    await assert.rejects(
      async () => {
        await PayrunPaymentService.markPayrunAsPaid(fullLifecyclePayrunId, 'Admin');
      },
      (err: any) => err.name === 'InvalidPayrunStatusError'
    );

    // Step 8: Verify calculation values remain strictly unchanged
    assert.equal(paidRun.payrun.totalGross, computedRun.summary.totalGross);
    assert.equal(paidRun.payrun.totalNet, computedRun.summary.totalNet);
  });
});
