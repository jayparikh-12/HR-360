/**
 * Payroll Data Preparation Layer — PeoplePay360
 *
 * Sits strictly between the data-access layer (repositories/MySQL)
 * and the pure deterministic PayrollEngine.
 *
 * Architecture:
 *   Database (MySQL)
 *       ↓
 *   Repositories / Services (attendance, timeOff, employee, contract)
 *       ↓
 *   Payroll Data Preparation (this service)
 *       ↓
 *   Normalized PayrollCalculationInput
 *       ↓
 *   Pure Payroll Engine (payrollEngine.ts)
 *
 * Responsibilities:
 * - Deterministically filters attendance records for the target employee & payroll period.
 * - Deterministically filters and normalizes approved time-off requests for the employee & period.
 * - Assembles a fully validated, normalized PayrollCalculationInput.
 * - Does NOT mutate or store state; keeps pure separation of concerns.
 */

import {
  summarizeAttendance,
  summarizeTimeOff,
  type PayrollPeriod,
  type AttendanceRecordInput,
  type AttendanceSummary,
  type TimeOffRecordInput,
  type TimeOffSummary,
  type PayrollSalaryRule,
} from './payrollEngine.js';
import type {
  PayrollCalculationInput,
  NormalizedEmployeeInput,
  NormalizedContractInput,
  NormalizedSalaryStructureInput,
  NormalizedSalaryRuleInput,
  NormalizedAttendanceInput,
  NormalizedTimeOffInput,
  NormalizedPayrollPeriodInput,
} from '../types/payroll.types.js';

export interface EmployeeDataInput {
  id: string;
  name: string;
  department: string;
  wage?: number | string | null;
}

export interface ContractDataInput {
  id?: string;
  wage?: number | string | null;
  salaryStructureId?: string | null;
  salary_structure_id?: string | null;
  structure?: string | null;
  workingScheduleId?: string | null;
  working_schedule_id?: string | null;
  schedule?: string | null;
}

export interface PreparePayrollInputParams {
  employee: EmployeeDataInput;
  contract?: ContractDataInput | null;
  period: PayrollPeriod;
  attendanceRecords?: AttendanceRecordInput[];
  timeOffRecords?: TimeOffRecordInput[];
  salaryRules?: PayrollSalaryRule[];
  overrideUnpaidDays?: number;
  overrideOvertimeHours?: number;
}

export interface PreparedPayrollData {
  input: PayrollCalculationInput;
  attendanceSummary: AttendanceSummary;
  timeOffSummary: TimeOffSummary;
}

/**
 * Prepares a normalized PayrollCalculationInput for a given employee and payroll period.
 * Connects attendance summaries and time-off summaries cleanly into calculation input.
 */
export function preparePayrollCalculationInput(params: PreparePayrollInputParams): PreparedPayrollData {
  const {
    employee,
    contract,
    period,
    attendanceRecords = [],
    timeOffRecords = [],
    salaryRules,
    overrideUnpaidDays,
    overrideOvertimeHours,
  } = params;

  if (!employee || !employee.id) {
    throw new Error('Employee information with a valid ID is required for payroll preparation.');
  }

  if (!period || !period.startDate || !period.endDate) {
    throw new Error('Valid payroll period with startDate and endDate is required.');
  }

  // 1. Prepare Attendance Summary
  const attendanceSummary = summarizeAttendance(attendanceRecords, employee.id, period);

  // 2. Prepare Time Off Summary
  const timeOffSummary = summarizeTimeOff(timeOffRecords, employee.id, period);

  // 3. Resolve Monthly Wage: Contract wage takes precedence over employee default wage
  const rawWage = contract?.wage ?? employee.wage ?? 0;
  const numericWage = typeof rawWage === 'number' ? rawWage : parseFloat(String(rawWage));
  const monthlyWage = isNaN(numericWage) || numericWage < 0 ? 0 : numericWage;

  // 4. Resolve Salary Structure ID
  const salaryStructureId =
    contract?.salaryStructureId ??
    contract?.salary_structure_id ??
    contract?.structure ??
    null;

  // 5. Resolve Unpaid Days (Explicit override -> timeOffSummary.unpaidLeaveDays -> 0)
  const unpaidDays =
    overrideUnpaidDays !== undefined
      ? overrideUnpaidDays
      : timeOffSummary.unpaidLeaveDays;

  // 6. Resolve Overtime Hours (Explicit override -> 0)
  const overtimeHours =
    overrideOvertimeHours !== undefined
      ? overrideOvertimeHours
      : 0;

  // Canonical normalized domain entities
  const nameParts = (employee.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || 'Employee';
  const lastName = nameParts.slice(1).join(' ');
  const fullName = employee.name || 'Unknown Employee';

  const canonicalEmployee: NormalizedEmployeeInput = {
    employeeId: employee.id,
    firstName,
    lastName,
    fullName,
    department: employee.department || 'General',
    position: 'Employee',
    employmentStatus: 'ACTIVE',
  };

  const canonicalContract: NormalizedContractInput = {
    contractId: contract?.id || `CON-${employee.id}`,
    employeeId: employee.id,
    wage: monthlyWage,
    startDate: period.startDate,
    endDate: period.endDate || null,
    salaryStructureId,
    status: 'ACTIVE',
  };

  const canonicalStructure: NormalizedSalaryStructureInput | null = salaryStructureId
    ? { structureId: salaryStructureId, code: salaryStructureId, name: salaryStructureId }
    : null;

  const canonicalPeriod: NormalizedPayrollPeriodInput = {
    periodStart: period.startDate,
    periodEnd: period.endDate,
    year: parseInt(period.startDate.slice(0, 4), 10) || 2026,
    month: parseInt(period.startDate.slice(5, 7), 10) || 1,
    totalDays: 30,
  };

  const canonicalRules: NormalizedSalaryRuleInput[] | undefined = salaryRules !== undefined
    ? salaryRules.map((r) => ({
        ruleId: r.id,
        structureId: r.salaryStructureId || r.structureId || r.structure_id || null,
        name: r.name,
        code: r.code,
        sequence: typeof r.sequence === 'number' ? r.sequence : parseInt(String(r.sequence), 10) || 0,
        category: (r.category.toUpperCase() as any),
        calculationType: ((r.calculationType || r.calculation_type || 'FIXED').toUpperCase() as any),
        amount: r.amount !== undefined && r.amount !== null ? Number(r.amount) : undefined,
        percentage: r.percentage !== undefined && r.percentage !== null ? Number(r.percentage) : undefined,
        formula: r.formula ?? undefined,
        id: r.id,
      }))
    : undefined;

  const canonicalAttendance: NormalizedAttendanceInput = {
    records: attendanceRecords.map((a) => ({
      id: a.id || 'ATT-1',
      date: a.date instanceof Date ? a.date.toISOString().split('T')[0] : String(a.date),
      checkIn: a.checkIn || '',
      checkOut: a.checkOut || '',
      workedHours: Number(a.workedHours ?? 0),
      status: (a.status as any) || 'PRESENT',
    })),
    summary: {
      totalWorkedHours: attendanceSummary.totalWorkedHours,
      presentDays: attendanceSummary.presentDays,
      absentDays: attendanceSummary.absentDays,
      lateDays: attendanceSummary.lateDays,
      overtimeDays: attendanceSummary.overtimeDays,
      overtimeHours: (attendanceSummary as any).overtimeHours ?? 0,
      totalRecordedDays: attendanceSummary.totalRecords,
    },
  };

  const canonicalTimeOff: NormalizedTimeOffInput = {
    requests: timeOffRecords.map((t) => ({
      id: t.id || 'TO-1',
      leaveType: t.leaveType || 'Unpaid Leave',
      startDate: t.startDate instanceof Date ? t.startDate.toISOString().split('T')[0] : String(t.startDate),
      endDate: t.endDate instanceof Date ? t.endDate.toISOString().split('T')[0] : String(t.endDate),
      durationDays: Number(t.durationDays ?? 1),
      status: (t.status as any) || 'APPROVED',
      isUnpaid: true,
    })),
    summary: {
      totalApprovedDays: timeOffSummary.approvedLeaveDays,
      approvedPaidDays: timeOffSummary.paidLeaveDays,
      approvedUnpaidDays: timeOffSummary.unpaidLeaveDays,
      pendingDays: 0,
      refusedDays: 0,
    },
  };

  const calculationInput: PayrollCalculationInput = {
    employee: canonicalEmployee,
    contract: canonicalContract,
    salaryStructure: canonicalStructure,
    salaryRules: canonicalRules,
    attendance: canonicalAttendance,
    timeOff: canonicalTimeOff,
    payrollPeriod: canonicalPeriod,

    // Integrated convenience properties
    employeeId: employee.id,
    employeeName: fullName,
    department: employee.department || 'General',
    monthlyWage,
    unpaidDays,
    overtimeHours,
    salaryStructureId,
    attendanceSummary,
    timeOffSummary,
    attendanceRecords,
    timeOffRecords,
  };

  return {
    input: calculationInput,
    attendanceSummary,
    timeOffSummary,
  };
}
