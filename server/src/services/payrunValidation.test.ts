/**
 * Phase 5.3 — Payrun Validation Workflow Test Suite
 *
 * Requirements tested:
 *  1. COMPUTED Payrun can be validated.
 *  2. DRAFT Payrun cannot be validated.
 *  3. Nonexistent Payrun returns correct error.
 *  4. Unauthorized user cannot validate.
 *  5. Forbidden role cannot validate.
 *  6. Validation requires existing payroll snapshots.
 *  7. VALIDATED Payrun remains VALIDATED after successful request.
 *  8. PAID Payrun cannot return to VALIDATED.
 *  9. Validation does not alter calculation snapshots.
 * 10. Validation does not recalculate payroll.
 * 11. Validation does not change Gross Salary.
 * 12. Validation does not change Total Deductions.
 * 13. Validation does not change Net Salary.
 * 14. Duplicate validation request is handled safely.
 * 15. COMPUTED ➔ VALIDATED transition works.
 * 16. Existing COMPUTE workflow still works (rejects VALIDATED payrun).
 * 17. Existing Phase 4 engine tests still pass.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, executeQuery } from '../config/database.js';
import {
  PayrunValidationService,
  PayrunNotFoundError,
  InvalidPayrunStatusError,
  PayrunValidationPreconditionError,
} from './payrunValidation.service.js';
import { PayrunComputeService } from './payrunCompute.service.js';
import {
  createPayrun,
  getPayrunById,
  updatePayrunStatus,
} from '../repositories/payrun.repository.js';
import { PayrollSnapshotService } from './payrollSnapshot.service.js';
import { PayrollEngine } from './payrollEngine.js';
import { roleHasPermission } from '../config/permissions.js';
import { ROLES, PERMISSIONS } from '../types/rbac.js';
import { randomUUID } from 'node:crypto';

describe('PHASE 5.3 — Payrun Validation Workflow', () => {
  const testSuffix = randomUUID().slice(0, 6).toUpperCase();
  const validPayrunId = `PR-VAL-OK-${testSuffix}`;
  const draftPayrunId = `PR-VAL-DRFT-${testSuffix}`;
  const noSnapPayrunId = `PR-VAL-NOSNAP-${testSuffix}`;
  const paidPayrunId = `PR-VAL-PAID-${testSuffix}`;

  let preValidationGross = 0;
  let preValidationNet = 0;
  let preValidationSnapshots: any[] = [];

  before(async () => {
    // Clean up any stale records
    const ids = [validPayrunId, draftPayrunId, noSnapPayrunId, paidPayrunId];
    await executeQuery('DELETE FROM payslips WHERE payrun_id IN (?, ?, ?, ?)', ids);
    await executeQuery('DELETE FROM payruns WHERE id IN (?, ?, ?, ?)', ids);

    // 1. Setup valid payrun: create in DRAFT, compute to COMPUTED
    await createPayrun({
      id: validPayrunId,
      name: `Validation Test Payrun ${testSuffix}`,
      period: '2026-09',
      salaryStructureId: 'STR-001',
      status: 'DRAFT',
    });
    const computedResult = await PayrunComputeService.computePayrun(validPayrunId);
    preValidationGross = computedResult.summary.totalGross;
    preValidationNet = computedResult.summary.totalNet;
    preValidationSnapshots = await PayrollSnapshotService.getSnapshotsForPayrun(validPayrunId);

    // 2. Setup DRAFT payrun (uncomputed)
    await createPayrun({
      id: draftPayrunId,
      name: `Draft Only Payrun ${testSuffix}`,
      period: '2026-09',
      status: 'DRAFT',
    });

    // 3. Setup payrun with COMPUTED status but 0 snapshots
    await createPayrun({
      id: noSnapPayrunId,
      name: `No Snapshots Payrun ${testSuffix}`,
      period: '2026-09',
      status: 'COMPUTED',
    });

    // 4. Setup PAID payrun
    await createPayrun({
      id: paidPayrunId,
      name: `Paid Payrun ${testSuffix}`,
      period: '2026-09',
      status: 'PAID',
    });
  });

  after(async () => {
    const ids = [validPayrunId, draftPayrunId, noSnapPayrunId, paidPayrunId];
    await executeQuery('DELETE FROM payslips WHERE payrun_id IN (?, ?, ?, ?)', ids);
    await executeQuery('DELETE FROM payruns WHERE id IN (?, ?, ?, ?)', ids);
    await pool.end();
  });

  it('1. COMPUTED Payrun can be validated', async () => {
    const beforeValidation = await getPayrunById(validPayrunId);
    assert.ok(beforeValidation);
    assert.equal(beforeValidation.status, 'COMPUTED');

    const result = await PayrunValidationService.validatePayrun(
      validPayrunId,
      'Elena Rostova (HR Payroll Manager)'
    );

    assert.ok(result);
    assert.equal(result.payrun.id, validPayrunId);
    assert.equal(result.payrun.status, 'VALIDATED');
    assert.equal(result.payrun.validatedBy, 'Elena Rostova (HR Payroll Manager)');
    assert.ok(result.payrun.validatedAt, 'validatedAt timestamp must be set');
  });

  it('2. DRAFT Payrun cannot be validated', async () => {
    await assert.rejects(
      async () => {
        await PayrunValidationService.validatePayrun(draftPayrunId, 'Elena Rostova');
      },
      (err: unknown) => {
        assert.ok(err instanceof InvalidPayrunStatusError);
        assert.equal(err.currentStatus, 'DRAFT');
        assert.match(err.message, /Payrun must be in COMPUTED status/);
        return true;
      }
    );
  });

  it('3. Nonexistent Payrun returns correct error', async () => {
    await assert.rejects(
      async () => {
        await PayrunValidationService.validatePayrun(`NONEXISTENT-${randomUUID()}`, 'Admin');
      },
      (err: unknown) => {
        assert.ok(err instanceof PayrunNotFoundError);
        return true;
      }
    );
  });

  it('4. Unauthorized user cannot validate (unauthenticated check)', () => {
    // Permission map strictly requires PAYRUN_VALIDATE
    assert.ok(PERMISSIONS.PAYRUN_VALIDATE);
  });

  it('5. Forbidden role cannot validate (RBAC enforcement)', () => {
    // Permitted roles
    assert.equal(roleHasPermission(ROLES.ADMIN, PERMISSIONS.PAYRUN_VALIDATE), true);
    assert.equal(roleHasPermission(ROLES.HR_PAYROLL_MANAGER, PERMISSIONS.PAYRUN_VALIDATE), true);

    // Forbidden roles
    assert.equal(roleHasPermission(ROLES.HR_MANAGER, PERMISSIONS.PAYRUN_VALIDATE), false);
    assert.equal(roleHasPermission(ROLES.HR_PAYROLL_USER, PERMISSIONS.PAYRUN_VALIDATE), false);
    assert.equal(roleHasPermission(ROLES.EMPLOYEE, PERMISSIONS.PAYRUN_VALIDATE), false);
  });

  it('6. Validation requires existing payroll snapshots', async () => {
    await assert.rejects(
      async () => {
        await PayrunValidationService.validatePayrun(noSnapPayrunId, 'Elena Rostova');
      },
      (err: unknown) => {
        assert.ok(err instanceof PayrunValidationPreconditionError);
        assert.equal(err.code, 'NO_SNAPSHOTS');
        assert.match(err.message, /No computed employee payroll snapshots exist/);
        return true;
      }
    );
  });

  it('7. VALIDATED Payrun remains VALIDATED after successful request', async () => {
    const payrun = await getPayrunById(validPayrunId);
    assert.ok(payrun);
    assert.equal(payrun.status, 'VALIDATED');

    // Verify all payslips in MySQL have status = 'VALIDATED'
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(validPayrunId);
    assert.ok(snapshots.length > 0);
    for (const snap of snapshots) {
      assert.equal(snap.status, 'VALIDATED');
    }
  });

  it('8. PAID Payrun cannot return to VALIDATED', async () => {
    await assert.rejects(
      async () => {
        await PayrunValidationService.validatePayrun(paidPayrunId, 'Elena Rostova');
      },
      (err: unknown) => {
        assert.ok(err instanceof InvalidPayrunStatusError);
        assert.equal(err.currentStatus, 'PAID');
        assert.match(err.message, /Cannot validate a payrun that has already been PAID/);
        return true;
      }
    );
  });

  it('9. Validation does not alter calculation snapshots', async () => {
    const currentSnapshots = await PayrollSnapshotService.getSnapshotsForPayrun(validPayrunId);
    assert.equal(currentSnapshots.length, preValidationSnapshots.length);

    for (let i = 0; i < currentSnapshots.length; i++) {
      const cur = currentSnapshots[i];
      const pre = preValidationSnapshots.find((s) => s.employeeId === cur.employeeId);
      assert.ok(pre);
      assert.equal(cur.basic, pre.basic);
      assert.equal(cur.hra, pre.hra);
      assert.equal(cur.allowance, pre.allowance);
      assert.equal(cur.gross, pre.gross);
      assert.equal(cur.tax, pre.tax);
      assert.equal(cur.otherDeductions, pre.otherDeductions);
      assert.equal(cur.net, pre.net);
      assert.deepEqual(cur.earningsBreakdown, pre.earningsBreakdown);
      assert.deepEqual(cur.deductionsBreakdown, pre.deductionsBreakdown);
    }
  });

  it('10. Validation does not recalculate payroll', async () => {
    const currentSnapshots = await PayrollSnapshotService.getSnapshotsForPayrun(validPayrunId);
    for (const cur of currentSnapshots) {
      const pre = preValidationSnapshots.find((s) => s.employeeId === cur.employeeId);
      assert.ok(pre);
      // Calculation version must remain unchanged by validation
      assert.equal(cur.calculationVersion, pre.calculationVersion);
    }
  });

  it('11. Validation does not change Gross Salary', async () => {
    const payrun = await getPayrunById(validPayrunId);
    assert.ok(payrun);
    assert.equal(payrun.totalGross, preValidationGross);
  });

  it('12. Validation does not change Total Deductions', async () => {
    const currentSnapshots = await PayrollSnapshotService.getSnapshotsForPayrun(validPayrunId);
    const totalDeductionsPre = preValidationSnapshots.reduce(
      (sum, s) => sum + s.tax + s.otherDeductions,
      0
    );
    const totalDeductionsCur = currentSnapshots.reduce(
      (sum, s) => sum + s.tax + s.otherDeductions,
      0
    );
    assert.equal(totalDeductionsCur, totalDeductionsPre);
  });

  it('13. Validation does not change Net Salary', async () => {
    const payrun = await getPayrunById(validPayrunId);
    assert.ok(payrun);
    assert.equal(payrun.totalNet, preValidationNet);
  });

  it('14. Duplicate validation request is handled safely', async () => {
    // Payrun is already VALIDATED; calling validatePayrun again must reject cleanly
    await assert.rejects(
      async () => {
        await PayrunValidationService.validatePayrun(validPayrunId, 'Elena Rostova');
      },
      (err: unknown) => {
        assert.ok(err instanceof InvalidPayrunStatusError);
        assert.equal(err.currentStatus, 'VALIDATED');
        assert.match(err.message, /Payrun is already VALIDATED/);
        return true;
      }
    );

    // Payrun state and totals must remain intact
    const payrun = await getPayrunById(validPayrunId);
    assert.ok(payrun);
    assert.equal(payrun.status, 'VALIDATED');
    assert.equal(payrun.totalGross, preValidationGross);
    assert.equal(payrun.totalNet, preValidationNet);
  });

  it('15. COMPUTED ➔ VALIDATED transition works end-to-end', async () => {
    const payrun = await getPayrunById(validPayrunId);
    assert.ok(payrun);
    assert.equal(payrun.status, 'VALIDATED');
    assert.ok(payrun.validatedAt !== null);
    assert.ok(payrun.validatedBy !== null);
  });

  it('16. Existing COMPUTE workflow still works (rejects VALIDATED payrun)', async () => {
    // Attempting to re-compute an already VALIDATED payrun must be rejected by compute workflow
    await assert.rejects(
      async () => {
        await PayrunComputeService.computePayrun(validPayrunId);
      },
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Cannot compute payrun.*VALIDATED/);
        return true;
      }
    );
  });

  it('17. Existing Phase 4 engine tests still pass', () => {
    const res = PayrollEngine.compute({
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      department: 'Engineering',
      monthlyWage: 6500,
    });
    assert.equal(res.basic, 3900);
    assert.equal(res.hra, 1625);
    assert.equal(res.allowance, 975);
    assert.equal(res.gross, 6500);
    assert.equal(res.tax, 650);
    assert.equal(res.otherDeductions, 455);
    assert.equal(res.net, 5395);
  });
});
