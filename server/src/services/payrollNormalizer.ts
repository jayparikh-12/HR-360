/**
 * PeoplePay360 — Payroll Normalization Layer
 *
 * Transforms heterogeneous domain entities (Employee, Contract, Salary Structure,
 * Salary Rules, Attendance Records, Time Off Requests) and payroll period definitions
 * into the canonical, strongly typed `PayrollCalculationInput` contract.
 *
 * Core Guarantees:
 * - Pure functions with zero side-effects.
 * - Zero direct MySQL queries (the payroll engine and normalizer receive data, never fetch).
 * - Deterministic outputs: identical inputs guarantee identical outputs.
 * - Sensitive credentials (passwords, tokens, bank accounts, routing numbers) stripped.
 * - Explicit date validation (never defaults silently to system date).
 * - First-class Employee and Contract normalization with deterministic active contract selection.
 * - Strict leave classification (only APPROVED leave qualifies for payroll adjustments).
 * - Deterministic rule ordering (sequence ASC, ruleId ASC).
 */

import {
  PayrollInputError,
  type NormalizedEmployeeInput,
  type NormalizedContractInput,
  type NormalizedSalaryStructureInput,
  type NormalizedSalaryRuleInput,
  type NormalizedPayrollPeriodInput,
  type NormalizedAttendanceRecord,
  type NormalizedAttendanceSummary,
  type NormalizedAttendanceInput,
  type NormalizedTimeOffRequest,
  type NormalizedTimeOffSummary,
  type NormalizedTimeOffInput,
  type PayrollCalculationInput,
  type FullyNormalizedPayrollCalculationInput,
  type RawPayrollDomainData,
  type RawEmployeeData,
  type RawContractData,
  type SalaryRuleCategory,
  type SalaryRuleCalculationType,
  type AttendanceStatus,
  type TimeOffRequestStatus,
} from '../types/payroll.types.js';
import { summarizeTimeOff, calculateCalendarDaysInclusive } from './payrollEngine.js';

// ── Date & Period Helpers ────────────────────────────────────────────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalizes Date objects or date strings into a canonical YYYY-MM-DD string.
 */
export function normalizeDateString(val: Date | string | null | undefined): string {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (str.includes('T')) {
    return str.split('T')[0];
  }
  return str;
}

/**
 * Parses and validates an explicit payroll period.
 * Supports either an object `{ startDate, endDate }` or a formatted string like `"2026-09-01 - 2026-09-30"`.
 * Never defaults silently to system date.
 */
export function normalizePayrollPeriod(
  periodInput: { startDate: string; endDate: string } | string
): NormalizedPayrollPeriodInput {
  let startStr = '';
  let endStr = '';

  if (typeof periodInput === 'string') {
    const trimmed = periodInput.trim();
    const dateMatches = trimmed.match(/\d{4}-\d{2}-\d{2}/g);
    if (dateMatches && dateMatches.length >= 2) {
      startStr = dateMatches[0];
      endStr = dateMatches[1];
    } else if (/^\d{4}-\d{2}$/.test(trimmed)) {
      const [y, m] = trimmed.split('-').map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      startStr = `${trimmed}-01`;
      endStr = `${trimmed}-${String(lastDay).padStart(2, '0')}`;
    } else {
      throw new PayrollInputError(
        'INVALID_PERIOD',
        `Invalid payroll period string '${periodInput}'. Expected format containing 'YYYY-MM-DD - YYYY-MM-DD' or 'YYYY-MM'.`
      );
    }
  } else if (typeof periodInput === 'object' && periodInput !== null) {
    startStr = normalizeDateString(periodInput.startDate);
    endStr = normalizeDateString(periodInput.endDate);
  } else {
    throw new PayrollInputError(
      'INVALID_PERIOD',
      'Payroll period must be provided as an object or valid range string.'
    );
  }

  if (!DATE_REGEX.test(startStr) || !DATE_REGEX.test(endStr)) {
    throw new PayrollInputError(
      'INVALID_PERIOD',
      `Invalid payroll period dates: start='${startStr}', end='${endStr}'. Must be YYYY-MM-DD.`
    );
  }

  const startDate = new Date(`${startStr}T00:00:00Z`);
  const endDate = new Date(`${endStr}T00:00:00Z`);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new PayrollInputError(
      'INVALID_PERIOD',
      `Unparseable payroll period dates: start='${startStr}', end='${endStr}'.`
    );
  }

  if (startDate > endDate) {
    throw new PayrollInputError(
      'INVALID_PERIOD',
      `Invalid payroll period range: periodStart ('${startStr}') cannot be after periodEnd ('${endStr}').`
    );
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  const totalDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

  const year = startDate.getUTCFullYear();
  const month = startDate.getUTCMonth() + 1; // 1-12

  return {
    periodStart: startStr,
    periodEnd: endStr,
    year,
    month,
    totalDays,
  };
}

// ── Employee Normalizer ──────────────────────────────────────────────────────

const VALID_GENDERS = new Set(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY']);
const VALID_EMPLOYEE_TYPES = new Set(['FULL_TIME', 'PART_TIME', 'CONTRACT']);

export function normalizeEmployee(raw: RawEmployeeData): NormalizedEmployeeInput {
  if (!raw || typeof raw !== 'object') {
    throw new PayrollInputError('MISSING_EMPLOYEE', 'Missing or invalid employee data for payroll calculation.');
  }

  const employeeId = String(raw.id || (raw as any).employeeId || '').trim();
  if (!employeeId) {
    throw new PayrollInputError('MISSING_EMPLOYEE', 'Employee record missing required employee ID.');
  }

  // Derive firstName and lastName safely
  let firstName = String(raw.firstName || '').trim();
  let lastName = String(raw.lastName || '').trim();
  if (!firstName && !lastName && raw.name) {
    const parts = String(raw.name).trim().split(/\s+/);
    firstName = parts[0] || 'Employee';
    lastName = parts.slice(1).join(' ') || '';
  }
  if (!firstName && !lastName) {
    firstName = 'Employee';
    lastName = employeeId;
  }

  const fullName = raw.name && typeof raw.name === 'string' && raw.name.trim().length > 0
    ? raw.name.trim()
    : [firstName, lastName].filter(Boolean).join(' ');

  const department = String(raw.department || 'General').trim();
  const position = String(raw.position || raw.jobPosition || 'Staff').trim();

  // Normalize gender if present
  let gender: NormalizedEmployeeInput['gender'] = null;
  if (raw.gender) {
    const gUpper = String(raw.gender).trim().toUpperCase();
    if (VALID_GENDERS.has(gUpper)) {
      gender = gUpper as NormalizedEmployeeInput['gender'];
    }
  }

  // Normalize employee type if present
  let employeeType: NormalizedEmployeeInput['employeeType'] = undefined;
  if (raw.employeeType) {
    const tUpper = String(raw.employeeType).trim().toUpperCase();
    if (VALID_EMPLOYEE_TYPES.has(tUpper)) {
      employeeType = tUpper as NormalizedEmployeeInput['employeeType'];
    }
  }

  const rawStatus = String(raw.status || 'ACTIVE').trim().toUpperCase();
  let employmentStatus: NormalizedEmployeeInput['employmentStatus'] = 'ACTIVE';
  if (rawStatus === 'PROBATION') {
    employmentStatus = 'PROBATION';
  } else if (rawStatus === 'TERMINATED' || rawStatus === 'INACTIVE') {
    employmentStatus = 'TERMINATED';
  }

  const workingSchedule = raw.workingSchedule || raw.schedule || raw.working_schedule
    ? String(raw.workingSchedule || raw.schedule || raw.working_schedule).trim()
    : undefined;

  return {
    employeeId,
    employeeCode: raw.empCode ? String(raw.empCode).trim() : undefined,
    firstName,
    lastName,
    fullName,
    department,
    position,
    gender,
    employeeType,
    employmentStatus,
    workingSchedule,
  };
}

// ── Contract Normalizer ──────────────────────────────────────────────────────

function isEmployeeIdMatch(
  contractEmpId: string,
  targetEmpId: string,
  contractEmpCode?: string,
  targetEmpCode?: string
): boolean {
  if (contractEmpId === targetEmpId) return true;
  const normTarget = targetEmpId.replace(/[-_]/g, '').toLowerCase();
  const normA = contractEmpId.replace(/[-_]/g, '').toLowerCase();
  if (normA === normTarget) return true;
  if (contractEmpCode) {
    const normCode = contractEmpCode.replace(/[-_]/g, '').toLowerCase();
    if (normCode === normTarget) return true;
  }
  if (targetEmpCode) {
    const normTargetCode = targetEmpCode.replace(/[-_]/g, '').toLowerCase();
    if (normTargetCode === normA) return true;
    if (contractEmpCode && normTargetCode === contractEmpCode.replace(/[-_]/g, '').toLowerCase()) return true;
  }
  return false;
}

export function normalizeContract(
  raw: RawContractData,
  expectedEmployeeId?: string
): NormalizedContractInput {
  if (!raw || typeof raw !== 'object') {
    throw new PayrollInputError('MISSING_CONTRACT', 'Missing or invalid contract data for payroll calculation.');
  }

  const contractId = String(raw.id || (raw as any).contractId || '').trim();
  const employeeId = String(raw.employeeId || raw.employee_id || '').trim();
  const empCode = raw.empCode || raw.emp_code ? String(raw.empCode || raw.emp_code).trim() : undefined;

  if (!contractId) {
    throw new PayrollInputError('MISSING_CONTRACT', 'Contract record missing required contract ID.');
  }
  if (!employeeId) {
    throw new PayrollInputError('MISSING_CONTRACT', 'Contract record missing required employee reference ID.');
  }

  // Enforce association integrity: contract must belong to target employee
  if (expectedEmployeeId && !isEmployeeIdMatch(employeeId, expectedEmployeeId.trim(), empCode)) {
    throw new PayrollInputError(
      'CONTRACT_EMPLOYEE_MISMATCH',
      `Contract '${contractId}' belongs to employee '${employeeId}', but calculation was requested for employee '${expectedEmployeeId}'.`
    );
  }

  const rawWage = raw.wage;
  const wageNum = typeof rawWage === 'number' ? rawWage : parseFloat(String(rawWage || ''));
  if (isNaN(wageNum) || !isFinite(wageNum) || wageNum < 0) {
    throw new PayrollInputError('INVALID_WAGE', `Contract wage must be a non-negative number, received '${rawWage}'.`);
  }

  // Normalize monetary precision to 2 decimal places deterministically
  const normalizedWage = Math.round(wageNum * 100) / 100;

  const startDate = normalizeDateString(raw.startDate || raw.start_date);
  if (!startDate) {
    throw new PayrollInputError('MISSING_CONTRACT', `Contract '${contractId}' missing valid start date.`);
  }

  const endDate = normalizeDateString(raw.endDate || raw.end_date) || null;
  if (endDate && startDate > endDate) {
    throw new PayrollInputError(
      'MISSING_CONTRACT',
      `Contract '${contractId}' start date ('${startDate}') cannot be after end date ('${endDate}').`
    );
  }

  const rawStatus = String(raw.status || 'ACTIVE').trim().toUpperCase();
  const validStatus = (['ACTIVE', 'FUTURE', 'HISTORICAL'].includes(rawStatus)
    ? rawStatus
    : 'ACTIVE') as NormalizedContractInput['status'];

  const salaryStructureId = raw.salaryStructureId || raw.salary_structure_id || raw.salaryStructure || raw.structure
    ? String(raw.salaryStructureId || raw.salary_structure_id || raw.salaryStructure || raw.structure).trim()
    : null;

  const workingScheduleId = raw.workingScheduleId || raw.working_schedule_id || raw.workingSchedule || raw.schedule
    ? String(raw.workingScheduleId || raw.working_schedule_id || raw.workingSchedule || raw.schedule).trim()
    : null;

  return {
    contractId,
    employeeId,
    wage: normalizedWage,
    startDate,
    endDate,
    salaryStructureId,
    workingScheduleId,
    status: validStatus,
  };
}

// ── Active Contract Selection Logic ──────────────────────────────────────────

/**
 * Deterministically selects the appropriate contract for an employee for a given payroll period.
 *
 * Selection Rules:
 * 1. Filter strictly to contracts associated with the given employeeId.
 * 2. Filter to contracts that overlap the payroll period:
 *    - contract.startDate <= period.periodEnd
 *    - contract.endDate == null || contract.endDate >= period.periodStart
 * 3. Reject contracts that ended prior to period.periodStart or start after period.periodEnd.
 * 4. Disambiguation if multiple valid contracts exist:
 *    - Priority 1: status === 'ACTIVE'
 *    - Priority 2: Latest startDate (most recent contract commence date)
 *    - Priority 3: contractId DESC (deterministic tie-breaker)
 * 5. If no qualifying contract is found, throws typed PayrollInputError('NO_VALID_CONTRACT').
 */
export function selectContractForPeriod(
  contracts: RawContractData[],
  employeeId: string,
  period: NormalizedPayrollPeriodInput | { periodStart: string; periodEnd: string },
  employeeCode?: string
): NormalizedContractInput {
  if (!contracts || !Array.isArray(contracts) || contracts.length === 0) {
    throw new PayrollInputError(
      'NO_VALID_CONTRACT',
      `No contract records provided for employee '${employeeId}'.`
    );
  }

  const targetEmpId = employeeId.trim();
  const periodStart = period.periodStart;
  const periodEnd = period.periodEnd;

  // 1. Filter contracts associated with this employee
  const employeeContracts = contracts.filter((c) => {
    if (!c || typeof c !== 'object') return false;
    const cEmpId = String(c.employeeId || c.employee_id || '').trim();
    const cEmpCode = c.empCode || c.emp_code ? String(c.empCode || c.emp_code).trim() : undefined;
    return isEmployeeIdMatch(cEmpId, targetEmpId, cEmpCode, employeeCode);
  });

  if (employeeContracts.length === 0) {
    throw new PayrollInputError(
      'NO_VALID_CONTRACT',
      `No contracts found associated with employee '${targetEmpId}'.`
    );
  }

  // 2. Filter contracts overlapping the payroll period
  const eligibleContracts = employeeContracts.filter((c) => {
    const cStart = normalizeDateString(c.startDate || c.start_date);
    const cEnd = normalizeDateString(c.endDate || c.end_date);

    if (!cStart) return false;

    // Contract has not started yet by the end of this payroll period
    if (cStart > periodEnd) return false;

    // Contract ended before this payroll period began
    if (cEnd && cEnd < periodStart) return false;

    return true;
  });

  if (eligibleContracts.length === 0) {
    throw new PayrollInputError(
      'NO_VALID_CONTRACT',
      `No active or valid contract found for employee '${targetEmpId}' during period ${periodStart} - ${periodEnd}.`
    );
  }

  // 3. Deterministic resolution when multiple contracts qualify
  eligibleContracts.sort((a, b) => {
    const statusA = String(a.status || '').trim().toUpperCase();
    const statusB = String(b.status || '').trim().toUpperCase();
    const aIsActive = statusA === 'ACTIVE' ? 1 : 0;
    const bIsActive = statusB === 'ACTIVE' ? 1 : 0;

    // Active status priority
    if (aIsActive !== bIsActive) return bIsActive - aIsActive;

    // Most recent start date
    const startA = normalizeDateString(a.startDate || a.start_date);
    const startB = normalizeDateString(b.startDate || b.start_date);
    if (startA !== startB) return startB.localeCompare(startA);

    // Tie-breaker: contract ID descending
    const idA = String(a.id || '');
    const idB = String(b.id || '');
    return idB.localeCompare(idA);
  });

  const selectedRaw = eligibleContracts[0];
  return normalizeContract(selectedRaw, targetEmpId);
}

// ── Salary Structure Normalizer ──────────────────────────────────────────────

export function normalizeSalaryStructure(
  raw?: RawPayrollDomainData['salaryStructure']
): NormalizedSalaryStructureInput | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const structureId = String(raw.id || (raw as any).structureId || '').trim();
  const code = String(raw.code || '').trim().toUpperCase();
  const name = String(raw.name || '').trim();

  if (!structureId || !code) {
    return null;
  }

  return {
    structureId,
    code,
    name: name || code,
  };
}

// ── Salary Rules Normalizer ──────────────────────────────────────────────────

const VALID_CATEGORIES = new Set<SalaryRuleCategory>(['BASIC', 'ALLOWANCE', 'GROSS', 'DEDUCTION', 'NET']);
const VALID_CALCULATION_TYPES = new Set<SalaryRuleCalculationType>(['FIXED', 'PERCENTAGE', 'FORMULA']);

export function normalizeSalaryRules(
  rawRules?: RawPayrollDomainData['salaryRules'] | null,
  targetStructureId?: string | null
): NormalizedSalaryRuleInput[] {
  if (!rawRules || !Array.isArray(rawRules) || rawRules.length === 0) {
    return [];
  }

  const normalized: NormalizedSalaryRuleInput[] = [];

  for (const r of rawRules) {
    if (!r || typeof r !== 'object') continue;

    const ruleId = String(r.id || '').trim();
    if (!ruleId) continue;

    // Exclude inactive rules if explicit active: false or status: 'INACTIVE' is present
    if (r.active === false || String(r.status || '').toUpperCase() === 'INACTIVE') {
      continue;
    }

    const structureId = r.structureId || r.structure_id
      ? String(r.structureId || r.structure_id).trim()
      : null;

    // Exclude rules explicitly assigned to a different structure
    if (targetStructureId && structureId && structureId !== targetStructureId) {
      continue;
    }

    const name = String(r.name || 'Unnamed Rule').trim();
    const code = String(r.code || ruleId).trim().toUpperCase();

    const seqRaw = r.sequence;
    const sequence = typeof seqRaw === 'number'
      ? seqRaw
      : parseInt(String(seqRaw || '1'), 10);

    const catUpper = String(r.category || 'ALLOWANCE').trim().toUpperCase();
    let category: SalaryRuleCategory = 'ALLOWANCE';
    if (catUpper === 'EARNINGS') {
      category = 'ALLOWANCE';
    } else if (catUpper === 'DEDUCTIONS' || catUpper === 'DEDUCTION') {
      category = 'DEDUCTION';
    } else if (VALID_CATEGORIES.has(catUpper as SalaryRuleCategory)) {
      category = catUpper as SalaryRuleCategory;
    }

    const calcTypeRaw = r.calculationType || r.calculation_type || 'PERCENTAGE';
    const calcTypeUpper = String(calcTypeRaw).trim().toUpperCase() as SalaryRuleCalculationType;
    const calculationType: SalaryRuleCalculationType = VALID_CALCULATION_TYPES.has(calcTypeUpper)
      ? calcTypeUpper
      : 'PERCENTAGE';

    const amountNum = r.amount !== undefined && r.amount !== null && r.amount !== ''
      ? typeof r.amount === 'number' ? r.amount : parseFloat(String(r.amount))
      : null;
    const normalizedAmount = amountNum !== null && !isNaN(amountNum)
      ? Math.round(amountNum * 100) / 100
      : null;

    const percentageNum = r.percentage !== undefined && r.percentage !== null && r.percentage !== ''
      ? typeof r.percentage === 'number' ? r.percentage : parseFloat(String(r.percentage))
      : null;
    const normalizedPercentage = percentageNum !== null && !isNaN(percentageNum)
      ? Math.round(percentageNum * 100) / 100
      : null;

    const formula = r.formula && String(r.formula).trim().length > 0
      ? String(r.formula).trim()
      : null;

    normalized.push({
      ruleId,
      structureId,
      name,
      code,
      sequence: isNaN(sequence) ? 1 : sequence,
      category,
      calculationType,
      amount: normalizedAmount,
      percentage: normalizedPercentage,
      formula,
      active: true,
    });
  }

  // Deterministic sorting: sequence ASC, ruleId ASC
  normalized.sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    return a.ruleId.localeCompare(b.ruleId);
  });

  return normalized;
}

// ── Attendance Normalizer ────────────────────────────────────────────────────

// ── Attendance Normalizer ────────────────────────────────────────────────────

export function normalizeAttendance(
  rawRecords: RawPayrollDomainData['attendanceRecords'],
  employeeId: string,
  periodStart: string,
  periodEnd: string
): NormalizedAttendanceInput {
  const records: NormalizedAttendanceRecord[] = [];
  let totalWorkedHours = 0;
  let presentDays = 0;
  let absentDays = 0;
  let lateDays = 0;
  let overtimeDays = 0;
  let overtimeHours = 0;

  if (Array.isArray(rawRecords)) {
    for (const rec of rawRecords) {
      if (!rec || typeof rec !== 'object') continue;

      // Employee isolation: exclude records belonging to other employees
      if (employeeId) {
        const recEmpId = String(rec.employeeId ?? rec.employee_id ?? '').trim();
        if (recEmpId && recEmpId !== employeeId) {
          continue;
        }
      }

      const date = normalizeDateString(rec.date);
      if (!date || date < periodStart || date > periodEnd) {
        continue;
      }

      const checkIn = String(rec.checkIn || rec.check_in || '—').trim();
      const checkOut = String(rec.checkOut || rec.check_out || '—').trim();

      const hrsRaw = rec.workedHours ?? rec.worked_hours;
      const workedHours = typeof hrsRaw === 'number'
        ? hrsRaw
        : parseFloat(String(hrsRaw || '0'));
      const safeWorkedHours = isNaN(workedHours) || workedHours < 0 ? 0 : workedHours;

      const rawStatus = String(rec.status || 'PRESENT').trim().toUpperCase();
      const status: AttendanceStatus = (
        ['PRESENT', 'LATE', 'ABSENT', 'OVERTIME', 'MISSING_CHECKOUT'].includes(rawStatus)
          ? rawStatus
          : 'PRESENT'
      ) as AttendanceStatus;

      records.push({
        id: rec.id ? String(rec.id) : undefined,
        date,
        checkIn,
        checkOut,
        workedHours: safeWorkedHours,
        status,
      });

      totalWorkedHours += safeWorkedHours;
      if (status === 'PRESENT' || status === 'LATE' || status === 'OVERTIME') {
        presentDays++;
      }
      if (status === 'ABSENT') {
        absentDays++;
      }
      if (status === 'LATE') {
        lateDays++;
      }
      if (status === 'OVERTIME') {
        overtimeDays++;
      }

      // Overtime hours extraction
      const rawOt = rec.overtimeHours ?? rec.overtime_hours;
      if (rawOt !== undefined && rawOt !== null) {
        const numOt = typeof rawOt === 'number' ? rawOt : parseFloat(String(rawOt));
        if (!isNaN(numOt) && isFinite(numOt) && numOt > 0) {
          overtimeHours += numOt;
        }
      } else if (status === 'OVERTIME' && safeWorkedHours > 8.0) {
        overtimeHours += (safeWorkedHours - 8.0);
      } else if (safeWorkedHours > 8.0) {
        overtimeHours += (safeWorkedHours - 8.0);
      }
    }
  }

  // Sort deterministically by date ASC, id ASC
  records.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.id || '').localeCompare(b.id || '');
  });

  const summary: NormalizedAttendanceSummary = {
    totalWorkedHours: Math.round(totalWorkedHours * 100) / 100,
    presentDays,
    absentDays,
    lateDays,
    overtimeDays,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    totalRecordedDays: records.length,
  };

  return { records, summary };
}

// ── Time Off Normalizer ──────────────────────────────────────────────────────

export function normalizeTimeOff(
  rawRequests: RawPayrollDomainData['timeOffRequests'],
  employeeId: string,
  periodStart: string,
  periodEnd: string
): NormalizedTimeOffInput {
  const requests: NormalizedTimeOffRequest[] = [];
  let pendingDays = 0;
  let refusedDays = 0;

  if (Array.isArray(rawRequests)) {
    for (const req of rawRequests) {
      if (!req || typeof req !== 'object') continue;

      // Employee isolation: exclude requests belonging to other employees
      if (employeeId) {
        const reqEmpId = String(req.employeeId ?? req.employee_id ?? '').trim();
        if (reqEmpId && reqEmpId !== employeeId) {
          continue;
        }
      }

      const startDate = normalizeDateString(req.startDate || req.start_date);
      const endDate = normalizeDateString(req.endDate || req.end_date);
      if (!startDate || !endDate) continue;

      if (endDate < periodStart || startDate > periodEnd) {
        continue;
      }

      const effStart = startDate < periodStart ? periodStart : startDate;
      const effEnd = endDate > periodEnd ? periodEnd : endDate;
      if (effStart > effEnd) continue;

      const rawDuration = req.durationDays ?? req.duration_days;
      let durationDays = 0;
      if (rawDuration !== undefined && rawDuration !== null) {
        const parsed = typeof rawDuration === 'number' ? rawDuration : parseInt(String(rawDuration), 10);
        if (!isNaN(parsed) && parsed > 0) {
          durationDays = parsed;
        }
      }
      if (durationDays <= 0) {
        durationDays = calculateCalendarDaysInclusive(effStart, effEnd);
      }

      const leaveType = String(req.leaveType || req.leave_type || 'Paid Annual Leave').trim();
      const isUnpaidFlag = req.isUnpaid ?? req.is_unpaid;
      const isPaidFlag = req.isPaid ?? req.is_paid;
      let isUnpaid = false;
      if (isUnpaidFlag === true) {
        isUnpaid = true;
      } else if (isPaidFlag === false) {
        isUnpaid = true;
      } else if (isPaidFlag === true) {
        isUnpaid = false;
      } else {
        isUnpaid = /unpaid|without\s*pay|loss\s*of\s*pay|lop|lwop/i.test(leaveType);
      }

      const rawStatus = String(req.status || 'PENDING').trim().toUpperCase();
      let status: TimeOffRequestStatus = 'PENDING';
      if (rawStatus === 'APPROVED') status = 'APPROVED';
      else if (rawStatus === 'REFUSED' || rawStatus === 'REJECTED') status = 'REFUSED';

      requests.push({
        id: String(req.id || `TO-${requests.length + 1}`),
        leaveType,
        startDate,
        endDate,
        durationDays,
        status,
        isUnpaid,
      });

      if (status === 'PENDING') {
        pendingDays += durationDays;
      } else if (status === 'REFUSED') {
        refusedDays += durationDays;
      }
    }
  }

  // Sort deterministically by startDate ASC, id ASC
  requests.sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
    return a.id.localeCompare(b.id);
  });

  // Calculate approved leave summaries deterministically preventing double counting
  const approvedSummary = summarizeTimeOff(
    rawRequests ? rawRequests.filter((r: any) => String(r?.status ?? '').toUpperCase() === 'APPROVED') : [],
    employeeId,
    { startDate: periodStart, endDate: periodEnd }
  );

  const summary: NormalizedTimeOffSummary = {
    totalApprovedDays: approvedSummary.approvedLeaveDays,
    approvedPaidDays: approvedSummary.paidLeaveDays,
    approvedUnpaidDays: approvedSummary.unpaidLeaveDays,
    pendingDays,
    refusedDays,
  };

  return { requests, summary };
}

// ── Composite Normalization Entrypoint ───────────────────────────────────────

/**
 * Top-level normalization function for the payroll engine.
 * Converts raw domain structures into the clean, strongly typed
 * `PayrollCalculationInput` contract.
 *
 * Does not query any database. Receives raw data as input and produces normalized data.
 */
export function normalizePayrollCalculationInput(data: RawPayrollDomainData): FullyNormalizedPayrollCalculationInput {
  if (!data || typeof data !== 'object') {
    throw new PayrollInputError('MISSING_EMPLOYEE', 'normalizePayrollCalculationInput requires a valid domain data object.');
  }

  // 1. Normalize payroll period first (anchors contract, attendance & time-off filtering)
  const rawPeriod = (data as any).payrollPeriod || (data as any).period || (data as any).payPeriod;
  const payrollPeriod = normalizePayrollPeriod(rawPeriod);

  // 2. Normalize Employee (strips credentials, normalizes names, status, gender, employeeType)
  const employee = normalizeEmployee(data.employee);

  // 3. Normalize Contract (with deterministic active contract selection & period validity checks)
  let contract: NormalizedContractInput;

  if (data.contracts && Array.isArray(data.contracts) && data.contracts.length > 0) {
    contract = selectContractForPeriod(data.contracts, employee.employeeId, payrollPeriod, employee.employeeCode);
  } else if (data.contract && typeof data.contract === 'object') {
    contract = normalizeContract(data.contract, employee.employeeId);
    // Validate that the single contract is effective during this payroll period
    const cStart = contract.startDate;
    const cEnd = contract.endDate;
    if (cStart > payrollPeriod.periodEnd || (cEnd && cEnd < payrollPeriod.periodStart)) {
      throw new PayrollInputError(
        'NO_VALID_CONTRACT',
        `Contract '${contract.contractId}' is not effective during payroll period ${payrollPeriod.periodStart} - ${payrollPeriod.periodEnd}.`
      );
    }
  } else {
    throw new PayrollInputError(
      'MISSING_CONTRACT',
      `No contract records provided for employee '${employee.employeeId}'.`
    );
  }

  // 4. Normalize Salary Structure (optional/nullable)
  const salaryStructure = normalizeSalaryStructure(data.salaryStructure);

  // 5. Normalize Salary Rules (sorted deterministically by sequence ASC, ruleId ASC)
  const salaryRules = normalizeSalaryRules(
    data.salaryRules,
    salaryStructure ? salaryStructure.structureId : contract.salaryStructureId
  );

  // 6. Normalize Attendance (scoped to period and employee)
  const attendance = normalizeAttendance(
    data.attendanceRecords,
    employee.employeeId,
    payrollPeriod.periodStart,
    payrollPeriod.periodEnd
  );

  // 7. Normalize Time Off (scoped to period and employee, strictly segregates approved vs refused/pending)
  const timeOff = normalizeTimeOff(
    data.timeOffRequests,
    employee.employeeId,
    payrollPeriod.periodStart,
    payrollPeriod.periodEnd
  );

  return {
    employee,
    contract,
    salaryStructure,
    salaryRules,
    attendance,
    timeOff,
    payrollPeriod,
    // Integrated convenience properties
    employeeId: employee.employeeId,
    employeeName: employee.fullName,
    department: employee.department,
    monthlyWage: contract.wage,
    unpaidDays: timeOff.summary.approvedUnpaidDays,
    overtimeHours: attendance.summary.overtimeHours,
    salaryStructureId: salaryStructure ? salaryStructure.structureId : (contract.salaryStructureId || null),
    attendanceSummary: {
      totalRecords: attendance.records.length,
      totalWorkedHours: attendance.summary.totalWorkedHours,
      presentDays: attendance.summary.presentDays,
      absentDays: attendance.summary.absentDays,
      lateDays: attendance.summary.lateDays,
      overtimeDays: attendance.summary.overtimeDays,
      overtimeHours: attendance.summary.overtimeHours,
    },
    timeOffSummary: {
      approvedLeaveDays: timeOff.summary.totalApprovedDays,
      paidLeaveDays: timeOff.summary.approvedPaidDays,
      unpaidLeaveDays: timeOff.summary.approvedUnpaidDays,
    },
    attendanceRecords: attendance.records,
    timeOffRecords: timeOff.requests,
  };
}
