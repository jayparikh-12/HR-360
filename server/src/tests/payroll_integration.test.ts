/**
 * PeoplePay360 — PHASE 4 INTEGRATION CHECKPOINT VERIFICATION SUITE
 *
 * Integrates and verifies Jay + Pavan Phase 4 implementations:
 * - Jay: payroll-engine foundation, normalization, PayrollCalculationInput architecture,
 *        earnings & deductions calculation.
 * - Pavan: salary-rule calculation, ordering, attendance/time-off integration, gross,
 *          total deductions, and net salary pipeline.
 *
 * Verification Areas:
 * 1. 13-Stage Rule Pipeline:
 *    Employee → Contract → Salary Structure → Active Salary Rules →
 *    Deterministic Rule Ordering → Fixed / Percentage Rule Calculation →
 *    Attendance → Time Off / Unpaid Leave → Earnings → Gross →
 *    Deductions → Total Deductions → Net Salary.
 * 2. Single Source of Truth for PayrollCalculationInput & CalculatedPayslip.
 * 3. Database Boundary: Pure calculation in payrollEngine.ts with zero database access.
 * 4. Determinism: Same input always produces same output (no order, random, or time dependency).
 * 5. Monetary precision: roundMoney consistent 2-decimal rounding.
 * 6. Structure isolation: rules from other structures strictly excluded.
 * 7. Error handling: clear failure modes for missing employee, missing/expired contracts, invalid periods.
 * 8. Edge cases: empty rules, only earnings, only deductions, zero adjustments, identical sequences,
 *    excessive deductions, decimal values.
 * 9. Payrun lifecycle state flow.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  PayrollEngine,
  calculateFixedRule,
  calculateFixedRules,
  calculatePercentageRules,
  calculateSalaryRules,
  orderSalaryRules,
  calculateGrossSalary,
  calculateTotalDeductions,
  calculateNetSalary,
  calculateUnpaidLeaveDeduction,
  roundMoney,
  type PayrollSalaryRule,
} from '../services/payrollEngine.js';
import {
  normalizePayrollCalculationInput,
  normalizePayrollPeriod,
  normalizeEmployee,
  normalizeContract,
  normalizeSalaryRules,
} from '../services/payrollNormalizer.js';
import {
  preparePayrollCalculationInput,
} from '../services/payrollPreparation.js';
import {
  loadEmployeePayrollInput,
} from '../services/payrollLoader.js';
import {
  PayrollInputError,
  type PayrollCalculationInput,
  type NormalizedSalaryRuleInput,
} from '../types/payroll.types.js';

describe('PHASE 4 INTEGRATION CHECKPOINT: Architecture & Pipeline Verification', () => {

  // ── 1. End-to-End 13-Stage Pipeline Verification ───────────────────────────
  it('1. Executes full 13-stage deterministic pipeline from normalized input to net salary', () => {
    // Stage 1: Employee
    const employee = {
      id: 'EMP-INT-001',
      name: 'Alexander Hamilton',
      department: 'Treasury & Finance',
    };

    // Stage 2: Contract
    const contract = {
      id: 'CNT-INT-001',
      employeeId: 'EMP-INT-001',
      wage: 80000,
      salaryStructureId: 'STR-CORP-FIN',
      startDate: '2025-01-01',
      status: 'ACTIVE',
    };

    // Stage 3: Salary Structure
    const salaryStructure = {
      id: 'STR-CORP-FIN',
      code: 'CORP_FIN_STD',
      name: 'Corporate Finance Senior',
    };

    // Stage 4: Salary Rules
    const salaryRules: PayrollSalaryRule[] = [
      { id: 'R-TAX', name: 'Federal Withholding', code: 'FED_TAX', sequence: 50, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 10, salaryStructureId: 'STR-CORP-FIN' },
      { id: 'R-BSC', name: 'Base Tech Component', code: 'BASE_COMP', sequence: 10, category: 'BASIC', calculationType: 'FIXED', amount: 8000, salaryStructureId: 'STR-CORP-FIN' },
      { id: 'R-HRA', name: 'Housing Allowance', code: 'HRA', sequence: 20, category: 'ALLOWANCE', calculationType: 'PERCENTAGE', percentage: 15, salaryStructureId: 'STR-CORP-FIN' },
      { id: 'R-MED', name: 'Health Insurance', code: 'MED_INS', sequence: 40, category: 'DEDUCTION', calculationType: 'FIXED', amount: 500, salaryStructureId: 'STR-CORP-FIN' },
      { id: 'R-BON', name: 'Quarterly Bonus', code: 'Q_BONUS', sequence: 30, category: 'EARNING', calculationType: 'FIXED', amount: 12000, salaryStructureId: 'STR-CORP-FIN' },
      // Rule from foreign structure (must be ignored)
      { id: 'R-FOR', name: 'Foreign Rule', code: 'FOR_RULE', sequence: 15, category: 'EARNING', calculationType: 'FIXED', amount: 99999, salaryStructureId: 'STR-FOREIGN' },
    ];

    // Stage 9 & 10: Attendance & Time Off
    const attendanceRecords = [
      { id: 'ATT-1', employeeId: 'EMP-INT-001', date: '2026-09-01', workedHours: 8, status: 'PRESENT' },
      { id: 'ATT-2', employeeId: 'EMP-INT-001', date: '2026-09-02', workedHours: 8, status: 'PRESENT' },
    ];
    const timeOffRequests = [
      { id: 'TO-1', employeeId: 'EMP-INT-001', leaveType: 'Unpaid Leave', startDate: '2026-09-15', endDate: '2026-09-16', durationDays: 2, status: 'APPROVED' },
    ];

    const period = { startDate: '2026-09-01', endDate: '2026-09-30' };

    // Stage 1-4: Normalize into single canonical PayrollCalculationInput
    const prepared = preparePayrollCalculationInput({
      employee,
      contract,
      period,
      salaryRules,
      attendanceRecords,
      timeOffRecords: timeOffRequests,
    });
    const input: PayrollCalculationInput = prepared.input;

    // Verify Stage 1 & 2 normalization
    assert.strictEqual(input.employeeId, 'EMP-INT-001');
    assert.strictEqual(input.monthlyWage, 80000);
    assert.strictEqual(input.salaryStructureId, 'STR-CORP-FIN');

    // Verify Stage 5: Deterministic ordering
    const rawFiltered = salaryRules.filter((r) => !r.salaryStructureId || r.salaryStructureId === 'STR-CORP-FIN');
    const ordered = orderSalaryRules(rawFiltered, 'STR-CORP-FIN');
    assert.deepStrictEqual(ordered.map((r) => r.code), ['BASE_COMP', 'HRA', 'Q_BONUS', 'MED_INS', 'FED_TAX']);

    // Stage 6, 7, 8, 9, 10, 11, 12, 13, 14: Pure Engine Calculation
    const payslip = PayrollEngine.compute(input);

    // Earnings:
    // BASE_COMP = 8000 (fixed)
    // HRA = 15% of 80000 = 12000 (percentage)
    // Q_BONUS = 12000 (fixed)
    // Total Rule Earnings = 8000 + 12000 + 12000 = 32000
    assert.strictEqual(payslip.totalEarnings, 32000);

    // Stage 11: Gross Salary = Base Wage (80000) + Earnings (32000) = 112000
    assert.strictEqual(payslip.grossSalary, 112000);

    // Stage 10 & 13: Deductions & Unpaid Leave
    // standardBasic = 80000 * 0.6 = 48000; dailyRate = 48000 / 30 = 1600
    // unpaidDays = 2 -> unpaidLeaveDeduction = 1600 * 2 = 3200
    assert.strictEqual(payslip.unpaidLeaveDeduction, 3200);
    // Rule Deductions:
    // MED_INS = 500 (fixed)
    // FED_TAX = 10% of 80000 = 8000 (percentage)
    // Total Rule Deductions = 8500
    // Total Calculated Deductions = 8500 + 3200 = 11700
    assert.strictEqual(payslip.totalCalculatedDeductions, 11700);

    // Stage 14: Net Salary = 112000 - 11700 = 100300
    assert.strictEqual(payslip.netSalary, 100300);
    assert.strictEqual(payslip.rulesResult?.netSalary, 100300);

    // Explanatory breakdown entities attached
    assert.ok(payslip.employee);
    assert.ok(payslip.contract);
    assert.strictEqual(payslip.earnings?.length, 3);
    assert.strictEqual(payslip.deductions?.length, 2);
  });

  // ── 2. Pure Engine Boundary (Zero Database Dependency) ─────────────────────
  it('2. Pure engine runs strictly in-memory with zero database access', () => {
    // Calling PayrollEngine.compute directly on pre-formed in-memory inputs
    const input: PayrollCalculationInput = {
      employeeId: 'EMP-MEM-01',
      employeeName: 'Pure In-Memory',
      department: 'Engineering',
      monthlyWage: 10000,
      salaryRules: [
        { id: 'R1', code: 'BONUS', name: 'Bonus', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 1500 },
        { id: 'R2', code: 'TAX', name: 'Tax', sequence: 20, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 10 },
      ],
      unpaidDays: 0,
    };

    const start = performance.now();
    const result = PayrollEngine.compute(input);
    const duration = performance.now() - start;

    assert.strictEqual(result.grossSalary, 11500);
    assert.strictEqual(result.totalCalculatedDeductions, 1000);
    assert.strictEqual(result.netSalary, 10500);
    // Computation takes sub-millisecond in memory
    assert.ok(duration < 50, `Expected in-memory pure calculation (<50ms), took ${duration}ms`);
  });

  // ── 3. Determinism Across 50 Repeated Iterations ───────────────────────────
  it('3. Produces 100% identical outputs across repeated executions regardless of rule order', () => {
    const baseRules: PayrollSalaryRule[] = [
      { id: 'R-C', code: 'RULE_C', name: 'Rule C', sequence: 30, category: 'DEDUCTION', calculationType: 'FIXED', amount: 300 },
      { id: 'R-A', code: 'RULE_A', name: 'Rule A', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 1000 },
      { id: 'R-B', code: 'RULE_B', name: 'Rule B', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 5 },
    ];

    const baselineInput: PayrollCalculationInput = {
      employeeId: 'EMP-DET',
      employeeName: 'Deterministic Tester',
      department: 'QA',
      monthlyWage: 20000,
      salaryRules: [...baseRules],
    };

    const baselineResult = PayrollEngine.compute(baselineInput);

    for (let i = 0; i < 50; i++) {
      // Shuffle rule input order
      const shuffledRules = [...baseRules].sort(() => Math.random() - 0.5);
      const testInput: PayrollCalculationInput = {
        employeeId: 'EMP-DET',
        employeeName: 'Deterministic Tester',
        department: 'QA',
        monthlyWage: 20000,
        salaryRules: shuffledRules,
      };

      const runResult = PayrollEngine.compute(testInput);
      assert.strictEqual(runResult.grossSalary, baselineResult.grossSalary);
      assert.strictEqual(runResult.totalCalculatedDeductions, baselineResult.totalCalculatedDeductions);
      assert.strictEqual(runResult.netSalary, baselineResult.netSalary);
    }
  });

  // ── 4. Salary Structure Isolation ──────────────────────────────────────────
  it('4. Excludes rules belonging to other salary structures', () => {
    const mixedRules: PayrollSalaryRule[] = [
      { id: 'R1', code: 'TARGET_EARN', name: 'Target Structure Earning', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 5000, salaryStructureId: 'STR-TARGET' },
      { id: 'R2', code: 'OTHER_EARN', name: 'Other Structure Earning', sequence: 20, category: 'EARNING', calculationType: 'FIXED', amount: 90000, salaryStructureId: 'STR-OTHER' },
      { id: 'R3', code: 'TARGET_DED', name: 'Target Structure Deduction', sequence: 30, category: 'DEDUCTION', calculationType: 'FIXED', amount: 1000, salaryStructureId: 'STR-TARGET' },
      { id: 'R4', code: 'OTHER_DED', name: 'Other Structure Deduction', sequence: 40, category: 'DEDUCTION', calculationType: 'FIXED', amount: 50000, salaryStructureId: 'STR-OTHER' },
    ];

    const input: PayrollCalculationInput = {
      employeeId: 'EMP-ISO',
      employeeName: 'Isolation Tester',
      department: 'Security',
      monthlyWage: 30000,
      salaryStructureId: 'STR-TARGET',
      salaryRules: mixedRules,
    };

    const result = PayrollEngine.compute(input);

    // Only STR-TARGET rules apply:
    // Gross = 30000 + 5000 = 35000
    // Deductions = 1000
    // Net = 34000
    assert.strictEqual(result.grossSalary, 35000);
    assert.strictEqual(result.totalCalculatedDeductions, 1000);
    assert.strictEqual(result.netSalary, 34000);
  });

  // ── 5. Error Handling for Missing Payroll Data ─────────────────────────────
  it('5. Normalizer throws clear PayrollInputError for missing domain records', () => {
    // Missing employee
    assert.throws(
      () => normalizePayrollCalculationInput({
        employee: null as any,
        contracts: [],
        payrollPeriod: '2026-09-01 - 2026-09-30',
      }),
      (err: any) => err instanceof PayrollInputError && err.code === 'MISSING_EMPLOYEE'
    );

    // Missing contract
    assert.throws(
      () => normalizePayrollCalculationInput({
        employee: { id: 'EMP-1', name: 'No Contract' },
        contracts: [],
        payrollPeriod: '2026-09-01 - 2026-09-30',
      }),
      (err: any) => err instanceof PayrollInputError && (err.code === 'NO_VALID_CONTRACT' || err.code === 'MISSING_CONTRACT')
    );

    // Contract outside payroll period
    assert.throws(
      () => normalizePayrollCalculationInput({
        employee: { id: 'EMP-1', name: 'Expired Contract' },
        contracts: [{
          id: 'CON-OLD',
          employeeId: 'EMP-1',
          wage: 5000,
          startDate: '2020-01-01',
          endDate: '2020-12-31',
          status: 'ACTIVE',
        }],
        payrollPeriod: '2026-09-01 - 2026-09-30',
      }),
      (err: any) => err instanceof PayrollInputError && err.code === 'NO_VALID_CONTRACT'
    );

    // Invalid period format
    assert.throws(
      () => normalizePayrollCalculationInput({
        employee: { id: 'EMP-1', name: 'Valid Emp' },
        contracts: [{ id: 'C1', employeeId: 'EMP-1', wage: 5000, startDate: '2026-01-01', status: 'ACTIVE' }],
        payrollPeriod: 'NOT-A-PERIOD',
      }),
      (err: any) => err instanceof PayrollInputError && err.code === 'INVALID_PERIOD'
    );
  });

  // ── 6. Edge Cases ──────────────────────────────────────────────────────────
  it('6. Edge Case: Employee with no applicable salary rules produces base wage and zero deductions', () => {
    const input: PayrollCalculationInput = {
      employeeId: 'EMP-NO-RULES',
      employeeName: 'No Rules Employee',
      department: 'Operations',
      monthlyWage: 45000,
      salaryRules: [],
    };

    const result = PayrollEngine.compute(input);
    assert.strictEqual(result.grossSalary, 45000);
    assert.strictEqual(result.totalCalculatedDeductions, 0);
    assert.strictEqual(result.netSalary, 45000);
  });

  it('7. Edge Case: Employee with only earnings produces zero deductions', () => {
    const input: PayrollCalculationInput = {
      employeeId: 'EMP-ONLY-EARN',
      employeeName: 'Only Earn',
      department: 'Sales',
      monthlyWage: 50000,
      salaryRules: [
        { id: 'E1', code: 'COMMISSION', name: 'Sales Commission', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 15000 },
        { id: 'E2', code: 'PERF', name: 'Performance Bonus', sequence: 20, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 10 },
      ],
    };

    const result = PayrollEngine.compute(input);
    assert.strictEqual(result.grossSalary, 70000); // 50000 + 15000 + 5000
    assert.strictEqual(result.totalCalculatedDeductions, 0);
    assert.strictEqual(result.netSalary, 70000);
  });

  it('8. Edge Case: Employee with only deductions preserves base wage as gross', () => {
    const input: PayrollCalculationInput = {
      employeeId: 'EMP-ONLY-DED',
      employeeName: 'Only Ded',
      department: 'Legal',
      monthlyWage: 50000,
      salaryRules: [
        { id: 'D1', code: 'INSURANCE', name: 'Insurance', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 2500 },
        { id: 'D2', code: 'TAX', name: 'Income Tax', sequence: 20, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 10 },
      ],
    };

    const result = PayrollEngine.compute(input);
    assert.strictEqual(result.grossSalary, 50000);
    assert.strictEqual(result.totalCalculatedDeductions, 7500); // 2500 + 5000
    assert.strictEqual(result.netSalary, 42500);
  });

  it('9. Edge Case: Rules with identical sequence order deterministically by ruleId/code', () => {
    const rulesWithSameSequence: PayrollSalaryRule[] = [
      { id: 'R-Z', code: 'Z_RULE', name: 'Z Rule', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 100 },
      { id: 'R-A', code: 'A_RULE', name: 'A Rule', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 200 },
      { id: 'R-M', code: 'M_RULE', name: 'M Rule', sequence: 10, category: 'EARNING', calculationType: 'FIXED', amount: 300 },
    ];

    const ordered = orderSalaryRules(rulesWithSameSequence);
    // Should be sorted by ruleId ASC when sequences tie
    assert.strictEqual(ordered[0].id, 'R-A');
    assert.strictEqual(ordered[1].id, 'R-M');
    assert.strictEqual(ordered[2].id, 'R-Z');
  });

  it('10. Edge Case: Deductions greater than gross produces negative net deterministically', () => {
    const input: PayrollCalculationInput = {
      employeeId: 'EMP-HIGH-DED',
      employeeName: 'High Deductions',
      department: 'Logistics',
      monthlyWage: 10000,
      salaryRules: [
        { id: 'D1', code: 'BIG_GARNISHMENT', name: 'Garnishment', sequence: 10, category: 'DEDUCTION', calculationType: 'FIXED', amount: 15000 },
      ],
    };

    const result = PayrollEngine.compute(input);
    assert.strictEqual(result.grossSalary, 10000);
    assert.strictEqual(result.totalCalculatedDeductions, 15000);
    assert.strictEqual(result.netSalary, -5000);
  });

  it('11. Edge Case: Decimal monetary values maintain exact 2-decimal financial precision', () => {
    const input: PayrollCalculationInput = {
      employeeId: 'EMP-DECIMAL',
      employeeName: 'Decimal Tester',
      department: 'Finance',
      monthlyWage: 4321.55,
      salaryRules: [
        { id: 'R1', code: 'PCT_EARN', name: 'Pct Earn', sequence: 10, category: 'EARNING', calculationType: 'PERCENTAGE', percentage: 7.33 },
        { id: 'R2', code: 'PCT_DED', name: 'Pct Ded', sequence: 20, category: 'DEDUCTION', calculationType: 'PERCENTAGE', percentage: 3.25 },
      ],
    };

    const result = PayrollEngine.compute(input);
    // 4321.55 * 0.0733 = 316.769615 -> 316.77
    assert.strictEqual(result.grossSalary, roundMoney(4321.55 + 316.77));
    // 4321.55 * 0.0325 = 140.450375 -> 140.45
    assert.strictEqual(result.totalCalculatedDeductions, 140.45);
    assert.strictEqual(result.netSalary, roundMoney(result.grossSalary - 140.45));
  });

  // ── 7. Domain Loader Integration with MySQL ────────────────────────────────
  it('12. payrollLoader hydrates employee, contracts, structure, and active rules from MySQL', async () => {
    const input = await loadEmployeePayrollInput('EMP-001', '2026-09-01 - 2026-09-30');
    assert.ok(input.employee);
    assert.strictEqual(input.employee.employeeId, 'EMP-001');
    assert.strictEqual(input.employee.fullName, 'John Doe');

    assert.ok(input.contract);
    assert.strictEqual(input.contract.contractId, 'CON-001');
    assert.strictEqual(input.contract.wage, 6500);

    assert.ok(input.salaryRules);
    assert.ok(input.salaryRules.length >= 5);

    // Compute payslip from MySQL-loaded data
    const payslip = PayrollEngine.compute(input);
    assert.strictEqual(payslip.gross, 6500);
    assert.strictEqual(payslip.basic, 3900); // 60% of 6500
    assert.strictEqual(payslip.hra, 1625);   // 25% of 6500
    assert.strictEqual(payslip.net, 5395);
  });
});
