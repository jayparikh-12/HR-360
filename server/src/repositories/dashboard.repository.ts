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

export interface AttendanceAggregationResult {
  totalRecords: number;
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
  totalDays: number;
  approvedDays: number;
}

// ── Employee Aggregation ─────────────────────────────────────────────────────

export async function getEmployeeMetrics(
  filters: DashboardFilterParams
): Promise<EmployeeAggregationResult> {
  const whereClauses: string[] = ['1=1'];
  const params: unknown[] = [];

  if (filters.department && filters.department.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('LOWER(e.department) = LOWER(?)');
    params.push(filters.department.trim());
  }

  if (filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('UPPER(e.employeeType) = UPPER(?)');
    params.push(filters.employeeType.trim());
  }

  const whereSql = whereClauses.join(' AND ');

  // Summary counts
  const summarySql = `
    SELECT
      COUNT(e.id) AS total,
      SUM(CASE WHEN e.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN e.status IN ('INACTIVE', 'TERMINATED') THEN 1 ELSE 0 END) AS inactive,
      COUNT(DISTINCT e.department) AS department_count
    FROM employees e
    WHERE ${whereSql}
  `;

  const summaryRows = await executeQuery<RowDataPacket[]>(summarySql, params);
  const row = summaryRows[0] || {};

  const total = Number(row.total) || 0;
  const active = Number(row.active) || 0;
  const inactive = Number(row.inactive) || 0;
  const departmentCount = Number(row.department_count) || 0;

  // Breakdown by department
  const deptSql = `
    SELECT
      COALESCE(e.department, 'Unassigned') AS department,
      COUNT(e.id) AS count
    FROM employees e
    WHERE ${whereSql}
    GROUP BY e.department
  `;
  const deptRows = await executeQuery<RowDataPacket[]>(deptSql, params);
  const byDepartment: Record<string, number> = {};
  for (const dr of deptRows) {
    byDepartment[String(dr.department)] = Number(dr.count) || 0;
  }

  // Breakdown by employeeType
  const typeSql = `
    SELECT
      COALESCE(e.employeeType, 'FULL_TIME') AS employeeType,
      COUNT(e.id) AS count
    FROM employees e
    WHERE ${whereSql}
    GROUP BY e.employeeType
  `;
  const typeRows = await executeQuery<RowDataPacket[]>(typeSql, params);
  const byType: Record<string, number> = {};
  for (const tr of typeRows) {
    byType[String(tr.employeeType)] = Number(tr.count) || 0;
  }

  return {
    total,
    active,
    inactive,
    departmentCount,
    byDepartment,
    byType,
  };
}

// ── Department Wages from Active Contracts ────────────────────────────────────

export async function getDepartmentWages(
  filters: DashboardFilterParams
): Promise<Record<string, number>> {
  const whereClauses: string[] = ['1=1'];
  const params: unknown[] = [];

  if (filters.department && filters.department.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('LOWER(e.department) = LOWER(?)');
    params.push(filters.department.trim());
  }

  if (filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL') {
    whereClauses.push('UPPER(e.employeeType) = UPPER(?)');
    params.push(filters.employeeType.trim());
  }

  const whereSql = whereClauses.join(' AND ');

  const sql = `
    SELECT
      COALESCE(e.department, 'Unassigned') AS department,
      COALESCE(SUM(c.wage), 0) AS total_wage
    FROM employees e
    LEFT JOIN contracts c ON c.employee_id = e.id AND c.status = 'ACTIVE'
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
    payslipWhereClauses.push('UPPER(e.employeeType) = UPPER(?)');
    payslipParams.push(filters.employeeType.trim());
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
    // If filtered by department or type, adjust payrun snapshot stats to the filtered scope
    const isFiltered =
      (filters.department && filters.department.trim().toUpperCase() !== 'ALL') ||
      (filters.employeeType && filters.employeeType.trim().toUpperCase() !== 'ALL');

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
    whereClauses.push('UPPER(e.employeeType) = UPPER(?)');
    params.push(filters.employeeType.trim());
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
    whereClauses.push('UPPER(e.employeeType) = UPPER(?)');
    params.push(filters.employeeType.trim());
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
    totalDays,
    approvedDays,
  };
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
