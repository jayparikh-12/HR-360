/**
 * Dashboard Service — Business Logic and Aggregation Coordinator for PeoplePay360.
 *
 * Responsibilities:
 * - Deterministic parsing of period/date filters across different module date semantics.
 * - Coordinating parallel database queries via dashboard.repository.ts.
 * - Generating live system alerts based on persisted database state.
 * - Formatting dual-compatible responses (grouped module structures + top-level KPI aliases).
 * - Enforcing zero-data guarantees and avoiding hardcoded statistics.
 */

import {
  getEmployeeMetrics,
  getPayrollMetrics,
  getAttendanceMetrics,
  getTimeOffMetrics,
  getDepartmentWages,
  getDistinctDepartments,
  getDistinctPeriods,
  type DashboardFilterParams,
  type DateRange,
  type EmployeeAggregationResult,
  type PayrollAggregationResult,
  type AttendanceAggregationResult,
  type TimeOffAggregationResult,
} from '../repositories/dashboard.repository.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DashboardAlert {
  id: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
}

export interface DashboardSummaryResponse {
  // Grouped module data
  employees: EmployeeAggregationResult;
  payroll: PayrollAggregationResult;
  attendance: AttendanceAggregationResult;
  timeOff: TimeOffAggregationResult;
  alerts: DashboardAlert[];

  // Top-level aliases for direct frontend foundation compatibility
  totalEmployees: number;
  activeEmployees: number;
  departmentCount: number;
  totalPayrollCost: number;
  grossPayroll: number;
  netPayroll: number;
  totalDeductions: number;
  latestPayrun: PayrollAggregationResult['latestPayrun'];
  departmentCosts: Record<string, number>;
  attendanceRate: number | null;
  attendancePresentCount: number;
  attendanceTotalRecords: number;
  pendingTimeOffCount: number;
  approvedTimeOffCount: number;
  isPendingBackendAggregation: false;
}

// ── Date & Period Parsing ────────────────────────────────────────────────────

/**
 * Parses user-supplied period filter into normalized DateRange.
 *
 * Supported formats:
 * - "YYYY-MM" (e.g. "2026-09") -> start of month to end of month.
 * - "YYYY-MM-DD - YYYY-MM-DD" or "(YYYY-MM-DD - YYYY-MM-DD)".
 * - Payrun label strings like "2026-09 (2026-09-01 - 2026-09-30)".
 * - "ALL" or empty -> null dates (unrestricted period).
 */
export function parsePeriodFilter(period?: string | null): DateRange {
  if (!period || typeof period !== 'string' || period.trim() === '' || period.trim().toUpperCase() === 'ALL') {
    return { startDate: null, endDate: null, periodLabel: null };
  }

  const p = period.trim();

  // Range match: "2026-09-01 - 2026-09-30"
  const rangeMatch = p.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  if (rangeMatch) {
    return {
      startDate: rangeMatch[1],
      endDate: rangeMatch[2],
      periodLabel: p,
    };
  }

  // Month match: "2026-09"
  const ymMatch = p.match(/^(\d{4})-(\d{2})$/);
  if (ymMatch) {
    const year = parseInt(ymMatch[1], 10);
    const month = parseInt(ymMatch[2], 10);
    const startDate = `${ymMatch[1]}-${ymMatch[2]}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${ymMatch[1]}-${ymMatch[2]}-${String(lastDay).padStart(2, '0')}`;
    return {
      startDate,
      endDate,
      periodLabel: p,
    };
  }

  // Label fallback without parseable date range
  return {
    startDate: null,
    endDate: null,
    periodLabel: p,
  };
}

// ── Alert Derivation ─────────────────────────────────────────────────────────

function deriveDashboardAlerts(
  payroll: PayrollAggregationResult,
  timeOff: TimeOffAggregationResult,
  attendance: AttendanceAggregationResult
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  // Payrun status alerts
  if (payroll.latestPayrun) {
    const lp = payroll.latestPayrun;
    if (lp.status === 'DRAFT') {
      alerts.push({
        id: 'alert-payrun-draft',
        type: 'warning',
        title: 'Payrun Calculation Pending',
        message: `${lp.name} (${lp.period}) is in DRAFT. Run Compute to calculate salary vouchers.`,
      });
    } else if (lp.status === 'COMPUTED') {
      alerts.push({
        id: 'alert-payrun-computed',
        type: 'info',
        title: 'Payrun Awaiting Validation',
        message: `${lp.name} calculations are ready. Validate before marking as paid.`,
      });
    } else if (lp.status === 'VALIDATED') {
      alerts.push({
        id: 'alert-payrun-validated',
        type: 'info',
        title: 'Payrun Ready for Disbursement',
        message: `${lp.name} is validated and approved for payment disbursement.`,
      });
    }
  }

  // Time off pending alerts
  if (timeOff.pending > 0) {
    alerts.push({
      id: 'alert-pending-timeoff',
      type: 'warning',
      title: `${timeOff.pending} Leave Request${timeOff.pending > 1 ? 's' : ''} Pending`,
      message: 'Pending time-off requests require managerial review before payroll cut-off.',
    });
  }

  // Attendance missing checkout alerts
  if (attendance.missingCheckout > 0) {
    alerts.push({
      id: 'alert-missing-checkout',
      type: 'warning',
      title: `${attendance.missingCheckout} Check-out${attendance.missingCheckout > 1 ? 's' : ''} Missing`,
      message: 'Uncompleted daily shifts require verification before wage computation.',
    });
  }

  return alerts;
}

// ── Dashboard Aggregation Coordinator ────────────────────────────────────────

export async function getDashboardSummary(
  filters: DashboardFilterParams = {}
): Promise<DashboardSummaryResponse> {
  const dateRange = parsePeriodFilter(filters.period);

  // Execute database queries in parallel
  const [employees, payroll, attendance, timeOff, baseDeptWages] = await Promise.all([
    getEmployeeMetrics(filters),
    getPayrollMetrics(filters, dateRange),
    getAttendanceMetrics(filters, dateRange),
    getTimeOffMetrics(filters, dateRange),
    getDepartmentWages(filters),
  ]);

  // Combine department costs: prefer payslip gross costs; fallback to base contract wages
  const departmentCosts: Record<string, number> = {};
  if (Object.keys(payroll.departmentCosts).length > 0) {
    Object.assign(departmentCosts, payroll.departmentCosts);
  } else {
    Object.assign(departmentCosts, baseDeptWages);
  }

  const baseWagesSum = Object.values(baseDeptWages).reduce((sum, w) => sum + w, 0);
  const totalPayrollCost = payroll.gross > 0 ? payroll.gross : baseWagesSum;

  const alerts = deriveDashboardAlerts(payroll, timeOff, attendance);

  return {
    // Grouped module objects
    employees,
    payroll,
    attendance,
    timeOff,
    alerts,

    // Top-level KPI aliases for direct frontend foundation compatibility
    totalEmployees: employees.total,
    activeEmployees: employees.active,
    departmentCount: employees.departmentCount,
    totalPayrollCost,
    grossPayroll: payroll.gross,
    netPayroll: payroll.net,
    totalDeductions: payroll.deductions,
    latestPayrun: payroll.latestPayrun,
    departmentCosts,
    attendanceRate: attendance.rate,
    attendancePresentCount: attendance.present + attendance.overtime,
    attendanceTotalRecords: attendance.totalRecords,
    pendingTimeOffCount: timeOff.pending,
    approvedTimeOffCount: timeOff.approved,
    isPendingBackendAggregation: false,
  };
}

export async function getDashboardFilterOptions(): Promise<{
  departments: string[];
  periods: string[];
  employeeTypes: string[];
}> {
  const [departments, periods] = await Promise.all([
    getDistinctDepartments(),
    getDistinctPeriods(),
  ]);

  return {
    departments,
    periods,
    employeeTypes: ['FULL_TIME', 'PART_TIME', 'CONTRACT'],
  };
}
