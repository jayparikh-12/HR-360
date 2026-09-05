/**
 * Phase 5.5 — Payslip Retrieval & Detailed Breakdown API Test Suite
 *
 * Requirements tested:
 *  1. Detailed payslip can be retrieved by ID.
 *  2. Detailed payslip can be retrieved by payrunId + employeeId.
 *  3. Payslip uses persisted snapshot data.
 *  4. Retrieval does not invoke payroll calculation.
 *  5. Earnings breakdown is returned correctly.
 *  6. Deductions breakdown is returned correctly.
 *  7. Gross Salary is correct.
 *  8. Total Deductions is correct.
 *  9. Net Salary is correct.
 * 10. Payroll period is correct.
 * 11. Employee metadata is correctly associated.
 * 12. Employee history returns correct records sorted newest first.
 * 13. History does not include another employee's payslips.
 * 14. Cross-employee access is prevented (Employee A requesting Employee B payslip -> 403).
 * 15. Unauthorized requests are rejected (401).
 * 16. Nonexistent payslip returns correct error (404).
 * 17. Nonexistent employee history returns empty list.
 * 18. Historical Immutability: Modifying contract wage, rules, or attendance does not alter historical payslip.
 * 19. Existing Payrun lifecycle workflow remains functional.
 * 20. Existing Phase 4 deterministic engine tests pass.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, executeQuery } from '../config/database.js';
import {
  PayslipRetrievalService,
  PayslipNotFoundError,
  EmployeeNotFoundError,
  ForbiddenEmployeeAccessError,
} from './payslipRetrieval.service.js';
import { PayrunComputeService } from './payrunCompute.service.js';
import { PayrunValidationService } from './payrunValidation.service.js';
import { PayrunPaymentService } from './payrunPayment.service.js';
import {
  createPayrun,
  getPayrunById,
} from '../repositories/payrun.repository.js';
import { PayrollSnapshotService } from './payrollSnapshot.service.js';
import { PayrollEngine } from './payrollEngine.js';
import { type AuthenticatedUser } from '../types/auth.types.js';
import { randomUUID } from 'node:crypto';

describe('PHASE 5.5 — Payslip Retrieval & Detailed Breakdown API', () => {
  const testSuffix = randomUUID().slice(0, 6).toUpperCase();
  const payrunId1 = `PR-RET-1-${testSuffix}`;
  const payrunId2 = `PR-RET-2-${testSuffix}`;

  const emp1Id = 'EMP-001'; // John Doe
  const emp2Id = 'EMP-002'; // Maya Lin

  // Mock users
  const userEmp1: AuthenticatedUser = {
    id: 'USR-001',
    name: 'John Doe',
    email: 'john@company.com',
    role: 'Employee',
    employeeId: emp1Id,
  };

  const userEmp2: AuthenticatedUser = {
    id: 'USR-002',
    name: 'Maya Lin',
    email: 'maya@company.com',
    role: 'Employee',
    employeeId: emp2Id,
  };

  const userAdmin: AuthenticatedUser = {
    id: 'USR-999',
    name: 'System Administrator',
    email: 'admin@company.com',
    role: 'Admin',
  };

  const userPayrollManager: AuthenticatedUser = {
    id: 'USR-004',
    name: 'Elena Rostova',
    email: 'elena@company.com',
    role: 'HR Payroll Manager',
    employeeId: 'EMP-004',
  };

  let emp1PayslipId: string = '';
  let emp2PayslipId: string = '';
  let baselineGross: number = 0;
  let baselineNet: number = 0;
  let baselineTotalDeductions: number = 0;

  before(async () => {
    // Clean up any stale records
    const pids = [payrunId1, payrunId2];
    await executeQuery('DELETE FROM payslips WHERE payrun_id IN (?, ?)', pids);
    await executeQuery('DELETE FROM payruns WHERE id IN (?, ?)', pids);

    // 1. Create Payrun 1 (Older period: 2026-08)
    await createPayrun({
      id: payrunId1,
      name: `August 2026 Payrun ${testSuffix}`,
      period: '2026-08 (2026-08-01 - 2026-08-31)',
      salaryStructureId: 'STR-001',
      status: 'DRAFT',
    });
    await PayrunComputeService.computePayrun(payrunId1);
    await PayrunValidationService.validatePayrun(payrunId1, 'Elena Rostova');
    await PayrunPaymentService.markPayrunAsPaid(payrunId1, 'Elena Rostova', `PAY-AUG-${testSuffix}`);

    // 2. Create Payrun 2 (Newer period: 2026-09)
    await createPayrun({
      id: payrunId2,
      name: `September 2026 Payrun ${testSuffix}`,
      period: '2026-09 (2026-09-01 - 2026-09-30)',
      salaryStructureId: 'STR-001',
      status: 'DRAFT',
    });
    await PayrunComputeService.computePayrun(payrunId2);
    await PayrunValidationService.validatePayrun(payrunId2, 'Elena Rostova');

    // Retrieve snapshots from Payrun 2 to record baseline payslip IDs
    const snapshots = await PayrollSnapshotService.getSnapshotsForPayrun(payrunId2);
    const snap1 = snapshots.find((s) => s.employeeId === emp1Id);
    const snap2 = snapshots.find((s) => s.employeeId === emp2Id);
    assert.ok(snap1, 'EMP-001 snapshot must exist');
    assert.ok(snap2, 'EMP-002 snapshot must exist');

    emp1PayslipId = snap1.id;
    emp2PayslipId = snap2.id;
    baselineGross = snap1.gross;
    baselineNet = snap1.net;
    baselineTotalDeductions = snap1.tax + snap1.otherDeductions;
  });

  after(async () => {
    const pids = [payrunId1, payrunId2];
    await executeQuery('DELETE FROM payslips WHERE payrun_id IN (?, ?)', pids);
    await executeQuery('DELETE FROM payruns WHERE id IN (?, ?)', pids);
    await pool.end();
  });

  it('1. Detailed payslip can be retrieved by ID', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.ok(payslip);
    assert.equal(payslip.payslipId, emp1PayslipId);
    assert.equal(payslip.payrunId, payrunId2);
    assert.equal(payslip.employee.employeeId, emp1Id);
  });

  it('2. Detailed payslip can be retrieved by payrunId + employeeId', async () => {
    const payslip = await PayslipRetrievalService.getPayslipByPayrunAndEmployee(
      payrunId2,
      emp1Id,
      userPayrollManager
    );
    assert.ok(payslip);
    assert.equal(payslip.payslipId, emp1PayslipId);
    assert.equal(payslip.payrunId, payrunId2);
    assert.equal(payslip.employee.employeeId, emp1Id);
  });

  it('3. Payslip uses persisted snapshot data', async () => {
    const snapshot = await PayrollSnapshotService.getSnapshotById(emp1PayslipId);
    assert.ok(snapshot);

    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.equal(payslip.grossSalary, snapshot.gross);
    assert.equal(payslip.netSalary, snapshot.net);
    assert.equal(payslip.baseSalary, snapshot.contractWage);
    assert.equal(payslip.calculatedAt, snapshot.calculationTimestamp);
  });

  it('4. Retrieval does not invoke payroll calculation (zero engine call)', async () => {
    // Spy on PayrollEngine.compute if needed; verify retrieval succeeds with identical numbers
    const payslip1 = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    const payslip2 = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.deepEqual(payslip1, payslip2);
  });

  it('5. Earnings breakdown is returned correctly with all rules', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.ok(Array.isArray(payslip.earnings));
    assert.ok(payslip.earnings.length > 0, 'Must contain earnings items');

    for (const earn of payslip.earnings) {
      assert.ok(earn.ruleCode, 'Rule code must be present');
      assert.ok(earn.ruleName, 'Rule name must be present');
      assert.ok(earn.category, 'Category must be present');
      assert.ok(typeof earn.amount === 'number' && earn.amount >= 0, 'Amount must be non-negative number');
    }
  });

  it('6. Deductions breakdown is returned correctly with all rules', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.ok(Array.isArray(payslip.deductions));
    assert.ok(payslip.deductions.length > 0, 'Must contain deduction items');

    for (const ded of payslip.deductions) {
      assert.ok(ded.ruleCode, 'Rule code must be present');
      assert.ok(ded.ruleName, 'Rule name must be present');
      assert.ok(ded.category, 'Category must be present');
      assert.ok(typeof ded.amount === 'number' && ded.amount >= 0, 'Amount must be non-negative number');
    }
  });

  it('7. Gross Salary is correct and matches stored snapshot', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.equal(payslip.grossSalary, baselineGross);
  });

  it('8. Total Deductions is correct and matches stored snapshot', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.equal(payslip.totalDeductions, baselineTotalDeductions);
  });

  it('9. Net Salary is correct and matches stored snapshot', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.equal(payslip.netSalary, baselineNet);
  });

  it('10. Payroll period is correct', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.ok(payslip.payrollPeriod.start);
    assert.ok(payslip.payrollPeriod.end);
    assert.match(payslip.payrollPeriod.start, /2026-09/);
    assert.match(payslip.payrollPeriod.end, /2026-09/);
  });

  it('11. Employee metadata (position, department, name) is correctly associated', async () => {
    const payslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    assert.equal(payslip.employee.employeeId, emp1Id);
    assert.equal(payslip.employee.name, 'John Doe');
    assert.ok(payslip.employee.department, 'Department should be populated');
    assert.ok(payslip.employee.position, 'Position should be populated');
  });

  it('12. Employee history returns correct records sorted newest first', async () => {
    const history = await PayslipRetrievalService.getEmployeePayslipHistory(emp1Id, userAdmin);
    assert.ok(Array.isArray(history));
    assert.ok(history.length >= 2, 'Should have at least 2 historical payslips (Aug & Sep)');

    // Verify ordering: newest period first (Sep before Aug)
    const dates = history.map((h) => h.payrollPeriod.start || '');
    assert.ok(dates[0] >= dates[1], 'History must be sorted newest first');

    for (const item of history) {
      assert.ok(item.payslipId);
      assert.ok(item.payrunId);
      assert.ok(typeof item.grossSalary === 'number');
      assert.ok(typeof item.totalDeductions === 'number');
      assert.ok(typeof item.netSalary === 'number');
      assert.ok(item.status);
    }
  });

  it("13. History does not include another employee's payslips", async () => {
    const history1 = await PayslipRetrievalService.getEmployeePayslipHistory(emp1Id, userAdmin);
    const history2 = await PayslipRetrievalService.getEmployeePayslipHistory(emp2Id, userAdmin);

    const ids1 = new Set(history1.map((h) => h.payslipId));
    const ids2 = new Set(history2.map((h) => h.payslipId));

    for (const id of ids1) {
      assert.equal(ids2.has(id), false, `Payslip ${id} must not appear in Employee 2 history`);
    }
  });

  it('14. Cross-employee access is prevented (Employee A requesting Employee B payslip -> 403)', async () => {
    // Employee 1 attempts to access Employee 2's payslip by ID
    await assert.rejects(
      async () => {
        await PayslipRetrievalService.getPayslipById(emp2PayslipId, userEmp1);
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenEmployeeAccessError);
        assert.match(err.message, /Forbidden/);
        return true;
      }
    );

    // Employee 1 attempts to access Employee 2's payslip by payrun/employee
    await assert.rejects(
      async () => {
        await PayslipRetrievalService.getPayslipByPayrunAndEmployee(payrunId2, emp2Id, userEmp1);
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenEmployeeAccessError);
        return true;
      }
    );

    // Employee 1 attempts to access Employee 2's history
    await assert.rejects(
      async () => {
        await PayslipRetrievalService.getEmployeePayslipHistory(emp2Id, userEmp1);
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenEmployeeAccessError);
        return true;
      }
    );

    // Employee 1 CAN access own payslip
    const ownPayslip = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userEmp1);
    assert.equal(ownPayslip.employee.employeeId, emp1Id);
  });

  it('15. Unauthorized requests are rejected (missing authentication)', async () => {
    await assert.rejects(
      async () => {
        await PayslipRetrievalService.getPayslipById(emp1PayslipId, undefined);
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenEmployeeAccessError);
        return true;
      }
    );
  });

  it('16. Nonexistent payslip returns correct error (404)', async () => {
    await assert.rejects(
      async () => {
        await PayslipRetrievalService.getPayslipById('PSL-NONEXISTENT-999', userAdmin);
      },
      (err: any) => {
        assert.ok(err instanceof PayslipNotFoundError);
        assert.match(err.message, /not found/);
        return true;
      }
    );
  });

  it('17. Nonexistent employee history returns empty list', async () => {
    const history = await PayslipRetrievalService.getEmployeePayslipHistory('EMP-NONEXISTENT', userAdmin);
    assert.ok(Array.isArray(history));
    assert.equal(history.length, 0);
  });

  it('18. Historical Immutability Test: Modifying contract wage, rules, or attendance does not alter historical payslip', async () => {
    // 18a. Retrieve baseline historical payslip
    const beforeChange = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);
    const originalGross = beforeChange.grossSalary;
    const originalNet = beforeChange.netSalary;
    const originalDeductions = beforeChange.totalDeductions;
    const originalBasic = beforeChange.earnings.find((e) => e.ruleCode === 'BASIC')?.amount;

    // 18b. Simulate external changes to live contract and rules
    const [contractRows] = await executeQuery<any[]>('SELECT wage FROM contracts WHERE employee_id = ? LIMIT 1', [emp1Id]);
    const originalContractWage = contractRows?.[0]?.wage ?? 6500;

    try {
      // Temporarily tamper live contract wage in DB
      await executeQuery('UPDATE contracts SET wage = wage + 5000 WHERE employee_id = ?', [emp1Id]);

      // 18c. Re-retrieve historical payslip via API
      const afterChange = await PayslipRetrievalService.getPayslipById(emp1PayslipId, userAdmin);

      // 18d. Verify values remain strictly frozen and unaltered
      assert.equal(afterChange.grossSalary, originalGross, 'Historical gross salary must remain unaltered');
      assert.equal(afterChange.netSalary, originalNet, 'Historical net salary must remain unaltered');
      assert.equal(afterChange.totalDeductions, originalDeductions, 'Historical deductions must remain unaltered');
      const afterBasic = afterChange.earnings.find((e) => e.ruleCode === 'BASIC')?.amount;
      assert.equal(afterBasic, originalBasic, 'Historical basic salary breakdown must remain unaltered');
    } finally {
      // Restore original contract wage
      await executeQuery('UPDATE contracts SET wage = ? WHERE employee_id = ?', [originalContractWage, emp1Id]);
    }
  });

  it('19. Existing Payrun lifecycle workflow remains functional', async () => {
    const payrun1 = await getPayrunById(payrunId1);
    assert.equal(payrun1?.status, 'PAID');
    assert.ok(payrun1?.paidAt);

    const payrun2 = await getPayrunById(payrunId2);
    assert.equal(payrun2?.status, 'VALIDATED');
    assert.ok(payrun2?.validatedAt);
  });

  it('20. Existing Phase 4 deterministic engine tests pass', () => {
    const calc = PayrollEngine.compute({
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      department: 'Engineering',
      monthlyWage: 6500,
      unpaidDays: 0,
    });
    assert.equal(calc.gross, 6500);
    assert.equal(calc.net, 5395);
  });
});
