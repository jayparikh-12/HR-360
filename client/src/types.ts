// Shared Domain Models for PeoplePay360

export type UserRole = 'Employee' | 'HR Manager' | 'HR Payroll User' | 'HR Payroll Manager' | 'Admin';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeId?: string;
}

export type Gender = 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER' | 'PREFER_NOT_TO_SAY';

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  gender?: Gender | null;
  status: 'ACTIVE' | 'PROBATION' | 'TERMINATED';
  avatarInitials: string;
  joinDate: string;
  activeContractId?: string;
  wage: number;
  schedule: string;
  bankAccount: string;
  attendanceRate: number;
  leaveBalance: number;
}

export interface Contract {
  id: string;
  employeeId: string;
  employeeName?: string;
  empCode?: string;
  department?: string;
  position?: string;
  startDate: string;
  endDate?: string | null;
  wage: number;
  structure?: string;
  salaryStructure: string;
  schedule?: string;
  workingSchedule: string;
  status: 'ACTIVE' | 'FUTURE' | 'HISTORICAL';
}

export interface WorkingSchedule {
  id: string;
  name: string;
  weeklyHours: number;
  workingHours?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  workedHours: number;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'OVERTIME' | 'MISSING_CHECKOUT';
}

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: 'Paid Annual Leave' | 'Sick Leave' | 'Unpaid Leave';
  startDate: string;
  endDate: string;
  durationDays: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REFUSED';
}

export interface PayslipItem {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  basic: number;
  hra: number;
  allowance: number;
  gross: number;
  tax: number;
  otherDeductions: number;
  net: number;
  status: 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID';
  warning?: string;
}

export interface BreakdownItem {
  ruleCode: string;
  ruleName: string;
  category: 'BASIC' | 'ALLOWANCE' | 'GROSS' | 'DEDUCTION' | 'NET';
  amount: number;
}

export interface DetailedPayslip {
  payslipId: string;
  payrunId: string;
  payrunName: string;
  employee: {
    id: string;
    employeeId: string;
    name: string;
    department: string;
    position: string;
  };
  payrollPeriod: {
    start: string | null;
    end: string | null;
  };
  status: 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID' | string;
  baseSalary: number;
  earnings: BreakdownItem[];
  deductions: BreakdownItem[];
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  calculatedAt: string;
  validatedAt: string | null;
  paidAt: string | null;
  paymentReference?: string | null;
  warning?: string | null;
}

export interface EmployeePayslipHistoryItem {
  payslipId: string;
  payrunId: string;
  payrunName: string;
  payrollPeriod: {
    start: string | null;
    end: string | null;
  };
  status: 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID' | string;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  calculatedAt: string;
  paidAt: string | null;
}

export interface Payrun {
  id: string;
  name: string;
  period: string;
  salaryStructure: string;
  totalGross: number;
  totalNet: number;
  employeeCount: number;
  status: 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID';
  validatedAt?: string | null;
  validatedBy?: string | null;
  paidAt?: string | null;
  paidBy?: string | null;
  paymentReference?: string | null;
  payslips: PayslipItem[];
}
