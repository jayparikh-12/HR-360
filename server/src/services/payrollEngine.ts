// Deterministic Payroll Calculation Engine — PeoplePay360
// Phase 4.6 (Salary Rule Ordering), Phase 4.7 (Fixed Amount Rules), & Phase 4.8 (Percentage-Based Rules)

/**
 * Deterministically rounds money amounts to 2 decimal places using standard financial round-half-up.
 * Mitigates IEEE-754 floating-point inaccuracies (e.g., 0.1 + 0.2 = 0.30000000000000004).
 */
export function roundMoney(amount: number): number {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export type RuleCategoryType = 'EARNING' | 'DEDUCTION' | 'OTHER';

/**
 * Classifies a salary rule category into standard payroll accounting buckets.
 * Aligns with the project's MySQL schema ('BASIC', 'ALLOWANCE', 'GROSS', 'DEDUCTION', 'NET')
 * as well as standard domain categories ('EARNING', 'EARNINGS', 'DEDUCTION', 'DEDUCTIONS').
 */
export function classifyRuleCategory(rawCategory: string): RuleCategoryType {
  const norm = (rawCategory || '').trim().toUpperCase();
  if (norm === 'EARNING' || norm === 'EARNINGS' || norm === 'BASIC' || norm === 'ALLOWANCE') {
    return 'EARNING';
  }
  if (norm === 'DEDUCTION' || norm === 'DEDUCTIONS') {
    return 'DEDUCTION';
  }
  return 'OTHER';
}

/**
 * Salary Rule contract consumed by the pure deterministic Payroll Engine.
 * Independent of ORMs, databases, and network transports.
 */
export interface PayrollSalaryRule {
  id: string;
  name: string;
  code: string;
  sequence: number;
  category: string; // 'BASIC' | 'ALLOWANCE' | 'EARNING' | 'DEDUCTION' | etc.
  calculationType: string; // 'FIXED' | 'PERCENTAGE' | 'FORMULA'
  amount?: number | string | null;
  percentage?: number | string | null;
  formula?: string | null;
  structureId?: string | null;
  structure_id?: string | null; // Compatibility with raw snake_case records
  salaryStructureId?: string | null; // Compatibility with camelCase structure ID
  calculation_type?: string; // Compatibility with raw snake_case records
  status?: string;
  isActive?: boolean;
  base?: number | string | null; // Optional explicit calculation base
  percentageBase?: string | null; // Optional base component reference (e.g. 'WAGE', 'BASIC')
}

/**
 * Individual rule contribution record from a deterministic calculation pass.
 */
export interface CalculatedRuleContribution {
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  category: string;
  categoryType: RuleCategoryType;
  calculationType: string; // 'FIXED' | 'PERCENTAGE'
  sequence: number;
  amount: number;
  percentage?: number | null;
  base?: number | null;
}

/**
 * Result of executing salary rules (fixed, percentage, or combined).
 */
export interface RulesCalculationResult {
  orderedRules: PayrollSalaryRule[];
  contributions: CalculatedRuleContribution[];
  earnings: number;
  deductions: number;
  byCategory: Record<string, number>;
  byRuleCode: Record<string, number>;
  fixedEarnings: number;
  fixedDeductions: number;
  percentageEarnings: number;
  percentageDeductions: number;
  // Phase 4.13, Phase 4.14 & Phase 4.15 extensions
  grossSalary?: number;
  totalDeductions?: number;
  netSalary?: number;
}

// Backward compatibility alias for Phase 4.7
export type FixedRulesCalculationResult = RulesCalculationResult;

export interface RuleCalculationContext {
  baseWage: number;
  accumulatedEarnings: number;
  accumulatedDeductions: number;
  ruleContributions: Record<string, number>;
}

export interface CalculateRulesOptions {
  salaryStructureId?: string | null;
  baseWage?: number; // Base contract wage for percentage calculation
  clampNegative?: boolean; // If true, clamps negative values to 0 instead of throwing domain validation error
  contextBases?: {
    wage?: number;
    basic?: number;
    earnings?: number;
    gross?: number;
    [key: string]: number | undefined;
  };
  resolveBase?: (rule: PayrollSalaryRule, context: RuleCalculationContext) => number;
}

// Backward compatibility alias for Phase 4.7
export type CalculateFixedRulesOptions = CalculateRulesOptions;

export interface CalculateGrossSalaryOptions extends CalculateRulesOptions {
  salaryStructureId?: string | null;
  baseWage?: number;
}

export interface CalculateTotalDeductionsOptions extends CalculateRulesOptions {
  salaryStructureId?: string | null;
  baseWage?: number;
  unpaidLeaveDeduction?: number;
  additionalDeductions?: number;
}

export interface CalculateNetSalaryOptions {
  clampNegative?: boolean; // If true, clamps negative net salary to 0
}

/**
 * PHASE 4.6 — Salary Rule Ordering
 *
 * Deterministically filters and sorts salary rules for a calculation context.
 * Rules are ordered by:
 *   1. sequence ASC (numerical)
 *   2. id ASC (deterministic secondary tie-breaker)
 *   3. code ASC (deterministic tertiary tie-breaker)
 *
 * Filtering rules:
 * - If salaryStructureId is provided, excludes rules belonging to other salary structures.
 * - Filters out inactive rules if status or isActive is present.
 * - Never mutates the input array.
 * - Never depends on database return order or object property insertion order.
 */
export function orderSalaryRules(
  rules: PayrollSalaryRule[],
  salaryStructureId?: string | null
): PayrollSalaryRule[] {
  if (!Array.isArray(rules) || rules.length === 0) {
    return [];
  }

  const eligible = rules.filter((rule) => {
    if (!rule || typeof rule !== 'object') return false;

    // Structure isolation: rules from another salary structure must not be applied
    if (salaryStructureId) {
      const ruleStruct = rule.salaryStructureId ?? rule.structureId ?? rule.structure_id;
      if (ruleStruct && ruleStruct !== salaryStructureId) {
        return false;
      }
    }

    // Status / applicability checks
    if (rule.status !== undefined && rule.status !== null) {
      const statusUpper = String(rule.status).trim().toUpperCase();
      if (statusUpper !== 'ACTIVE' && statusUpper !== '') {
        return false;
      }
    }
    if (rule.isActive === false) {
      return false;
    }

    return true;
  });

  return [...eligible].sort((a, b) => {
    const seqA = typeof a.sequence === 'number' ? a.sequence : parseInt(String(a.sequence), 10) || 0;
    const seqB = typeof b.sequence === 'number' ? b.sequence : parseInt(String(b.sequence), 10) || 0;

    if (seqA !== seqB) {
      return seqA - seqB;
    }

    const idA = String(a.id || '');
    const idB = String(b.id || '');
    const idComp = idA.localeCompare(idB);
    if (idComp !== 0) {
      return idComp;
    }

    const codeA = String(a.code || '');
    const codeB = String(b.code || '');
    return codeA.localeCompare(codeB);
  });
}

/**
 * PHASE 4.8 — Reusable Percentage Calculation Helper
 *
 * Computes a percentage contribution from a base and percentage rate:
 *   percentageAmount = roundMoney(calculationBase * percentage / 100)
 *
 * Validation rules:
 * - base must be finite. If <= 0, returns 0.
 * - percentage must be a finite number between 0 and 100 (aligned with salaryRule.routes validation).
 * - Negative percentage is rejected unless clampNegative is specified.
 * - Rounded deterministically to 2 decimal places.
 */
export function calculateRulePercentageAmount(
  calculationBase: number,
  percentage: number,
  options?: { clampNegative?: boolean }
): number {
  const base = Number(calculationBase);
  if (isNaN(base) || !isFinite(base) || base <= 0) {
    return 0;
  }

  const pct = Number(percentage);
  if (isNaN(pct) || !isFinite(pct)) {
    throw new Error('Salary rule percentage must be a valid number.');
  }

  if (pct < 0 || pct > 100) {
    if (options?.clampNegative && pct < 0) {
      return 0;
    }
    throw new Error(`Salary rule percentage must be between 0 and 100. Received: ${pct}`);
  }

  if (pct === 0) {
    return 0;
  }

  return roundMoney((base * pct) / 100);
}

/**
 * Resolves the calculation base for a given rule in a calculation context.
 *
 * Precedence:
 *   1. Explicit custom resolver (options.resolveBase)
 *   2. Explicit numeric base on rule (rule.base)
 *   3. Context component match (e.g. rule.percentageBase === 'BASIC' -> context.ruleContributions['BASIC'])
 *   4. Base wage (options.baseWage or contextBases.wage)
 */
function resolveRuleBase(
  rule: PayrollSalaryRule,
  options: CalculateRulesOptions | undefined,
  context: RuleCalculationContext
): number {
  if (options?.resolveBase) {
    return options.resolveBase(rule, context);
  }

  if (rule.base !== undefined && rule.base !== null && rule.base !== '') {
    const directBase = Number(rule.base);
    if (!isNaN(directBase) && isFinite(directBase)) {
      return directBase;
    }
  }

  if (rule.percentageBase) {
    const key = String(rule.percentageBase).trim().toUpperCase();
    if (key === 'EARNINGS' || key === 'ACCUMULATED_EARNINGS') {
      return context.accumulatedEarnings;
    }
    if (key === 'DEDUCTIONS' || key === 'ACCUMULATED_DEDUCTIONS') {
      return context.accumulatedDeductions;
    }
    if (options?.contextBases && options.contextBases[rule.percentageBase] !== undefined) {
      return options.contextBases[rule.percentageBase]!;
    }
    if (context.ruleContributions[key] !== undefined) {
      return context.ruleContributions[key];
    }
  }

  return options?.baseWage ?? options?.contextBases?.wage ?? context.baseWage ?? 0;
}

/**
 * Unified deterministic rule calculator supporting both FIXED (Phase 4.7)
 * and PERCENTAGE (Phase 4.8) rules in sequential order.
 *
 * Rules are processed strictly in deterministic sequence (Phase 4.6):
 * - Fixed rules contribute their fixed amount.
 * - Percentage rules contribute calculationBase * percentage / 100.
 * - Non-supported calculation types (e.g. FORMULA) are bypassed without error.
 * - Negative values are rejected according to domain validation rules (or clamped per options).
 */
export function calculateSalaryRules(
  rules: PayrollSalaryRule[],
  options?: CalculateRulesOptions,
  allowedTypes: Set<string> = new Set(['FIXED', 'PERCENTAGE'])
): RulesCalculationResult {
  const orderedRules = orderSalaryRules(rules, options?.salaryStructureId);

  const contributions: CalculatedRuleContribution[] = [];
  const byCategory: Record<string, number> = {};
  const byRuleCode: Record<string, number> = {};

  let totalEarnings = 0;
  let totalDeductions = 0;
  let fixedEarnings = 0;
  let fixedDeductions = 0;
  let percentageEarnings = 0;
  let percentageDeductions = 0;

  const baseWage = options?.baseWage ?? options?.contextBases?.wage ?? 0;

  const context: RuleCalculationContext = {
    baseWage,
    accumulatedEarnings: 0,
    accumulatedDeductions: 0,
    ruleContributions: {},
  };

  for (const rule of orderedRules) {
    const calcType = (rule.calculationType ?? rule.calculation_type ?? '').trim().toUpperCase();

    if (!allowedTypes.has(calcType)) {
      continue;
    }

    let calculatedAmount = 0;
    let rulePercentage: number | null = null;
    let ruleBase: number | null = null;

    if (calcType === 'FIXED') {
      const rawAmount = rule.amount !== null && rule.amount !== undefined ? Number(rule.amount) : 0;

      if (isNaN(rawAmount) || !isFinite(rawAmount)) {
        continue;
      }

      // Domain validation: amounts must be non-negative numbers
      if (rawAmount < 0) {
        if (options?.clampNegative) {
          calculatedAmount = 0;
        } else {
          throw new Error(`Salary rule '${rule.code || rule.id}' amount must be a non-negative number.`);
        }
      } else {
        calculatedAmount = roundMoney(rawAmount);
      }
    } else if (calcType === 'PERCENTAGE') {
      if (rule.percentage === null || rule.percentage === undefined || rule.percentage === '') {
        throw new Error(`Salary rule '${rule.code || rule.id}' percentage is required.`);
      }

      const rawPct = Number(rule.percentage);
      const resolvedBase = resolveRuleBase(rule, options, context);

      rulePercentage = rawPct;
      ruleBase = resolvedBase;
      calculatedAmount = calculateRulePercentageAmount(resolvedBase, rawPct, {
        clampNegative: options?.clampNegative,
      });
    }

    const categoryType = classifyRuleCategory(rule.category);

    if (categoryType === 'EARNING') {
      totalEarnings = roundMoney(totalEarnings + calculatedAmount);
      context.accumulatedEarnings = totalEarnings;
      if (calcType === 'FIXED') {
        fixedEarnings = roundMoney(fixedEarnings + calculatedAmount);
      } else if (calcType === 'PERCENTAGE') {
        percentageEarnings = roundMoney(percentageEarnings + calculatedAmount);
      }
    } else if (categoryType === 'DEDUCTION') {
      totalDeductions = roundMoney(totalDeductions + calculatedAmount);
      context.accumulatedDeductions = totalDeductions;
      if (calcType === 'FIXED') {
        fixedDeductions = roundMoney(fixedDeductions + calculatedAmount);
      } else if (calcType === 'PERCENTAGE') {
        percentageDeductions = roundMoney(percentageDeductions + calculatedAmount);
      }
    }

    context.ruleContributions[rule.code] = calculatedAmount;
    byCategory[rule.category] = roundMoney((byCategory[rule.category] || 0) + calculatedAmount);
    byRuleCode[rule.code] = roundMoney((byRuleCode[rule.code] || 0) + calculatedAmount);

    contributions.push({
      ruleId: rule.id,
      ruleCode: rule.code,
      ruleName: rule.name,
      category: rule.category,
      categoryType,
      calculationType: calcType,
      sequence: typeof rule.sequence === 'number' ? rule.sequence : parseInt(String(rule.sequence), 10) || 0,
      amount: calculatedAmount,
      ...(rulePercentage !== null ? { percentage: rulePercentage } : {}),
      ...(ruleBase !== null ? { base: ruleBase } : {}),
    });
  }

  return {
    orderedRules,
    contributions,
    earnings: totalEarnings,
    deductions: totalDeductions,
    byCategory,
    byRuleCode,
    fixedEarnings,
    fixedDeductions,
    percentageEarnings,
    percentageDeductions,
  };
}

/**
 * PHASE 4.7 — Fixed Amount Salary Rules
 *
 * Dedicated fixed rule calculator preserving backward compatibility with Phase 4.7.
 */
export function calculateFixedRules(
  rules: PayrollSalaryRule[],
  options?: CalculateFixedRulesOptions
): FixedRulesCalculationResult {
  return calculateSalaryRules(rules, options, new Set(['FIXED']));
}

/**
 * PHASE 4.8 — Percentage-Based Salary Rule Calculation
 *
 * Evaluates rules whose calculation type represents a PERCENTAGE.
 * - Processes rules strictly in deterministic sequence established by Phase 4.6.
 * - Calculates amounts dynamically from calculation base and percentage value.
 * - Preserves money precision with roundMoney.
 */
export function calculatePercentageRules(
  rules: PayrollSalaryRule[],
  options?: CalculateRulesOptions
): RulesCalculationResult {
  return calculateSalaryRules(rules, options, new Set(['PERCENTAGE']));
}

/**
 * PHASE 4.13 — Gross Salary Calculation
 *
 * Deterministically aggregates Gross Salary from:
 *   Gross Salary = Base Salary + Applicable Earnings
 *
 * Applicable earnings include:
 * - Fixed earning rules (category classified as 'EARNING')
 * - Percentage earning rules (category classified as 'EARNING')
 *
 * Requirements:
 * 1. Base salary/wage source comes from normalized input (clamped to non-negative number).
 * 2. Applicable earning rules are included.
 * 3. Fixed earning rules contribute correctly.
 * 4. Percentage earning rules contribute correctly.
 * 5. Rules respect deterministic ordering (Phase 4.6).
 * 6. Unrelated salary structure rules are excluded.
 * 7. Gross calculation is reproducible (pure determinism).
 * 8. Empty earning rules produce a valid gross result (the base wage).
 * 9. Financial rounding using roundMoney.
 * 10. Pure function: Zero database access, zero external side effects.
 */
export function calculateGrossSalary(
  baseWage: number,
  rulesOrResult?: PayrollSalaryRule[] | RulesCalculationResult,
  options?: CalculateGrossSalaryOptions
): number {
  const wage = Number(baseWage);
  const normalizedWage = isNaN(wage) || !isFinite(wage) || wage < 0 ? 0 : roundMoney(wage);

  if (!rulesOrResult) {
    return normalizedWage;
  }

  let earnings = 0;

  if (Array.isArray(rulesOrResult)) {
    const rulesResult = calculateSalaryRules(rulesOrResult, {
      salaryStructureId: options?.salaryStructureId,
      baseWage: normalizedWage,
      clampNegative: options?.clampNegative,
      contextBases: options?.contextBases,
      resolveBase: options?.resolveBase,
    });
    earnings = rulesResult.earnings;
  } else if (typeof rulesOrResult === 'object' && typeof rulesOrResult.earnings === 'number') {
    earnings = rulesOrResult.earnings;
  }

  return roundMoney(normalizedWage + earnings);
}

/**
 * PHASE 4.14 — Total Deductions Calculation
 *
 * Deterministically aggregates Total Deductions from:
 *   Total Deductions = Salary Rule Deductions + Applicable Unpaid Leave Deduction + Other Valid Payroll Deductions
 *
 * Applicable deductions include:
 * - Fixed deduction rules (category classified as 'DEDUCTION')
 * - Percentage deduction rules (category classified as 'DEDUCTION')
 * - Applicable unpaid leave deduction (if already represented by current architecture)
 *
 * Requirements:
 * 1. Fixed deduction rules contribute correctly.
 * 2. Percentage deduction rules contribute correctly.
 * 3. Only applicable deductions are included.
 * 4. Rules from another salary structure are excluded.
 * 5. Deduction aggregation is deterministic.
 * 6. Empty deductions produce 0 (or safe unpaid leave deduction if provided).
 * 7. Deductions are not double-counted.
 * 8. Financial rounding using roundMoney.
 * 9. Pure function: Zero database access, zero external side effects.
 */
export function calculateTotalDeductions(
  rulesOrResult?: PayrollSalaryRule[] | RulesCalculationResult,
  options?: CalculateTotalDeductionsOptions
): number {
  let ruleDeductions = 0;

  if (rulesOrResult) {
    if (Array.isArray(rulesOrResult)) {
      const baseWage = options?.baseWage ?? 0;
      const rulesResult = calculateSalaryRules(rulesOrResult, {
        salaryStructureId: options?.salaryStructureId,
        baseWage,
        clampNegative: options?.clampNegative,
        contextBases: options?.contextBases,
        resolveBase: options?.resolveBase,
      });
      ruleDeductions = rulesResult.deductions;
    } else if (typeof rulesOrResult === 'object' && typeof rulesOrResult.deductions === 'number') {
      ruleDeductions = rulesOrResult.deductions;
    }
  }

  const unpaidLeave = options?.unpaidLeaveDeduction !== undefined
    ? Number(options.unpaidLeaveDeduction)
    : 0;
  const safeUnpaidLeave = isNaN(unpaidLeave) || !isFinite(unpaidLeave) || unpaidLeave < 0
    ? 0
    : unpaidLeave;

  const additional = options?.additionalDeductions !== undefined
    ? Number(options.additionalDeductions)
    : 0;
  const safeAdditional = isNaN(additional) || !isFinite(additional) || additional < 0
    ? 0
    : additional;

  return roundMoney(ruleDeductions + safeUnpaidLeave + safeAdditional);
}

/**
 * PHASE 4.15 — Final Net Salary Calculation
 *
 * Deterministically calculates Net Salary from:
 *   Net Salary = Gross Salary - Total Deductions
 *
 * Uses existing calculated aggregate values without recalculating rules.
 *
 * Requirements:
 * 1. Net Salary is deterministic: Gross Salary - Total Deductions.
 * 2. Consumes existing gross and deduction values without recomputing rules or components.
 * 3. Financial precision rounding using roundMoney.
 * 4. Negative net handling: supports true signed difference, or clamps to 0 if clampNegative: true.
 * 5. Pure function: Zero database access, zero external side effects.
 */
export function calculateNetSalary(
  grossOrResult:
    | number
    | { grossSalary?: number; gross?: number; totalCalculatedDeductions?: number; totalDeductions?: number },
  totalDeductions?: number | CalculateNetSalaryOptions,
  options?: CalculateNetSalaryOptions
): number {
  let gross = 0;
  let deductions = 0;
  let opts: CalculateNetSalaryOptions | undefined = options;

  if (typeof grossOrResult === 'number') {
    gross = grossOrResult;
    if (typeof totalDeductions === 'number') {
      deductions = totalDeductions;
    } else if (typeof totalDeductions === 'object' && totalDeductions !== null) {
      opts = totalDeductions;
    }
  } else if (typeof grossOrResult === 'object' && grossOrResult !== null) {
    gross = grossOrResult.grossSalary ?? grossOrResult.gross ?? 0;
    deductions =
      grossOrResult.totalCalculatedDeductions ??
      grossOrResult.totalDeductions ??
      (typeof totalDeductions === 'number' ? totalDeductions : 0);
    // If options passed as second arg when first is object
    if (typeof totalDeductions === 'object' && totalDeductions !== null) {
      opts = totalDeductions as CalculateNetSalaryOptions;
    }
  }

  const safeGross = isNaN(gross) || !isFinite(gross) ? 0 : roundMoney(gross);
  const safeDeductions = isNaN(deductions) || !isFinite(deductions) ? 0 : roundMoney(deductions);

  let net = roundMoney(safeGross - safeDeductions);

  if (opts?.clampNegative && net < 0) {
    net = 0;
  }

  return net;
}

// ── Baseline Payroll Calculation Contracts ────────────────────────────────────

export interface PayrollPeriod {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
}

export interface AttendanceRecordInput {
  id?: string;
  employeeId?: string | null;
  employee_id?: string | null;
  date: string | Date;
  checkIn?: string | null;
  check_in?: string | null;
  checkOut?: string | null;
  check_out?: string | null;
  workedHours?: number | string | null;
  worked_hours?: number | string | null;
  status?: string | null;
}

export interface AttendanceSummary {
  totalRecords: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  overtimeDays: number;
  totalWorkedHours: number;
}

export interface TimeOffRecordInput {
  id?: string;
  employeeId?: string | null;
  employee_id?: string | null;
  leaveType?: string | null;
  leave_type?: string | null;
  startDate: string | Date;
  start_date?: string | Date;
  endDate: string | Date;
  end_date?: string | Date;
  durationDays?: number | string | null;
  duration_days?: number | string | null;
  status?: string | null;
  isPaid?: boolean | null;
  is_paid?: boolean | null;
}

export interface TimeOffSummary {
  approvedLeaveDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
}

// ── Pure Date & Overlap Helpers ───────────────────────────────────────────────

/**
 * Normalizes a Date or date string to YYYY-MM-DD in UTC without timezone shifting.
 */
export function normalizeDateString(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (str.includes('T')) {
    return str.split('T')[0];
  }
  const match = str.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

/**
 * Parses YYYY-MM-DD safely into UTC Date.
 */
export function parseUtcYMD(val: string): Date | null {
  const norm = normalizeDateString(val);
  if (!norm) return null;
  const parts = norm.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Calculates calendar duration in whole days (inclusive of start and end date).
 * Returns 0 if end date is before start date.
 */
export function calculateCalendarDaysInclusive(startStr: string, endStr: string): number {
  const start = parseUtcYMD(startStr);
  const end = parseUtcYMD(endStr);
  if (!start || !end) return 0;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 0;
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Clamps a date range [startDate, endDate] to a payroll period [periodStart, periodEnd]
 * and returns the number of overlapping days (inclusive).
 * Returns 0 if there is no overlap.
 */
export function calculateDateOverlapDays(
  startDate: string,
  endDate: string,
  periodStart: string,
  periodEnd: string
): number {
  const startNorm = normalizeDateString(startDate);
  const endNorm = normalizeDateString(endDate);
  const pStartNorm = normalizeDateString(periodStart);
  const pEndNorm = normalizeDateString(periodEnd);

  if (!startNorm || !endNorm || !pStartNorm || !pEndNorm) return 0;

  // Effective overlap range
  const effStart = startNorm > pStartNorm ? startNorm : pStartNorm;
  const effEnd = endNorm < pEndNorm ? endNorm : pEndNorm;

  if (effStart > effEnd) return 0;

  return calculateCalendarDaysInclusive(effStart, effEnd);
}

/**
 * Generates an array of all discrete ISO date strings (YYYY-MM-DD) between start and end date (inclusive).
 */
export function getDateRangeArray(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const start = parseUtcYMD(startDateStr);
  const end = parseUtcYMD(endDateStr);
  if (!start || !end || start.getTime() > end.getTime()) return dates;

  const current = new Date(start.getTime());
  while (current.getTime() <= end.getTime()) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Determines whether a leave type is unpaid based on leaveType name and optional isPaid flag.
 * If isPaid is explicitly defined as a boolean, that flag takes precedence.
 * Otherwise, inspects leaveType string for 'unpaid', 'without pay', 'lwop'.
 */
export function isUnpaidLeaveType(leaveType?: string | null, isPaid?: boolean | null): boolean {
  if (isPaid === false) return true;
  if (isPaid === true) return false;
  if (!leaveType || typeof leaveType !== 'string') return false;
  const lower = leaveType.trim().toLowerCase();
  return /unpaid|without\s*pay|lwop|un-paid/.test(lower);
}

// ── PHASE 4.11: Pure Attendance Summarization ─────────────────────────────────

/**
 * PHASE 4.11 — Attendance Integration
 *
 * Deterministically summarizes attendance records for a specific employee and payroll period.
 * Pure function: Zero database access, zero external side effects.
 *
 * Rules:
 * - Filters strictly by employeeId (Employee A never affects Employee B).
 * - Filters strictly by payroll period [period.startDate, period.endDate] (records outside excluded).
 * - Handles duplicate records deterministically (deduplicates by record ID).
 * - Categorizes status:
 *     'PRESENT', 'LATE', 'OVERTIME' -> presentDays
 *     'ABSENT' -> absentDays
 *     'LATE' -> lateDays
 *     'OVERTIME' -> overtimeDays
 * - Accurately sums worked hours and rounds with roundMoney.
 * - Missing/incomplete checkout (e.g. checkOut 'Active' or missing) safely treated as 0 without crashing.
 * - Empty attendance records list produces a valid zero summary.
 */
export function summarizeAttendance(
  records: AttendanceRecordInput[],
  employeeId: string,
  period?: PayrollPeriod
): AttendanceSummary {
  if (!Array.isArray(records) || records.length === 0 || !employeeId) {
    return {
      totalRecords: 0,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      overtimeDays: 0,
      totalWorkedHours: 0,
    };
  }

  const pStart = period ? normalizeDateString(period.startDate) : null;
  const pEnd = period ? normalizeDateString(period.endDate) : null;

  // Deduplicate by record ID if present, preserving first occurrence deterministically
  const seenIds = new Set<string>();
  let totalWorked = 0;
  let presentDays = 0;
  let absentDays = 0;
  let lateDays = 0;
  let overtimeDays = 0;
  let totalRecords = 0;

  for (const rec of records) {
    if (!rec || typeof rec !== 'object') continue;

    const empId = String(rec.employeeId ?? rec.employee_id ?? '').trim();
    if (empId !== employeeId) continue;

    const dateStr = normalizeDateString(rec.date);
    if (!dateStr) continue;

    // Boundary check
    if (pStart && dateStr < pStart) continue;
    if (pEnd && dateStr > pEnd) continue;

    if (rec.id) {
      const idStr = String(rec.id).trim();
      if (seenIds.has(idStr)) continue;
      seenIds.add(idStr);
    }

    totalRecords++;

    const statusUpper = String(rec.status ?? '').trim().toUpperCase();

    if (statusUpper === 'PRESENT' || statusUpper === 'LATE' || statusUpper === 'OVERTIME') {
      presentDays++;
    }
    if (statusUpper === 'ABSENT') {
      absentDays++;
    }
    if (statusUpper === 'LATE') {
      lateDays++;
    }
    if (statusUpper === 'OVERTIME') {
      overtimeDays++;
    }

    // Worked hours handling
    const rawHours = rec.workedHours ?? rec.worked_hours;
    if (rawHours !== undefined && rawHours !== null) {
      const numHours = typeof rawHours === 'number' ? rawHours : parseFloat(String(rawHours));
      if (!isNaN(numHours) && isFinite(numHours) && numHours > 0) {
        totalWorked += numHours;
      }
    }
  }

  return {
    totalRecords,
    presentDays,
    absentDays,
    lateDays,
    overtimeDays,
    totalWorkedHours: roundMoney(totalWorked),
  };
}

// ── PHASE 4.12: Pure Time Off / Unpaid Leave Summarization ─────────────────────

/**
 * PHASE 4.12 — Time Off / Unpaid Leave Integration
 *
 * Deterministically summarizes approved leave for an employee within a payroll period.
 * Pure function: Zero database access, zero external side effects.
 *
 * Rules:
 * - Filters strictly by employeeId (Employee A never affects Employee B).
 * - Filters strictly by status: Only APPROVED requests are considered.
 * - Clamps leave dates strictly to payroll period [period.startDate, period.endDate].
 * - Distinguishes Paid vs Unpaid leave using isUnpaidLeaveType().
 * - Prevents double-counting of overlapping leave requests by tracking distinct calendar dates.
 * - Empty time off records list produces a valid zero summary.
 */
export function summarizeTimeOff(
  records: TimeOffRecordInput[],
  employeeId: string,
  period?: PayrollPeriod
): TimeOffSummary {
  if (!Array.isArray(records) || records.length === 0 || !employeeId) {
    return {
      approvedLeaveDays: 0,
      paidLeaveDays: 0,
      unpaidLeaveDays: 0,
    };
  }

  const pStart = period ? normalizeDateString(period.startDate) : null;
  const pEnd = period ? normalizeDateString(period.endDate) : null;

  const seenIds = new Set<string>();
  const unpaidDates = new Set<string>();
  const paidDates = new Set<string>();

  for (const rec of records) {
    if (!rec || typeof rec !== 'object') continue;

    const empId = String(rec.employeeId ?? rec.employee_id ?? '').trim();
    if (empId !== employeeId) continue;

    // Status check: only APPROVED requests are included
    const statusUpper = String(rec.status ?? '').trim().toUpperCase();
    if (statusUpper !== 'APPROVED') continue;

    if (rec.id) {
      const idStr = String(rec.id).trim();
      if (seenIds.has(idStr)) continue;
      seenIds.add(idStr);
    }

    const startNorm = normalizeDateString(rec.startDate ?? rec.start_date);
    const endNorm = normalizeDateString(rec.endDate ?? rec.end_date);
    if (!startNorm || !endNorm) continue;
    if (startNorm > endNorm) continue;

    // Clamp to payroll period
    const effStart = pStart && startNorm < pStart ? pStart : startNorm;
    const effEnd = pEnd && endNorm > pEnd ? pEnd : endNorm;

    if (effStart > effEnd) continue; // No overlap with payroll period

    const isUnpaid = isUnpaidLeaveType(
      rec.leaveType ?? rec.leave_type,
      rec.isPaid ?? rec.is_paid
    );

    const overlapDates = getDateRangeArray(effStart, effEnd);
    for (const d of overlapDates) {
      if (isUnpaid) {
        unpaidDates.add(d);
        // Unpaid leave takes priority over paid leave for payroll deduction purposes
        paidDates.delete(d);
      } else {
        if (!unpaidDates.has(d)) {
          paidDates.add(d);
        }
      }
    }
  }

  const unpaidLeaveDays = unpaidDates.size;
  const paidLeaveDays = paidDates.size;
  const approvedLeaveDays = unpaidLeaveDays + paidLeaveDays;

  return {
    approvedLeaveDays,
    paidLeaveDays,
    unpaidLeaveDays,
  };
}

// ── Baseline Payroll Calculation Contracts ────────────────────────────────────

export interface PayrollCalculationInput {
  employeeId: string;
  employeeName: string;
  department: string;
  monthlyWage: number;
  unpaidDays?: number;
  overtimeHours?: number;
  // Phase 4.6, 4.7, 4.8 Salary Rules
  salaryStructureId?: string | null;
  salaryRules?: PayrollSalaryRule[];
  // Phase 4.11 Attendance Integration
  attendanceSummary?: AttendanceSummary;
  attendanceRecords?: AttendanceRecordInput[];
  // Phase 4.12 Time Off Integration
  timeOffSummary?: TimeOffSummary;
  timeOffRecords?: TimeOffRecordInput[];
  // Payroll Period
  payrollPeriod?: PayrollPeriod;
}

export interface CalculatedPayslip {
  employeeId: string;
  employeeName: string;
  department: string;
  basic: number;
  hra: number;
  allowance: number;
  gross: number;
  tax: number;
  unpaidLeaveDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  net: number;
  // Phase 4 extension fields (optional to preserve complete backward compatibility)
  rulesResult?: RulesCalculationResult;
  fixedRulesResult?: FixedRulesCalculationResult;
  fixedEarnings?: number;
  fixedDeductions?: number;
  percentageEarnings?: number;
  percentageDeductions?: number;
  // Phase 4.11 Attendance Integration
  attendanceSummary?: AttendanceSummary;
  // Phase 4.12 Time Off Integration
  timeOffSummary?: TimeOffSummary;
  // Phase 4.13 Gross Salary & Phase 4.14 Total Deductions Integration
  grossSalary?: number;
  totalCalculatedDeductions?: number;
  // Phase 4.15 Net Salary Integration
  netSalary?: number;
}

export class PayrollEngine {
  /**
   * Exposed Phase 4.6 pure salary rule ordering.
   */
  public static orderSalaryRules = orderSalaryRules;

  /**
   * Exposed Phase 4.7 pure fixed amount rules calculation.
   */
  public static calculateFixedRules = calculateFixedRules;

  /**
   * Exposed Phase 4.8 pure percentage amount calculator.
   */
  public static calculateRulePercentageAmount = calculateRulePercentageAmount;

  /**
   * Exposed Phase 4.8 pure percentage rules calculation.
   */
  public static calculatePercentageRules = calculatePercentageRules;

  /**
   * Exposed unified salary rules calculation (FIXED + PERCENTAGE in sequence).
   */
  public static calculateSalaryRules = calculateSalaryRules;

  /**
   * Exposed Phase 4.11 pure attendance summarization.
   */
  public static summarizeAttendance = summarizeAttendance;

  /**
   * Exposed Phase 4.12 pure time off summarization.
   */
  public static summarizeTimeOff = summarizeTimeOff;

  /**
   * Exposed Phase 4.13 pure gross salary calculation.
   */
  public static calculateGrossSalary = calculateGrossSalary;

  /**
   * Exposed Phase 4.14 pure total deductions calculation.
   */
  public static calculateTotalDeductions = calculateTotalDeductions;

  /**
   * Exposed Phase 4.15 pure net salary calculation.
   */
  public static calculateNetSalary = calculateNetSalary;

  /**
   * Exposed date overlap helper.
   */
  public static calculateDateOverlapDays = calculateDateOverlapDays;

  /**
   * Exposed unpaid leave classifier helper.
   */
  public static isUnpaidLeaveType = isUnpaidLeaveType;

  /**
   * Exposed date normalization helper.
   */
  public static normalizeDateString = normalizeDateString;

  /**
   * Exposed money rounding utility.
   */
  public static roundMoney = roundMoney;

  /**
   * Exposed category classification utility.
   */
  public static classifyRuleCategory = classifyRuleCategory;

  /**
   * Baseline deterministic payroll computation.
   * Preserves full backward compatibility with Phase 3 payruns, while integrating
   * Phase 4.6/4.7/4.8 salary rule calculations when salaryRules are provided,
   * Phase 4.11 attendance data, Phase 4.12 time off data,
   * Phase 4.13 gross salary, Phase 4.14 total deductions, and Phase 4.15 net salary.
   */
  public static compute(input: PayrollCalculationInput): CalculatedPayslip {
    const basic = Math.round(input.monthlyWage * 0.60);
    const hra = Math.round(input.monthlyWage * 0.25);
    const allowance = input.monthlyWage - basic - hra;
    const gross = input.monthlyWage;

    // Phase 4.11 Attendance Summary resolution
    let attendanceSummary = input.attendanceSummary;
    if (!attendanceSummary && input.attendanceRecords && Array.isArray(input.attendanceRecords)) {
      attendanceSummary = summarizeAttendance(input.attendanceRecords, input.employeeId, input.payrollPeriod);
    }

    // Phase 4.12 Time Off Summary resolution
    let timeOffSummary = input.timeOffSummary;
    if (!timeOffSummary && input.timeOffRecords && Array.isArray(input.timeOffRecords)) {
      timeOffSummary = summarizeTimeOff(input.timeOffRecords, input.employeeId, input.payrollPeriod);
    }

    // Unpaid days resolution: If input.unpaidDays is explicitly supplied, respect it.
    // Otherwise, connect directly to timeOffSummary.unpaidLeaveDays if available.
    const unpaidDays = input.unpaidDays !== undefined
      ? input.unpaidDays
      : (timeOffSummary ? timeOffSummary.unpaidLeaveDays : 0);

    const dailyRate = basic / 30;
    const unpaidLeaveDeduction = Math.round(dailyRate * unpaidDays);

    const tax = Math.round(gross * 0.10);
    const otherDeductions = Math.round(gross * 0.07);
    const totalDeductions = tax + otherDeductions + unpaidLeaveDeduction;

    const net = gross - totalDeductions;

    // Phase 4.6, 4.7, 4.8 calculation if salary rules are supplied
    let rulesResult: RulesCalculationResult | undefined = undefined;
    let calculatedGrossSalary: number | undefined = undefined;
    let calculatedTotalDeductions: number | undefined = undefined;
    let calculatedNetSalary: number | undefined = undefined;

    if (input.salaryRules && Array.isArray(input.salaryRules)) {
      rulesResult = calculateSalaryRules(input.salaryRules, {
        salaryStructureId: input.salaryStructureId,
        baseWage: input.monthlyWage,
      });

      // Phase 4.13 Gross Salary & Phase 4.14 Total Deductions
      calculatedGrossSalary = calculateGrossSalary(input.monthlyWage, rulesResult, {
        salaryStructureId: input.salaryStructureId,
      });
      calculatedTotalDeductions = calculateTotalDeductions(rulesResult, {
        salaryStructureId: input.salaryStructureId,
        unpaidLeaveDeduction,
      });
      rulesResult.grossSalary = calculatedGrossSalary;
      rulesResult.totalDeductions = calculatedTotalDeductions;

      // Phase 4.15 Net Salary
      calculatedNetSalary = calculateNetSalary(calculatedGrossSalary, calculatedTotalDeductions);
      rulesResult.netSalary = calculatedNetSalary;
    }

    return {
      employeeId: input.employeeId,
      employeeName: input.employeeName,
      department: input.department,
      basic,
      hra,
      allowance,
      gross,
      tax,
      unpaidLeaveDeduction,
      otherDeductions,
      totalDeductions,
      net,
      ...(rulesResult
        ? {
            rulesResult,
            fixedRulesResult: rulesResult,
            fixedEarnings: rulesResult.fixedEarnings,
            fixedDeductions: rulesResult.fixedDeductions,
            percentageEarnings: rulesResult.percentageEarnings,
            percentageDeductions: rulesResult.percentageDeductions,
          }
        : {}),
      ...(attendanceSummary ? { attendanceSummary } : {}),
      ...(timeOffSummary ? { timeOffSummary } : {}),
      ...(calculatedGrossSalary !== undefined ? { grossSalary: calculatedGrossSalary } : {}),
      ...(calculatedTotalDeductions !== undefined ? { totalCalculatedDeductions: calculatedTotalDeductions } : {}),
      ...(calculatedNetSalary !== undefined ? { netSalary: calculatedNetSalary } : {}),
    };
  }
}



