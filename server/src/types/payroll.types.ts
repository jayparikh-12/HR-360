/**
 * PeoplePay360 — Normalized Payroll Calculation Contract Types
 *
 * Defines the clean, strongly typed domain contracts for the deterministic
 * payroll engine. Contains only fields strictly necessary for payroll calculation.
 * Sensitive fields (passwords, tokens, credentials, banking identifiers) are
 * explicitly omitted.
 */

// ── Error Definitions ────────────────────────────────────────────────────────

export type PayrollInputErrorCode =
  | 'MISSING_EMPLOYEE'
  | 'MISSING_CONTRACT'
  | 'NO_VALID_CONTRACT'
  | 'CONTRACT_EMPLOYEE_MISMATCH'
  | 'INVALID_WAGE'
  | 'INVALID_PERIOD';

export class PayrollInputError extends Error {
  public readonly code: PayrollInputErrorCode;
  public readonly details?: unknown;

  constructor(code: PayrollInputErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'PayrollInputError';
    this.code = code;
    this.details = details;
  }
}

// ── Employee Input Contract ──────────────────────────────────────────────────

export interface NormalizedEmployeeInput {
  employeeId: string;
  employeeCode?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  department: string;
  position: string;
  gender?: 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER' | 'PREFER_NOT_TO_SAY' | null;
  employeeType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';
  employmentStatus: 'ACTIVE' | 'PROBATION' | 'TERMINATED';
  workingSchedule?: string;
}

// ── Contract Input Contract ──────────────────────────────────────────────────

export interface NormalizedContractInput {
  contractId: string;
  employeeId: string;
  wage: number; // Base monthly wage
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  salaryStructureId?: string | null;
  workingScheduleId?: string | null;
  status: 'ACTIVE' | 'FUTURE' | 'HISTORICAL';
}

// ── Salary Structure Input Contract ──────────────────────────────────────────

export interface NormalizedSalaryStructureInput {
  structureId: string;
  code: string;
  name: string;
}

// ── Salary Rule Input Contract ───────────────────────────────────────────────

export type SalaryRuleCategory = 'BASIC' | 'ALLOWANCE' | 'GROSS' | 'DEDUCTION' | 'NET' | 'EARNING' | 'EARNINGS' | 'DEDUCTIONS';
export type SalaryRuleCalculationType = 'FIXED' | 'PERCENTAGE' | 'FORMULA';

export interface NormalizedSalaryRuleInput {
  ruleId: string;
  structureId: string | null;
  name: string;
  code: string;
  sequence: number;
  category: SalaryRuleCategory;
  calculationType: SalaryRuleCalculationType;
  amount: number | null;
  percentage: number | null;
  formula: string | null;
  active?: boolean;
  // Compatibility aliases
  id?: string;
  structure_id?: string | null;
  salaryStructureId?: string | null;
  calculation_type?: string;
}

export interface PayrollSalaryRule {
  id: string;
  ruleId?: string;
  name: string;
  code: string;
  sequence: number;
  category: string;
  calculationType?: string;
  calculation_type?: string;
  amount?: number | null;
  percentage?: number | null;
  base?: number | null;
  percentageBase?: string | null;
  salaryStructureId?: string | null;
  structureId?: string | null;
  structure_id?: string | null;
  status?: string | null;
  isActive?: boolean;
  [key: string]: any;
}

export interface NormalizedPayrollPeriodInput {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  year: number;
  month: number; // 1-12
  totalDays: number;
}

// ── Attendance Input Contract ────────────────────────────────────────────────

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'OVERTIME' | 'MISSING_CHECKOUT';

export interface NormalizedAttendanceRecord {
  id?: string;
  date: string; // YYYY-MM-DD
  checkIn: string;
  checkOut: string;
  workedHours: number;
  status: AttendanceStatus;
}

export interface NormalizedAttendanceSummary {
  totalWorkedHours: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  overtimeDays: number;
  overtimeHours: number;
  totalRecordedDays: number;
}

export interface NormalizedAttendanceInput {
  records: NormalizedAttendanceRecord[];
  summary: NormalizedAttendanceSummary;
}

// ── Time Off Input Contract ──────────────────────────────────────────────────

export type TimeOffRequestStatus = 'PENDING' | 'APPROVED' | 'REFUSED';

export interface NormalizedTimeOffRequest {
  id: string;
  leaveType: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  durationDays: number;
  status: TimeOffRequestStatus;
  isUnpaid: boolean;
}

export interface NormalizedTimeOffSummary {
  totalApprovedDays: number;
  approvedPaidDays: number;
  approvedUnpaidDays: number;
  pendingDays: number;
  refusedDays: number;
}

export interface NormalizedTimeOffInput {
  requests: NormalizedTimeOffRequest[];
  summary: NormalizedTimeOffSummary;
}

export interface PayrollPeriod {
  startDate: string;
  endDate: string;
}

// ── Unified Payroll Calculation Input (Single Source of Truth) ───────────────

export interface PayrollCalculationInput {
  // Canonical normalized domain entities (hydrated by payrollNormalizer / payrollLoader)
  employee?: NormalizedEmployeeInput;
  contract?: NormalizedContractInput;
  salaryStructure?: NormalizedSalaryStructureInput | null;
  salaryRules?: NormalizedSalaryRuleInput[] | any[];
  attendance?: NormalizedAttendanceInput;
  timeOff?: NormalizedTimeOffInput;
  payrollPeriod?: NormalizedPayrollPeriodInput | PayrollPeriod | { startDate: string; endDate: string };

  // Integrated / convenience properties (direct accessors)
  employeeId?: string;
  employeeName?: string;
  department?: string;
  monthlyWage?: number;
  unpaidDays?: number;
  overtimeHours?: number;
  salaryStructureId?: string | null;
  attendanceSummary?: NormalizedAttendanceSummary | any;
  timeOffSummary?: NormalizedTimeOffSummary | any;
  attendanceRecords?: NormalizedAttendanceRecord[] | any[];
  timeOffRecords?: NormalizedTimeOffRequest[] | any[];
  [key: string]: any;
}

export interface FullyNormalizedPayrollCalculationInput extends PayrollCalculationInput {
  employee: NormalizedEmployeeInput;
  contract: NormalizedContractInput;
  salaryStructure: NormalizedSalaryStructureInput | null;
  salaryRules: NormalizedSalaryRuleInput[];
  attendance: NormalizedAttendanceInput;
  timeOff: NormalizedTimeOffInput;
  payrollPeriod: NormalizedPayrollPeriodInput;
}

// ── Payroll Calculation Result Contract (Single Source of Truth) ─────────────

export interface SalaryRuleContribution {
  ruleId: string;
  code: string;
  name: string;
  category: SalaryRuleCategory;
  calculationType: SalaryRuleCalculationType;
  sequence: number;
  amount: number;
  percentage?: number | null;
  base?: number | null;
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
  warning?: string;
  unpaidDays?: number;
  overtimeHours?: number;

  // Rule breakdown
  totalEarnings?: number;
  earnings?: SalaryRuleContribution[];
  deductions?: SalaryRuleContribution[];

  // Phase 4 calculation results
  grossSalary?: number;
  totalCalculatedDeductions?: number;
  netSalary?: number;

  // Detailed summarization results
  rulesResult?: any;
  fixedRulesResult?: any;
  fixedEarnings?: number;
  fixedDeductions?: number;
  percentageEarnings?: number;
  percentageDeductions?: number;
  attendanceSummary?: any;
  timeOffSummary?: any;

  // Explanatory normalized domain entities
  employee?: NormalizedEmployeeInput;
  contract?: NormalizedContractInput;
  salaryStructure?: NormalizedSalaryStructureInput | null;
}

export type PayrollCalculationResult = CalculatedPayslip;

// ── Raw Domain Data Payload for Normalization Layer ─────────────────────────

export interface RawEmployeeData {
  id: string;
  empCode?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  department?: string;
  position?: string;
  jobPosition?: string;
  gender?: string | null;
  employeeType?: string;
  status?: string;
  workingSchedule?: string;
  schedule?: string;
  working_schedule?: string;
  [key: string]: any;
}

export interface RawContractData {
  id: string;
  employeeId?: string;
  employee_id?: string;
  empCode?: string;
  emp_code?: string;
  wage: number | string;
  startDate?: string | Date;
  start_date?: string | Date;
  endDate?: string | Date | null;
  end_date?: string | Date | null;
  salaryStructureId?: string | null;
  salary_structure_id?: string | null;
  salaryStructure?: string;
  structure?: string;
  workingScheduleId?: string | null;
  working_schedule_id?: string | null;
  workingSchedule?: string;
  schedule?: string;
  status?: string;
  [key: string]: any;
}

export interface RawPayrollDomainData {
  employee: RawEmployeeData;
  contract?: RawContractData;
  contracts?: RawContractData[];
  salaryStructure?: {
    id: string;
    code: string;
    name: string;
    [key: string]: any;
  } | null;
  salaryRules?: Array<{
    id: string;
    structureId?: string | null;
    structure_id?: string | null;
    name?: string;
    code: string;
    sequence?: number | string;
    category?: string;
    calculationType?: string;
    calculation_type?: string;
    amount?: number | string | null;
    percentage?: number | string | null;
    formula?: string | null;
    [key: string]: any;
  }>;
  attendanceRecords?: Array<{
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
    overtimeHours?: number | string | null;
    overtime_hours?: number | string | null;
    [key: string]: any;
  }>;
  timeOffRequests?: Array<{
    id?: string;
    employeeId?: string | null;
    employee_id?: string | null;
    leaveType?: string | null;
    leave_type?: string | null;
    startDate?: string | Date | null;
    start_date?: string | Date | null;
    endDate?: string | Date | null;
    end_date?: string | Date | null;
    durationDays?: number | string | null;
    duration_days?: number | string | null;
    status?: string | null;
    isPaid?: boolean | null;
    is_paid?: boolean | null;
    [key: string]: any;
  }>;
  payrollPeriod?: {
    startDate: string;
    endDate: string;
  } | string;
  period?: {
    startDate: string;
    endDate: string;
  } | string;
  payPeriod?: {
    startDate: string;
    endDate: string;
  } | string;
}
