/**
 * Phase 5.1 — Payroll Calculation Snapshot & Payslip Persistence Foundation Tests
 *
 * Requirements covered:
 *  1. A calculation result can be persisted.
 *  2. Stored snapshot contains gross salary.
 *  3. Stored snapshot contains total deductions.
 *  4. Stored snapshot contains net salary.
 *  5. Earnings breakdown is preserved.
 *  6. Deductions breakdown is preserved.
 *  7. Snapshot belongs to correct employee.
 *  8. Snapshot belongs to correct Payrun.
 *  9. Payroll period is preserved.
 * 10. Recalculation does not accidentally overwrite finalized historical snapshot.
 * 11. Duplicate snapshot creation is handled safely (idempotent version increment).
 * 12. Employee A cannot receive Employee B's snapshot.
 * 13. Snapshot retrieval works correctly (by ID, by Payrun, by Employee).
 * 14. Existing Phase 4 payroll calculation output structure is preserved.
 * 15. Existing Payrun lifecycle state compatibility is respected.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, executeQuery } from '../config/database.js';
import { PayrollEngine } from './payrollEngine.js';
import { PayrollSnapshotService } from './payrollSnapshot.service.js';
import { createPayrun, updatePayrunStatus } from '../repositories/payrun.repository.js';
import { randomUUID } from 'node:crypto';

describe('PHASE 5.1 — Payroll Calculation Snapshot & Payslip Persistence', () => {
  const testSuffix = randomUUID().slice(0, 6).toUpperCase();
  const testPayrunId = `PR-TEST-51-${testSuffix}`;
  const empA = 'EMP-001'; // John Doe
  const empB = 'EMP-002'; // Maya Lin

  const standardRules = [
    { id: 'RUL-01', code: 'BASIC', name: 'Basic Salary', sequence: 1, category: 'BASIC', calculationType: 'PERCENTAGE', percentage: 60 },
    { id: 'RUL-02', code: 'HRA', name: 'House Rent Allowance', sequence: 2, category: 'ALLOWANCE', calculationType: 'PERCENTAGE', percentage: 25 },
    { id: 'RUL-03', code: 'ALLOWANCE', name: 'Special Allowance', sequence: 3, category: 'ALLOWANCE', calculationType: 'PERCENTAGE', percentage: 15 },
    { id: 'RUL-04', code: 'TAX', name: 'Income Tax', sequence: 4, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 10 },
    { id: 'RUL-05', code: 'PF', name: 'Social Security / PF', sequence: 5, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 7 },
  ];

  before(async () => {
    // Clean up any stale records from previous aborted runs
    await executeQuery('DELETE FROM payslips WHERE payrun_id = ?', [testPayrunId]);
    await executeQuery('DELETE FROM payruns WHERE id = ?', [testPayrunId]);

    // Create test payrun in DRAFT status
    await createPayrun({
      id: testPayrunId,
      name: `Test Payrun Phase 5.1 ${testSuffix}`,
      period: '2026-09',
      salaryStructureId: 'STR-001',
      totalGross: 13700,
      totalNet: 11371,
      employeeCount: 2,
      status: 'DRAFT',
    });
  });

  after(async () => {
    // Teardown test artifacts
    await executeQuery('DELETE FROM payslips WHERE payrun_id = ?', [testPayrunId]);
    await executeQuery('DELETE FROM payruns WHERE id = ?', [testPayrunId]);
    await pool.end();
  });

  it('1. A calculation result can be persisted to MySQL', async () => {
    const computed = PayrollEngine.compute({
      employeeId: empA,
      employeeName: 'John Doe',
      department: 'Engineering',
      monthlyWage: 6500,
      salaryRules: standardRules,
    });

    const persisted = await PayrollSnapshotService.persistSnapshot({
      payrunId: testPayrunId,
      employeeId: empA,
      contractWage: 6500,
      period: { startDate: '2026-09-01', endDate: '2026-09-30' },
      calculatedPayslip: computed,
      status: 'DRAFT',
    });

    assert.ok(persisted.id, 'Persisted record must have an ID');
    assert.equal(persisted.payrunId, testPayrunId);
    assert.equal(persisted.employeeId, empA);
  });

  it('2. Stored snapshot contains gross salary', async () => {
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId);
    const snapA = snapshots.find((s) => s.employeeId === empA);
    assert.ok(snapA, 'Snapshot for Employee A must exist');
    assert.equal(snapA.gross, 6500, 'Gross salary must be 6500');
  });

  it('3. Stored snapshot contains total deductions', async () => {
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId);
    const snapA = snapshots.find((s) => s.employeeId === empA);
    assert.ok(snapA);
    // tax = 650, other_deductions = 455 => total = 1105
    assert.equal(snapA.tax + snapA.otherDeductions, 1105);
  });

  it('4. Stored snapshot contains net salary', async () => {
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId);
    const snapA = snapshots.find((s) => s.employeeId === empA);
    assert.ok(snapA);
    assert.equal(snapA.net, 5395, 'Net salary must equal gross - deductions (6500 - 1105 = 5395)');
  });

  it('5. Earnings breakdown is preserved in structured format', async () => {
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId);
    const snapA = snapshots.find((s) => s.employeeId === empA);
    assert.ok(snapA);
    assert.ok(Array.isArray(snapA.earningsBreakdown), 'earningsBreakdown must be an array');
    assert.equal(snapA.earningsBreakdown.length, 3, 'Must have 3 standard earnings rules');

    const basic = snapA.earningsBreakdown.find((e) => e.ruleCode === 'BASIC');
    assert.ok(basic, 'Basic salary item must exist');
    assert.equal(basic.amount, 3900);
    assert.equal(basic.category, 'BASIC');

    const hra = snapA.earningsBreakdown.find((e) => e.ruleCode === 'HRA');
    assert.ok(hra, 'HRA item must exist');
    assert.equal(hra.amount, 1625);
  });

  it('6. Deductions breakdown is preserved in structured format', async () => {
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId);
    const snapA = snapshots.find((s) => s.employeeId === empA);
    assert.ok(snapA);
    assert.ok(Array.isArray(snapA.deductionsBreakdown), 'deductionsBreakdown must be an array');
    assert.ok(snapA.deductionsBreakdown.length >= 2, 'Must have at least TAX and PF deductions');

    const tax = snapA.deductionsBreakdown.find((d) => d.ruleCode === 'TAX');
    assert.ok(tax, 'Tax item must exist');
    assert.equal(tax.amount, 650);

    const pf = snapA.deductionsBreakdown.find((d) => d.ruleCode === 'PF');
    assert.ok(pf, 'PF item must exist');
    assert.equal(pf.amount, 455);
  });

  it('7. Snapshot belongs to correct employee', async () => {
    const computedB = PayrollEngine.compute({
      employeeId: empB,
      employeeName: 'Maya Lin',
      department: 'Product',
      monthlyWage: 7200,
      salaryRules: standardRules,
    });

    await PayrollSnapshotService.persistSnapshot({
      payrunId: testPayrunId,
      employeeId: empB,
      contractWage: 7200,
      period: { startDate: '2026-09-01', endDate: '2026-09-30' },
      calculatedPayslip: computedB,
      status: 'DRAFT',
    });

    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId);
    const snapB = snapshots.find((s) => s.employeeId === empB);
    assert.ok(snapB);
    assert.equal(snapB.employeeId, empB);
    assert.equal(snapB.employeeName, 'Maya Lin');
  });

  it('8. Snapshot belongs to correct Payrun', async () => {
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId);
    for (const snap of snapshots) {
      assert.equal(snap.payrunId, testPayrunId);
    }
  });

  it('9. Payroll period is preserved', async () => {
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId);
    const snapA = snapshots.find((s) => s.employeeId === empA);
    assert.ok(snapA);
    assert.equal(snapA.periodStart, '2026-09-01');
    assert.equal(snapA.periodEnd, '2026-09-30');
  });

  it('10. Recalculation does not accidentally overwrite finalized historical snapshot', async () => {
    // Finalize snapshot A by marking status VALIDATED
    await executeQuery('UPDATE payslips SET status = ? WHERE payrun_id = ? AND employee_id = ?', [
      'VALIDATED',
      testPayrunId,
      empA,
    ]);

    const modifiedComputation = PayrollEngine.compute({
      employeeId: empA,
      employeeName: 'John Doe',
      department: 'Engineering',
      monthlyWage: 99999, // Attempted altered wage
      salaryRules: standardRules,
    });

    await assert.rejects(
      async () => {
        await PayrollSnapshotService.persistSnapshot({
          payrunId: testPayrunId,
          employeeId: empA,
          contractWage: 99999,
          calculatedPayslip: modifiedComputation,
        });
      },
      /IMMUTABLE_SNAPSHOT_FINALIZED/,
      'Must reject recalculation/overwrite of finalized snapshot'
    );

    // Verify historical value remained intact (6500, not 99999)
    const snapAfter = await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId);
    const unchanged = snapAfter.find((s) => s.employeeId === empA);
    assert.equal(unchanged?.gross, 6500, 'Historical snapshot must not have changed');
    assert.equal(unchanged?.net, 5395, 'Historical net must not have changed');
  });

  it('11. Duplicate snapshot creation in DRAFT is handled safely (idempotent version increment)', async () => {
    // Reset Emp A to DRAFT for recalculation test
    await executeQuery('UPDATE payslips SET status = ? WHERE payrun_id = ? AND employee_id = ?', [
      'DRAFT',
      testPayrunId,
      empA,
    ]);

    const initial = (await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId)).find(
      (s) => s.employeeId === empA
    );
    const initialVersion = initial?.calculationVersion || 1;

    const recalculated = PayrollEngine.compute({
      employeeId: empA,
      employeeName: 'John Doe',
      department: 'Engineering',
      monthlyWage: 6500,
    });

    const updated = await PayrollSnapshotService.persistSnapshot({
      payrunId: testPayrunId,
      employeeId: empA,
      contractWage: 6500,
      calculatedPayslip: recalculated,
      status: 'DRAFT',
    });

    assert.equal(updated.calculationVersion, initialVersion + 1, 'Version must increment on recalculation');

    // Confirm total count for empA in this payrun is still exactly 1 (no duplicate rows)
    const rows = await executeQuery<any[]>(
      'SELECT COUNT(*) as count FROM payslips WHERE payrun_id = ? AND employee_id = ?',
      [testPayrunId, empA]
    );
    assert.equal(rows[0].count, 1, 'Must maintain exactly one snapshot record per employee per payrun');
  });

  it('12. Employee A cannot receive Employee B snapshot', async () => {
    const historyA = await PayrollSnapshotService.getHistoryForEmployee(empA);
    for (const snap of historyA) {
      assert.equal(snap.employeeId, empA, "History for Emp A must not contain any other employee's data");
      assert.notEqual(snap.employeeId, empB);
    }
  });

  it('13. Snapshot retrieval works correctly (by ID, by Payrun, by Employee)', async () => {
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId);
    assert.ok(snapshots.length >= 2, 'Payrun must have at least 2 snapshots');

    const first = snapshots[0];
    const fetchedById = await PayrollSnapshotService.getSnapshotById(first.id);
    assert.ok(fetchedById);
    assert.equal(fetchedById.id, first.id);
    assert.equal(fetchedById.employeeId, first.employeeId);

    const history = await PayrollSnapshotService.getHistoryForEmployee(first.employeeId);
    assert.ok(history.length >= 1);
    assert.ok(history.some((h) => h.id === first.id));
  });

  it('14. Full calculation snapshot payload preserves detailed audit structure', async () => {
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(testPayrunId);
    const snap = snapshots[0];
    assert.ok(snap.calculationSnapshot, 'Calculation snapshot JSON must be present');
    assert.ok(snap.calculationTimestamp, 'Calculation timestamp must be present');

    const payload = snap.calculationSnapshot as any;
    assert.ok(payload.calculatedAt, 'Timestamp in JSON payload must be present');
    assert.ok(payload.employee, 'Employee info in JSON payload must be present');
    assert.ok(payload.contract, 'Contract info in JSON payload must be present');
    assert.ok(Array.isArray(payload.earnings), 'Earnings array in JSON payload must be present');
    assert.ok(Array.isArray(payload.deductions), 'Deductions array in JSON payload must be present');
  });

  it('15. Existing Payrun lifecycle state transitions remain intact', async () => {
    // Payrun was in DRAFT. Advance to VALIDATED
    const validated = await updatePayrunStatus(testPayrunId, 'VALIDATED');
    assert.equal(validated?.status, 'VALIDATED');

    // Advance to PAID
    const paid = await updatePayrunStatus(testPayrunId, 'PAID');
    assert.equal(paid?.status, 'PAID');
  });
});
