/**
 * PeoplePay360 — Deterministic Payroll Engine
 *
 * Phase 4.1 & Phase 4.2: Foundation & Normalized Input Contract.
 * Phase 4.9: Earnings Calculation.
 * Phase 4.10: Deductions Calculation.
 *
 * The payroll engine executes pure mathematical calculations on normalized inputs.
 * It never initiates database queries, network requests, or side effects.
 */

import type {
  PayrollCalculationInput,
  CalculatedPayslip,
  SalaryRuleContribution,
  NormalizedSalaryRuleInput,
  SalaryRuleCategory,
  SalaryRuleCalculationType,
} from '../types/payroll.types.js';

export type {
  PayrollCalculationInput,
  CalculatedPayslip,
  SalaryRuleContribution,
  NormalizedSalaryRuleInput,
  PayrollInputErrorCode,
} from '../types/payroll.types.js';
export { PayrollInputError } from '../types/payroll.types.js';

// ── Types & Interfaces ───────────────────────────────────────────────────────

/**
 * Legacy input shape preserved for non-breaking backwards compatibility
 * with legacy verification scripts.
 */
export interface LegacyPayrollCalculationInput {
  employeeId: string;
  employeeName: string;
  department: string;
  monthlyWage: number;
  unpaidDays?: number;
  overtimeHours?: number;
}

/**
 * Context provided to rule evaluation functions.
 * Designed as the primary integration point for Pavan's Phase 4.6–4.8 implementation:
 * - Phase 4.6: Rule sequence execution
 * - Phase 4.7: Fixed amount evaluation
 * - Phase 4.8: Percentage rule base evaluation
 */
export interface SalaryRuleEvaluationContext {
  baseWage: number;
  accumulatedEarnings?: number;
  accumulatedDeductions?: number;
  ruleContributions?: Map<string, number>;
}

/**
 * Result of processing all applicable salary rules.
 */
export interface ProcessedSalaryRulesResult {
  earnings: SalaryRuleContribution[];
  deductions: SalaryRuleContribution[];
  totalEarnings: number;
  totalDeductions: number;
}

// ── Helper Utilities ─────────────────────────────────────────────────────────

/**
 * Rounds a financial amount to exactly 2 decimal places to prevent floating-point artifacts.
 */
export function roundMoney(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Determines if a category represents an earning component.
 * Project schema: 'BASIC' and 'ALLOWANCE' are earning categories.
 */
export function isEarningCategory(category: SalaryRuleCategory): boolean {
  return category === 'BASIC' || category === 'ALLOWANCE';
}

/**
 * Determines if a category represents a deduction component.
 * Project schema: 'DEDUCTION' is the deduction category.
 */
export function isDeductionCategory(category: SalaryRuleCategory): boolean {
  return category === 'DEDUCTION';
}

/**
 * Type guard to check if an input is the normalized PayrollCalculationInput.
 */
function isNormalizedInput(
  input: PayrollCalculationInput | LegacyPayrollCalculationInput
): input is PayrollCalculationInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'employee' in input &&
    'contract' in input &&
    'payrollPeriod' in input
  );
}

// ── Rule Contribution Evaluation (Pavan's 4.6–4.8 Integration Point) ──────────

/**
 * Calculates the contribution of an individual salary rule.
 * Expected integration point for Pavan's Phase 4.6 - 4.8 implementation:
 * - Phase 4.6: Sequence Ordering
 * - Phase 4.7: Fixed Amount Rules
 * - Phase 4.8: Percentage Rules
 *
 * Preserves monetary precision (2 decimals) and rejects negative values.
 */
export function calculateSalaryRuleContribution(
  rule: NormalizedSalaryRuleInput,
  context: SalaryRuleEvaluationContext
): number {
  if (rule.calculationType === 'FIXED') {
    // Phase 4.7: Fixed Amount Rules
    const amount = typeof rule.amount === 'number' ? rule.amount : parseFloat(String(rule.amount || '0'));
    if (isNaN(amount) || amount <= 0) return 0;
    return roundMoney(amount);
  }

  if (rule.calculationType === 'PERCENTAGE') {
    // Phase 4.8: Percentage Rules
    const percentage = typeof rule.percentage === 'number' ? rule.percentage : parseFloat(String(rule.percentage || '0'));
    if (isNaN(percentage) || percentage <= 0) return 0;

    // Base calculation: uses base wage from context
    const base = context.baseWage;
    if (base <= 0) return 0;
    const rawContribution = (base * percentage) / 100;
    return roundMoney(rawContribution);
  }

  // Formula or unhandled calculation types evaluate to 0 in Phase 4.9/4.10
  return 0;
}

// ── Phase 4.9: Earnings Calculation ──────────────────────────────────────────

/**
 * Calculates employee earnings from applicable salary rules.
 *
 * Rules:
 * - Only rules belonging to the selected salary structure (or global rules) may contribute.
 * - Inactive rules (active: false) are excluded.
 * - Evaluated in deterministic sequence order (sequence ASC, ruleId ASC).
 * - Only rules with earning categories ('BASIC' or 'ALLOWANCE') contribute.
 * - Earning rules are strictly excluded from deductions.
 * - Empty rules produce totalEarnings = 0 and empty earnings array.
 */
export function calculateEarnings(
  rules: NormalizedSalaryRuleInput[],
  baseWage: number,
  structureId?: string | null
): { totalEarnings: number; earnings: SalaryRuleContribution[] } {
  if (!rules || !Array.isArray(rules) || rules.length === 0 || baseWage < 0) {
    return { totalEarnings: 0, earnings: [] };
  }

  // Filter applicable earning rules
  const applicableRules = rules.filter((r) => {
    if (r.active === false) return false;
    if (structureId && r.structureId && r.structureId !== structureId) return false;
    return isEarningCategory(r.category);
  });

  // Sort deterministically: sequence ASC, ruleId ASC
  applicableRules.sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    return a.ruleId.localeCompare(b.ruleId);
  });

  const context: SalaryRuleEvaluationContext = {
    baseWage: Math.max(0, baseWage),
    accumulatedEarnings: 0,
    ruleContributions: new Map(),
  };

  const earnings: SalaryRuleContribution[] = [];
  let totalEarnings = 0;

  for (const rule of applicableRules) {
    const amount = calculateSalaryRuleContribution(rule, context);
    context.ruleContributions?.set(rule.code, amount);
    totalEarnings = roundMoney(totalEarnings + amount);
    context.accumulatedEarnings = totalEarnings;

    earnings.push({
      ruleId: rule.ruleId,
      code: rule.code,
      name: rule.name,
      category: rule.category,
      calculationType: rule.calculationType,
      sequence: rule.sequence,
      amount,
    });
  }

  return {
    totalEarnings: roundMoney(totalEarnings),
    earnings,
  };
}

// ── Phase 4.10: Deductions Calculation ───────────────────────────────────────

/**
 * Calculates employee deductions from applicable salary rules.
 *
 * Rules:
 * - Only rules belonging to the selected salary structure (or global rules) may contribute.
 * - Inactive rules (active: false) are excluded.
 * - Evaluated in deterministic sequence order (sequence ASC, ruleId ASC).
 * - Only rules with deduction categories ('DEDUCTION') contribute.
 * - Deduction rules are strictly excluded from earnings.
 * - Empty rules produce totalDeductions = 0 and empty deductions array.
 * - Does NOT calculate Net Salary (reserved for Phase 4.15).
 */
export function calculateDeductions(
  rules: NormalizedSalaryRuleInput[],
  baseWage: number,
  structureId?: string | null
): { totalDeductions: number; deductions: SalaryRuleContribution[] } {
  if (!rules || !Array.isArray(rules) || rules.length === 0 || baseWage < 0) {
    return { totalDeductions: 0, deductions: [] };
  }

  // Filter applicable deduction rules
  const applicableRules = rules.filter((r) => {
    if (r.active === false) return false;
    if (structureId && r.structureId && r.structureId !== structureId) return false;
    return isDeductionCategory(r.category);
  });

  // Sort deterministically: sequence ASC, ruleId ASC
  applicableRules.sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    return a.ruleId.localeCompare(b.ruleId);
  });

  const context: SalaryRuleEvaluationContext = {
    baseWage: Math.max(0, baseWage),
    accumulatedDeductions: 0,
    ruleContributions: new Map(),
  };

  const deductions: SalaryRuleContribution[] = [];
  let totalDeductions = 0;

  for (const rule of applicableRules) {
    const amount = calculateSalaryRuleContribution(rule, context);
    context.ruleContributions?.set(rule.code, amount);
    totalDeductions = roundMoney(totalDeductions + amount);
    context.accumulatedDeductions = totalDeductions;

    deductions.push({
      ruleId: rule.ruleId,
      code: rule.code,
      name: rule.name,
      category: rule.category,
      calculationType: rule.calculationType,
      sequence: rule.sequence,
      amount,
    });
  }

  return {
    totalDeductions: roundMoney(totalDeductions),
    deductions,
  };
}

// ── Combined Rule Processor ──────────────────────────────────────────────────

/**
 * Processes all applicable salary rules in deterministic sequence order,
 * cleanly partitioning contributions into earnings and deductions.
 */
export function processSalaryRules(
  rules: NormalizedSalaryRuleInput[],
  baseWage: number,
  structureId?: string | null
): ProcessedSalaryRulesResult {
  if (!rules || !Array.isArray(rules) || rules.length === 0 || baseWage < 0) {
    return {
      earnings: [],
      deductions: [],
      totalEarnings: 0,
      totalDeductions: 0,
    };
  }

  // Filter applicable rules (structure match and active)
  const applicable = rules.filter((r) => {
    if (r.active === false) return false;
    if (structureId && r.structureId && r.structureId !== structureId) return false;
    // Exclude summary categories like GROSS and NET
    return isEarningCategory(r.category) || isDeductionCategory(r.category);
  });

  // Sort deterministically: sequence ASC, ruleId ASC
  applicable.sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    return a.ruleId.localeCompare(b.ruleId);
  });

  const context: SalaryRuleEvaluationContext = {
    baseWage: Math.max(0, baseWage),
    accumulatedEarnings: 0,
    accumulatedDeductions: 0,
    ruleContributions: new Map(),
  };

  const earnings: SalaryRuleContribution[] = [];
  const deductions: SalaryRuleContribution[] = [];
  let totalEarnings = 0;
  let totalDeductions = 0;

  for (const rule of applicable) {
    const amount = calculateSalaryRuleContribution(rule, context);
    context.ruleContributions?.set(rule.code, amount);

    if (isEarningCategory(rule.category)) {
      totalEarnings = roundMoney(totalEarnings + amount);
      context.accumulatedEarnings = totalEarnings;
      earnings.push({
        ruleId: rule.ruleId,
        code: rule.code,
        name: rule.name,
        category: rule.category,
        calculationType: rule.calculationType,
        sequence: rule.sequence,
        amount,
      });
    } else if (isDeductionCategory(rule.category)) {
      totalDeductions = roundMoney(totalDeductions + amount);
      context.accumulatedDeductions = totalDeductions;
      deductions.push({
        ruleId: rule.ruleId,
        code: rule.code,
        name: rule.name,
        category: rule.category,
        calculationType: rule.calculationType,
        sequence: rule.sequence,
        amount,
      });
    }
  }

  return {
    earnings,
    deductions,
    totalEarnings: roundMoney(totalEarnings),
    totalDeductions: roundMoney(totalDeductions),
  };
}

// ── Payroll Engine Class ─────────────────────────────────────────────────────

export class PayrollEngine {
  /**
   * Primary entry point for calculating salary rule contribution (Phase 4.6–4.8 integration point).
   */
  public static calculateRuleContribution(
    rule: NormalizedSalaryRuleInput,
    context: SalaryRuleEvaluationContext
  ): number {
    return calculateSalaryRuleContribution(rule, context);
  }

  /**
   * Primary entry point for Phase 4.9: Earnings Calculation.
   */
  public static calculateEarnings(
    rules: NormalizedSalaryRuleInput[],
    baseWage: number,
    structureId?: string | null
  ): { totalEarnings: number; earnings: SalaryRuleContribution[] } {
    return calculateEarnings(rules, baseWage, structureId);
  }

  /**
   * Primary entry point for Phase 4.10: Deductions Calculation.
   */
  public static calculateDeductions(
    rules: NormalizedSalaryRuleInput[],
    baseWage: number,
    structureId?: string | null
  ): { totalDeductions: number; deductions: SalaryRuleContribution[] } {
    return calculateDeductions(rules, baseWage, structureId);
  }

  /**
   * Primary entry point for combined salary rule processing.
   */
  public static processSalaryRules(
    rules: NormalizedSalaryRuleInput[],
    baseWage: number,
    structureId?: string | null
  ): ProcessedSalaryRulesResult {
    return processSalaryRules(rules, baseWage, structureId);
  }

  /**
   * Computes deterministic payslip figures from calculation input.
   *
   * Operates purely in-memory with zero database queries:
   * - Calculates rule-based earnings (Phase 4.9) and deductions (Phase 4.10).
   * - Exposes totalEarnings, earnings, and deductions in the result.
   * - Preserves backwards compatibility for gross (Phase 4.13) and net (Phase 4.15).
   * - Preserves verified payroll baseline ($40,000 Gross / $33,074 Net).
   */
  public static compute(
    input: PayrollCalculationInput | LegacyPayrollCalculationInput
  ): CalculatedPayslip {
    let employeeId: string;
    let employeeName: string;
    let department: string;
    let monthlyWage: number;
    let unpaidDays: number;
    let structureId: string | null = null;
    let rules: NormalizedSalaryRuleInput[] = [];

    if (isNormalizedInput(input)) {
      employeeId = input.employee.employeeId;
      employeeName = input.employee.fullName;
      department = input.employee.department;
      monthlyWage = input.contract.wage;
      unpaidDays = input.timeOff?.summary?.approvedUnpaidDays || 0;
      structureId = input.salaryStructure?.structureId || input.contract.salaryStructureId || null;
      rules = input.salaryRules || [];
    } else {
      employeeId = input.employeeId;
      employeeName = input.employeeName;
      department = input.department;
      monthlyWage = input.monthlyWage;
      unpaidDays = input.unpaidDays || 0;
    }

    // Process applicable salary rules for earnings (Phase 4.9) and deductions (Phase 4.10)
    const ruleResult = processSalaryRules(rules, monthlyWage, structureId);
    const hasRules = rules.length > 0;

    let basic: number;
    let hra: number;
    let allowance: number;
    let tax: number;
    let otherDeductions: number;
    let totalDeductions: number;

    if (hasRules) {
      // Database/rule-driven component extraction
      const basicRule = ruleResult.earnings.find((r) => r.code === 'BASIC' || r.category === 'BASIC');
      const hraRule = ruleResult.earnings.find((r) => r.code === 'HRA');
      const taxRule = ruleResult.deductions.find((r) => r.code === 'TAX');

      basic = basicRule ? basicRule.amount : Math.round(monthlyWage * 0.60);
      hra = hraRule ? hraRule.amount : Math.round(monthlyWage * 0.25);
      allowance = roundMoney(
        ruleResult.earnings
          .filter((r) => r !== basicRule && r !== hraRule)
          .reduce((sum, r) => sum + r.amount, 0)
      );

      // If allowance rule not explicitly defined, ensure total earnings consistency
      if (allowance === 0 && ruleResult.totalEarnings > basic + hra) {
        allowance = roundMoney(ruleResult.totalEarnings - basic - hra);
      }

      tax = taxRule ? taxRule.amount : Math.round(monthlyWage * 0.10);
      otherDeductions = roundMoney(
        ruleResult.deductions
          .filter((r) => r !== taxRule)
          .reduce((sum, r) => sum + r.amount, 0)
      );

      const dailyRate = basic / 30;
      const unpaidLeaveDeduction = Math.round(dailyRate * unpaidDays);
      totalDeductions = roundMoney(ruleResult.totalDeductions + unpaidLeaveDeduction);

      const gross = monthlyWage;
      const net = gross - totalDeductions;

      return {
        employeeId,
        employeeName,
        department,
        basic,
        hra,
        allowance,
        gross,
        tax,
        unpaidLeaveDeduction,
        otherDeductions,
        totalDeductions,
        net,
        totalEarnings: ruleResult.totalEarnings,
        earnings: ruleResult.earnings,
        deductions: ruleResult.deductions,
      };
    }

    // Baseline fallback when no rules are passed (e.g. legacy callers or baseline checks)
    basic = Math.round(monthlyWage * 0.60);
    hra = Math.round(monthlyWage * 0.25);
    allowance = monthlyWage - basic - hra;
    const gross = monthlyWage;

    const dailyRate = basic / 30;
    const unpaidLeaveDeduction = Math.round(dailyRate * unpaidDays);

    tax = Math.round(gross * 0.10);
    otherDeductions = Math.round(gross * 0.07);
    totalDeductions = tax + otherDeductions + unpaidLeaveDeduction;

    const net = gross - totalDeductions;

    return {
      employeeId,
      employeeName,
      department,
      basic,
      hra,
      allowance,
      gross,
      tax,
      unpaidLeaveDeduction,
      otherDeductions,
      totalDeductions,
      net,
      totalEarnings: 0,
      earnings: [],
      deductions: [],
    };
  }
}

