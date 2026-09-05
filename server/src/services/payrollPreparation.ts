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
  type PayrollCalculationInput,
} from './payrollEngine.js';

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

  const calculationInput: PayrollCalculationInput = {
    employeeId: employee.id,
    employeeName: employee.name || 'Unknown Employee',
    department: employee.department || 'General',
    monthlyWage,
    unpaidDays,
    overtimeHours,
    salaryStructureId,
    salaryRules,
    attendanceSummary,
    timeOffSummary,
    payrollPeriod: period,
  };

  return {
    input: calculationInput,
    attendanceSummary,
    timeOffSummary,
  };
}
