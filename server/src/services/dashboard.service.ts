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
  getPayrollTrendAggregation,
  getPayrunStatusBreakdown,
  getDepartmentBreakdownAggregation,
  getEmployeeTypeBreakdownAggregation,
  getPendingPayrunsForAlerts,
  type DashboardFilterParams,
  type DateRange,
  type EmployeeAggregationResult,
  type PayrollAggregationResult,
  type AttendanceAggregationResult,
  type TimeOffAggregationResult,
  type PayrollTrendItem,
  type PayrunStatusCounts,
  type StatusBreakdownItem,
  type DepartmentPayrollBreakdownItem,
  type EmployeeTypeBreakdownItem,
  type PayrunAlertItem,
} from '../repositories/dashboard.repository.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DashboardAlert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  severity: 'critical' | 'warning' | 'info' | 'success';
  area: 'payroll' | 'attendance' | 'time-off' | 'employees' | string;
  title: string;
  message: string;
  count: number;
  actionTab?: 'payruns' | 'attendance' | 'time-off' | 'employees' | string;
  actionLabel?: string;
}

export interface DashboardAnalyticsResponse {
  payrollTrend: PayrollTrendItem[];
  trends: PayrollTrendItem[];
  statusBreakdown: StatusBreakdownItem[];
  statusCounts: PayrunStatusCounts;
  departmentBreakdown: DepartmentPayrollBreakdownItem[];
  employeeTypeBreakdown: EmployeeTypeBreakdownItem[];
  summary: {
    grossPayroll: number;
    netPayroll: number;
    totalDeductions: number;
    activeHeadcount: number;
    totalPayruns: number;
    selectedPeriod: string | null;
    selectedDepartment: string | null;
    selectedEmployeeType: string | null;
  };
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

  // Visual analytics aggregations (Phase 6.3)
  payrollTrend: PayrollTrendItem[];
  trends: PayrollTrendItem[];
  statusBreakdown: StatusBreakdownItem[];
  statusCounts: PayrunStatusCounts;
  departmentBreakdown: DepartmentPayrollBreakdownItem[];
  employeeTypeBreakdown: EmployeeTypeBreakdownItem[];
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

export function deriveDashboardAlerts(
  pendingPayruns: PayrunAlertItem[],
  timeOff: TimeOffAggregationResult,
  attendance: AttendanceAggregationResult,
  employees?: EmployeeAggregationResult,
  latestPayrunFallback?: PayrollAggregationResult['latestPayrun']
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  // 1. Payruns awaiting validation (COMPUTED)
  const computedPayruns = pendingPayruns.filter((p) => p.status === 'COMPUTED');
  if (computedPayruns.length > 0) {
    const count = computedPayruns.length;
    const first = computedPayruns[0];
    alerts.push({
      id: 'alert-payrun-computed',
      type: 'warning',
      severity: 'warning',
      area: 'payroll',
      title: count === 1 ? 'Payrun Awaiting Validation' : `${count} Payruns Awaiting Validation`,
      message:
        count === 1
          ? `${first.name} (${first.period}) calculations are ready. Validate before marking as paid.`
          : `${count} payruns have completed calculation and require administrator validation.`,
      count,
      actionTab: 'payruns',
      actionLabel: 'Review & Validate',
    });
  } else if (latestPayrunFallback && latestPayrunFallback.status === 'COMPUTED') {
    alerts.push({
      id: 'alert-payrun-computed',
      type: 'warning',
      severity: 'warning',
      area: 'payroll',
      title: 'Payrun Awaiting Validation',
      message: `${latestPayrunFallback.name} (${latestPayrunFallback.period}) calculations are ready. Validate before marking as paid.`,
      count: 1,
      actionTab: 'payruns',
      actionLabel: 'Review & Validate',
    });
  }

  // 2. Validated payruns pending payment disbursement (VALIDATED)
  const validatedPayruns = pendingPayruns.filter((p) => p.status === 'VALIDATED');
  if (validatedPayruns.length > 0) {
    const count = validatedPayruns.length;
    const first = validatedPayruns[0];
    alerts.push({
      id: 'alert-payrun-validated',
      type: 'critical',
      severity: 'critical',
      area: 'payroll',
      title: count === 1 ? 'Payrun Ready for Disbursement' : `${count} Payruns Ready for Disbursement`,
      message:
        count === 1
          ? `${first.name} (${first.period}) is validated and approved for payment disbursement.`
          : `${count} payruns are validated and awaiting payment disbursement.`,
      count,
      actionTab: 'payruns',
      actionLabel: 'Process Disbursement',
    });
  } else if (latestPayrunFallback && latestPayrunFallback.status === 'VALIDATED') {
    alerts.push({
      id: 'alert-payrun-validated',
      type: 'critical',
      severity: 'critical',
      area: 'payroll',
      title: 'Payrun Ready for Disbursement',
      message: `${latestPayrunFallback.name} (${latestPayrunFallback.period}) is validated and approved for payment disbursement.`,
      count: 1,
      actionTab: 'payruns',
      actionLabel: 'Process Disbursement',
    });
  }

  // 3. Payrun calculation pending (DRAFT)
  const draftPayruns = pendingPayruns.filter((p) => p.status === 'DRAFT');
  if (draftPayruns.length > 0) {
    const count = draftPayruns.length;
    const first = draftPayruns[0];
    alerts.push({
      id: 'alert-payrun-draft',
      type: 'warning',
      severity: 'warning',
      area: 'payroll',
      title: count === 1 ? 'Payrun Calculation Pending' : `${count} Payrun Calculations Pending`,
      message:
        count === 1
          ? `${first.name} (${first.period}) is in DRAFT. Run Compute to calculate salary vouchers.`
          : `${count} payruns are in DRAFT state. Run Compute to calculate salary vouchers.`,
      count,
      actionTab: 'payruns',
      actionLabel: 'Launch Payrun',
    });
  } else if (latestPayrunFallback && latestPayrunFallback.status === 'DRAFT') {
    alerts.push({
      id: 'alert-payrun-draft',
      type: 'warning',
      severity: 'warning',
      area: 'payroll',
      title: 'Payrun Calculation Pending',
      message: `${latestPayrunFallback.name} (${latestPayrunFallback.period}) is in DRAFT. Run Compute to calculate salary vouchers.`,
      count: 1,
      actionTab: 'payruns',
      actionLabel: 'Launch Payrun',
    });
  }

  // 4. Attendance missing checkout alerts
  if (attendance && attendance.missingCheckout > 0) {
    const count = attendance.missingCheckout;
    alerts.push({
      id: 'alert-missing-checkout',
      type: count > 5 ? 'critical' : 'warning',
      severity: count > 5 ? 'critical' : 'warning',
      area: 'attendance',
      title: `${count} Check-out${count > 1 ? 's' : ''} Missing`,
      message: 'Uncompleted daily shifts require verification before wage computation.',
      count,
      actionTab: 'attendance',
      actionLabel: 'Verify Attendance',
    });
  }

  // 5. Time off pending requests
  if (timeOff && timeOff.pending > 0) {
    const count = timeOff.pending;
    alerts.push({
      id: 'alert-pending-timeoff',
      type: 'warning',
      severity: 'warning',
      area: 'time-off',
      title: `${count} Leave Request${count > 1 ? 's' : ''} Pending`,
      message: 'Pending time-off requests require managerial review before payroll cut-off.',
      count,
      actionTab: 'time-off',
      actionLabel: 'Review Requests',
    });
  }

  // 6. Active employees missing active contracts
  if (employees && employees.uncontracted && employees.uncontracted > 0) {
    const count = employees.uncontracted;
    alerts.push({
      id: 'alert-uncontracted-employees',
      type: 'critical',
      severity: 'critical',
      area: 'employees',
      title: `${count} Active Employee${count > 1 ? 's' : ''} Missing Contract`,
      message: 'Active employees lack an active salary contract. Contracts are required before running payroll.',
      count,
      actionTab: 'employees',
      actionLabel: 'View Directory',
    });
  }

  // 7. Employees on probation
  if (employees && employees.probation && employees.probation > 0) {
    const count = employees.probation;
    alerts.push({
      id: 'alert-probation-review',
      type: 'info',
      severity: 'info',
      area: 'employees',
      title: `${count} Employee${count > 1 ? 's' : ''} on Probation`,
      message: 'Probationary reviews are pending evaluation against active contracts.',
      count,
      actionTab: 'employees',
      actionLabel: 'View Directory',
    });
  }

  return alerts;
}

/**
 * Dedicated coordinator to retrieve operational alerts and insights with optional filters.
 */
export async function getDashboardAlerts(
  filters: DashboardFilterParams = {}
): Promise<DashboardAlert[]> {
  const dateRange = parsePeriodFilter(filters.period);

  const [employees, attendance, timeOff, pendingPayruns] = await Promise.all([
    getEmployeeMetrics(filters, dateRange),
    getAttendanceMetrics(filters, dateRange),
    getTimeOffMetrics(filters, dateRange),
    getPendingPayrunsForAlerts(filters, dateRange),
  ]);

  return deriveDashboardAlerts(pendingPayruns, timeOff, attendance, employees);
}

// ── Dashboard Aggregation Coordinator ────────────────────────────────────────

export async function getDashboardSummary(
  filters: DashboardFilterParams = {}
): Promise<DashboardSummaryResponse> {
  const dateRange = parsePeriodFilter(filters.period);

  // Execute database queries in parallel
  const [
    employees,
    payroll,
    attendance,
    timeOff,
    baseDeptWages,
    payrollTrend,
    statusResult,
    employeeTypeBreakdown,
    pendingPayruns,
  ] = await Promise.all([
    getEmployeeMetrics(filters, dateRange),
    getPayrollMetrics(filters, dateRange),
    getAttendanceMetrics(filters, dateRange),
    getTimeOffMetrics(filters, dateRange),
    getDepartmentWages(filters, dateRange),
    getPayrollTrendAggregation(filters, dateRange),
    getPayrunStatusBreakdown(filters, dateRange),
    getEmployeeTypeBreakdownAggregation(filters),
    getPendingPayrunsForAlerts(filters, dateRange),
  ]);

  const departmentBreakdown = await getDepartmentBreakdownAggregation(
    filters,
    dateRange,
    payroll.latestPayrun?.id
  );

  // Combine department costs: prefer payslip gross costs; fallback to base contract wages
  const departmentCosts: Record<string, number> = {};
  if (Object.keys(payroll.departmentCosts).length > 0) {
    Object.assign(departmentCosts, payroll.departmentCosts);
  } else {
    Object.assign(departmentCosts, baseDeptWages);
  }

  const baseWagesSum = Object.values(baseDeptWages).reduce((sum, w) => sum + w, 0);
  const totalPayrollCost = payroll.gross > 0 ? payroll.gross : baseWagesSum;

  const alerts = deriveDashboardAlerts(
    pendingPayruns,
    timeOff,
    attendance,
    employees,
    payroll.latestPayrun
  );

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

    // Visual analytics aggregations (Phase 6.3)
    payrollTrend,
    trends: payrollTrend,
    statusBreakdown: statusResult.items,
    statusCounts: statusResult.counts,
    departmentBreakdown,
    employeeTypeBreakdown,
  };
}

/**
 * Dedicated visual analytics coordinator for /api/dashboard/analytics.
 */
export async function getDashboardAnalytics(
  filters: DashboardFilterParams = {}
): Promise<DashboardAnalyticsResponse> {
  const dateRange = parsePeriodFilter(filters.period);

  const [
    payrollTrend,
    statusResult,
    employees,
    payroll,
  ] = await Promise.all([
    getPayrollTrendAggregation(filters, dateRange),
    getPayrunStatusBreakdown(filters, dateRange),
    getEmployeeMetrics(filters, dateRange),
    getPayrollMetrics(filters, dateRange),
  ]);

  const [departmentBreakdown, employeeTypeBreakdown] = await Promise.all([
    getDepartmentBreakdownAggregation(filters, dateRange, payroll.latestPayrun?.id),
    getEmployeeTypeBreakdownAggregation(filters),
  ]);

  return {
    payrollTrend,
    trends: payrollTrend,
    statusBreakdown: statusResult.items,
    statusCounts: statusResult.counts,
    departmentBreakdown,
    employeeTypeBreakdown,
    summary: {
      grossPayroll: payroll.gross,
      netPayroll: payroll.net,
      totalDeductions: payroll.deductions,
      activeHeadcount: employees.active,
      totalPayruns: statusResult.counts.total,
      selectedPeriod: filters.period || null,
      selectedDepartment: filters.department || null,
      selectedEmployeeType: filters.employeeType || null,
    },
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
