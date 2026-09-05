import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  PayrollEngine,
  orderSalaryRules,
  calculateFixedRules,
  calculatePercentageRules,
  calculateSalaryRules,
  calculateRulePercentageAmount,
  calculateGrossSalary,
  calculateTotalDeductions,
  calculateNetSalary,
  type CalculateNetSalaryOptions,
  summarizeAttendance,
  summarizeTimeOff,
  calculateDateOverlapDays,
  isUnpaidLeaveType,
  roundMoney,
  classifyRuleCategory,
  type PayrollSalaryRule,
  type AttendanceRecordInput,
  type TimeOffRecordInput,
  type PayrollPeriod,
} from './payrollEngine.js';
import { preparePayrollCalculationInput } from './payrollPreparation.js';

describe('PHASE 4.6: Deterministic Salary Rule Ordering', () => {
  it('1. sorts rules strictly by configured sequence (ASC)', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'RUL-03', name: 'Allowance', code: 'ALLOWANCE', sequence: 30, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 1000 },
      { id: 'RUL-01', name: 'Basic', code: 'BASIC', sequence: 10, category: 'BASIC', calculationType: 'FIXED', amount: 5000 },
      { id: 'RUL-02', name: 'HRA', code: 'HRA', sequence: 20, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 2500 },
    ];

    const ordered = orderSalaryRules(rules);

    assert.strictEqual(ordered.length, 3);
    assert.strictEqual(ordered[0].code, 'BASIC');
    assert.strictEqual(ordered[1].code, 'HRA');
    assert.strictEqual(ordered[2].code, 'ALLOWANCE');
  });

  it('2. provides deterministic secondary ordering (id ASC) when sequence values are equal', () => {
    const ruleA: PayrollSalaryRule = {
      id: 'RUL-001',
      name: 'Rule Alpha',
      code: 'ALPHA',
      sequence: 20,
      category: 'EARNING',
      calculationType: 'FIXED',
      amount: 100,
    };
    const ruleB: PayrollSalaryRule = {
      id: 'RUL-002',
      name: 'Rule Beta',
      code: 'BETA',
      sequence: 20,
      category: 'EARNING',
      calculationType: 'FIXED',
      amount: 200,
    };

    // Pass in reverse order
    const ordered1 = orderSalaryRules([ruleB, ruleA]);
    assert.strictEqual(ordered1[0].id, 'RUL-001');
    assert.strictEqual(ordered1[1].id, 'RUL-002');

    // Pass in normal order
    const ordered2 = orderSalaryRules([ruleA, ruleB]);
    assert.strictEqual(ordered2[0].id, 'RUL-001');
    assert.strictEqual(ordered2[1].id, 'RUL-002');

    // Tertiary tie-breaker by code if IDs were equal
    const ruleSameId1 = { ...ruleA, code: 'ZZZ' };
    const ruleSameId2 = { ...ruleA, code: 'AAA' };
    const orderedTie = orderSalaryRules([ruleSameId1, ruleSameId2]);
    assert.strictEqual(orderedTie[0].code, 'AAA');
    assert.strictEqual(orderedTie[1].code, 'ZZZ');
  });

  it('5. filters out rules belonging to other salary structures (structure isolation)', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'RUL-S1', name: 'Structure 1 Rule', code: 'S1_RULE', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 5000, structureId: 'STR-001' },
      { id: 'RUL-S2', name: 'Structure 2 Rule', code: 'S2_RULE', sequence: 20, category: 'EARNING', calculationType: 'FIXED', amount: 9000, structureId: 'STR-002' },
      { id: 'RUL-S3', name: 'Structure 1 Deduction', code: 'S1_DED', sequence: 30, category: 'DEDUCTION', calculationType: 'FIXED', amount: 300, structure_id: 'STR-001' },
    ];

    const targetStructure = 'STR-001';
    const ordered = orderSalaryRules(rules, targetStructure);

    assert.strictEqual(ordered.length, 2);
    assert.strictEqual(ordered[0].id, 'RUL-S1');
    assert.strictEqual(ordered[1].id, 'RUL-S3');
    assert.strictEqual(ordered.some((r) => r.id === 'RUL-S2'), false);
  });

  it('filters out inactive or disabled rules according to model status', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'RUL-01', name: 'Active Rule', code: 'ACT', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 1000, status: 'ACTIVE' },
      { id: 'RUL-02', name: 'Inactive Status Rule', code: 'INACT', sequence: 20, category: 'EARNING', calculationType: 'FIXED', amount: 2000, status: 'INACTIVE' },
      { id: 'RUL-03', name: 'Explicit false flag Rule', code: 'FLAG_INACT', sequence: 30, category: 'EARNING', calculationType: 'FIXED', amount: 3000, isActive: false },
      { id: 'RUL-04', name: 'Default Rule', code: 'DEF', sequence: 40, category: 'EARNING', calculationType: 'FIXED', amount: 4000 },
    ];

    const ordered = orderSalaryRules(rules);

    assert.strictEqual(ordered.length, 2);
    assert.strictEqual(ordered[0].id, 'RUL-01');
    assert.strictEqual(ordered[1].id, 'RUL-04');
  });

  it('never mutates the input array', () => {
    const original: PayrollSalaryRule[] = [
      { id: 'RUL-B', name: 'B', code: 'B', sequence: 50, category: 'EARNING', calculationType: 'FIXED', amount: 100 },
      { id: 'RUL-A', name: 'A', code: 'A', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 100 },
    ];
    const copy = [...original];

    orderSalaryRules(original);

    assert.strictEqual(original[0].id, copy[0].id);
    assert.strictEqual(original[1].id, copy[1].id);
  });
});

describe('PHASE 4.7: Fixed Amount Salary Rules Calculation', () => {
  it('3. calculates FIXED + EARNING correctly', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'RUL-01', name: 'Base Fixed Pay', code: 'BASE_FIX', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 5000 },
    ];

    const result = calculateFixedRules(rules);

    assert.strictEqual(result.earnings, 5000);
    assert.strictEqual(result.deductions, 0);
    assert.strictEqual(result.contributions.length, 1);
    assert.strictEqual(result.contributions[0].amount, 5000);
    assert.strictEqual(result.contributions[0].categoryType, 'EARNING');
  });

  it('4. calculates FIXED + DEDUCTION correctly', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'RUL-D1', name: 'Fixed Health Deduction', code: 'HEALTH_DED', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 450 },
    ];

    const result = calculateFixedRules(rules);

    assert.strictEqual(result.earnings, 0);
    assert.strictEqual(result.deductions, 450);
    assert.strictEqual(result.contributions.length, 1);
    assert.strictEqual(result.contributions[0].amount, 450);
    assert.strictEqual(result.contributions[0].categoryType, 'DEDUCTION');
  });

  it('6. handles zero fixed amount correctly without side effects', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'RUL-Z1', name: 'Zero Earning', code: 'ZERO_EARN', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 0 },
      { id: 'RUL-Z2', name: 'Zero Deduction', code: 'ZERO_DED', sequence: 20, category: 'DEDUCTION', calculationType: 'FIXED', amount: 0 },
    ];

    const result = calculateFixedRules(rules);

    assert.strictEqual(result.earnings, 0);
    assert.strictEqual(result.deductions, 0);
    assert.strictEqual(result.contributions.length, 2);
    assert.strictEqual(result.contributions[0].amount, 0);
    assert.strictEqual(result.contributions[1].amount, 0);
  });

  it('7. handles negative fixed amounts according to domain validation rules', () => {
    const invalidRule: PayrollSalaryRule = {
      id: 'RUL-NEG',
      name: 'Negative Deduction',
      code: 'NEG_DED',
      sequence: 10,
      category: 'DEDUCTION',
      calculationType: 'FIXED',
      amount: -250,
    };

    // By default, strict domain validation rejects negative amounts with an explicit error
    assert.throws(
      () => calculateFixedRules([invalidRule]),
      /amount must be a non-negative number/i
    );

    // With clampNegative enabled, it safely clamps to 0 without mutating totals
    const clampedResult = calculateFixedRules([invalidRule], { clampNegative: true });
    assert.strictEqual(clampedResult.deductions, 0);
    assert.strictEqual(clampedResult.earnings, 0);
  });

  it('8. respects money precision and rounding on decimal amounts', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'RUL-DEC1', name: 'Earning 1', code: 'E1', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 150.255 },
      { id: 'RUL-DEC2', name: 'Earning 2', code: 'E2', sequence: 20, category: 'EARNING', calculationType: 'FIXED', amount: 250.504 },
      { id: 'RUL-DEC3', name: 'Floating Jitter Check', code: 'E3', sequence: 30, category: 'EARNING', calculationType: 'FIXED', amount: 5000.000000000001 },
    ];

    const result = calculateFixedRules(rules);

    // 150.255 rounds to 150.26, 250.504 rounds to 250.50, 5000.000000000001 rounds to 5000.00
    assert.strictEqual(result.contributions[0].amount, 150.26);
    assert.strictEqual(result.contributions[1].amount, 250.50);
    assert.strictEqual(result.contributions[2].amount, 5000.00);
    assert.strictEqual(result.earnings, 5400.76);
  });

  it('9. calculates and accumulates multiple fixed rules deterministically matching the prompt example', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'RUL-03', name: 'Rule 3', code: 'RUL_3', sequence: 30, category: 'DEDUCTION', calculationType: 'FIXED', amount: 500 },
      { id: 'RUL-01', name: 'Rule 1', code: 'RUL_1', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 5000 },
      { id: 'RUL-02', name: 'Rule 2', code: 'RUL_2', sequence: 20, category: 'EARNING', calculationType: 'FIXED', amount: 2500 },
    ];

    const result = calculateFixedRules(rules);

    assert.strictEqual(result.earnings, 7500);
    assert.strictEqual(result.deductions, 500);
    assert.strictEqual(result.contributions.length, 3);
    assert.strictEqual(result.contributions[0].ruleCode, 'RUL_1');
    assert.strictEqual(result.contributions[1].ruleCode, 'RUL_2');
    assert.strictEqual(result.contributions[2].ruleCode, 'RUL_3');
  });

  it('ignores non-FIXED calculation types (PERCENTAGE, FORMULA) in calculateFixedRules', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'RUL-FIX', name: 'Fixed Component', code: 'FIX', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 3000 },
      { id: 'RUL-PCT', name: 'Percentage Component', code: 'PCT', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 10 },
      { id: 'RUL-FOR', name: 'Formula Component', code: 'FOR', sequence: 30, category: 'NET', calculationType: 'FORMULA', formula: 'GROSS - DEDUCTION' },
    ];

    const result = calculateFixedRules(rules);

    // Only the FIXED rule should produce a contribution in calculateFixedRules
    assert.strictEqual(result.earnings, 3000);
    assert.strictEqual(result.deductions, 0);
    assert.strictEqual(result.contributions.length, 1);
    assert.strictEqual(result.contributions[0].ruleCode, 'FIX');
  });

  it('10. handles empty rule list gracefully producing a valid zero result', () => {
    const result = calculateFixedRules([]);

    assert.strictEqual(result.earnings, 0);
    assert.strictEqual(result.deductions, 0);
    assert.deepStrictEqual(result.contributions, []);
    assert.deepStrictEqual(result.orderedRules, []);
  });

  it('11. produces exactly identical results and ordering across repeated runs (pure determinism)', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'RUL-D', name: 'D', code: 'D', sequence: 40, category: 'DEDUCTION', calculationType: 'FIXED', amount: 150 },
      { id: 'RUL-B', name: 'B', code: 'B', sequence: 20, category: 'EARNING', calculationType: 'FIXED', amount: 2000 },
      { id: 'RUL-A', name: 'A', code: 'A', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 3000 },
      { id: 'RUL-C', name: 'C', code: 'C', sequence: 30, category: 'EARNING', calculationType: 'FIXED', amount: 500 },
    ];

    const firstRun = calculateFixedRules(rules);

    for (let i = 0; i < 20; i++) {
      const shuffled = [...rules].sort(() => Math.random() - 0.5);
      const subsequentRun = calculateFixedRules(shuffled);
      assert.deepStrictEqual(subsequentRun, firstRun);
    }
  });

  it('maps MySQL schema categories (BASIC, ALLOWANCE, DEDUCTION) correctly', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Basic Fixed', code: 'BSC', sequence: 1, category: 'BASIC', calculationType: 'FIXED', amount: 4000 },
      { id: 'R2', name: 'Special Allowance', code: 'ALW', sequence: 2, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 1200 },
      { id: 'R3', name: 'Provident Fund', code: 'PF', sequence: 3, category: 'DEDUCTION', calculationType: 'FIXED', amount: 600 },
    ];

    const result = calculateFixedRules(rules);

    assert.strictEqual(result.earnings, 5200);
    assert.strictEqual(result.deductions, 600);
    assert.strictEqual(result.byCategory['BASIC'], 4000);
    assert.strictEqual(result.byCategory['ALLOWANCE'], 1200);
    assert.strictEqual(result.byCategory['DEDUCTION'], 600);
  });
});

describe('PHASE 4.8: Percentage-Based Salary Rule Calculation', () => {
  it('1. calculates a valid percentage rule correctly (e.g. Base=10000, Pct=10 -> 1000)', () => {
    const amount = calculateRulePercentageAmount(10000, 10);
    assert.strictEqual(amount, 1000);

    const rules: PayrollSalaryRule[] = [
      { id: 'RUL-PCT1', name: 'Test Percent', code: 'PCT_1', sequence: 10, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 10 },
    ];
    const result = calculatePercentageRules(rules, { baseWage: 10000 });

    assert.strictEqual(result.earnings, 1000);
    assert.strictEqual(result.percentageEarnings, 1000);
    assert.strictEqual(result.deductions, 0);
    assert.strictEqual(result.contributions.length, 1);
    assert.strictEqual(result.contributions[0].amount, 1000);
    assert.strictEqual(result.contributions[0].percentage, 10);
    assert.strictEqual(result.contributions[0].base, 10000);
  });

  it('2. calculates decimal percentages correctly (e.g. Base=8500, Pct=12.5 -> 1062.50)', () => {
    const amount = calculateRulePercentageAmount(8500, 12.5);
    assert.strictEqual(amount, 1062.5);

    const rules: PayrollSalaryRule[] = [
      { id: 'RUL-DEC', name: 'Decimal Pct', code: 'DEC_PCT', sequence: 10, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 12.5 },
    ];
    const result = calculatePercentageRules(rules, { baseWage: 8500 });

    assert.strictEqual(result.earnings, 1062.5);
    assert.strictEqual(result.contributions[0].amount, 1062.5);
  });

  it('3. produces zero deterministic result when percentage is 0', () => {
    const amount = calculateRulePercentageAmount(10000, 0);
    assert.strictEqual(amount, 0);

    const rules: PayrollSalaryRule[] = [
      { id: 'RUL-ZPCT', name: 'Zero Percent', code: 'ZERO_PCT', sequence: 10, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 0 },
    ];
    const result = calculatePercentageRules(rules, { baseWage: 10000 });

    assert.strictEqual(result.earnings, 0);
    assert.strictEqual(result.contributions[0].amount, 0);
  });

  it('4. calculates percentage earning rules correctly (adds to earnings)', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R-BSC', name: 'Basic 60%', code: 'BASIC', sequence: 1, category: 'BASIC', calculationType: 'PERCENTAGE', percentage: 60 },
      { id: 'R-HRA', name: 'HRA 25%', code: 'HRA', sequence: 2, category: 'ALLOWANCE', calculationType: 'PERCENTAGE', percentage: 25 },
    ];
    const result = calculatePercentageRules(rules, { baseWage: 10000 });

    assert.strictEqual(result.earnings, 8500); // 6000 + 2500
    assert.strictEqual(result.deductions, 0);
    assert.strictEqual(result.byCategory['BASIC'], 6000);
    assert.strictEqual(result.byCategory['ALLOWANCE'], 2500);
  });

  it('5. calculates percentage deduction rules correctly (adds to deductions)', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R-TAX', name: 'Income Tax 10%', code: 'TAX', sequence: 4, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 10 },
      { id: 'R-PF', name: 'Provident Fund 7%', code: 'PF', sequence: 5, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 7 },
    ];
    const result = calculatePercentageRules(rules, { baseWage: 10000 });

    assert.strictEqual(result.earnings, 0);
    assert.strictEqual(result.deductions, 1700); // 1000 + 700
    assert.strictEqual(result.percentageDeductions, 1700);
    assert.strictEqual(result.byCategory['DEDUCTION'], 1700);
  });

  it('6. respects deterministic sequence ordering for percentage rules', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R-3', name: 'Rule 3', code: 'R3', sequence: 30, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 5 },
      { id: 'R-1', name: 'Rule 1', code: 'R1', sequence: 10, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 50 },
      { id: 'R-2', name: 'Rule 2', code: 'R2', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 20 },
    ];
    const result = calculatePercentageRules(rules, { baseWage: 10000 });

    assert.strictEqual(result.contributions[0].ruleCode, 'R1');
    assert.strictEqual(result.contributions[1].ruleCode, 'R2');
    assert.strictEqual(result.contributions[2].ruleCode, 'R3');
  });

  it('7. maintains deterministic secondary ordering (id ASC) for equal sequences in percentage rules', () => {
    const ruleA: PayrollSalaryRule = { id: 'RUL-001', name: 'A', code: 'A', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 5 };
    const ruleB: PayrollSalaryRule = { id: 'RUL-002', name: 'B', code: 'B', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 5 };

    const result = calculatePercentageRules([ruleB, ruleA], { baseWage: 10000 });

    assert.strictEqual(result.contributions[0].ruleId, 'RUL-001');
    assert.strictEqual(result.contributions[1].ruleId, 'RUL-002');
  });

  it('8. excludes percentage rules from another Salary Structure (structure isolation)', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Structure 1 Rule', code: 'R1', sequence: 10, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 10, structureId: 'STR-001' },
      { id: 'R2', name: 'Structure 2 Rule', code: 'R2', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 15, structureId: 'STR-002' },
    ];
    const result = calculatePercentageRules(rules, { salaryStructureId: 'STR-001', baseWage: 10000 });

    assert.strictEqual(result.contributions.length, 1);
    assert.strictEqual(result.contributions[0].ruleId, 'R1');
    assert.strictEqual(result.earnings, 1000);
  });

  it('9. ensures fixed rules continue to work alongside percentage rules in calculateSalaryRules', () => {
    const fixedOnly: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Fixed Basic', code: 'BSC_F', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 5000 },
    ];
    const result = calculateSalaryRules(fixedOnly, { baseWage: 10000 });

    assert.strictEqual(result.earnings, 5000);
    assert.strictEqual(result.fixedEarnings, 5000);
    assert.strictEqual(result.percentageEarnings, 0);
  });

  it('10. calculates mixed FIXED + PERCENTAGE rules together in deterministic sequence matching Step 7', () => {
    // Step 7 conceptual example:
    // Rule A: sequence = 10, type = FIXED, amount = 5000 (EARNING)
    // Rule B: sequence = 20, type = PERCENTAGE, percentage = 10 (EARNING, base = 10000 -> 1000)
    // Rule C: sequence = 30, type = FIXED, amount = 500 (DEDUCTION)
    const mixedRules: PayrollSalaryRule[] = [
      { id: 'RC', name: 'Rule C', code: 'R_C', sequence: 30, category: 'DEDUCTION', calculationType: 'FIXED', amount: 500 },
      { id: 'RA', name: 'Rule A', code: 'R_A', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 5000 },
      { id: 'RB', name: 'Rule B', code: 'R_B', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 10 },
    ];

    const result = calculateSalaryRules(mixedRules, { baseWage: 10000 });

    assert.strictEqual(result.earnings, 6000); // 5000 (fixed) + 1000 (10% of 10000)
    assert.strictEqual(result.deductions, 500); // 500 (fixed)
    assert.strictEqual(result.fixedEarnings, 5000);
    assert.strictEqual(result.percentageEarnings, 1000);
    assert.strictEqual(result.fixedDeductions, 500);
    assert.strictEqual(result.percentageDeductions, 0);

    // Verification of sequential order
    assert.strictEqual(result.contributions.length, 3);
    assert.strictEqual(result.contributions[0].ruleCode, 'R_A');
    assert.strictEqual(result.contributions[1].ruleCode, 'R_B');
    assert.strictEqual(result.contributions[2].ruleCode, 'R_C');
  });

  it('11. produces exactly the same result on repeated calculations (pure determinism)', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Basic', code: 'BSC', sequence: 10, category: 'BASIC', calculationType: 'PERCENTAGE', percentage: 50 },
      { id: 'R2', name: 'Bonus', code: 'BON', sequence: 20, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 1500 },
      { id: 'R3', name: 'Tax', code: 'TAX', sequence: 30, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 10 },
      { id: 'R4', name: 'Insurance', code: 'INS', sequence: 40, category: 'DEDUCTION', calculationType: 'FIXED', amount: 350 },
    ];

    const firstRun = calculateSalaryRules(rules, { baseWage: 8000 });

    for (let i = 0; i < 20; i++) {
      const shuffled = [...rules].sort(() => Math.random() - 0.5);
      const subsequentRun = calculateSalaryRules(shuffled, { baseWage: 8000 });
      assert.deepStrictEqual(subsequentRun, firstRun);
    }
  });

  it('12. ensures money precision is consistent without floating point jitter', () => {
    // 10% of 8500 = 850.00
    const amt1 = calculateRulePercentageAmount(8500, 10);
    assert.strictEqual(amt1, 850.00);

    // 12.5% of 8500 = 1062.50
    const amt2 = calculateRulePercentageAmount(8500, 12.5);
    assert.strictEqual(amt2, 1062.50);

    // 7% of 1000 = 70.00 (not 70.00000000000001)
    const amt3 = calculateRulePercentageAmount(1000, 7);
    assert.strictEqual(amt3, 70);

    // 33.33% of 3333.33 = 1110.998889 -> rounds to 1111.00
    const amt4 = calculateRulePercentageAmount(3333.33, 33.33);
    assert.strictEqual(amt4, 1111.00);
  });

  it('13. safely handles invalid percentage values according to domain validation rules', () => {
    // Negative percentage throws domain error by default
    assert.throws(
      () => calculateRulePercentageAmount(10000, -5),
      /percentage must be between 0 and 100/i
    );

    // Percentage > 100 throws domain error
    assert.throws(
      () => calculateRulePercentageAmount(10000, 105),
      /percentage must be between 0 and 100/i
    );

    // With clampNegative, negative percentage safely returns 0
    const clampedAmt = calculateRulePercentageAmount(10000, -5, { clampNegative: true });
    assert.strictEqual(clampedAmt, 0);

    // Negative base safely yields 0 contribution
    const negBaseAmt = calculateRulePercentageAmount(-5000, 10);
    assert.strictEqual(negBaseAmt, 0);

    // Missing percentage throws descriptive error
    const invalidRule: PayrollSalaryRule = {
      id: 'R-NOPCT',
      name: 'Missing Percentage',
      code: 'NO_PCT',
      sequence: 10,
      category: 'EARNING',
      calculationType: 'PERCENTAGE',
      percentage: null,
    };
    assert.throws(
      () => calculatePercentageRules([invalidRule], { baseWage: 10000 }),
      /percentage is required/i
    );
  });

  it('14. empty rules list does not break calculation', () => {
    const result = calculatePercentageRules([], { baseWage: 10000 });

    assert.strictEqual(result.earnings, 0);
    assert.strictEqual(result.deductions, 0);
    assert.deepStrictEqual(result.contributions, []);
    assert.deepStrictEqual(result.orderedRules, []);
  });

  it('supports explicit context component references for percentage base', () => {
    // Test rule where HRA is 50% of BASIC component rather than total wage
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Basic', code: 'BASIC', sequence: 10, category: 'BASIC', calculationType: 'PERCENTAGE', percentage: 60 },
      { id: 'R2', name: 'HRA on Basic', code: 'HRA', sequence: 20, category: 'ALLOWANCE', calculationType: 'PERCENTAGE', percentage: 50, percentageBase: 'BASIC' },
    ];

    const result = calculateSalaryRules(rules, { baseWage: 10000 });

    // R1: 60% of 10000 = 6000
    // R2: 50% of BASIC (6000) = 3000
    assert.strictEqual(result.contributions[0].amount, 6000);
    assert.strictEqual(result.contributions[1].amount, 3000);
    assert.strictEqual(result.earnings, 9000);
  });
});

describe('Integration with PayrollEngine.compute', () => {
  it('15. does not apply legacy hardcoded fallback when no salary rules are passed', () => {
    const legacyInput = {
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      department: 'Engineering',
      monthlyWage: 6500,
      unpaidDays: 0,
    };

    const payslip = PayrollEngine.compute(legacyInput);

    assert.strictEqual(payslip.basic, 0);
    assert.strictEqual(payslip.hra, 0);
    assert.strictEqual(payslip.allowance, 0);
    assert.strictEqual(payslip.gross, 6500);
    assert.strictEqual(payslip.tax, 0);
    assert.strictEqual(payslip.otherDeductions, 0);
    assert.strictEqual(payslip.totalDeductions, 0);
    assert.strictEqual(payslip.net, 6500);
    assert.strictEqual(payslip.totalEarnings, 0);
    assert.ok(payslip.rulesResult);
  });

  it('attaches deterministic rule calculation results when salaryRules are provided', () => {
    const inputWithRules = {
      employeeId: 'EMP-002',
      employeeName: 'Maya Lin',
      department: 'Product',
      monthlyWage: 10000,
      salaryStructureId: 'STR-TECH',
      salaryRules: [
        { id: 'R1', name: 'Basic Fixed', code: 'BSC_F', sequence: 10, category: 'BASIC', calculationType: 'FIXED', amount: 4000, structureId: 'STR-TECH' },
        { id: 'R2', name: 'HRA Pct', code: 'HRA_P', sequence: 20, category: 'ALLOWANCE', calculationType: 'PERCENTAGE', percentage: 20, structureId: 'STR-TECH' },
        { id: 'R3', name: 'Tax Pct', code: 'TAX_P', sequence: 30, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 10, structureId: 'STR-TECH' },
        { id: 'R4', name: 'Other Structure Rule', code: 'OTHER', sequence: 40, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 999, structureId: 'STR-OTHER' },
      ],
    };

    const payslip = PayrollEngine.compute(inputWithRules);

    // Baseline fields remain intact
    assert.strictEqual(payslip.gross, 10000);

    // Phase 4 calculation results attached
    assert.ok(payslip.rulesResult);
    assert.strictEqual(payslip.rulesResult.contributions.length, 3);
    assert.strictEqual(payslip.rulesResult.fixedEarnings, 4000);
    assert.strictEqual(payslip.rulesResult.percentageEarnings, 2000); // 20% of 10000
    assert.strictEqual(payslip.rulesResult.earnings, 6000);
    assert.strictEqual(payslip.rulesResult.percentageDeductions, 1000); // 10% of 10000
    assert.strictEqual(payslip.rulesResult.deductions, 1000);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4.11: ATTENDANCE INTEGRATION TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('PHASE 4.11: Attendance Integration & Summarization', () => {
  const testPeriod: PayrollPeriod = {
    startDate: '2026-09-01',
    endDate: '2026-09-30',
  };

  it('1. filters attendance strictly by employee (Employee A data does not affect Employee B)', () => {
    const records: AttendanceRecordInput[] = [
      { id: 'ATT-01', employeeId: 'EMP-001', date: '2026-09-02', status: 'PRESENT', workedHours: 8 },
      { id: 'ATT-02', employeeId: 'EMP-001', date: '2026-09-03', status: 'PRESENT', workedHours: 8 },
      { id: 'ATT-03', employeeId: 'EMP-002', date: '2026-09-02', status: 'PRESENT', workedHours: 7.5 },
      { id: 'ATT-04', employeeId: 'EMP-002', date: '2026-09-03', status: 'ABSENT', workedHours: 0 },
    ];

    const summaryEmp1 = summarizeAttendance(records, 'EMP-001', testPeriod);
    const summaryEmp2 = summarizeAttendance(records, 'EMP-002', testPeriod);

    // Emp 1 checks
    assert.strictEqual(summaryEmp1.totalRecords, 2);
    assert.strictEqual(summaryEmp1.presentDays, 2);
    assert.strictEqual(summaryEmp1.absentDays, 0);
    assert.strictEqual(summaryEmp1.totalWorkedHours, 16);

    // Emp 2 checks
    assert.strictEqual(summaryEmp2.totalRecords, 2);
    assert.strictEqual(summaryEmp2.presentDays, 1);
    assert.strictEqual(summaryEmp2.absentDays, 1);
    assert.strictEqual(summaryEmp2.totalWorkedHours, 7.5);
  });

  it('2. filters attendance strictly by payroll period (records outside period are excluded)', () => {
    const records: AttendanceRecordInput[] = [
      { id: 'ATT-01', employeeId: 'EMP-001', date: '2026-08-31', status: 'PRESENT', workedHours: 8 }, // Before period
      { id: 'ATT-02', employeeId: 'EMP-001', date: '2026-09-01', status: 'PRESENT', workedHours: 8 }, // Inside (start)
      { id: 'ATT-03', employeeId: 'EMP-001', date: '2026-09-15', status: 'PRESENT', workedHours: 8 }, // Inside
      { id: 'ATT-04', employeeId: 'EMP-001', date: '2026-09-30', status: 'PRESENT', workedHours: 8 }, // Inside (end)
      { id: 'ATT-05', employeeId: 'EMP-001', date: '2026-10-01', status: 'PRESENT', workedHours: 8 }, // After period
    ];

    const summary = summarizeAttendance(records, 'EMP-001', testPeriod);

    assert.strictEqual(summary.totalRecords, 3);
    assert.strictEqual(summary.presentDays, 3);
    assert.strictEqual(summary.totalWorkedHours, 24);
  });

  it('3. start and end boundary dates are inclusive', () => {
    const records: AttendanceRecordInput[] = [
      { id: 'ATT-01', employeeId: 'EMP-001', date: '2026-09-01', status: 'PRESENT', workedHours: 8.5 },
      { id: 'ATT-02', employeeId: 'EMP-001', date: '2026-09-30', status: 'PRESENT', workedHours: 7.5 },
    ];

    const summary = summarizeAttendance(records, 'EMP-001', testPeriod);

    assert.strictEqual(summary.totalRecords, 2);
    assert.strictEqual(summary.presentDays, 2);
    assert.strictEqual(summary.totalWorkedHours, 16);
  });

  it('4. calculates total worked hours with financial rounding precision', () => {
    const records: AttendanceRecordInput[] = [
      { id: 'ATT-01', employeeId: 'EMP-001', date: '2026-09-02', status: 'PRESENT', workedHours: 7.3333 },
      { id: 'ATT-02', employeeId: 'EMP-001', date: '2026-09-03', status: 'PRESENT', workedHours: 8.125 },
      { id: 'ATT-03', employeeId: 'EMP-001', date: '2026-09-04', status: 'OVERTIME', workedHours: 9.666 },
    ];

    const summary = summarizeAttendance(records, 'EMP-001', testPeriod);

    // 7.3333 + 8.125 + 9.666 = 25.1243 -> 25.12
    assert.strictEqual(summary.totalWorkedHours, 25.12);
  });

  it('5. handles missing or incomplete records safely (Active checkout, missing hours, invalid formats)', () => {
    const records: AttendanceRecordInput[] = [
      { id: 'ATT-01', employeeId: 'EMP-001', date: '2026-09-02', status: 'PRESENT', checkIn: '09:00 AM', checkOut: 'Active', workedHours: null },
      { id: 'ATT-02', employeeId: 'EMP-001', date: '2026-09-03', status: 'MISSING_CHECKOUT', checkIn: '09:00 AM', checkOut: undefined, workedHours: undefined },
      { id: 'ATT-03', employeeId: 'EMP-001', date: '2026-09-04', status: 'PRESENT', checkIn: '09:00 AM', checkOut: '05:00 PM', workedHours: 'invalid' as unknown as number },
      { id: 'ATT-04', employeeId: 'EMP-001', date: '2026-09-05', status: 'PRESENT', checkIn: '09:00 AM', checkOut: '05:00 PM', workedHours: 8 },
    ];

    const summary = summarizeAttendance(records, 'EMP-001', testPeriod);

    assert.strictEqual(summary.totalRecords, 4);
    assert.strictEqual(summary.presentDays, 3);
    assert.strictEqual(summary.totalWorkedHours, 8); // Only the valid 8 hours counted
  });

  it('6. empty attendance records list produces valid zero summary', () => {
    const summary = summarizeAttendance([], 'EMP-001', testPeriod);

    assert.strictEqual(summary.totalRecords, 0);
    assert.strictEqual(summary.presentDays, 0);
    assert.strictEqual(summary.absentDays, 0);
    assert.strictEqual(summary.lateDays, 0);
    assert.strictEqual(summary.overtimeDays, 0);
    assert.strictEqual(summary.totalWorkedHours, 0);
  });

  it('7. deduplicates duplicate records deterministically by record ID', () => {
    const records: AttendanceRecordInput[] = [
      { id: 'ATT-DUP', employeeId: 'EMP-001', date: '2026-09-05', status: 'PRESENT', workedHours: 8 },
      { id: 'ATT-DUP', employeeId: 'EMP-001', date: '2026-09-05', status: 'PRESENT', workedHours: 8 },
      { id: 'ATT-UNIQ', employeeId: 'EMP-001', date: '2026-09-06', status: 'PRESENT', workedHours: 8 },
    ];

    const summary = summarizeAttendance(records, 'EMP-001', testPeriod);

    assert.strictEqual(summary.totalRecords, 2);
    assert.strictEqual(summary.presentDays, 2);
    assert.strictEqual(summary.totalWorkedHours, 16);
  });

  it('8. produces identical attendance summary across multiple repeated executions (pure determinism)', () => {
    const records: AttendanceRecordInput[] = [
      { id: 'ATT-01', employeeId: 'EMP-001', date: '2026-09-05', status: 'PRESENT', workedHours: 8 },
      { id: 'ATT-02', employeeId: 'EMP-001', date: '2026-09-06', status: 'LATE', workedHours: 7.5 },
      { id: 'ATT-03', employeeId: 'EMP-001', date: '2026-09-07', status: 'ABSENT', workedHours: 0 },
      { id: 'ATT-04', employeeId: 'EMP-001', date: '2026-09-08', status: 'OVERTIME', workedHours: 10 },
    ];

    const res1 = summarizeAttendance(records, 'EMP-001', testPeriod);
    const res2 = summarizeAttendance(records, 'EMP-001', testPeriod);
    const res3 = summarizeAttendance(records, 'EMP-001', testPeriod);

    assert.deepStrictEqual(res1, res2);
    assert.deepStrictEqual(res2, res3);
    assert.strictEqual(res1.presentDays, 3); // PRESENT + LATE + OVERTIME
    assert.strictEqual(res1.lateDays, 1);
    assert.strictEqual(res1.absentDays, 1);
    assert.strictEqual(res1.overtimeDays, 1);
    assert.strictEqual(res1.totalWorkedHours, 25.5);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4.12: TIME OFF / UNPAID LEAVE INTEGRATION TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('PHASE 4.12: Time Off / Unpaid Leave Integration & Summarization', () => {
  const testPeriod: PayrollPeriod = {
    startDate: '2026-09-01',
    endDate: '2026-09-30',
  };

  it('9. filters time-off strictly by employee (Employee A leave does not affect Employee B)', () => {
    const requests: TimeOffRecordInput[] = [
      { id: 'TO-01', employeeId: 'EMP-001', leaveType: 'Unpaid Leave', startDate: '2026-09-10', endDate: '2026-09-12', status: 'APPROVED' },
      { id: 'TO-02', employeeId: 'EMP-002', leaveType: 'Unpaid Leave', startDate: '2026-09-15', endDate: '2026-09-18', status: 'APPROVED' },
    ];

    const summary1 = summarizeTimeOff(requests, 'EMP-001', testPeriod);
    const summary2 = summarizeTimeOff(requests, 'EMP-002', testPeriod);

    assert.strictEqual(summary1.unpaidLeaveDays, 3); // Sep 10, 11, 12
    assert.strictEqual(summary1.approvedLeaveDays, 3);

    assert.strictEqual(summary2.unpaidLeaveDays, 4); // Sep 15, 16, 17, 18
    assert.strictEqual(summary2.approvedLeaveDays, 4);
  });

  it('10. only approved requests are included (PENDING and REFUSED requests are excluded)', () => {
    const requests: TimeOffRecordInput[] = [
      { id: 'TO-01', employeeId: 'EMP-001', leaveType: 'Paid Annual Leave', startDate: '2026-09-05', endDate: '2026-09-06', status: 'APPROVED' },
      { id: 'TO-02', employeeId: 'EMP-001', leaveType: 'Unpaid Leave', startDate: '2026-09-10', endDate: '2026-09-12', status: 'PENDING' },
      { id: 'TO-03', employeeId: 'EMP-001', leaveType: 'Unpaid Leave', startDate: '2026-09-15', endDate: '2026-09-17', status: 'REFUSED' },
    ];

    const summary = summarizeTimeOff(requests, 'EMP-001', testPeriod);

    assert.strictEqual(summary.approvedLeaveDays, 2);
    assert.strictEqual(summary.paidLeaveDays, 2);
    assert.strictEqual(summary.unpaidLeaveDays, 0); // PENDING and REFUSED ignored
  });

  it('11. leave completely outside the payroll period is excluded', () => {
    const requests: TimeOffRecordInput[] = [
      { id: 'TO-BEFORE', employeeId: 'EMP-001', leaveType: 'Unpaid Leave', startDate: '2026-08-01', endDate: '2026-08-10', status: 'APPROVED' },
      { id: 'TO-AFTER', employeeId: 'EMP-001', leaveType: 'Unpaid Leave', startDate: '2026-10-05', endDate: '2026-10-10', status: 'APPROVED' },
      { id: 'TO-INSIDE', employeeId: 'EMP-001', leaveType: 'Unpaid Leave', startDate: '2026-09-15', endDate: '2026-09-16', status: 'APPROVED' },
    ];

    const summary = summarizeTimeOff(requests, 'EMP-001', testPeriod);

    assert.strictEqual(summary.approvedLeaveDays, 2);
    assert.strictEqual(summary.unpaidLeaveDays, 2);
  });

  it('12. partial overlap: leave starting before and ending inside period is clamped accurately (Prompt Example 1)', () => {
    // Prompt conceptual example:
    // Payroll Period: September 1 -> September 30
    // Leave: August 28 -> September 5
    // Only September 1 -> September 5 should be considered (5 days).
    const requests: TimeOffRecordInput[] = [
      { id: 'TO-01', employeeId: 'EMP-001', leaveType: 'Unpaid Leave', startDate: '2026-08-28', endDate: '2026-09-05', status: 'APPROVED' },
    ];

    const summary = summarizeTimeOff(requests, 'EMP-001', testPeriod);

    assert.strictEqual(summary.unpaidLeaveDays, 5); // Sep 1, 2, 3, 4, 5
    assert.strictEqual(summary.approvedLeaveDays, 5);
    assert.strictEqual(summary.paidLeaveDays, 0);

    // Also test raw overlap calculator helper directly
    const overlapDays = calculateDateOverlapDays('2026-08-28', '2026-09-05', '2026-09-01', '2026-09-30');
    assert.strictEqual(overlapDays, 5);
  });

  it('13. partial overlap: leave starting inside and ending after period is clamped accurately (Prompt Example 2)', () => {
    // Prompt conceptual example:
    // Leave: September 28 -> October 4
    // Only September 28 -> September 30 should be considered (3 days).
    const requests: TimeOffRecordInput[] = [
      { id: 'TO-02', employeeId: 'EMP-001', leaveType: 'Unpaid Leave', startDate: '2026-09-28', endDate: '2026-10-04', status: 'APPROVED' },
    ];

    const summary = summarizeTimeOff(requests, 'EMP-001', testPeriod);

    assert.strictEqual(summary.unpaidLeaveDays, 3); // Sep 28, 29, 30
    assert.strictEqual(summary.approvedLeaveDays, 3);

    const overlapDays = calculateDateOverlapDays('2026-09-28', '2026-10-04', '2026-09-01', '2026-09-30');
    assert.strictEqual(overlapDays, 3);
  });

  it('14. partial overlap: leave completely covering entire payroll period is clamped to period duration', () => {
    const requests: TimeOffRecordInput[] = [
      { id: 'TO-WIDE', employeeId: 'EMP-001', leaveType: 'Unpaid Leave', startDate: '2026-08-15', endDate: '2026-10-15', status: 'APPROVED' },
    ];

    const summary = summarizeTimeOff(requests, 'EMP-001', testPeriod);

    // September has 30 days
    assert.strictEqual(summary.unpaidLeaveDays, 30);
    assert.strictEqual(summary.approvedLeaveDays, 30);
  });

  it('15. distinguishes paid vs unpaid leave correctly using leave type domain rules', () => {
    const requests: TimeOffRecordInput[] = [
      { id: 'TO-PAID-1', employeeId: 'EMP-001', leaveType: 'Paid Annual Leave', startDate: '2026-09-02', endDate: '2026-09-04', status: 'APPROVED' }, // 3 days
      { id: 'TO-PAID-2', employeeId: 'EMP-001', leaveType: 'Sick Leave', startDate: '2026-09-10', endDate: '2026-09-11', status: 'APPROVED' },         // 2 days
      { id: 'TO-UNPAID', employeeId: 'EMP-001', leaveType: 'Unpaid Leave', startDate: '2026-09-20', endDate: '2026-09-21', status: 'APPROVED' },       // 2 days
      { id: 'TO-EXPLICIT', employeeId: 'EMP-001', leaveType: 'Special Leave', isPaid: false, startDate: '2026-09-25', endDate: '2026-09-25', status: 'APPROVED' }, // 1 day
    ];

    const summary = summarizeTimeOff(requests, 'EMP-001', testPeriod);

    assert.strictEqual(summary.paidLeaveDays, 5); // 3 + 2
    assert.strictEqual(summary.unpaidLeaveDays, 3); // 2 + 1
    assert.strictEqual(summary.approvedLeaveDays, 8); // 5 + 3

    // Helper checks
    assert.strictEqual(isUnpaidLeaveType('Paid Annual Leave'), false);
    assert.strictEqual(isUnpaidLeaveType('Sick Leave'), false);
    assert.strictEqual(isUnpaidLeaveType('Unpaid Leave'), true);
    assert.strictEqual(isUnpaidLeaveType('Leave without pay'), true);
    assert.strictEqual(isUnpaidLeaveType('Custom Leave', false), true);
    assert.strictEqual(isUnpaidLeaveType('Unpaid Leave', true), false); // explicit override
  });

  it('16. prevents double counting on overlapping or duplicate leave requests', () => {
    const requests: TimeOffRecordInput[] = [
      // Request 1: Sep 10 to Sep 14 (5 days)
      { id: 'TO-01', employeeId: 'EMP-001', leaveType: 'Paid Annual Leave', startDate: '2026-09-10', endDate: '2026-09-14', status: 'APPROVED' },
      // Request 2 overlaps: Sep 12 to Sep 16 (overlaps on Sep 12, 13, 14; new are 15, 16)
      { id: 'TO-02', employeeId: 'EMP-001', leaveType: 'Paid Annual Leave', startDate: '2026-09-12', endDate: '2026-09-16', status: 'APPROVED' },
      // Exact duplicate by ID
      { id: 'TO-01', employeeId: 'EMP-001', leaveType: 'Paid Annual Leave', startDate: '2026-09-10', endDate: '2026-09-14', status: 'APPROVED' },
    ];

    const summary = summarizeTimeOff(requests, 'EMP-001', testPeriod);

    // Total distinct calendar days: Sep 10, 11, 12, 13, 14, 15, 16 = 7 distinct days
    assert.strictEqual(summary.paidLeaveDays, 7);
    assert.strictEqual(summary.approvedLeaveDays, 7);
    assert.strictEqual(summary.unpaidLeaveDays, 0);
  });

  it('17. handles overlapping paid and unpaid leave deterministically without double counting', () => {
    const requests: TimeOffRecordInput[] = [
      // Sep 10 to Sep 12: Paid
      { id: 'TO-01', employeeId: 'EMP-001', leaveType: 'Paid Annual Leave', startDate: '2026-09-10', endDate: '2026-09-12', status: 'APPROVED' },
      // Sep 12 to Sep 14: Unpaid (Sep 12 overlaps)
      { id: 'TO-02', employeeId: 'EMP-001', leaveType: 'Unpaid Leave', startDate: '2026-09-12', endDate: '2026-09-14', status: 'APPROVED' },
    ];

    const summary = summarizeTimeOff(requests, 'EMP-001', testPeriod);

    // Sep 10, 11 -> Paid (2)
    // Sep 12, 13, 14 -> Unpaid (3, takes priority)
    // Total approved days = 5 distinct days
    assert.strictEqual(summary.paidLeaveDays, 2);
    assert.strictEqual(summary.unpaidLeaveDays, 3);
    assert.strictEqual(summary.approvedLeaveDays, 5);
  });

  it('18. empty time-off records list produces valid zero summary', () => {
    const summary = summarizeTimeOff([], 'EMP-001', testPeriod);

    assert.strictEqual(summary.approvedLeaveDays, 0);
    assert.strictEqual(summary.paidLeaveDays, 0);
    assert.strictEqual(summary.unpaidLeaveDays, 0);
  });

  it('19. produces identical time-off summary across repeated runs (pure determinism)', () => {
    const requests: TimeOffRecordInput[] = [
      { id: 'TO-01', employeeId: 'EMP-001', leaveType: 'Paid Annual Leave', startDate: '2026-09-05', endDate: '2026-09-08', status: 'APPROVED' },
      { id: 'TO-02', employeeId: 'EMP-001', leaveType: 'Unpaid Leave', startDate: '2026-09-15', endDate: '2026-09-17', status: 'APPROVED' },
    ];

    const res1 = summarizeTimeOff(requests, 'EMP-001', testPeriod);
    const res2 = summarizeTimeOff(requests, 'EMP-001', testPeriod);
    const res3 = summarizeTimeOff(requests, 'EMP-001', testPeriod);

    assert.deepStrictEqual(res1, res2);
    assert.deepStrictEqual(res2, res3);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PIPELINE INTEGRATION & REGRESSION VERIFICATION
// ══════════════════════════════════════════════════════════════════════════════

describe('PHASE 4.11 & 4.12: Payroll Calculation Pipeline & Regression Integration', () => {
  const testPeriod: PayrollPeriod = {
    startDate: '2026-09-01',
    endDate: '2026-09-30',
  };

  it('20. preparePayrollCalculationInput normalizes employee, contract, attendance, and time off into clean input', () => {
    const employee = {
      id: 'EMP-006',
      name: 'Sarah Connor',
      department: 'Operations',
      wage: 6000,
    };
    const contract = {
      wage: 6300,
      salaryStructureId: 'STR-OPS',
    };
    const attendanceRecords: AttendanceRecordInput[] = [
      { id: 'ATT-01', employeeId: 'EMP-006', date: '2026-09-01', status: 'PRESENT', workedHours: 8 },
      { id: 'ATT-02', employeeId: 'EMP-006', date: '2026-09-02', status: 'PRESENT', workedHours: 8 },
      { id: 'ATT-03', employeeId: 'EMP-999', date: '2026-09-01', status: 'PRESENT', workedHours: 8 }, // Other employee
    ];
    const timeOffRecords: TimeOffRecordInput[] = [
      { id: 'TO-01', employeeId: 'EMP-006', leaveType: 'Unpaid Leave', startDate: '2026-09-10', endDate: '2026-09-11', status: 'APPROVED' }, // 2 days
      { id: 'TO-02', employeeId: 'EMP-999', leaveType: 'Unpaid Leave', startDate: '2026-09-10', endDate: '2026-09-15', status: 'APPROVED' }, // Other employee
    ];

    const prepared = preparePayrollCalculationInput({
      employee,
      contract,
      period: testPeriod,
      attendanceRecords,
      timeOffRecords,
    });

    assert.strictEqual(prepared.input.employeeId, 'EMP-006');
    assert.strictEqual(prepared.input.monthlyWage, 6300); // Contract wage takes precedence
    assert.strictEqual(prepared.input.salaryStructureId, 'STR-OPS');
    assert.strictEqual(prepared.input.unpaidDays, 2); // Automatically populated from unpaid leave
    assert.strictEqual(prepared.attendanceSummary.presentDays, 2);
    assert.strictEqual(prepared.attendanceSummary.totalRecords, 2);
    assert.strictEqual(prepared.timeOffSummary.unpaidLeaveDays, 2);
    assert.strictEqual(prepared.timeOffSummary.approvedLeaveDays, 2);
  });

  it('21. PayrollEngine.compute automatically attaches attendanceSummary and timeOffSummary', () => {
    const input = {
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      department: 'Engineering',
      monthlyWage: 6500,
      attendanceSummary: {
        totalRecords: 22,
        presentDays: 21,
        absentDays: 1,
        lateDays: 2,
        overtimeDays: 1,
        totalWorkedHours: 172.5,
      },
      timeOffSummary: {
        approvedLeaveDays: 3,
        paidLeaveDays: 2,
        unpaidLeaveDays: 1,
      },
    };

    const payslip = PayrollEngine.compute(input);

    assert.ok(payslip.attendanceSummary);
    assert.strictEqual(payslip.attendanceSummary.presentDays, 21);
    assert.strictEqual(payslip.attendanceSummary.totalWorkedHours, 172.5);

    assert.ok(payslip.timeOffSummary);
    assert.strictEqual(payslip.timeOffSummary.approvedLeaveDays, 3);
    assert.strictEqual(payslip.timeOffSummary.unpaidLeaveDays, 1);
  });

  it('22. Unpaid leave days flow automatically into existing unpaid leave deduction when input.unpaidDays is not hardcoded', () => {
    const input = {
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      department: 'Engineering',
      monthlyWage: 6000,
      timeOffSummary: {
        approvedLeaveDays: 3,
        paidLeaveDays: 1,
        unpaidLeaveDays: 2, // 2 days unpaid
      },
    };

    const payslip = PayrollEngine.compute(input);

    // basic = 6000 * 0.60 = 3600
    // dailyRate = 3600 / 30 = 120
    // unpaidLeaveDeduction = 120 * 2 = 240
    assert.strictEqual(payslip.basic, 0);
    assert.strictEqual(payslip.unpaidLeaveDeduction, 240);
  });

  it('23. Explicit input.unpaidDays overrides timeOffSummary (preserves full backward compatibility)', () => {
    const input = {
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      department: 'Engineering',
      monthlyWage: 6000,
      unpaidDays: 0, // Explicitly 0
      timeOffSummary: {
        approvedLeaveDays: 2,
        paidLeaveDays: 0,
        unpaidLeaveDays: 2,
      },
    };

    const payslip = PayrollEngine.compute(input);

    assert.strictEqual(payslip.unpaidLeaveDeduction, 0); // Explicit unpaidDays: 0 respected
  });

  it('24. PayrollEngine.compute automatically resolves raw attendanceRecords and timeOffRecords if summaries not pre-calculated', () => {
    const payslip = PayrollEngine.compute({
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      department: 'Engineering',
      monthlyWage: 6000,
      payrollPeriod: testPeriod,
      attendanceRecords: [
        { id: 'ATT-1', employeeId: 'EMP-001', date: '2026-09-02', status: 'PRESENT', workedHours: 8 },
        { id: 'ATT-2', employeeId: 'EMP-001', date: '2026-09-03', status: 'PRESENT', workedHours: 8 },
      ],
      timeOffRecords: [
        { id: 'TO-1', employeeId: 'EMP-001', leaveType: 'Unpaid Leave', startDate: '2026-09-10', endDate: '2026-09-10', status: 'APPROVED' }, // 1 day
      ],
    });

    assert.ok(payslip.attendanceSummary);
    assert.strictEqual(payslip.attendanceSummary.presentDays, 2);
    assert.strictEqual(payslip.attendanceSummary.totalWorkedHours, 16);

    assert.ok(payslip.timeOffSummary);
    assert.strictEqual(payslip.timeOffSummary.unpaidLeaveDays, 1);

    // 1 day unpaid: basic = 3600 -> dailyRate = 120 -> deduction = 120
    assert.strictEqual(payslip.unpaidLeaveDeduction, 120);
  });

  it('25. Regression: Fixed rule calculations continue working exactly as before', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Basic Fixed', code: 'BASIC', sequence: 10, category: 'BASIC', calculationType: 'FIXED', amount: 5000 },
      { id: 'R2', name: 'Medical Allowance', code: 'MED', sequence: 20, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 1500 },
      { id: 'R3', name: 'Insurance Deduction', code: 'INS', sequence: 30, category: 'DEDUCTION', calculationType: 'FIXED', amount: 400 },
    ];

    const result = calculateFixedRules(rules);

    assert.strictEqual(result.earnings, 6500);
    assert.strictEqual(result.deductions, 400);
    assert.strictEqual(result.fixedEarnings, 6500);
    assert.strictEqual(result.fixedDeductions, 400);
  });

  it('26. Regression: Percentage rule calculations continue working exactly as before', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Provident Fund', code: 'PF', sequence: 10, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 12 },
    ];

    const result = calculatePercentageRules(rules, { baseWage: 10000 });

    assert.strictEqual(result.deductions, 1200);
    assert.strictEqual(result.percentageDeductions, 1200);
  });

  it('27. Regression: Deterministic rule ordering continues working exactly as before', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R3', name: 'Rule 3', code: 'R3', sequence: 30, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 100 },
      { id: 'R1', name: 'Rule 1', code: 'R1', sequence: 10, category: 'BASIC', calculationType: 'FIXED', amount: 100 },
      { id: 'R2', name: 'Rule 2', code: 'R2', sequence: 20, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 100 },
    ];

    const ordered = orderSalaryRules(rules);

    assert.strictEqual(ordered[0].id, 'R1');
    assert.strictEqual(ordered[1].id, 'R2');
    assert.strictEqual(ordered[2].id, 'R3');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4.13: GROSS SALARY CALCULATION TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('PHASE 4.13: Gross Salary Calculation', () => {
  it('1. base wage only produces correct gross salary', () => {
    const gross = calculateGrossSalary(50000, []);
    assert.strictEqual(gross, 50000);

    const grossZero = calculateGrossSalary(0, []);
    assert.strictEqual(grossZero, 0);

    const grossNoRules = calculateGrossSalary(6500);
    assert.strictEqual(grossNoRules, 6500);
  });

  it('2. fixed earning rule increases gross salary correctly', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Basic Allowance', code: 'ALLOW', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 5000 },
    ];

    const gross = calculateGrossSalary(50000, rules);
    assert.strictEqual(gross, 55000);
  });

  it('3. percentage earning rule increases gross salary correctly', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Bonus', code: 'BONUS', sequence: 10, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 10 },
    ];

    // 10% of 50000 = 5000 -> 50000 + 5000 = 55000
    const gross = calculateGrossSalary(50000, rules);
    assert.strictEqual(gross, 55000);
  });

  it('4. mixed fixed + percentage earnings aggregate correctly (Prompt Gross Salary Example)', () => {
    // Prompt conceptual example:
    // Base Wage = 50,000
    // Earning Rules:
    //   Basic Allowance = 5,000
    //   Bonus = 10% of Base = 5,000
    // Gross Salary: 50,000 + 5,000 + 5,000 = 60,000
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Basic Allowance', code: 'ALLOW', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 5000 },
      { id: 'R2', name: 'Bonus', code: 'BONUS', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 10 },
    ];

    const gross = calculateGrossSalary(50000, rules);
    assert.strictEqual(gross, 60000);
  });

  it('5. empty earning rules work correctly (produces base wage)', () => {
    const gross = calculateGrossSalary(75000, []);
    assert.strictEqual(gross, 75000);
  });

  it('6. rules from another structure do not affect gross salary', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Structure 1 Allowance', code: 'S1_ALW', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 3000, structureId: 'STR-001' },
      { id: 'R2', name: 'Structure 2 Bonus', code: 'S2_BON', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 20, structureId: 'STR-002' },
    ];

    const gross = calculateGrossSalary(50000, rules, { salaryStructureId: 'STR-001' });
    // Only STR-001 rule applied: 50000 + 3000 = 53000
    assert.strictEqual(gross, 53000);
  });

  it('7. repeated calculations produce identical gross salary (pure determinism)', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Alw Fixed', code: 'ALW', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 4500 },
      { id: 'R2', name: 'Pct Bonus', code: 'BON', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 8.5 },
    ];

    const res1 = calculateGrossSalary(60000, rules);
    const res2 = calculateGrossSalary(60000, rules);
    const res3 = calculateGrossSalary(60000, rules);

    assert.strictEqual(res1, res2);
    assert.strictEqual(res2, res3);
    // 60000 + 4500 + 5100 = 69600
    assert.strictEqual(res1, 69600);
  });

  it('8. decimal values maintain correct precision without floating-point drift', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Dec Earning 1', code: 'E1', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 1250.455 }, // rounds to 1250.46
      { id: 'R2', name: 'Dec Earning 2', code: 'E2', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 7.333 },
    ];

    const gross = calculateGrossSalary(50000.33, rules);
    // baseWage: 50000.33
    // E1: 1250.46
    // E2: roundMoney(50000.33 * 7.333 / 100) = roundMoney(3666.5241989) = 3666.52
    // Gross: roundMoney(50000.33 + 1250.46 + 3666.52) = 54917.31
    assert.strictEqual(gross, 54917.31);
  });

  it('deduction rules do not contribute to gross salary', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Allowance', code: 'ALW', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 2000 },
      { id: 'R2', name: 'Tax Deduction', code: 'TAX', sequence: 20, category: 'DEDUCTION', calculationType: 'FIXED', amount: 1500 },
      { id: 'R3', name: 'PF Deduction', code: 'PF', sequence: 30, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 10 },
    ];

    const gross = calculateGrossSalary(40000, rules);
    // 40000 + 2000 = 42000 (deductions ignored in gross)
    assert.strictEqual(gross, 42000);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4.14: TOTAL DEDUCTIONS CALCULATION TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('PHASE 4.14: Total Deductions Calculation', () => {
  it('9. fixed deduction rules aggregate correctly', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Deduction Rule A', code: 'DED_A', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 2000 },
    ];

    const total = calculateTotalDeductions(rules);
    assert.strictEqual(total, 2000);
  });

  it('10. percentage deduction rules aggregate correctly', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Deduction Rule B', code: 'DED_B', sequence: 10, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 5 },
    ];

    // 5% of 50000 = 2500
    const total = calculateTotalDeductions(rules, { baseWage: 50000 });
    assert.strictEqual(total, 2500);
  });

  it('11. mixed deductions aggregate correctly (Prompt Deduction Example)', () => {
    // Prompt conceptual example:
    // Deduction Rule A = 2,000
    // Deduction Rule B = 5% = 2,500
    // Total Deductions: 4,500
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Deduction Rule A', code: 'DED_A', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 2000 },
      { id: 'R2', name: 'Deduction Rule B', code: 'DED_B', sequence: 20, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 5 },
    ];

    const total = calculateTotalDeductions(rules, { baseWage: 50000 });
    assert.strictEqual(total, 4500);
  });

  it('12. empty deductions return zero', () => {
    const total = calculateTotalDeductions([]);
    assert.strictEqual(total, 0);

    const totalUndefined = calculateTotalDeductions();
    assert.strictEqual(totalUndefined, 0);
  });

  it('13. duplicate contributions are not double-counted', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Health Insurance', code: 'HLTH', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 750 },
    ];

    const rulesResult = calculateSalaryRules(rules);
    // Passing rulesResult directly
    const total = calculateTotalDeductions(rulesResult);
    assert.strictEqual(total, 750);
  });

  it('14. rules from another structure are excluded from total deductions', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Structure 1 Deduction', code: 'S1_DED', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 1500, structureId: 'STR-001' },
      { id: 'R2', name: 'Structure 2 Deduction', code: 'S2_DED', sequence: 20, category: 'DEDUCTION', calculationType: 'FIXED', amount: 9999, structureId: 'STR-002' },
    ];

    const total = calculateTotalDeductions(rules, { salaryStructureId: 'STR-001' });
    assert.strictEqual(total, 1500);
  });

  it('15. decimal deductions maintain precision', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Tax Part A', code: 'T1', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 123.456 }, // rounds to 123.46
      { id: 'R2', name: 'Tax Part B', code: 'T2', sequence: 20, category: 'DEDUCTION', calculationType: 'FIXED', amount: 789.012 }, // rounds to 789.01
    ];

    const total = calculateTotalDeductions(rules);
    assert.strictEqual(total, 912.47);
  });

  it('16. repeated calculations produce identical totals (pure determinism)', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Deduction Fixed', code: 'D1', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 1000 },
      { id: 'R2', name: 'Deduction Pct', code: 'D2', sequence: 20, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 7.5 },
    ];

    const res1 = calculateTotalDeductions(rules, { baseWage: 40000 });
    const res2 = calculateTotalDeductions(rules, { baseWage: 40000 });
    const res3 = calculateTotalDeductions(rules, { baseWage: 40000 });

    assert.strictEqual(res1, res2);
    assert.strictEqual(res2, res3);
    // 1000 + 3000 = 4000
    assert.strictEqual(res1, 4000);
  });

  it('17. integrates applicable unpaid leave deduction safely when provided via current architecture', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Provident Fund', code: 'PF', sequence: 10, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 10 },
    ];

    // PF: 10% of 60000 = 6000
    // Unpaid leave deduction: 240
    // Total deductions = 6000 + 240 = 6240
    const total = calculateTotalDeductions(rules, {
      baseWage: 60000,
      unpaidLeaveDeduction: 240,
    });

    assert.strictEqual(total, 6240);
  });

  it('earning rules do not contribute to total deductions', () => {
    const rules: PayrollSalaryRule[] = [
      { id: 'R1', name: 'Basic', code: 'BASIC', sequence: 10, category: 'BASIC', calculationType: 'FIXED', amount: 5000 },
      { id: 'R2', name: 'Allowance', code: 'ALW', sequence: 20, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 2000 },
      { id: 'R3', name: 'Deduction', code: 'DED', sequence: 30, category: 'DEDUCTION', calculationType: 'FIXED', amount: 500 },
    ];

    const total = calculateTotalDeductions(rules);
    assert.strictEqual(total, 500);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PIPELINE INTEGRATION & REGRESSION VERIFICATION (PHASE 4.13 & 4.14)
// ══════════════════════════════════════════════════════════════════════════════

describe('PHASE 4.13 & 4.14: Pipeline Integration & Regression', () => {
  it('18. PayrollEngine.compute attaches grossSalary and totalCalculatedDeductions', () => {
    const input = {
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      department: 'Engineering',
      monthlyWage: 50000,
      salaryRules: [
        { id: 'R1', name: 'Basic Allowance', code: 'ALLOW', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 5000 },
        { id: 'R2', name: 'Bonus Pct', code: 'BONUS', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 10 },
        { id: 'R3', name: 'Deduction Fixed', code: 'DED_F', sequence: 30, category: 'DEDUCTION', calculationType: 'FIXED', amount: 2000 },
        { id: 'R4', name: 'Deduction Pct', code: 'DED_P', sequence: 40, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 5 },
      ],
    };

    const payslip = PayrollEngine.compute(input);

    // Phase 4.13 Gross Salary: 50000 + 5000 + 5000 = 60000
    assert.strictEqual(payslip.grossSalary, 60000);
    assert.strictEqual(payslip.rulesResult?.grossSalary, 60000);

    // Phase 4.14 Total Deductions: 2000 + 2500 = 4500 (unpaidDays: 0)
    assert.strictEqual(payslip.totalCalculatedDeductions, 4500);
    assert.strictEqual(payslip.rulesResult?.totalDeductions, 4500);
  });

  it('19. incorporates unpaid leave deduction into totalCalculatedDeductions in compute', () => {
    const input = {
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      department: 'Engineering',
      monthlyWage: 6000,
      unpaidDays: 2, // 2 unpaid days
      salaryRules: [
        { id: 'R1', name: 'Tax', code: 'TAX', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 300 },
      ],
    };

    const payslip = PayrollEngine.compute(input);

    // basic = 6000 * 0.60 = 3600
    // dailyRate = 3600 / 30 = 120
    // unpaidLeaveDeduction = 120 * 2 = 240
    assert.strictEqual(payslip.unpaidLeaveDeduction, 240);

    // Total deductions = 300 (rule) + 240 (unpaid leave) = 540
    assert.strictEqual(payslip.totalCalculatedDeductions, 540);
  });

  it('20. static methods on PayrollEngine match standalone pure functions', () => {
    assert.strictEqual(PayrollEngine.calculateGrossSalary, calculateGrossSalary);
    assert.strictEqual(PayrollEngine.calculateTotalDeductions, calculateTotalDeductions);
    assert.strictEqual(PayrollEngine.calculateNetSalary, calculateNetSalary);
  });

  it('21. Legacy fields remain untouched for full backward compatibility', () => {
    const input = {
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      department: 'Engineering',
      monthlyWage: 10000,
      salaryRules: [
        { id: 'R1', name: 'Allowance', code: 'ALW', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 2000 },
      ],
    };

    const payslip = PayrollEngine.compute(input);

    // Phase 4.13 grossSalary is 12000
    assert.strictEqual(payslip.grossSalary, 12000);
    // Phase 4.15 netSalary is 12000 (12000 - 0 deductions)
    assert.strictEqual(payslip.netSalary, 12000);

    // Salary rules are the ONLY source of deductions -> zero fallback deductions applied
    assert.strictEqual(payslip.gross, 10000);
    assert.strictEqual(payslip.totalDeductions, 0);
    assert.strictEqual(payslip.net, 12000);
  });
});

describe('PHASE 4.15: Final Net Salary Calculation', () => {
  it('1. Gross Salary minus deductions produces correct Net Salary', () => {
    // Direct numerical input
    const net1 = calculateNetSalary(60000, 4500);
    assert.strictEqual(net1, 55500);

    // Object input with grossSalary and totalCalculatedDeductions
    const net2 = calculateNetSalary({
      grossSalary: 60000,
      totalCalculatedDeductions: 4500,
    });
    assert.strictEqual(net2, 55500);

    // Object input with rulesResult shape (grossSalary and totalDeductions)
    const net3 = calculateNetSalary({
      grossSalary: 60000,
      totalDeductions: 4500,
    });
    assert.strictEqual(net3, 55500);

    // Fallback to legacy gross and totalDeductions if Phase 4 names omitted
    const net4 = calculateNetSalary({
      gross: 50000,
      totalDeductions: 8500,
    });
    assert.strictEqual(net4, 41500);
  });

  it('2. Zero deductions results in Net Salary equal to Gross Salary', () => {
    const netFromNumbers = calculateNetSalary(50000, 0);
    assert.strictEqual(netFromNumbers, 50000);

    const netFromObject = calculateNetSalary({
      grossSalary: 75000,
      totalCalculatedDeductions: 0,
    });
    assert.strictEqual(netFromObject, 75000);

    // Omitted deductions defaults to 0
    const netOmitted = calculateNetSalary(42000);
    assert.strictEqual(netOmitted, 42000);
  });

  it('3. Decimal values maintain correct precision without floating-point drift', () => {
    // 50000.55 - 1234.33 = 48766.22 (in native JS 50000.55 - 1234.33 can suffer precision issues)
    const net1 = calculateNetSalary(50000.55, 1234.33);
    assert.strictEqual(net1, 48766.22);

    // 12345.678 - 234.567 = 12111.11 after 2-decimal money rounding
    const net2 = calculateNetSalary(12345.678, 234.567);
    assert.strictEqual(net2, 12111.11);
  });

  it('4. Fixed earning + fixed deduction produces correct final result', () => {
    const input = {
      employeeId: 'EMP-001',
      employeeName: 'Alice',
      department: 'Finance',
      monthlyWage: 50000,
      salaryRules: [
        { id: 'R1', name: 'Fixed Allowance', code: 'ALW', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 5000 },
        { id: 'R2', name: 'Fixed Deduction', code: 'DED', sequence: 20, category: 'DEDUCTION', calculationType: 'FIXED', amount: 2000 },
      ],
    };

    const payslip = PayrollEngine.compute(input);

    // Gross = 50000 + 5000 = 55000
    assert.strictEqual(payslip.grossSalary, 55000);
    // Deductions = 2000
    assert.strictEqual(payslip.totalCalculatedDeductions, 2000);
    // Net Salary = 55000 - 2000 = 53000
    assert.strictEqual(payslip.netSalary, 53000);
    assert.strictEqual(payslip.rulesResult?.netSalary, 53000);
  });

  it('5. Percentage earning + percentage deduction produces correct final result', () => {
    const input = {
      employeeId: 'EMP-002',
      employeeName: 'Bob',
      department: 'Sales',
      monthlyWage: 50000,
      salaryRules: [
        { id: 'R1', name: 'Bonus Pct', code: 'BONUS', sequence: 10, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 10 },
        { id: 'R2', name: 'Tax Pct', code: 'TAX', sequence: 20, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 5 },
      ],
    };

    const payslip = PayrollEngine.compute(input);

    // Gross = 50000 + 10% (5000) = 55000
    assert.strictEqual(payslip.grossSalary, 55000);
    // Deductions = 5% of 50000 = 2500
    assert.strictEqual(payslip.totalCalculatedDeductions, 2500);
    // Net Salary = 55000 - 2500 = 52500
    assert.strictEqual(payslip.netSalary, 52500);
    assert.strictEqual(payslip.rulesResult?.netSalary, 52500);
  });

  it('6. Mixed FIXED + PERCENTAGE rules produce correct final result', () => {
    const input = {
      employeeId: 'EMP-003',
      employeeName: 'Charlie',
      department: 'Engineering',
      monthlyWage: 50000,
      salaryRules: [
        { id: 'R1', name: 'Allowance Fixed', code: 'ALW', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 5000 },
        { id: 'R2', name: 'Bonus Pct', code: 'BONUS', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 10 },
        { id: 'R3', name: 'Insurance Fixed', code: 'INS', sequence: 30, category: 'DEDUCTION', calculationType: 'FIXED', amount: 2000 },
        { id: 'R4', name: 'Tax Pct', code: 'TAX', sequence: 40, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 5 },
      ],
    };

    const payslip = PayrollEngine.compute(input);

    // Gross = 50000 + 5000 + 5000 = 60000
    assert.strictEqual(payslip.grossSalary, 60000);
    // Deductions = 2000 + 2500 = 4500
    assert.strictEqual(payslip.totalCalculatedDeductions, 4500);
    // Net Salary = 60000 - 4500 = 55500
    assert.strictEqual(payslip.netSalary, 55500);
    assert.strictEqual(payslip.rulesResult?.netSalary, 55500);
  });

  it('7. Empty rule list produces valid Net Salary (equal to base wage)', () => {
    const input = {
      employeeId: 'EMP-004',
      employeeName: 'Dana',
      department: 'Operations',
      monthlyWage: 50000,
      salaryRules: [],
    };

    const payslip = PayrollEngine.compute(input);

    assert.strictEqual(payslip.grossSalary, 50000);
    assert.strictEqual(payslip.totalCalculatedDeductions, 0);
    assert.strictEqual(payslip.netSalary, 50000);
    assert.strictEqual(payslip.rulesResult?.netSalary, 50000);
  });

  it('8. Repeated calculation with same input produces identical output (pure determinism)', () => {
    const input = {
      employeeId: 'EMP-005',
      employeeName: 'Eve',
      department: 'Marketing',
      monthlyWage: 60000,
      salaryRules: [
        { id: 'R1', name: 'Allowance', code: 'ALW', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 4000 },
        { id: 'R2', name: 'PF', code: 'PF', sequence: 20, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 12 },
      ],
    };

    const firstRun = PayrollEngine.compute(input);

    for (let i = 0; i < 5; i++) {
      const subsequentRun = PayrollEngine.compute(input);
      assert.strictEqual(subsequentRun.grossSalary, firstRun.grossSalary);
      assert.strictEqual(subsequentRun.totalCalculatedDeductions, firstRun.totalCalculatedDeductions);
      assert.strictEqual(subsequentRun.netSalary, firstRun.netSalary);
      assert.strictEqual(subsequentRun.netSalary, 56800); // 64000 - 7200 = 56800
    }
  });

  it('9. Net Salary uses existing Gross Salary rather than recalculating rules', () => {
    // Calling standalone calculateNetSalary consumes pre-calculated gross without re-evaluating rules
    const net = calculateNetSalary(60000, 4500);
    assert.strictEqual(net, 55500);

    // In PayrollEngine.compute, payslip.netSalary exactly matches payslip.grossSalary - payslip.totalCalculatedDeductions
    const input = {
      employeeId: 'EMP-006',
      employeeName: 'Frank',
      department: 'Engineering',
      monthlyWage: 50000,
      salaryRules: [
        { id: 'R1', name: 'Allowance', code: 'ALW', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 10000 },
        { id: 'R2', name: 'Deduction', code: 'DED', sequence: 20, category: 'DEDUCTION', calculationType: 'FIXED', amount: 3000 },
      ],
    };

    const payslip = PayrollEngine.compute(input);
    assert.strictEqual(payslip.netSalary, payslip.grossSalary! - payslip.totalCalculatedDeductions!);
  });

  it('10. Net Salary uses existing Total Deductions rather than duplicating deductions', () => {
    const input = {
      employeeId: 'EMP-007',
      employeeName: 'Grace',
      department: 'HR',
      monthlyWage: 6000,
      unpaidDays: 2, // basic = 3600, dailyRate = 120, unpaidLeaveDeduction = 240
      salaryRules: [
        { id: 'R1', name: 'Tax', code: 'TAX', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 300 },
      ],
    };

    const payslip = PayrollEngine.compute(input);

    // Gross = 6000 (no earning rules)
    assert.strictEqual(payslip.grossSalary, 6000);
    // Unpaid leave deduction = 240
    assert.strictEqual(payslip.unpaidLeaveDeduction, 240);
    // Total deductions = 300 (rule) + 240 (unpaid leave) = 540
    assert.strictEqual(payslip.totalCalculatedDeductions, 540);
    // Net Salary must subtract totalCalculatedDeductions (540) exactly once -> 6000 - 540 = 5460
    assert.strictEqual(payslip.netSalary, 5460);
    // Verify it is not double-deducted (6000 - 540 - 240 = 5220 would be wrong)
    assert.notStrictEqual(payslip.netSalary, 5220);
  });

  it('11. Employee-specific data remains isolated', () => {
    const emp1Input = {
      employeeId: 'EMP-001',
      employeeName: 'Alice',
      department: 'Design',
      monthlyWage: 40000,
      salaryRules: [
        { id: 'R1', name: 'Deduction', code: 'DED', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 2000 },
      ],
    };

    const emp2Input = {
      employeeId: 'EMP-002',
      employeeName: 'Bob',
      department: 'Engineering',
      monthlyWage: 70000,
      salaryRules: [
        { id: 'R1', name: 'Deduction', code: 'DED', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 8000 },
      ],
    };

    const payslip1 = PayrollEngine.compute(emp1Input);
    const payslip2 = PayrollEngine.compute(emp2Input);

    assert.strictEqual(payslip1.grossSalary, 40000);
    assert.strictEqual(payslip1.netSalary, 38000);

    assert.strictEqual(payslip2.grossSalary, 70000);
    assert.strictEqual(payslip2.netSalary, 62000);
  });

  it('12. Salary Structure isolation remains intact', () => {
    const input = {
      employeeId: 'EMP-008',
      employeeName: 'Henry',
      department: 'Sales',
      monthlyWage: 50000,
      salaryStructureId: 'STRUCTURE-A',
      salaryRules: [
        { id: 'R1', name: 'Allowance A', code: 'ALW_A', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 5000, salaryStructureId: 'STRUCTURE-A' },
        { id: 'R2', name: 'Deduction A', code: 'DED_A', sequence: 20, category: 'DEDUCTION', calculationType: 'FIXED', amount: 2000, salaryStructureId: 'STRUCTURE-A' },
        // Foreign rules from STRUCTURE-B must be ignored
        { id: 'R3', name: 'Allowance B', code: 'ALW_B', sequence: 30, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 50000, salaryStructureId: 'STRUCTURE-B' },
        { id: 'R4', name: 'Deduction B', code: 'DED_B', sequence: 40, category: 'DEDUCTION', calculationType: 'FIXED', amount: 20000, salaryStructureId: 'STRUCTURE-B' },
      ],
    };

    const payslip = PayrollEngine.compute(input);

    assert.strictEqual(payslip.grossSalary, 55000);
    assert.strictEqual(payslip.totalCalculatedDeductions, 2000);
    assert.strictEqual(payslip.netSalary, 53000);
  });

  it('13. Attendance summary remains intact and does not distort net salary', () => {
    const input = {
      employeeId: 'EMP-009',
      employeeName: 'Ian',
      department: 'Operations',
      monthlyWage: 50000,
      attendanceSummary: {
        totalRecords: 22,
        presentDays: 20,
        absentDays: 2,
        lateDays: 1,
        overtimeDays: 0,
        totalWorkedHours: 160,
      },
      salaryRules: [
        { id: 'R1', name: 'Allowance', code: 'ALW', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 3000 },
        { id: 'R2', name: 'Deduction', code: 'DED', sequence: 20, category: 'DEDUCTION', calculationType: 'FIXED', amount: 1000 },
      ],
    };

    const payslip = PayrollEngine.compute(input);

    assert.ok(payslip.attendanceSummary);
    assert.strictEqual(payslip.attendanceSummary.presentDays, 20);
    assert.strictEqual(payslip.grossSalary, 53000);
    assert.strictEqual(payslip.totalCalculatedDeductions, 1000);
    assert.strictEqual(payslip.netSalary, 52000);
  });

  it('14. Time-off summary remains intact and flows into net salary via unpaid leave deduction', () => {
    const input = {
      employeeId: 'EMP-010',
      employeeName: 'Julia',
      department: 'Support',
      monthlyWage: 6000,
      timeOffSummary: {
        approvedLeaveDays: 3,
        paidLeaveDays: 0,
        unpaidLeaveDays: 3,
      },
      salaryRules: [
        { id: 'R1', name: 'Fixed Deduction', code: 'DED', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 200 },
      ],
    };

    const payslip = PayrollEngine.compute(input);

    assert.ok(payslip.timeOffSummary);
    assert.strictEqual(payslip.timeOffSummary.unpaidLeaveDays, 3);
    // basic = 3600, daily = 120, unpaidLeaveDeduction = 120 * 3 = 360
    assert.strictEqual(payslip.unpaidLeaveDeduction, 360);
    // Total deductions = 200 + 360 = 560
    assert.strictEqual(payslip.totalCalculatedDeductions, 560);
    // Net Salary = 6000 - 560 = 5440
    assert.strictEqual(payslip.netSalary, 5440);
  });

  it('15. Negative-net scenario follows documented domain behavior', () => {
    // Conceptual prompt example: Gross = 10,000, Deductions = 12,000
    // Default behavior: preserves signed difference (-2000) to represent arrears/debt
    const netDefault = calculateNetSalary(10000, 12000);
    assert.strictEqual(netDefault, -2000);

    // Clamped behavior: when clampNegative option is enabled, clamps to 0
    const netClamped = calculateNetSalary(10000, 12000, { clampNegative: true });
    assert.strictEqual(netClamped, 0);

    // Also supports passing options object as 2nd parameter
    const netClampedDirect = calculateNetSalary(
      { grossSalary: 10000, totalCalculatedDeductions: 12000 },
      { clampNegative: true }
    );
    assert.strictEqual(netClampedDirect, 0);
  });

  it('16. Final result contains expected calculation breakdown', () => {
    const input = {
      employeeId: 'EMP-011',
      employeeName: 'Kevin',
      department: 'Engineering',
      monthlyWage: 50000,
      salaryRules: [
        { id: 'R1', name: 'Basic Allowance', code: 'ALW', sequence: 10, category: 'ALLOWANCE', calculationType: 'FIXED', amount: 5000 },
        { id: 'R2', name: 'Bonus', code: 'BONUS', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 10 },
        { id: 'R3', name: 'PF', code: 'PF', sequence: 30, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 12 },
        { id: 'R4', name: 'Tax', code: 'TAX', sequence: 40, category: 'DEDUCTION', calculationType: 'FIXED', amount: 2500 },
      ],
    };

    const payslip = PayrollEngine.compute(input);

    // Top-level payslip breakdown fields
    assert.strictEqual(payslip.grossSalary, 60000); // 50000 + 5000 + 5000
    assert.strictEqual(payslip.totalCalculatedDeductions, 8500); // 6000 + 2500
    assert.strictEqual(payslip.netSalary, 51500); // 60000 - 8500

    // Detailed rulesResult breakdown
    assert.ok(payslip.rulesResult);
    assert.strictEqual(payslip.rulesResult.grossSalary, 60000);
    assert.strictEqual(payslip.rulesResult.totalDeductions, 8500);
    assert.strictEqual(payslip.rulesResult.netSalary, 51500);
    assert.strictEqual(payslip.rulesResult.earnings, 10000);
    assert.strictEqual(payslip.rulesResult.deductions, 8500);
    assert.strictEqual(payslip.rulesResult.contributions.length, 4);
    assert.strictEqual(payslip.rulesResult.contributions.filter((c: any) => c.categoryType === 'EARNING').length, 2);
    assert.strictEqual(payslip.rulesResult.contributions.filter((c: any) => c.categoryType === 'DEDUCTION').length, 2);
  });
});

describe('PHASE 4.15: Full Calculation Integration Test', () => {
  it('executes complete end-to-end engine-level calculation deterministically without a database', () => {
    // 1. Employee, contract, structure, rules, attendance records, time-off records
    const employee = {
      id: 'EMP-999',
      name: 'Samantha Vance',
      department: 'Engineering',
    };

    const contract = {
      id: 'CNT-999',
      employeeId: 'EMP-999',
      wage: 75000,
      salaryStructureId: 'STR-ENG-01',
    };

    const period: PayrollPeriod = {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    };

    const rules: PayrollSalaryRule[] = [
      { id: 'R-PF', name: 'Provident Fund', code: 'PF', sequence: 40, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 12, salaryStructureId: 'STR-ENG-01' },
      { id: 'R-BASIC', name: 'Basic Allowance', code: 'BASIC_ALW', sequence: 10, category: 'BASIC', calculationType: 'FIXED', amount: 5000, salaryStructureId: 'STR-ENG-01' },
      { id: 'R-HRA', name: 'House Rent Allowance', code: 'HRA', sequence: 20, category: 'ALLOWANCE', calculationType: 'PERCENTAGE', percentage: 20, salaryStructureId: 'STR-ENG-01' },
      { id: 'R-TAX', name: 'Professional Tax', code: 'PTAX', sequence: 50, category: 'DEDUCTION', calculationType: 'FIXED', amount: 200, salaryStructureId: 'STR-ENG-01' },
      { id: 'R-BONUS', name: 'Performance Bonus', code: 'BONUS', sequence: 30, category: 'EARNING', calculationType: 'FIXED', amount: 10000, salaryStructureId: 'STR-ENG-01' },
    ];

    const attendanceRecords: AttendanceRecordInput[] = [
      { id: 'ATT-1', employeeId: 'EMP-999', date: '2026-09-01', workedHours: 8, status: 'PRESENT' },
      { id: 'ATT-2', employeeId: 'EMP-999', date: '2026-09-02', workedHours: 8, status: 'PRESENT' },
      { id: 'ATT-3', employeeId: 'EMP-999', date: '2026-09-03', workedHours: 8, status: 'PRESENT' },
    ];

    const timeOffRecords: TimeOffRecordInput[] = [
      {
        id: 'TO-1',
        employeeId: 'EMP-999',
        leaveType: 'UNPAID',
        startDate: '2026-09-10',
        endDate: '2026-09-10', // 1 unpaid day
        status: 'APPROVED',
      },
    ];

    // Stage 1: Normalize input using preparePayrollCalculationInput
    const prepared = preparePayrollCalculationInput({
      employee,
      contract,
      period,
      attendanceRecords,
      timeOffRecords,
      salaryRules: rules,
    });
    const normalizedInput = prepared.input;

    assert.strictEqual(normalizedInput.employeeId, 'EMP-999');
    assert.strictEqual(normalizedInput.monthlyWage, 75000);
    assert.strictEqual(normalizedInput.salaryStructureId, 'STR-ENG-01');
    assert.ok(normalizedInput.attendanceSummary);
    assert.ok(normalizedInput.timeOffSummary);
    assert.strictEqual(normalizedInput.timeOffSummary.unpaidLeaveDays, 1);

    // Stage 2 to 7: Pure Payroll Engine processes pipeline
    const payslip1 = PayrollEngine.compute(normalizedInput);

    // Assert Stage-by-Stage Results:
    // Base Wage = 75,000
    // Ordered Rules:
    //  Seq 10: BASIC_ALW (Fixed: 5000) -> Earning
    //  Seq 20: HRA (Percentage: 20% of 75000 = 15000) -> Earning
    //  Seq 30: BONUS (Fixed: 10000) -> Earning
    //  Seq 40: PF (Percentage: 12% of 75000 = 9000) -> Deduction
    //  Seq 50: PTAX (Fixed: 200) -> Deduction
    // Total Rule Earnings = 5000 + 15000 + 10000 = 30000
    // Total Rule Deductions = 9000 + 200 = 9200
    //
    // Stage 5: Gross Salary = 75000 + 30000 = 105000
    assert.strictEqual(payslip1.grossSalary, 105000);
    assert.strictEqual(payslip1.rulesResult?.grossSalary, 105000);

    // Stage 6: Total Deductions
    // basic = 75000 * 0.60 = 45000; dailyRate = 45000 / 30 = 1500
    // unpaidLeaveDeduction = 1500 * 1 = 1500
    // totalCalculatedDeductions = 9200 (rules) + 1500 (unpaid leave) = 10700
    assert.strictEqual(payslip1.unpaidLeaveDeduction, 1500);
    assert.strictEqual(payslip1.totalCalculatedDeductions, 10700);
    assert.strictEqual(payslip1.rulesResult?.totalDeductions, 10700);

    // Stage 7: Net Salary = Gross Salary (105000) - Total Deductions (10700) = 94300
    assert.strictEqual(payslip1.netSalary, 94300);
    assert.strictEqual(payslip1.rulesResult?.netSalary, 94300);

    // Pure Determinism Verification: Re-run engine with exact same input produces identical result
    const payslip2 = PayrollEngine.compute(normalizedInput);
    assert.deepStrictEqual(payslip1, payslip2);
    assert.strictEqual(payslip2.netSalary, 94300);
  });
});



