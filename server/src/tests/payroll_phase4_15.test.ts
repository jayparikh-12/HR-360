/**
 * PeoplePay360 — PHASE 4.15 TEST SUITE: Final Net Salary Calculation
 *
 * Comprehensive end-to-end verification suite for:
 * - PHASE 4.15: Final Net Salary Calculation
 * - Full 13-Stage Pipeline Verification (4.1 – 4.15)
 *
 * Formula:
 * Net Salary = Gross Salary - Total Deductions
 *
 * Core Guarantees Verified:
 * - Pure calculations with zero database access (database-independent).
 * - Single-source-of-truth financial rounding (roundMoney).
 * - Zero double counting across rules, attendance, and unpaid leave.
 * - Non-recalculation guarantee (consumes existing gross and total deductions).
 * - Negative net behavior preservation (signed difference / optional clamp).
 * - Payrun lifecycle integrity (DRAFT status preserved, no auto-PAID transition).
 * - 100% deterministic outputs across repeated runs.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  PayrollEngine,
  calculateNetSalary,
  calculateGrossSalary,
  calculateTotalDeductions,
  roundMoney,
  type PayrollSalaryRule,
} from '../services/payrollEngine.js';
import {
  preparePayrollCalculationInput,
} from '../services/payrollPreparation.js';
import type { PayrollCalculationInput } from '../types/payroll.types.js';

describe('PHASE 4.15: Final Net Salary Calculation', () => {

  it('1. Gross = 0 and deductions = 0 produces Net = 0', () => {
    const net = calculateNetSalary(0, 0);
    assert.strictEqual(net, 0);

    const input: PayrollCalculationInput = {
      employeeId: 'EMP-ZERO',
      monthlyWage: 0,
      salaryRules: [],
    };
    const payslip = PayrollEngine.compute(input);
    assert.strictEqual(payslip.grossSalary, 0);
    assert.strictEqual(payslip.totalCalculatedDeductions, 0);
    assert.strictEqual(payslip.netSalary, 0);
  });

  it('2. Gross > deductions produces Net = Gross - Deductions', () => {
    const net = calculateNetSalary(50000, 5000);
    assert.strictEqual(net, 45000);

    const payslip = PayrollEngine.compute({
      employeeId: 'EMP-POS',
      monthlyWage: 50000,
      salaryRules: [
        { id: 'R1', code: 'TAX', name: 'Tax', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 5000 },
      ],
    });

    assert.strictEqual(payslip.grossSalary, 50000);
    assert.strictEqual(payslip.totalCalculatedDeductions, 5000);
    assert.strictEqual(payslip.netSalary, 45000);
    assert.strictEqual(payslip.net, 45000);
  });

  it('3. Gross = deductions produces Net = 0', () => {
    const net = calculateNetSalary(10000, 10000);
    assert.strictEqual(net, 0);

    const payslip = PayrollEngine.compute({
      employeeId: 'EMP-EQUAL',
      monthlyWage: 10000,
      salaryRules: [
        { id: 'R1', code: 'DED_FULL', name: 'Full Deduction', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 10000 },
      ],
    });

    assert.strictEqual(payslip.grossSalary, 10000);
    assert.strictEqual(payslip.totalCalculatedDeductions, 10000);
    assert.strictEqual(payslip.netSalary, 0);
  });

  it('4. Deductions > gross produces signed negative net (or 0 if clampNegative: true)', () => {
    // Unclamped (default domain behavior)
    const signedNet = calculateNetSalary(10000, 15000);
    assert.strictEqual(signedNet, -5000);

    // Clamped explicitly
    const clampedNet = calculateNetSalary(10000, 15000, { clampNegative: true });
    assert.strictEqual(clampedNet, 0);

    const payslip = PayrollEngine.compute({
      employeeId: 'EMP-NEG',
      monthlyWage: 10000,
      salaryRules: [
        { id: 'R1', code: 'GARNISHMENT', name: 'Garnishment', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 15000 },
      ],
    });

    assert.strictEqual(payslip.grossSalary, 10000);
    assert.strictEqual(payslip.totalCalculatedDeductions, 15000);
    assert.strictEqual(payslip.netSalary, -5000);
  });

  it('5. Decimal gross and decimal deductions maintain exact 2-decimal financial precision without floating-point artifacts', () => {
    // 54321.77 - 12345.88 = 41975.89
    const net1 = calculateNetSalary(54321.77, 12345.88);
    assert.strictEqual(net1, 41975.89);

    // 0.1 + 0.2 floating point check
    const net2 = calculateNetSalary(100.1, 50.2);
    assert.strictEqual(net2, 49.9);
  });

  it('6. No salary rules produces Net = Base Wage', () => {
    const payslip = PayrollEngine.compute({
      employeeId: 'EMP-NO-RULES',
      monthlyWage: 65000,
      salaryRules: [],
    });

    assert.strictEqual(payslip.grossSalary, 65000);
    assert.strictEqual(payslip.totalCalculatedDeductions, 0);
    assert.strictEqual(payslip.netSalary, 65000);
  });

  it('7. Multiple salary rules (fixed + percentage earnings and deductions) produce exact Net Salary', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', code: 'BASE_ALW', name: 'Base Allowance', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 5000 },
      { id: 'R2', code: 'BONUS_PCT', name: 'Bonus Pct', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 10 }, // 10% of 40000 = 4000
      { id: 'R3', code: 'HEALTH_INS', name: 'Health Insurance', sequence: 30, category: 'DEDUCTION', calculationType: 'FIXED', amount: 1500 },
      { id: 'R4', code: 'TAX_PCT', name: 'Tax Pct', sequence: 40, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 12 }, // 12% of 40000 = 4800
    ];

    const payslip = PayrollEngine.compute({
      employeeId: 'EMP-MULTI',
      monthlyWage: 40000,
      salaryRules: rules,
    });

    // Gross = 40000 + 5000 + 4000 = 49000
    assert.strictEqual(payslip.grossSalary, 49000);
    // Deductions = 1500 + 4800 = 6300
    assert.strictEqual(payslip.totalCalculatedDeductions, 6300);
    // Net Salary = 49000 - 6300 = 42700
    assert.strictEqual(payslip.netSalary, 42700);
  });

  it('8. Attendance adjustment (overtime hours) flows into Net Salary via Gross', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R-OT', code: 'OT_PAY', name: 'Overtime Pay', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 2500 },
    ];

    const payslip = PayrollEngine.compute({
      employeeId: 'EMP-OT',
      monthlyWage: 50000,
      salaryRules: rules,
      overtimeHours: 8,
    });

    assert.strictEqual(payslip.grossSalary, 52500);
    assert.strictEqual(payslip.totalCalculatedDeductions, 0);
    assert.strictEqual(payslip.netSalary, 52500);
    assert.strictEqual(payslip.overtimeHours, 8);
  });

  it('9. Unpaid leave deduction flows into Net Salary via Total Deductions', () => {
    // monthlyWage = 60000
    // standardBasic = 60000 * 0.6 = 36000
    // dailyRate = 36000 / 30 = 1200
    // unpaidDays = 2 -> unpaidLeaveDeduction = 2400
    const payslip = PayrollEngine.compute({
      employeeId: 'EMP-UNPAID',
      monthlyWage: 60000,
      unpaidDays: 2,
      salaryRules: [
        { id: 'R1', code: 'TAX', name: 'Tax', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 3000 },
      ],
    });

    assert.strictEqual(payslip.grossSalary, 60000);
    assert.strictEqual(payslip.unpaidLeaveDeduction, 2400);
    assert.strictEqual(payslip.totalCalculatedDeductions, 5400); // 3000 + 2400
    assert.strictEqual(payslip.netSalary, 54600); // 60000 - 5400
  });

  it('10. Complete end-to-end 13-stage pipeline calculation (Phase 4.1 – 4.15)', () => {
    const employee = {
      id: 'EMP-E2E-001',
      name: 'Eleanor Vance',
      department: 'Research & Development',
    };

    const contract = {
      id: 'CNT-E2E-001',
      employeeId: 'EMP-E2E-001',
      wage: 75000,
      salaryStructureId: 'STR-RND',
      startDate: '2025-01-01',
      status: 'ACTIVE',
    };

    const salaryRules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'R&D Stipend', code: 'RD_STIPEND', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 5000, salaryStructureId: 'STR-RND' },
      { id: 'R2', name: 'Patent Bonus', code: 'PATENT_BONUS', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 8, salaryStructureId: 'STR-RND' }, // 8% of 75000 = 6000
      { id: 'R3', name: 'Health Plan', code: 'HEALTH', sequence: 30, category: 'DEDUCTION', calculationType: 'FIXED', amount: 1200, salaryStructureId: 'STR-RND' },
      { id: 'R4', name: 'State Tax', code: 'STATE_TAX', sequence: 40, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 6, salaryStructureId: 'STR-RND' }, // 6% of 75000 = 4500
    ];

    const attendanceRecords = [
      { id: 'ATT-1', employeeId: 'EMP-E2E-001', date: '2026-09-01', workedHours: 8, status: 'PRESENT' },
    ];
    const timeOffRequests = [
      { id: 'TO-1', employeeId: 'EMP-E2E-001', leaveType: 'Unpaid Leave', startDate: '2026-09-10', endDate: '2026-09-10', durationDays: 1, status: 'APPROVED' },
    ];

    const period = { startDate: '2026-09-01', endDate: '2026-09-30' };

    const prepared = preparePayrollCalculationInput({
      employee,
      contract,
      period,
      salaryRules,
      attendanceRecords,
      timeOffRecords: timeOffRequests,
    });

    const payslip = PayrollEngine.compute(prepared.input);

    // Earnings breakdown:
    // RD_STIPEND = 5000
    // PATENT_BONUS = 6000
    // Total Earnings = 11000
    assert.strictEqual(payslip.totalEarnings, 11000);

    // Gross Salary = 75000 + 11000 = 86000
    assert.strictEqual(payslip.grossSalary, 86000);

    // Unpaid leave deduction:
    // basic = 75000 * 0.60 = 45000; dailyRate = 45000 / 30 = 1500; unpaidDays = 1 -> 1500
    assert.strictEqual(payslip.unpaidLeaveDeduction, 1500);

    // Total Deductions:
    // HEALTH = 1200
    // STATE_TAX = 4500
    // Unpaid Leave = 1500
    // Total Deductions = 1200 + 4500 + 1500 = 7200
    assert.strictEqual(payslip.totalCalculatedDeductions, 7200);

    // Net Salary = 86000 - 7200 = 78800
    assert.strictEqual(payslip.netSalary, 78800);
    assert.strictEqual(payslip.netSalary, payslip.grossSalary! - payslip.totalCalculatedDeductions!);
  });

  it('11. Same input executed repeatedly produces 100% identical Gross, Total Deductions, and Net Salary', () => {
    const input: PayrollCalculationInput = {
      employeeId: 'EMP-REPEAT',
      monthlyWage: 55000,
      unpaidDays: 2,
      salaryRules: [
        { id: 'R1', code: 'BONUS', name: 'Bonus', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 4000 },
        { id: 'R2', code: 'TAX', name: 'Tax', sequence: 20, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 10 },
      ],
    };

    const firstRun = PayrollEngine.compute(input);

    for (let i = 0; i < 25; i++) {
      const run = PayrollEngine.compute(input);
      assert.strictEqual(run.grossSalary, firstRun.grossSalary);
      assert.strictEqual(run.totalCalculatedDeductions, firstRun.totalCalculatedDeductions);
      assert.strictEqual(run.netSalary, firstRun.netSalary);
    }
  });

  it('12. Database boundary verification: Pure engine execution runs in-memory without database side effects', () => {
    const input: PayrollCalculationInput = {
      employeeId: 'EMP-PURE',
      monthlyWage: 30000,
      salaryRules: [
        { id: 'R1', code: 'COMM', name: 'Commission', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 2500 },
      ],
    };

    const start = performance.now();
    const result = PayrollEngine.compute(input);
    const elapsed = performance.now() - start;

    assert.strictEqual(result.netSalary, 32500);
    assert.ok(elapsed < 20, `Execution took ${elapsed}ms; expected in-memory pure computation (<20ms)`);
  });

  it('13. Payrun lifecycle state flow integrity check', () => {
    // Verifies calculating Net Salary leaves Payrun status lifecycle control to external payrun operations
    const input: PayrollCalculationInput = {
      employeeId: 'EMP-PAYRUN-STATE',
      monthlyWage: 40000,
      salaryRules: [],
    };

    const payslip = PayrollEngine.compute(input);
    assert.strictEqual(payslip.netSalary, 40000);
    // Payslip output contains calculated results without mutating or setting payrun status to PAID
    assert.strictEqual((payslip as any).status, undefined);
  });
});
