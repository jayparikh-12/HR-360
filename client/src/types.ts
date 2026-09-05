// Shared Domain Models for PeoplePay360

export type UserRole = 'Employee' | 'HR Manager' | 'HR Payroll User' | 'HR Payroll Manager' | 'Admin';

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
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
  employeeName: string;
  startDate: string;
  endDate?: string;
  wage: number;
  salaryStructure: string;
  workingSchedule: string;
  status: 'ACTIVE' | 'FUTURE' | 'HISTORICAL';
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

export interface Payrun {
  id: string;
  name: string;
  period: string;
  salaryStructure: string;
  totalGross: number;
  totalNet: number;
  employeeCount: number;
  status: 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID';
  payslips: PayslipItem[];
}
