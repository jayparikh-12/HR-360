// Deterministic Payroll Calculation Engine

export interface PayrollCalculationInput {
  employeeId: string;
  employeeName: string;
  department: string;
  monthlyWage: number;
  unpaidDays?: number;
  overtimeHours?: number;
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
}

export class PayrollEngine {
  public static compute(input: PayrollCalculationInput): CalculatedPayslip {
    const basic = Math.round(input.monthlyWage * 0.60);
    const hra = Math.round(input.monthlyWage * 0.25);
    const allowance = input.monthlyWage - basic - hra;
    const gross = input.monthlyWage;

    const unpaidDays = input.unpaidDays || 0;
    const dailyRate = basic / 30;
    const unpaidLeaveDeduction = Math.round(dailyRate * unpaidDays);

    const tax = Math.round(gross * 0.10);
    const otherDeductions = Math.round(gross * 0.07);
    const totalDeductions = tax + otherDeductions + unpaidLeaveDeduction;

    const net = gross - totalDeductions;

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
    };
  }
}
