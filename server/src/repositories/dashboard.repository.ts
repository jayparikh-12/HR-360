/**
 * Dashboard Repository — Centralized SQL Aggregation Layer for PeoplePay360 Dashboard.
 *
 * Responsibilities:
 * - Direct aggregation over MySQL database tables: employees, payruns, payslips, attendance_records, time_off_requests.
 * - Uses parameterized queries exclusively via executeQuery.
 * - Safely handles zero-data scenarios (returns clean numeric 0s, never null or NaN).
 * - Implements server-side filtering for department, employeeType, and period dates.
 * - Never leaks SQL statements or credentials to callers.
 */

import { RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '../config/database.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DashboardFilterParams {
  period?: string | null;
  department?: string | null;
  employeeType?: string | null;
}

export interface DateRange {
  startDate: string | null;
  endDate: string | null;
  periodLabel: string | null;
}

export interface EmployeeAggregationResult {
  total: number;
  active: number;
  inactive: number;
  probation: number;
  uncontracted: number;
  departmentCount: number;
  byDepartment: Record<string, number>;
  byType: Record<string, number>;
}

export interface PayrollAggregationResult {
  gross: number;
  deductions: number;
  net: number;
  employees: number;
  payslips: number;
  totalPayruns: number;
  statusCounts: {
    draft: number;
    computed: number;
    validated: number;
    paid: number;
  };
  latestPayrun: {
    id: string;
    name: string;
    period: string;
    status: string;
    employeeCount: number;
    totalGross: number;
    totalNet: number;
  } | null;
  departmentCosts: Record<string, number>;
}

export interface PayrollTrendItem {
  period: string;
  payrollPeriod: string;
  name: string;
  gross: number;
  grossPayroll: number;
  net: number;
  netPayroll: number;
  deductions: number;
  totalDeductions: number;
  employeeCount: number;
  status: string;
  payrunId: string;
}

export interface PayrunStatusCounts {
  draft: number;
  computed: number;
  validated: number;
  paid: number;
  total: number;
}

export interface StatusBreakdownItem {
  status: string;
  count: number;
  percentage: number;
}

export interface DepartmentPayrollBreakdownItem {
  department: string;
  gross: number;
  totalPayroll: number;
  net: number;
  deductions: number;
  employeeCount: number;
  percentage: number;
}

export interface EmployeeTypeBreakdownItem {
  employeeType: string;
  count: number;
  percentage: number;
  totalWage: number;
}

export interface AttendanceAggregationResult {
  totalRecords: number;
  total?: number;
  present: number;
  absent: number;
  late: number;
  overtime: number;
  missingCheckout: number;
  rate: number | null;
}

export interface TimeOffAggregationResult {
  totalRequests: number;
  approved: number;
  pending: number;
  rejected: number;
  refused?: number;
  totalDays: number;
  approvedDays: number;
}

export interface AttendanceTrendItem {
  date: string;
  displayDate: string;
  present: number;
  absent: number;
  late: number;
  overtime: number;
  missingCheckout: number;
  total: number;
}

export interface AttendanceDepartmentItem {
  department: string;
  total: number;
  present: number;
  rate: number;
}

export interface TimeOffTypeItem {
  type: string;
  count: number;
  days: number;
  percentage: number;
}

export interface TimeOffDepartmentItem {
  department: string;
  count: number;
  days: number;
  percentage: number;
}

// ── Employee Aggregation ─────────────────────────────────────────────────────

export async function getEmployeeMetrics(
  filters: DashboardFilterParams,
  dateRange?: DateRange
): Promise<EmployeeAggregationResult> {
  const whereClauses: string[] = ['1=1'];
  const params: unknown[] = [];

  if (filters.department && filters.department.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('LOWER(e.department) = LOWER(?)');
    params.push(filters.department.trim());
  }

  // Active/employment period semantics: employee must have joined on or before period end date
  if (dateRange && dateRange.endDate) {
    whereClauses.push('DATE(e.join_date) <= ?');
    params.push(dateRange.endDate);
  }

  if (filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('(CASE WHEN ws.weekly_hours < 40 THEN "PART_TIME" ELSE "FULL_TIME" END = ?)');
    params.push(filters.employeeType.trim().toUpperCase());
  }

  const whereSql = whereClauses.join(' AND ');

  // Summary counts
  const summarySql = `
    SELECT
      COUNT(DISTINCT e.id) AS total,
      SUM(CASE WHEN e.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN e.status IN ('INACTIVE', 'TERMINATED') THEN 1 ELSE 0 END) AS inactive,
      SUM(CASE WHEN e.status = 'PROBATION' THEN 1 ELSE 0 END) AS probation,
      SUM(CASE WHEN e.status = 'ACTIVE' AND c.id IS NULL THEN 1 ELSE 0 END) AS uncontracted,
      COUNT(DISTINCT e.department) AS department_count
    FROM employees e
    LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
    LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
    WHERE ${whereSql}
  `;

  const summaryRows = await executeQuery<RowDataPacket[]>(summarySql, params);
  const row = summaryRows[0] || {};

  const total = Number(row.total) || 0;
  const active = Number(row.active) || 0;
  const inactive = Number(row.inactive) || 0;
  const probation = Number(row.probation) || 0;
  const uncontracted = Number(row.uncontracted) || 0;
  const departmentCount = Number(row.department_count) || 0;

  // Breakdown by department
  const deptSql = `
    SELECT
      COALESCE(e.department, 'Unassigned') AS department,
      COUNT(DISTINCT e.id) AS count
    FROM employees e
    LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
    LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
    WHERE ${whereSql}
    GROUP BY e.department
  `;
  const deptRows = await executeQuery<RowDataPacket[]>(deptSql, params);
  const byDepartment: Record<string, number> = {};
  for (const dr of deptRows) {
    byDepartment[String(dr.department)] = Number(dr.count) || 0;
  }

  // Note: Employee Type is unavailable in current schema domain model.
  const byType: Record<string, number> = {};

  return {
    total,
    active,
    inactive,
    probation,
    uncontracted,
    departmentCount,
    byDepartment,
    byType,
  };
}

// ── Department Wages from Active Contracts ────────────────────────────────────

export async function getDepartmentWages(
  filters: DashboardFilterParams,
  dateRange?: DateRange
): Promise<Record<string, number>> {
  const whereClauses: string[] = ['1=1'];
  const params: unknown[] = [];

  if (filters.department && filters.department.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('LOWER(e.department) = LOWER(?)');
    params.push(filters.department.trim());
  }

  if (dateRange && dateRange.endDate) {
    whereClauses.push('DATE(e.join_date) <= ?');
    params.push(dateRange.endDate);
  }

  if (filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('(CASE WHEN ws.weekly_hours < 40 THEN "PART_TIME" ELSE "FULL_TIME" END = ?)');
    params.push(filters.employeeType.trim().toUpperCase());
  }

  const whereSql = whereClauses.join(' AND ');

  const sql = `
    SELECT
      COALESCE(e.department, 'Unassigned') AS department,
      COALESCE(SUM(c.wage), 0) AS total_wage
    FROM employees e
    LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
    LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
    WHERE ${whereSql}
    GROUP BY e.department
  `;

  const rows = await executeQuery<RowDataPacket[]>(sql, params);
  const costs: Record<string, number> = {};
  for (const r of rows) {
    costs[String(r.department)] = Number(r.total_wage) || 0;
  }
  return costs;
}

// ── Payroll Aggregation ──────────────────────────────────────────────────────

export async function getPayrollMetrics(
  filters: DashboardFilterParams,
  dateRange: DateRange
): Promise<PayrollAggregationResult> {
  // 1. Overall payrun status distribution
  const statusSql = `
    SELECT
      COUNT(id) AS total_payruns,
      SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) AS draft_count,
      SUM(CASE WHEN status = 'COMPUTED' THEN 1 ELSE 0 END) AS computed_count,
      SUM(CASE WHEN status = 'VALIDATED' THEN 1 ELSE 0 END) AS validated_count,
      SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) AS paid_count
    FROM payruns
  `;
  const statusRows = await executeQuery<RowDataPacket[]>(statusSql, []);
  const sRow = statusRows[0] || {};
  const statusCounts = {
    draft: Number(sRow.draft_count) || 0,
    computed: Number(sRow.computed_count) || 0,
    validated: Number(sRow.validated_count) || 0,
    paid: Number(sRow.paid_count) || 0,
  };
  const totalPayruns = Number(sRow.total_payruns) || 0;

  // 2. Determine target Payrun for cycle view
  let targetPayrun: RowDataPacket | null = null;
  if (dateRange.periodLabel) {
    const payrunQuery = `
      SELECT * FROM payruns
      WHERE period = ? OR period LIKE ?
      ORDER BY (period = ?) DESC, id DESC
      LIMIT 1
    `;
    const payrunRows = await executeQuery<RowDataPacket[]>(payrunQuery, [
      dateRange.periodLabel,
      `%${dateRange.periodLabel}%`,
      dateRange.periodLabel,
    ]);
    if (payrunRows.length > 0) {
      targetPayrun = payrunRows[0];
    }
  } else {
    // Default to most recent payrun
    const payrunQuery = `SELECT * FROM payruns ORDER BY id DESC LIMIT 1`;
    const payrunRows = await executeQuery<RowDataPacket[]>(payrunQuery, []);
    if (payrunRows.length > 0) {
      targetPayrun = payrunRows[0];
    }
  }

  // 3. Aggregate Payslips
  const payslipWhereClauses: string[] = ['1=1'];
  const payslipParams: unknown[] = [];

  if (targetPayrun) {
    payslipWhereClauses.push('p.payrun_id = ?');
    payslipParams.push(targetPayrun.id);
  } else if (dateRange.periodLabel) {
    // If period requested but no payrun exists with that period: zero data
    payslipWhereClauses.push('1=0');
  }

  if (filters.department && filters.department.trim().toUpperCase() !== 'ALL') {
    payslipWhereClauses.push('LOWER(e.department) = LOWER(?)');
    payslipParams.push(filters.department.trim());
  }

  if (filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL') {
    payslipWhereClauses.push('(CASE WHEN ws.weekly_hours < 40 THEN "PART_TIME" ELSE "FULL_TIME" END = ?)');
    payslipParams.push(filters.employeeType.trim().toUpperCase());
  }

  const payslipWhereSql = payslipWhereClauses.join(' AND ');

  const payslipMetricsSql = `
    SELECT
      COALESCE(SUM(p.gross), 0) AS total_gross,
      COALESCE(SUM(p.net), 0) AS total_net,
      COALESCE(SUM(COALESCE(p.tax, 0) + COALESCE(p.other_deductions, 0)), 0) AS total_deductions,
      COUNT(DISTINCT p.employee_id) AS employee_count,
      COUNT(p.id) AS payslip_count
    FROM payslips p
    JOIN employees e ON e.id = p.employee_id
    LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
    LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
    WHERE ${payslipWhereSql}
  `;

  const payslipMetricRows = await executeQuery<RowDataPacket[]>(payslipMetricsSql, payslipParams);
  const pm = payslipMetricRows[0] || {};

  const gross = Number(pm.total_gross) || 0;
  const net = Number(pm.total_net) || 0;
  const calculatedDeductions = Number(pm.total_deductions) || 0;
  const deductions = calculatedDeductions > 0 ? calculatedDeductions : Math.max(0, gross - net);
  const employeeCount = Number(pm.employee_count) || 0;
  const payslipCount = Number(pm.payslip_count) || 0;

  // Department cost breakdown from payslips
  const deptCostSql = `
    SELECT
      COALESCE(e.department, 'Unassigned') AS department,
      COALESCE(SUM(p.gross), 0) AS total_gross
    FROM payslips p
    JOIN employees e ON e.id = p.employee_id
    LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
    LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
    WHERE ${payslipWhereSql}
    GROUP BY e.department
  `;
  const deptCostRows = await executeQuery<RowDataPacket[]>(deptCostSql, payslipParams);
  const departmentCosts: Record<string, number> = {};
  for (const dr of deptCostRows) {
    departmentCosts[String(dr.department)] = Number(dr.total_gross) || 0;
  }

  // Scoped latestPayrun representation
  let latestPayrun: PayrollAggregationResult['latestPayrun'] = null;
  if (targetPayrun) {
    // If filtered by department, adjust payrun snapshot stats to the filtered scope
    const isFiltered = filters.department && filters.department.trim().toUpperCase() !== 'ALL';

    latestPayrun = {
      id: String(targetPayrun.id),
      name: String(targetPayrun.name),
      period: String(targetPayrun.period),
      status: String(targetPayrun.status),
      employeeCount: isFiltered ? employeeCount : Number(targetPayrun.employee_count) || payslipCount,
      totalGross: isFiltered ? gross : Number(targetPayrun.total_gross) || gross,
      totalNet: isFiltered ? net : Number(targetPayrun.total_net) || net,
    };
  }

  return {
    gross,
    deductions,
    net,
    employees: employeeCount,
    payslips: payslipCount,
    totalPayruns,
    statusCounts,
    latestPayrun,
    departmentCosts,
  };
}

// ── Attendance Aggregation ───────────────────────────────────────────────────

export async function getAttendanceMetrics(
  filters: DashboardFilterParams,
  dateRange: DateRange
): Promise<AttendanceAggregationResult> {
  const whereClauses: string[] = ['1=1'];
  const params: unknown[] = [];

  if (dateRange.startDate && dateRange.endDate) {
    whereClauses.push('a.date >= ? AND a.date <= ?');
    params.push(dateRange.startDate, dateRange.endDate);
  }

  if (filters.department && filters.department.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('LOWER(e.department) = LOWER(?)');
    params.push(filters.department.trim());
  }

  if (filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('(CASE WHEN ws.weekly_hours < 40 THEN "PART_TIME" ELSE "FULL_TIME" END = ?)');
    params.push(filters.employeeType.trim().toUpperCase());
  }

  const whereSql = whereClauses.join(' AND ');

  const sql = `
    SELECT
      COUNT(a.id) AS total_records,
      SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) AS present_count,
      SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END) AS absent_count,
      SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END) AS late_count,
      SUM(CASE WHEN a.status = 'OVERTIME' THEN 1 ELSE 0 END) AS overtime_count,
      SUM(CASE WHEN a.status = 'MISSING_CHECKOUT' OR (a.check_in IS NOT NULL AND a.check_out IS NULL) THEN 1 ELSE 0 END) AS missing_checkout_count
    FROM attendance_records a
    LEFT JOIN employees e ON e.id = a.employee_id
    LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
    LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
    WHERE ${whereSql}
  `;

  const rows = await executeQuery<RowDataPacket[]>(sql, params);
  const row = rows[0] || {};

  const totalRecords = Number(row.total_records) || 0;
  const present = Number(row.present_count) || 0;
  const absent = Number(row.absent_count) || 0;
  const late = Number(row.late_count) || 0;
  const overtime = Number(row.overtime_count) || 0;
  const missingCheckout = Number(row.missing_checkout_count) || 0;

  const rate =
    totalRecords > 0
      ? Math.round(((present + overtime) / totalRecords) * 1000) / 10
      : null;

  return {
    totalRecords,
    total: totalRecords,
    present,
    absent,
    late,
    overtime,
    missingCheckout,
    rate,
  };
}

// ── Time Off Aggregation ─────────────────────────────────────────────────────

export async function getTimeOffMetrics(
  filters: DashboardFilterParams,
  dateRange: DateRange
): Promise<TimeOffAggregationResult> {
  const whereClauses: string[] = ['1=1'];
  const params: unknown[] = [];

  // Overlapping request date filter: request covers or intersects with period
  if (dateRange.startDate && dateRange.endDate) {
    whereClauses.push('t.start_date <= ? AND t.end_date >= ?');
    params.push(dateRange.endDate, dateRange.startDate);
  }

  if (filters.department && filters.department.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('LOWER(e.department) = LOWER(?)');
    params.push(filters.department.trim());
  }

  if (filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('(CASE WHEN ws.weekly_hours < 40 THEN "PART_TIME" ELSE "FULL_TIME" END = ?)');
    params.push(filters.employeeType.trim().toUpperCase());
  }

  const whereSql = whereClauses.join(' AND ');

  const sql = `
    SELECT
      COUNT(t.id) AS total_requests,
      SUM(CASE WHEN t.status = 'APPROVED' THEN 1 ELSE 0 END) AS approved_count,
      SUM(CASE WHEN t.status = 'PENDING' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN t.status IN ('REFUSED', 'REJECTED') THEN 1 ELSE 0 END) AS rejected_count,
      COALESCE(SUM(t.duration_days), 0) AS total_days,
      COALESCE(SUM(CASE WHEN t.status = 'APPROVED' THEN t.duration_days ELSE 0 END), 0) AS approved_days
    FROM time_off_requests t
    LEFT JOIN employees e ON e.id = t.employee_id
    LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
    LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
    WHERE ${whereSql}
  `;

  const rows = await executeQuery<RowDataPacket[]>(sql, params);
  const row = rows[0] || {};

  const totalRequests = Number(row.total_requests) || 0;
  const approved = Number(row.approved_count) || 0;
  const pending = Number(row.pending_count) || 0;
  const rejected = Number(row.rejected_count) || 0;
  const totalDays = Number(row.total_days) || 0;
  const approvedDays = Number(row.approved_days) || 0;

  return {
    totalRequests,
    approved,
    pending,
    rejected,
    refused: rejected,
    totalDays,
    approvedDays,
  };
}

// ── Attendance Visual & Breakdown Aggregations (Phase 6.5) ───────────────────

/**
 * Aggregates daily attendance trends grouped chronologically by date.
 */
export async function getAttendanceTrendAggregation(
  filters: DashboardFilterParams,
  dateRange: DateRange
): Promise<AttendanceTrendItem[]> {
  const whereClauses: string[] = ['1=1'];
  const params: unknown[] = [];

  if (dateRange.startDate && dateRange.endDate) {
    whereClauses.push('a.date >= ? AND a.date <= ?');
    params.push(dateRange.startDate, dateRange.endDate);
  }

  if (filters.department && filters.department.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('LOWER(e.department) = LOWER(?)');
    params.push(filters.department.trim());
  }

  if (filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('(CASE WHEN ws.weekly_hours < 40 THEN "PART_TIME" ELSE "FULL_TIME" END = ?)');
    params.push(filters.employeeType.trim().toUpperCase());
  }

  const whereSql = whereClauses.join(' AND ');

  const sql = `
    SELECT
      DATE_FORMAT(a.date, '%Y-%m-%d') AS date_str,
      COUNT(a.id) AS total,
      COALESCE(SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END), 0) AS present,
      COALESCE(SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END), 0) AS absent,
      COALESCE(SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END), 0) AS late,
      COALESCE(SUM(CASE WHEN a.status = 'OVERTIME' THEN 1 ELSE 0 END), 0) AS overtime,
      COALESCE(SUM(CASE WHEN a.status = 'MISSING_CHECKOUT' OR (a.check_in IS NOT NULL AND a.check_out IS NULL) THEN 1 ELSE 0 END), 0) AS missing_checkout
    FROM attendance_records a
    LEFT JOIN employees e ON e.id = a.employee_id
    LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
    LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
    WHERE ${whereSql}
    GROUP BY DATE_FORMAT(a.date, '%Y-%m-%d')
    ORDER BY date_str ASC
    LIMIT 31
  `;

  const rows = await executeQuery<RowDataPacket[]>(sql, params);
  return rows.map((r) => {
    const d = String(r.date_str);
    let displayDate = d;
    try {
      const parts = d.split('-');
      if (parts.length === 3) {
        const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        displayDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch {
      displayDate = d;
    }

    return {
      date: d,
      displayDate,
      present: Number(r.present) || 0,
      absent: Number(r.absent) || 0,
      late: Number(r.late) || 0,
      overtime: Number(r.overtime) || 0,
      missingCheckout: Number(r.missing_checkout) || 0,
      total: Number(r.total) || 0,
    };
  });
}

/**
 * Aggregates attendance volume and presence rate grouped by department.
 */
export async function getAttendanceDepartmentBreakdown(
  filters: DashboardFilterParams,
  dateRange: DateRange
): Promise<AttendanceDepartmentItem[]> {
  const whereClauses: string[] = ['1=1'];
  const params: unknown[] = [];

  if (dateRange.startDate && dateRange.endDate) {
    whereClauses.push('a.date >= ? AND a.date <= ?');
    params.push(dateRange.startDate, dateRange.endDate);
  }

  if (filters.department && filters.department.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('LOWER(e.department) = LOWER(?)');
    params.push(filters.department.trim());
  }

  if (filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('(CASE WHEN ws.weekly_hours < 40 THEN "PART_TIME" ELSE "FULL_TIME" END = ?)');
    params.push(filters.employeeType.trim().toUpperCase());
  }

  const whereSql = whereClauses.join(' AND ');

  const sql = `
    SELECT
      COALESCE(e.department, 'Unassigned') AS department,
      COUNT(a.id) AS total,
      COALESCE(SUM(CASE WHEN a.status IN ('PRESENT', 'OVERTIME') THEN 1 ELSE 0 END), 0) AS present
    FROM attendance_records a
    LEFT JOIN employees e ON e.id = a.employee_id
    LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
    LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
    WHERE ${whereSql}
    GROUP BY e.department
    ORDER BY total DESC
  `;

  const rows = await executeQuery<RowDataPacket[]>(sql, params);
  return rows.map((r) => {
    const total = Number(r.total) || 0;
    const present = Number(r.present) || 0;
    return {
      department: String(r.department),
      total,
      present,
      rate: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
    };
  });
}

// ── Time-Off Breakdowns (Phase 6.5) ───────────────────────────────────────────

/**
 * Aggregates time-off requests and total duration days grouped by leave type.
 */
export async function getTimeOffTypeBreakdown(
  filters: DashboardFilterParams,
  dateRange: DateRange
): Promise<TimeOffTypeItem[]> {
  const whereClauses: string[] = ['1=1'];
  const params: unknown[] = [];

  if (dateRange.startDate && dateRange.endDate) {
    whereClauses.push('t.start_date <= ? AND t.end_date >= ?');
    params.push(dateRange.endDate, dateRange.startDate);
  }

  if (filters.department && filters.department.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('LOWER(e.department) = LOWER(?)');
    params.push(filters.department.trim());
  }

  if (filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('(CASE WHEN ws.weekly_hours < 40 THEN "PART_TIME" ELSE "FULL_TIME" END = ?)');
    params.push(filters.employeeType.trim().toUpperCase());
  }

  const whereSql = whereClauses.join(' AND ');

  const sql = `
    SELECT
      COALESCE(t.leave_type, 'Other Leave') AS leave_type,
      COUNT(t.id) AS count,
      COALESCE(SUM(t.duration_days), 0) AS total_days
    FROM time_off_requests t
    LEFT JOIN employees e ON e.id = t.employee_id
    LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
    LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
    WHERE ${whereSql}
    GROUP BY t.leave_type
    ORDER BY total_days DESC
  `;

  const rows = await executeQuery<RowDataPacket[]>(sql, params);
  const totalDaysSum = rows.reduce((s, r) => s + (Number(r.total_days) || 0), 0);

  return rows.map((r) => {
    const days = Number(r.total_days) || 0;
    return {
      type: String(r.leave_type),
      count: Number(r.count) || 0,
      days,
      percentage: totalDaysSum > 0 ? Math.round((days / totalDaysSum) * 1000) / 10 : 0,
    };
  });
}

/**
 * Aggregates time-off requests and total duration days grouped by requesting employee's department.
 */
export async function getTimeOffDepartmentBreakdown(
  filters: DashboardFilterParams,
  dateRange: DateRange
): Promise<TimeOffDepartmentItem[]> {
  const whereClauses: string[] = ['1=1'];
  const params: unknown[] = [];

  if (dateRange.startDate && dateRange.endDate) {
    whereClauses.push('t.start_date <= ? AND t.end_date >= ?');
    params.push(dateRange.endDate, dateRange.startDate);
  }

  if (filters.department && filters.department.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('LOWER(e.department) = LOWER(?)');
    params.push(filters.department.trim());
  }

  if (filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('(CASE WHEN ws.weekly_hours < 40 THEN "PART_TIME" ELSE "FULL_TIME" END = ?)');
    params.push(filters.employeeType.trim().toUpperCase());
  }

  const whereSql = whereClauses.join(' AND ');

  const sql = `
    SELECT
      COALESCE(e.department, 'Unassigned') AS department,
      COUNT(t.id) AS count,
      COALESCE(SUM(t.duration_days), 0) AS total_days
    FROM time_off_requests t
    LEFT JOIN employees e ON e.id = t.employee_id
    LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
    LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
    WHERE ${whereSql}
    GROUP BY e.department
    ORDER BY total_days DESC
  `;

  const rows = await executeQuery<RowDataPacket[]>(sql, params);
  const totalDaysSum = rows.reduce((s, r) => s + (Number(r.total_days) || 0), 0);

  return rows.map((r) => {
    const days = Number(r.total_days) || 0;
    return {
      department: String(r.department),
      count: Number(r.count) || 0,
      days,
      percentage: totalDaysSum > 0 ? Math.round((days / totalDaysSum) * 1000) / 10 : 0,
    };
  });
}

// ── Distinct Filter Options ──────────────────────────────────────────────────

export async function getDistinctDepartments(): Promise<string[]> {
  const sql = `
    SELECT DISTINCT department
    FROM employees
    WHERE department IS NOT NULL AND TRIM(department) != ''
    ORDER BY department ASC
  `;
  const rows = await executeQuery<RowDataPacket[]>(sql, []);
  return rows.map((r) => String(r.department));
}

export async function getDistinctPeriods(): Promise<string[]> {
  const sql = `
    SELECT DISTINCT period
    FROM payruns
    WHERE period IS NOT NULL AND TRIM(period) != ''
    ORDER BY period DESC
  `;
  const rows = await executeQuery<RowDataPacket[]>(sql, []);
  return rows.map((r) => String(r.period));
}

// ── Visual Analytics Aggregations (Phase 6.3) ─────────────────────────────────

/**
 * Aggregates multi-period payroll trend data for visual charts.
 * Scopes to department or employeeType when filtered, or returns historical payrun trajectories.
 */
export async function getPayrollTrendAggregation(
  filters: DashboardFilterParams,
  dateRange?: DateRange
): Promise<PayrollTrendItem[]> {
  const hasDept = filters.department && filters.department.trim().toUpperCase() !== 'ALL';
  const hasEmpType = filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL';
  const hasPeriod = dateRange?.periodLabel && dateRange.periodLabel.trim().toUpperCase() !== 'ALL';

  if (hasDept || hasEmpType) {
    const whereClauses: string[] = ['1=1'];
    const params: unknown[] = [];

    if (hasDept) {
      whereClauses.push('LOWER(e.department) = LOWER(?)');
      params.push(filters.department!.trim());
    }

    if (hasEmpType) {
      whereClauses.push('(CASE WHEN ws.weekly_hours < 40 THEN "PART_TIME" ELSE "FULL_TIME" END = ?)');
      params.push(filters.employeeType!.trim().toUpperCase());
    }

    if (hasPeriod) {
      whereClauses.push('(pr.period = ? OR pr.period LIKE ?)');
      params.push(dateRange!.periodLabel!, `%${dateRange!.periodLabel!}%`);
    }

    const whereSql = whereClauses.join(' AND ');

    const sql = `
      SELECT
        pr.id,
        pr.name,
        pr.period,
        pr.status,
        pr.created_at,
        COALESCE(SUM(p.gross), 0) AS gross,
        COALESCE(SUM(p.net), 0) AS net,
        COALESCE(SUM(COALESCE(p.tax, 0) + COALESCE(p.other_deductions, 0)), 0) AS deductions,
        COUNT(DISTINCT p.employee_id) AS employee_count
      FROM payruns pr
      JOIN payslips p ON p.payrun_id = pr.id
      JOIN employees e ON e.id = p.employee_id
      LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
      LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
      WHERE ${whereSql}
      GROUP BY pr.id, pr.name, pr.period, pr.status, pr.created_at
      ORDER BY pr.id ASC
    `;

    const rows = await executeQuery<RowDataPacket[]>(sql, params);
    return rows.map((r) => {
      const g = Number(r.gross) || 0;
      const n = Number(r.net) || 0;
      const d = Number(r.deductions) || (g - n);
      const periodStr = String(r.period);
      const nameStr = String(r.name);
      return {
        period: periodStr,
        payrollPeriod: periodStr,
        name: nameStr,
        gross: g,
        grossPayroll: g,
        net: n,
        netPayroll: n,
        deductions: Math.max(0, d),
        totalDeductions: Math.max(0, d),
        employeeCount: Number(r.employee_count) || 0,
        status: String(r.status),
        payrunId: String(r.id),
      };
    });
  } else {
    const whereClauses: string[] = ['1=1'];
    const params: unknown[] = [];

    if (hasPeriod) {
      whereClauses.push('(pr.period = ? OR pr.period LIKE ?)');
      params.push(dateRange!.periodLabel!, `%${dateRange!.periodLabel!}%`);
    }

    const whereSql = whereClauses.join(' AND ');

    const sql = `
      SELECT
        pr.id,
        pr.name,
        pr.period,
        pr.status,
        pr.created_at,
        COALESCE(ps.sum_gross, pr.total_gross, 0) AS gross,
        COALESCE(ps.sum_net, pr.total_net, 0) AS net,
        COALESCE(ps.sum_deductions, GREATEST(0, COALESCE(ps.sum_gross, pr.total_gross, 0) - COALESCE(ps.sum_net, pr.total_net, 0)), 0) AS deductions,
        COALESCE(ps.cnt_employees, pr.employee_count, 0) AS employee_count
      FROM payruns pr
      LEFT JOIN (
        SELECT
          p.payrun_id,
          SUM(p.gross) AS sum_gross,
          SUM(p.net) AS sum_net,
          SUM(COALESCE(p.tax, 0) + COALESCE(p.other_deductions, 0)) AS sum_deductions,
          COUNT(DISTINCT p.employee_id) AS cnt_employees
        FROM payslips p
        GROUP BY p.payrun_id
      ) ps ON ps.payrun_id = pr.id
      WHERE ${whereSql}
      ORDER BY pr.id ASC
    `;

    const rows = await executeQuery<RowDataPacket[]>(sql, params);
    return rows.map((r) => {
      const g = Number(r.gross) || 0;
      const n = Number(r.net) || 0;
      const d = Number(r.deductions) || (g - n);
      const periodStr = String(r.period);
      const nameStr = String(r.name);
      return {
        period: periodStr,
        payrollPeriod: periodStr,
        name: nameStr,
        gross: g,
        grossPayroll: g,
        net: n,
        netPayroll: n,
        deductions: Math.max(0, d),
        totalDeductions: Math.max(0, d),
        employeeCount: Number(r.employee_count) || 0,
        status: String(r.status),
        payrunId: String(r.id),
      };
    });
  }
}

/**
 * Aggregates payrun lifecycle distribution across DRAFT, COMPUTED, VALIDATED, and PAID.
 */
export async function getPayrunStatusBreakdown(
  _filters: DashboardFilterParams,
  dateRange?: DateRange
): Promise<{ counts: PayrunStatusCounts; items: StatusBreakdownItem[] }> {
  const whereClauses: string[] = ['1=1'];
  const params: unknown[] = [];

  if (dateRange?.periodLabel && dateRange.periodLabel.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('(period = ? OR period LIKE ?)');
    params.push(dateRange.periodLabel, `%${dateRange.periodLabel}%`);
  }

  const whereSql = whereClauses.join(' AND ');

  const sql = `
    SELECT
      COUNT(id) AS total_payruns,
      SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) AS draft_count,
      SUM(CASE WHEN status = 'COMPUTED' THEN 1 ELSE 0 END) AS computed_count,
      SUM(CASE WHEN status = 'VALIDATED' THEN 1 ELSE 0 END) AS validated_count,
      SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) AS paid_count
    FROM payruns
    WHERE ${whereSql}
  `;

  const rows = await executeQuery<RowDataPacket[]>(sql, params);
  const r = rows[0] || {};

  const total = Number(r.total_payruns) || 0;
  const draft = Number(r.draft_count) || 0;
  const computed = Number(r.computed_count) || 0;
  const validated = Number(r.validated_count) || 0;
  const paid = Number(r.paid_count) || 0;

  const counts: PayrunStatusCounts = {
    draft,
    computed,
    validated,
    paid,
    total,
  };

  const items: StatusBreakdownItem[] = [
    { status: 'DRAFT', count: draft, percentage: total > 0 ? Math.round((draft / total) * 1000) / 10 : 0 },
    { status: 'COMPUTED', count: computed, percentage: total > 0 ? Math.round((computed / total) * 1000) / 10 : 0 },
    { status: 'VALIDATED', count: validated, percentage: total > 0 ? Math.round((validated / total) * 1000) / 10 : 0 },
    { status: 'PAID', count: paid, percentage: total > 0 ? Math.round((paid / total) * 1000) / 10 : 0 },
  ];

  return { counts, items };
}

/**
 * Aggregates department payroll expenditure breakdown with percentage share.
 */
export async function getDepartmentBreakdownAggregation(
  filters: DashboardFilterParams,
  dateRange?: DateRange,
  targetPayrunId?: string | null
): Promise<DepartmentPayrollBreakdownItem[]> {
  const whereClauses: string[] = ['1=1'];
  const params: unknown[] = [];

  if (targetPayrunId) {
    whereClauses.push('p.payrun_id = ?');
    params.push(targetPayrunId);
  } else if (dateRange?.periodLabel && dateRange.periodLabel.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('1=0');
  }

  if (filters.department && filters.department.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('LOWER(e.department) = LOWER(?)');
    params.push(filters.department.trim());
  }

  if (filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('(CASE WHEN ws.weekly_hours < 40 THEN "PART_TIME" ELSE "FULL_TIME" END = ?)');
    params.push(filters.employeeType.trim().toUpperCase());
  }

  const whereSql = whereClauses.join(' AND ');

  const sql = `
    SELECT
      COALESCE(e.department, 'Unassigned') AS department,
      COALESCE(SUM(p.gross), 0) AS gross,
      COALESCE(SUM(p.net), 0) AS net,
      COALESCE(SUM(COALESCE(p.tax, 0) + COALESCE(p.other_deductions, 0)), 0) AS deductions,
      COUNT(DISTINCT p.employee_id) AS employee_count
    FROM payslips p
    JOIN employees e ON e.id = p.employee_id
    LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
    LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
    WHERE ${whereSql}
    GROUP BY e.department
    ORDER BY gross DESC
  `;

  const rows = await executeQuery<RowDataPacket[]>(sql, params);
  const totalGross = rows.reduce((s, r) => s + (Number(r.gross) || 0), 0);

  if (rows.length > 0 && totalGross > 0) {
    return rows.map((r) => {
      const g = Number(r.gross) || 0;
      const n = Number(r.net) || 0;
      const d = Number(r.deductions) || (g - n);
      return {
        department: String(r.department),
        gross: g,
        totalPayroll: g,
        net: n,
        deductions: Math.max(0, d),
        employeeCount: Number(r.employee_count) || 0,
        percentage: totalGross > 0 ? Math.round((g / totalGross) * 1000) / 10 : 0,
      };
    });
  }

  // Fallback: active contracts per department when no payslips exist yet
  const fallbackWhere: string[] = ['1=1'];
  const fallbackParams: unknown[] = [];

  if (filters.department && filters.department.trim().toUpperCase() !== 'ALL') {
    fallbackWhere.push('LOWER(e.department) = LOWER(?)');
    fallbackParams.push(filters.department.trim());
  }
  if (filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL') {
    fallbackWhere.push('(CASE WHEN ws.weekly_hours < 40 THEN "PART_TIME" ELSE "FULL_TIME" END = ?)');
    fallbackParams.push(filters.employeeType.trim().toUpperCase());
  }

  const fallbackSql = `
    SELECT
      COALESCE(e.department, 'Unassigned') AS department,
      COALESCE(SUM(c.wage), 0) AS gross,
      COUNT(DISTINCT e.id) AS employee_count
    FROM employees e
    LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
    LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
    WHERE ${fallbackWhere.join(' AND ')}
    GROUP BY e.department
    ORDER BY gross DESC
  `;

  const fallbackRows = await executeQuery<RowDataPacket[]>(fallbackSql, fallbackParams);
  const fallbackTotal = fallbackRows.reduce((s, r) => s + (Number(r.gross) || 0), 0);

  return fallbackRows.map((r) => {
    const g = Number(r.gross) || 0;
    return {
      department: String(r.department),
      gross: g,
      totalPayroll: g,
      net: g,
      deductions: 0,
      employeeCount: Number(r.employee_count) || 0,
      percentage: fallbackTotal > 0 ? Math.round((g / fallbackTotal) * 1000) / 10 : 0,
    };
  });
}

/**
 * Aggregates payroll breakdown by employee type (FULL_TIME, PART_TIME, CONTRACT).
 */
export async function getEmployeeTypeBreakdownAggregation(
  filters: DashboardFilterParams
): Promise<EmployeeTypeBreakdownItem[]> {
  const whereClauses: string[] = ['1=1'];
  const params: unknown[] = [];

  if (filters.department && filters.department.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('LOWER(e.department) = LOWER(?)');
    params.push(filters.department.trim());
  }

  if (filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('(CASE WHEN ws.weekly_hours < 40 THEN "PART_TIME" ELSE "FULL_TIME" END = ?)');
    params.push(filters.employeeType.trim().toUpperCase());
  }

  const whereSql = whereClauses.join(' AND ');

  const sql = `
    SELECT
      CASE WHEN ws.weekly_hours < 40 THEN 'PART_TIME' ELSE 'FULL_TIME' END AS employee_type,
      COUNT(DISTINCT e.id) AS employee_count,
      COALESCE(SUM(c.wage), 0) AS total_wage
    FROM employees e
    LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
    LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
    WHERE ${whereSql}
    GROUP BY CASE WHEN ws.weekly_hours < 40 THEN 'PART_TIME' ELSE 'FULL_TIME' END
    ORDER BY employee_count DESC
  `;

  const rows = await executeQuery<RowDataPacket[]>(sql, params);
  const totalCount = rows.reduce((s, r) => s + (Number(r.employee_count) || 0), 0);

  return rows.map((r) => {
    const count = Number(r.employee_count) || 0;
    return {
      employeeType: String(r.employee_type),
      count,
      percentage: totalCount > 0 ? Math.round((count / totalCount) * 1000) / 10 : 0,
      totalWage: Number(r.total_wage) || 0,
    };
  });
}

// ── Operational Payrun Alerts Aggregation ────────────────────────────────────

export interface PayrunAlertItem {
  id: string;
  name: string;
  period: string;
  status: string;
  employeeCount: number;
}

/**
 * Retrieves pending payruns (DRAFT, COMPUTED, VALIDATED) scoped by period and department.
 */
export async function getPendingPayrunsForAlerts(
  filters: DashboardFilterParams,
  dateRange: DateRange
): Promise<PayrunAlertItem[]> {
  const whereClauses: string[] = ["pr.status IN ('DRAFT', 'COMPUTED', 'VALIDATED')"];
  const params: unknown[] = [];

  if (dateRange?.periodLabel && dateRange.periodLabel.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('(pr.period = ? OR pr.period LIKE ?)');
    params.push(dateRange.periodLabel, `%${dateRange.periodLabel}%`);
  }

  if (filters.department && filters.department.trim().toUpperCase() !== 'ALL') {
    whereClauses.push(`(
      pr.status = 'DRAFT' OR EXISTS (
        SELECT 1 FROM payslips ps
        JOIN employees e ON e.id = ps.employee_id
        WHERE ps.payrun_id = pr.id AND LOWER(e.department) = LOWER(?)
      )
    )`);
    params.push(filters.department.trim());
  }

  if (filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL') {
    whereClauses.push(`(
      pr.status = 'DRAFT' OR EXISTS (
        SELECT 1 FROM payslips ps
        JOIN employees e ON e.id = ps.employee_id
        LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
        LEFT JOIN working_schedules ws ON ws.id = c.working_schedule_id
        WHERE ps.payrun_id = pr.id AND (CASE WHEN ws.weekly_hours < 40 THEN 'PART_TIME' ELSE 'FULL_TIME' END = ?)
      )
    )`);
    params.push(filters.employeeType.trim().toUpperCase());
  }

  const whereSql = whereClauses.join(' AND ');
  const sql = `
    SELECT
      pr.id,
      pr.name,
      pr.period,
      pr.status,
      COALESCE(pr.employee_count, 0) AS employee_count
    FROM payruns pr
    WHERE ${whereSql}
    ORDER BY pr.id DESC
    LIMIT 20
  `;

  const rows = await executeQuery<RowDataPacket[]>(sql, params);
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    period: String(r.period),
    status: String(r.status),
    employeeCount: Number(r.employee_count) || 0,
  }));
}

