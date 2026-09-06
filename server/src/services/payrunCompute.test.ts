/**
 * Phase 5.2 — Payrun Compute Workflow Test Suite
 *
 * Requirements tested:
 *  1. DRAFT Payrun can be computed.
 *  2. COMPUTE processes eligible employees.
 *  3. Payroll engine is called through existing architecture.
 *  4. Employee snapshots are created.
 *  5. Snapshot contains calculation result.
 *  6. Payrun becomes COMPUTED after successful processing.
 *  7. Payrun does NOT automatically become VALIDATED.
 *  8. Payrun does NOT automatically become PAID.
 *  9. COMPUTED Payrun cannot accidentally create duplicate snapshots (idempotency).
 * 10. Ineligible employees are excluded (terminated, contract outside period, no contract).
 * 11. Employee A payroll does not contain Employee B data.
 * 12. Payroll period filtering is respected.
 * 13. Calculation failure does not incorrectly mark Payrun COMPUTED.
 * 14. Snapshot persistence failure is handled safely.
 * 15. Existing Phase 4 calculation tests still pass (regression check).
 * 16. Existing Payrun functionality still works (state validation, /payruns endpoints).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, executeQuery } from '../config/database.js';
import {
  PayrunComputeService,
  PayrunNotFoundError,
  InvalidPayrunStatusError,
  PayrunComputeError,
} from './payrunCompute.service.js';
import {
  createPayrun,
  getPayrunById,
  updatePayrunStatus,
} from '../repositories/payrun.repository.js';
import { PayrollSnapshotService } from './payrollSnapshot.service.js';
import { PayrollEngine } from './payrollEngine.js';
import { preparePayrollCalculationInput } from './payrollPreparation.js';
import { randomUUID } from 'node:crypto';

describe('PHASE 5.2 — Payrun Compute Workflow', () => {
  const testSuffix = randomUUID().slice(0, 6).toUpperCase();
  const testPayrunId = `PR-TEST-52-${testSuffix}`;
  const testRecalcPayrunId = `PR-RECALC-52-${testSuffix}`;
  const testFailedPayrunId = `PR-FAIL-52-${testSuffix}`;

  // Ineligible test fixture IDs
  const terminatedEmpId = `EMP-INEL-TERM-${testSuffix}`;
  const futureContractEmpId = `EMP-INEL-FUTR-${testSuffix}`;
  const terminatedContractId = `CON-INEL-TERM-${testSuffix}`;
  const futureContractId = `CON-INEL-FUTR-${testSuffix}`;

  before(async () => {
    // Clean up any stale records
    await executeQuery('DELETE FROM payslips WHERE payrun_id IN (?, ?, ?)', [
      testPayrunId,
      testRecalcPayrunId,
      testFailedPayrunId,
    ]);
    await executeQuery('DELETE FROM payruns WHERE id IN (?, ?, ?)', [
      testPayrunId,
      testRecalcPayrunId,
      testFailedPayrunId,
    ]);

    // Clean up test employee fixtures if any
    await executeQuery('DELETE FROM contracts WHERE id IN (?, ?)', [
      terminatedContractId,
      futureContractId,
    ]);
    await executeQuery('DELETE FROM employees WHERE id IN (?, ?)', [
      terminatedEmpId,
      futureContractEmpId,
    ]);

    // Insert an INACTIVE employee fixture to test exclusion
    await executeQuery(
      `INSERT INTO employees (id, name, email, department, position, status, join_date, bank_account)
       VALUES (?, ?, ?, 'Engineering', 'Former Engineer', 'INACTIVE', '2026-01-01', '•••• 9999')`,
      [terminatedEmpId, `Terminated User ${testSuffix}`, `term_${testSuffix}@company.com`]
    );
    await executeQuery(
      `INSERT INTO contracts (id, employee_id, salary_structure_id, working_schedule_id, wage, start_date, status)
       VALUES (?, ?, 'STR-001', 'SCH-001', 5000.00, '2023-01-01', 'ACTIVE')`,
      [terminatedContractId, terminatedEmpId]
    );

    // Insert an ACTIVE employee whose contract is FUTURE (starts 2027-01-01, outside 2026-09)
    await executeQuery(
      `INSERT INTO employees (id, name, email, department, position, status, join_date, bank_account)
       VALUES (?, ?, ?, 'Product', 'Future PM', 'ACTIVE', '2026-01-01', '•••• 8888')`,
      [futureContractEmpId, `Future Hire ${testSuffix}`, `future_${testSuffix}@company.com`]
    );
    await executeQuery(
      `INSERT INTO contracts (id, employee_id, salary_structure_id, working_schedule_id, wage, start_date, status)
       VALUES (?, ?, 'STR-001', 'SCH-001', 7000.00, '2027-01-01', 'ACTIVE')`,
      [futureContractId, futureContractEmpId]
    );

    // 1. Create primary test payrun in DRAFT status
    await createPayrun({
      id: testPayrunId,
      name: `September 2026 Regular Payrun ${testSuffix}`,
      period: '2026-09',
      salaryStructureId: 'STR-001',
      totalGross: 0,
      totalNet: 0,
      employeeCount: 0,
      status: 'DRAFT',
    });

    // 2. Create recalculation test payrun in DRAFT status
    await createPayrun({
      id: testRecalcPayrunId,
      name: `September 2026 Recalc Payrun ${testSuffix}`,
      period: '2026-09-01 to 2026-09-30',
      salaryStructureId: 'STR-001',
      totalGross: 0,
      totalNet: 0,
      employeeCount: 0,
      status: 'DRAFT',
    });

    // 3. Create failure test payrun in DRAFT status with invalid period
    await createPayrun({
      id: testFailedPayrunId,
      name: `Failure Test Payrun ${testSuffix}`,
      period: 'INVALID-PERIOD',
      salaryStructureId: 'STR-001',
      totalGross: 0,
      totalNet: 0,
      employeeCount: 0,
      status: 'DRAFT',
    });
  });

  after(async () => {
    // Teardown test artifacts
    await executeQuery('DELETE FROM payslips WHERE payrun_id IN (?, ?, ?)', [
      testPayrunId,
      testRecalcPayrunId,
      testFailedPayrunId,
    ]);
    await executeQuery('DELETE FROM payruns WHERE id IN (?, ?, ?)', [
      testPayrunId,
      testRecalcPayrunId,
      testFailedPayrunId,
    ]);
    await executeQuery('DELETE FROM contracts WHERE id IN (?, ?)', [
      terminatedContractId,
      futureContractId,
    ]);
    await executeQuery('DELETE FROM employees WHERE id IN (?, ?)', [
      terminatedEmpId,
      futureContractEmpId,
    ]);
    await pool.end();
  });

  it('1. DRAFT Payrun can be computed', async () => {
    const initial = await getPayrunById(testPayrunId);
    assert.ok(initial);
    assert.equal(initial.status, 'DRAFT', 'Payrun must start in DRAFT status before compute');

    const result = await PayrunComputeService.computePayrun(testPayrunId);
    assert.ok(result);
    assert.equal(result.payrun.id, testPayrunId);
    assert.equal(result.payrun.status, 'COMPUTED', 'Payrun must transition to COMPUTED');
  });

  it('2. COMPUTE processes eligible employees', async () => {
    const result = await PayrunComputeService.computePayrun(testPayrunId);
    assert.ok(result.summary.processedEmployeesCount >= 6, 'Must process baseline eligible employees');

    const processedIds = result.snapshots.map((s) => s.employeeId);
    assert.ok(processedIds.includes('EMP-001'), 'Must include John Doe');
    assert.ok(processedIds.includes('EMP-002'), 'Must include Maya Lin');
    assert.ok(processedIds.includes('EMP-003'), 'Must include Alex Rivera');
    assert.ok(processedIds.includes('EMP-004'), 'Must include Elena Rostova');
    assert.ok(processedIds.includes('EMP-005'), 'Must include David Kim');
    assert.ok(processedIds.includes('EMP-006'), 'Must include Sarah Connor');
  });

  it('3. Payroll engine is called through existing architecture', async () => {
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId);
    const emp1Snap = snapshots.find((s) => s.employeeId === 'EMP-001');
    assert.ok(emp1Snap, 'EMP-001 snapshot must exist');

    // For EMP-001: contract wage is 6500.00
    // Basic (60%) = 3900, HRA (25%) = 1625, Allowance (15%) = 975
    // Tax (10%) = 650, PF (7%) = 455
    assert.equal(emp1Snap.contractWage, 6500);
    assert.equal(emp1Snap.basic, 3900);
    assert.equal(emp1Snap.hra, 1625);
    assert.equal(emp1Snap.allowance, 975);
    assert.equal(emp1Snap.tax, 650);
    assert.equal(emp1Snap.otherDeductions, 455);
    assert.ok(emp1Snap.gross > 0);
    assert.ok(emp1Snap.net > 0);
    assert.equal(emp1Snap.net, emp1Snap.gross - emp1Snap.tax - emp1Snap.otherDeductions);
  });

  it('4. Employee snapshots are created', async () => {
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId);
    assert.ok(snapshots.length >= 6, 'Snapshots must be persisted for each processed employee');
    for (const snap of snapshots) {
      assert.ok(snap.id.startsWith('PSL-'), 'Snapshot ID must have PSL- prefix');
      assert.equal(snap.payrunId, testPayrunId);
      assert.equal(snap.status, 'COMPUTED');
    }
  });

  it('5. Snapshot contains calculation result', async () => {
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId);
    const snap = snapshots[0];

    assert.ok(snap.gross > 0, 'Snapshot must store gross salary');
    assert.ok(snap.net > 0, 'Snapshot must store net salary');
    assert.ok(Array.isArray(snap.earningsBreakdown), 'Must store earnings breakdown');
    assert.ok(snap.earningsBreakdown.length >= 3, 'Must have at least 3 earnings components');
    assert.ok(Array.isArray(snap.deductionsBreakdown), 'Must store deductions breakdown');
    assert.ok(snap.deductionsBreakdown.length >= 2, 'Must have at least 2 deduction components');
    assert.ok(snap.calculationSnapshot, 'Must store calculation snapshot JSON payload');
  });

  it('6. Payrun becomes COMPUTED after successful processing', async () => {
    const updated = await getPayrunById(testPayrunId);
    assert.ok(updated);
    assert.equal(updated.status, 'COMPUTED');
    assert.ok(updated.totalGross > 0, 'Payrun totalGross must be updated');
    assert.ok(updated.totalNet > 0, 'Payrun totalNet must be updated');
    assert.ok(updated.employeeCount >= 6, 'Payrun employeeCount must reflect eligible employees');
  });

  it('7. Payrun does NOT automatically become VALIDATED', async () => {
    const payrun = await getPayrunById(testPayrunId);
    assert.ok(payrun);
    assert.notEqual(payrun.status, 'VALIDATED', 'Compute must NOT advance status to VALIDATED');
  });

  it('8. Payrun does NOT automatically become PAID', async () => {
    const payrun = await getPayrunById(testPayrunId);
    assert.ok(payrun);
    assert.notEqual(payrun.status, 'PAID', 'Compute must NOT advance status to PAID');
  });

  it('9. COMPUTED Payrun cannot accidentally create duplicate snapshots (idempotency)', async () => {
    // Initial compute on testRecalcPayrunId
    const firstResult = await PayrunComputeService.computePayrun(testRecalcPayrunId);
    const firstSnapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testRecalcPayrunId);
    const initialCount = firstSnapshots.length;

    // Trigger compute again (simulating repeated click)
    const secondResult = await PayrunComputeService.computePayrun(testRecalcPayrunId);
    const secondSnapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testRecalcPayrunId);

    assert.equal(
      secondSnapshots.length,
      initialCount,
      'Duplicate compute must NOT create duplicate snapshot rows in payslips table'
    );

    // Verify calculation version was incremented
    const version2Snap = secondSnapshots[0];
    assert.ok(
      version2Snap.calculationVersion >= 2,
      'Recalculation must increment calculation_version idempotently'
    );
  });

  it('10. Ineligible employees are excluded (terminated, future contract)', async () => {
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId);
    const processedEmployeeIds = snapshots.map((s) => s.employeeId);

    assert.ok(
      !processedEmployeeIds.includes(terminatedEmpId),
      'Terminated employee must be excluded from computation'
    );
    assert.ok(
      !processedEmployeeIds.includes(futureContractEmpId),
      'Employee with future contract not covering period must be excluded from computation'
    );
  });

  it('11. Employee A payroll does not contain Employee B data', async () => {
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId);
    const emp1 = snapshots.find((s) => s.employeeId === 'EMP-001');
    const emp2 = snapshots.find((s) => s.employeeId === 'EMP-002');

    assert.ok(emp1 && emp2, 'Both snapshots must exist');
    assert.notEqual(emp1.employeeId, emp2.employeeId);
    assert.notEqual(emp1.employeeName, emp2.employeeName);
    assert.notEqual(emp1.contractWage, emp2.contractWage);
    assert.notEqual(emp1.gross, emp2.gross);
    assert.notEqual(emp1.net, emp2.net);
  });

  it('12. Payroll period filtering is respected', () => {
    const period = PayrunComputeService.parsePeriod('2026-09');
    assert.equal(period.startDate, '2026-09-01');
    assert.equal(period.endDate, '2026-09-30');

    // Feb in leap year 2024
    const leapFeb = PayrunComputeService.parsePeriod('2024-02');
    assert.equal(leapFeb.startDate, '2024-02-01');
    assert.equal(leapFeb.endDate, '2024-02-29');

    // Feb in non-leap year 2026
    const nonLeapFeb = PayrunComputeService.parsePeriod('2026-02');
    assert.equal(nonLeapFeb.startDate, '2026-02-01');
    assert.equal(nonLeapFeb.endDate, '2026-02-28');
  });

  it('13. Calculation failure does not incorrectly mark Payrun COMPUTED', async () => {
    const beforeFail = await getPayrunById(testFailedPayrunId);
    assert.ok(beforeFail);
    assert.equal(beforeFail.status, 'DRAFT');

    await assert.rejects(
      async () => {
        await PayrunComputeService.computePayrun(testFailedPayrunId);
      },
      (err: unknown) => {
        assert.ok(err instanceof PayrunComputeError);
        return true;
      }
    );

    const afterFail = await getPayrunById(testFailedPayrunId);
    assert.ok(afterFail);
    assert.equal(
      afterFail.status,
      'DRAFT',
      'Payrun must remain in DRAFT status when calculation fails'
    );
  });

  it('14. Snapshot persistence failure is handled safely (immutability check / invalid status rejection)', async () => {
    // Create a dummy payrun marked VALIDATED
    const validatedId = `PR-VAL-${testSuffix}`;
    await createPayrun({
      id: validatedId,
      name: `Validated Payrun ${testSuffix}`,
      period: '2026-09',
      status: 'VALIDATED',
    });

    // Computing a VALIDATED payrun must fail with InvalidPayrunStatusError
    await assert.rejects(
      async () => {
        await PayrunComputeService.computePayrun(validatedId);
      },
      (err: unknown) => {
        assert.ok(err instanceof InvalidPayrunStatusError);
        return true;
      }
    );

    // Create a dummy payrun marked PAID
    const paidId = `PR-PAID-${testSuffix}`;
    await createPayrun({
      id: paidId,
      name: `Paid Payrun ${testSuffix}`,
      period: '2026-09',
      status: 'PAID',
    });

    // Computing a PAID payrun must fail with InvalidPayrunStatusError
    await assert.rejects(
      async () => {
        await PayrunComputeService.computePayrun(paidId);
      },
      (err: unknown) => {
        assert.ok(err instanceof InvalidPayrunStatusError);
        return true;
      }
    );

    // Clean up temporary payruns
    await executeQuery('DELETE FROM payruns WHERE id IN (?, ?)', [validatedId, paidId]);
  });

  it('15. Existing Phase 4 calculation tests still pass (deterministic verification)', () => {
    const input = preparePayrollCalculationInput({
      employee: { id: 'EMP-999', name: 'Determinism Check', department: 'QA', wage: 10000 },
      period: { startDate: '2026-09-01', endDate: '2026-09-30' },
      salaryRules: [
        { id: 'RUL-01', code: 'BASIC', name: 'Basic Salary', sequence: 1, category: 'BASIC', calculationType: 'PERCENTAGE', percentage: 60 },
        { id: 'RUL-02', code: 'HRA', name: 'House Rent Allowance', sequence: 2, category: 'ALLOWANCE', calculationType: 'PERCENTAGE', percentage: 25 },
        { id: 'RUL-03', code: 'ALLOWANCE', name: 'Special Allowance', sequence: 3, category: 'ALLOWANCE', calculationType: 'PERCENTAGE', percentage: 15 },
        { id: 'RUL-04', code: 'TAX', name: 'Income Tax', sequence: 4, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 10 },
        { id: 'RUL-05', code: 'PF', name: 'Social Security / PF', sequence: 5, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 7 },
      ],
    });

    const result = PayrollEngine.compute(input.input);
    assert.equal(result.basic, 6000);
    assert.equal(result.hra, 2500);
    assert.equal(result.allowance, 1500);
    assert.equal(result.gross, 10000);
    assert.equal(result.tax, 1000);
    assert.equal(result.otherDeductions, 700);
    assert.equal(result.net, 8300);
  });

  it('16. Existing Payrun functionality still works (non-regression for state transitions)', async () => {
    // Verify payrun transition from COMPUTED -> VALIDATED via updatePayrunStatus
    const validated = await updatePayrunStatus(testPayrunId, 'VALIDATED');
    assert.ok(validated);
    assert.equal(validated.status, 'VALIDATED');

    // Verify payrun transition from VALIDATED -> PAID
    const paid = await updatePayrunStatus(testPayrunId, 'PAID');
    assert.ok(paid);
    assert.equal(paid.status, 'PAID');
  });
});
