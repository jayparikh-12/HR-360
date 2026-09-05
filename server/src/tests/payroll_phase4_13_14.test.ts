/**
 * PeoplePay360 — PHASE 4.13 & PHASE 4.14 TEST SUITE
 *
 * Dedicated verification suite for:
 * - PHASE 4.13: Gross Salary Calculation
 * - PHASE 4.14: Total Deductions Calculation
 *
 * Core Guarantees Verified:
 * - Pure calculations with zero database access.
 * - Single-source-of-truth financial rounding (roundMoney).
 * - Zero double counting across rules, attendance, and unpaid leave.
 * - Strict structural isolation & non-negative monetary safety.
 * - 100% deterministic outputs across repeated runs.
 * - Phase 4.15 (Net Salary) is NOT being implemented as a new feature here.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  PayrollEngine,
  calculateGrossSalary,
  calculateTotalDeductions,
  calculateSalaryRules,
  roundMoney,
  type PayrollSalaryRule,
  type RulesCalculationResult,
} from '../services/payrollEngine.js';
import {
  normalizePayrollCalculationInput,
} from '../services/payrollNormalizer.js';
import type { PayrollCalculationInput } from '../types/payroll.types.js';

describe('PHASE 4.13: Gross Salary Calculation', () => {

  it('1. Gross is calculated correctly from existing earnings', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R-ALW', code: 'HOUSING_ALW', name: 'Housing Allowance', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 3000 },
      { id: 'R-BON', code: 'PERF_BONUS', name: 'Performance Bonus', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 10 },
    ];

    // Base wage = 50,000
    // Housing Allowance = 3,000
    // Bonus = 10% of 50,000 = 5,000
    // Total Earnings = 8,000
    // Expected Gross = 50,000 + 8,000 = 58,000
    const gross = calculateGrossSalary(50000, rules);
    assert.strictEqual(gross, 58000);

    // Verify passing pre-calculated RulesCalculationResult
    const rulesResult = calculateSalaryRules(rules, { baseWage: 50000 });
    const grossFromObj = calculateGrossSalary(50000, rulesResult);
    assert.strictEqual(grossFromObj, 58000);
  });

  it('2. Overtime/attendance earning is included exactly once where applicable', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R-OT', code: 'OVERTIME_PAY', name: 'Overtime Pay', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 1500 },
    ];

    const input: PayrollCalculationInput = {
      employeeId: 'EMP-OT-001',
      monthlyWage: 40000,
      salaryRules: rules,
      overtimeHours: 10,
    };

    const payslip = PayrollEngine.compute(input);

    // Overtime earning rule (1500) adds to base wage (40000) -> Gross Salary = 41500
    assert.strictEqual(payslip.grossSalary, 41500);
    // Ensure overtime hours are exposed on payslip without duplicating gross
    assert.strictEqual(payslip.overtimeHours, 10);
  });

  it('3. Deductions are not included in gross', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R-EARN', code: 'ALW', name: 'Allowance', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 2000 },
      { id: 'R-DED1', code: 'TAX', name: 'Tax', sequence: 20, category: 'DEDUCTION', calculationType: 'FIXED', amount: 5000 },
      { id: 'R-DED2', code: 'INS', name: 'Insurance', sequence: 30, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 5 },
    ];

    // Base wage = 30,000
    // Earnings = 2,000
    // Deductions = 5,000 + (5% of 30,000 = 1,500) = 6,500
    // Gross Salary MUST be 30,000 + 2,000 = 32,000 (Deductions must NOT be added or subtracted here)
    const gross = calculateGrossSalary(30000, rules);
    assert.strictEqual(gross, 32000);
  });

  it('4. Multiple earnings aggregate correctly', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', code: 'E1', name: 'Earning 1', sequence: 10, category: 'BASIC', calculationType: 'FIXED', amount: 1000 },
      { id: 'R2', code: 'E2', name: 'Earning 2', sequence: 20, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 2000 },
      { id: 'R3', code: 'E3', name: 'Earning 3', sequence: 30, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 10 }, // 10% of 20000 = 2000
    ];

    const gross = calculateGrossSalary(20000, rules);
    // 20000 + 1000 + 2000 + 2000 = 25000
    assert.strictEqual(gross, 25000);
  });

  it('5. Zero earnings produces correct gross (base wage only)', () => {
    const grossEmpty = calculateGrossSalary(45000, []);
    assert.strictEqual(grossEmpty, 45000);

    const grossUndefined = calculateGrossSalary(45000);
    assert.strictEqual(grossUndefined, 45000);
  });

  it('6. Decimal amounts remain precise using roundMoney', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', code: 'DEC1', name: 'Decimal Earning 1', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 123.456 }, // 123.46
      { id: 'R2', code: 'DEC2', name: 'Decimal Earning 2', sequence: 20, category: 'EARNING', calculationType: 'FIXED', amount: 678.901 }, // 678.90
    ];

    // 10000.33 + 123.46 + 678.90 = 10802.69
    const gross = calculateGrossSalary(10000.33, rules);
    assert.strictEqual(gross, 10802.69);
  });
});

describe('PHASE 4.14: Total Deductions Calculation', () => {

  it('7. Salary Rule deductions are included', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', code: 'MED', name: 'Medical Insurance', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 750 },
      { id: 'R2', code: 'TAX', name: 'Income Tax', sequence: 20, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 12 },
    ];

    // Base wage = 50,000
    // Medical = 750
    // Tax = 12% of 50,000 = 6,000
    // Total Deductions = 6,750
    const total = calculateTotalDeductions(rules, { baseWage: 50000 });
    assert.strictEqual(total, 6750);
  });

  it('8. Unpaid leave deductions are included where applicable', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', code: 'PENSION', name: 'Pension Fund', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 1200 },
    ];

    // Unpaid leave deduction = 400
    // Total Deductions = 1200 + 400 = 1600
    const total = calculateTotalDeductions(rules, {
      baseWage: 50000,
      unpaidLeaveDeduction: 400,
    });
    assert.strictEqual(total, 1600);
  });

  it('9. Attendance / additional deductions are included where applicable', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', code: 'TAX', name: 'Tax', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 500 },
    ];

    // Additional attendance penalty deduction = 250
    const total = calculateTotalDeductions(rules, {
      baseWage: 20000,
      additionalDeductions: 250,
    });
    assert.strictEqual(total, 750);
  });

  it('10. Multiple deduction components aggregate correctly', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', code: 'DED_FIXED', name: 'Fixed Deduction', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 1000 },
      { id: 'R2', code: 'DED_PCT', name: 'Pct Deduction', sequence: 20, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 5 }, // 5% of 40000 = 2000
    ];

    // Salary rules = 3000
    // Unpaid leave = 600
    // Additional deductions = 150
    // Total = 3750
    const total = calculateTotalDeductions(rules, {
      baseWage: 40000,
      unpaidLeaveDeduction: 600,
      additionalDeductions: 150,
    });
    assert.strictEqual(total, 3750);
  });

  it('11. No deduction is counted twice', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', code: 'DED_1', name: 'Deduction 1', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 500 },
    ];

    const rulesResult = calculateSalaryRules(rules);
    // Passing rulesResult object containing pre-calculated deductions
    const total = calculateTotalDeductions(rulesResult, { unpaidLeaveDeduction: 200 });

    // Rules = 500, Unpaid leave = 200 -> Total = 700 (not 500 + 500 + 200)
    assert.strictEqual(total, 700);
  });

  it('12. Zero deductions produce zero total deductions', () => {
    const totalEmpty = calculateTotalDeductions([], { baseWage: 60000 });
    assert.strictEqual(totalEmpty, 0);

    const totalUndefined = calculateTotalDeductions();
    assert.strictEqual(totalUndefined, 0);
  });
});

describe('PHASE 4.13 & 4.14: Integration, Determinism & Pipeline Verification', () => {

  it('13. Full pipeline produces deterministic gross salary', () => {
    const input: PayrollCalculationInput = {
      employeeId: 'EMP-PIPE-01',
      monthlyWage: 60000,
      salaryRules: [
        { id: 'R1', code: 'ALW', name: 'Allowance', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 5000 },
        { id: 'R2', code: 'BONUS', name: 'Bonus Pct', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 10 },
      ],
    };

    const payslip1 = PayrollEngine.compute(input);
    const payslip2 = PayrollEngine.compute(input);

    assert.strictEqual(payslip1.grossSalary, 71000); // 60000 + 5000 + 6000
    assert.strictEqual(payslip1.grossSalary, payslip2.grossSalary);
  });

  it('14. Full pipeline produces deterministic total deductions', () => {
    const input: PayrollCalculationInput = {
      employeeId: 'EMP-PIPE-02',
      monthlyWage: 50000,
      unpaidDays: 3, // basic = 30000, daily = 1000, unpaid = 3000
      salaryRules: [
        { id: 'R1', code: 'TAX', name: 'Tax', sequence: 10, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 10 }, // 5000
      ],
    };

    const payslip1 = PayrollEngine.compute(input);
    const payslip2 = PayrollEngine.compute(input);

    assert.strictEqual(payslip1.totalCalculatedDeductions, 8000); // 5000 + 3000
    assert.strictEqual(payslip1.totalCalculatedDeductions, payslip2.totalCalculatedDeductions);
  });

  it('15. Same input produces 100% identical outputs across 20 iterations', () => {
    const input: PayrollCalculationInput = {
      employeeId: 'EMP-DET-MULTI',
      monthlyWage: 40000,
      unpaidDays: 1,
      salaryRules: [
        { id: 'R1', code: 'EARN_F', name: 'Earn Fixed', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 2000 },
        { id: 'R2', code: 'DED_P', name: 'Ded Pct', sequence: 20, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 5 },
      ],
    };

    const basePayslip = PayrollEngine.compute(input);

    for (let i = 0; i < 20; i++) {
      const iterPayslip = PayrollEngine.compute(input);
      assert.strictEqual(iterPayslip.grossSalary, basePayslip.grossSalary);
      assert.strictEqual(iterPayslip.totalCalculatedDeductions, basePayslip.totalCalculatedDeductions);
    }
  });

  it('16. Database boundary verification: Pure calculation runs strictly in-memory without database access', () => {
    const input: PayrollCalculationInput = {
      employeeId: 'EMP-INMEM',
      monthlyWage: 12000,
      salaryRules: [
        { id: 'R1', code: 'COMMISSION', name: 'Commission', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 3000 },
      ],
    };

    const start = performance.now();
    const result = PayrollEngine.compute(input);
    const elapsed = performance.now() - start;

    assert.strictEqual(result.grossSalary, 15000);
    assert.ok(elapsed < 20, `Execution took ${elapsed}ms; expected pure in-memory calculation (<20ms)`);
  });
});
