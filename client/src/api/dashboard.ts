/**
 * PeoplePay360 — Dashboard API Module
 *
 * Centralized typed wrappers for Dashboard metrics and aggregation.
 * Connects directly to backend API infrastructure via apiFetch.
 *
 * Design:
 * - Attempts to call dedicated backend dashboard endpoint if available.
 * - If the dedicated endpoint is pending backend deployment (404), gracefully
 *   aggregates live data from core backend endpoints (/api/employees, /api/payroll/payruns,
 *   /api/attendance, /api/time-off).
 * - Zero mock data: all values originate from live database records.
 */

import { apiFetch, ApiError } from './client';
import { employeesApi } from './employees';
import { payrollApi } from './payroll';
import { attendanceApi } from './attendance';
import { timeOffApi } from './timeOff';
import type { Employee, Payrun, AttendanceRecord, TimeOffRequest } from '../types';

export interface DashboardFilters {
  period?: string;
  department?: string;
  employeeType?: string;
}

export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface DashboardAlert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success' | string;
  severity?: AlertSeverity;
  title: string;
  message: string;
  area?: 'payroll' | 'attendance' | 'time-off' | 'employees' | string;
  count?: number;
  actionTab?: string;
  actionLabel?: string;
}

export interface PayrollTrendPoint {
  period: string;
  name: string;
  gross: number;
  net: number;
  deductions: number;
  employeeCount: number;
  status: string;
}

export interface PayrunStatusCounts {
  draft: number;
  computed: number;
  validated: number;
  paid: number;
  total?: number;
}

// ── Attendance & Time-Off Analytics Types (Phase 6.5) ────────────────────────

export interface AttendanceStatusCounts {
  present: number;
  absent: number;
  late: number;
  overtime: number;
  missingCheckout: number;
  total: number;
  rate: number | null;
}

export interface AttendanceTrendPoint {
  date: string;
  displayDate: string;
  present: number;
  absent: number;
  late: number;
  overtime: number;
  missingCheckout: number;
  total: number;
}

export interface AttendanceDeptBreakdown {
  department: string;
  total: number;
  present: number;
  rate: number;
}

export interface AttendanceAnalyticsData {
  statusCounts: AttendanceStatusCounts;
  trends: AttendanceTrendPoint[];
  departmentBreakdown: AttendanceDeptBreakdown[];
  totalRecords: number;
  attendanceRate: number | null;
}

export interface TimeOffStatusCounts {
  approved: number;
  pending: number;
  refused: number;
  totalRequests: number;
  totalDays: number;
  approvedDays: number;
}

export interface TimeOffTypeBreakdown {
  type: string;
  count: number;
  days: number;
  percentage: number;
}

export interface TimeOffDeptBreakdown {
  department: string;
  count: number;
  days: number;
  percentage: number;
}

export interface TimeOffAnalyticsData {
  statusCounts: TimeOffStatusCounts;
  byType: TimeOffTypeBreakdown[];
  byDepartment: TimeOffDeptBreakdown[];
  totalRequests: number;
  totalDays: number;
}

export interface DashboardMetrics {
  totalEmployees: number;
  activeEmployees: number;
  departmentCount: number;
  totalPayrollCost: number;
  grossPayroll: number;
  netPayroll: number;
  totalDeductions: number;
  latestPayrun: {
    id: string;
    name: string;
    period: string;
    status: 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID' | string;
    employeeCount: number;
    totalGross: number;
    totalNet: number;
  } | null;
  departmentCosts: Record<string, number>;
  statusCounts: PayrunStatusCounts;
  trends: PayrollTrendPoint[];
  attendanceRate: number | null; // e.g. 95.5 or null if no attendance records logged
  attendancePresentCount: number;
  attendanceTotalRecords: number;
  pendingTimeOffCount: number;
  approvedTimeOffCount: number;
  alerts: DashboardAlert[];
  attendanceAnalytics?: AttendanceAnalyticsData;
  timeOffAnalytics?: TimeOffAnalyticsData;
  isPendingBackendAggregation: boolean;
}

export interface DashboardApiResponse {
  success: boolean;
  data: DashboardMetrics;
  message?: string;
}

/**
 * Aggregates live data from available core APIs into typed DashboardMetrics
 */
function aggregateLiveMetrics(
  employees: Employee[],
  payruns: Payrun[],
  attendance: AttendanceRecord[],
  timeOff: TimeOffRequest[],
  filters?: DashboardFilters
): DashboardMetrics {
  // 1. Apply department filter
  let filteredEmployees = employees;
  if (filters?.department && filters.department !== 'ALL') {
    const deptFilterLower = filters.department.trim().toLowerCase();
    filteredEmployees = filteredEmployees.filter(
      (e) => (e.department || '').trim().toLowerCase() === deptFilterLower
    );
  }

  // 2. Apply employeeType filter if specified
  if (filters?.employeeType && filters.employeeType !== 'ALL') {
    const typeFilterLower = filters.employeeType.trim().toLowerCase();
    filteredEmployees = filteredEmployees.filter((e) => {
      const empType = ((e as any).employeeType || '').trim().toLowerCase();
      const sched = (e.schedule || '').trim().toLowerCase();
      if (empType) return empType === typeFilterLower;
      if (typeFilterLower === 'part_time') return sched.includes('part');
      if (typeFilterLower === 'full_time') return sched.includes('standard') || sched.includes('40h');
      return true;
    });
  }

  // If no employees match the selected department/type filter: zero-data guarantee
  if (filteredEmployees.length === 0) {
    return {
      totalEmployees: 0,
      activeEmployees: 0,
      departmentCount: 0,
      totalPayrollCost: 0,
      grossPayroll: 0,
      netPayroll: 0,
      totalDeductions: 0,
      latestPayrun: null,
      departmentCosts: {},
      statusCounts: { draft: 0, computed: 0, validated: 0, paid: 0 },
      trends: [],
      attendanceRate: null,
      attendancePresentCount: 0,
      attendanceTotalRecords: 0,
      pendingTimeOffCount: 0,
      approvedTimeOffCount: 0,
      alerts: [],
      isPendingBackendAggregation: true,
    };
  }

  // Active employees
  const activeEmps = filteredEmployees.filter((e) => e.status === 'ACTIVE');
  const totalEmployees = filteredEmployees.length;
  const activeEmployees = activeEmps.length;

  // Departments
  const departmentSet = new Set(filteredEmployees.map((e) => e.department).filter(Boolean));
  const departmentCount = departmentSet.size;

  // Department salary costs from real employee wages
  const departmentCosts = filteredEmployees.reduce((acc, emp) => {
    const dept = emp.department || 'Unassigned';
    acc[dept] = (acc[dept] || 0) + (emp.wage || 0);
    return acc;
  }, {} as Record<string, number>);

  // 3. Apply period filter to payruns
  let relevantPayruns = payruns;
  if (filters?.period && filters.period !== 'ALL') {
    const periodLower = filters.period.trim().toLowerCase();
    relevantPayruns = relevantPayruns.filter(
      (p) => p.period.toLowerCase().includes(periodLower) || p.name.toLowerCase().includes(periodLower)
    );
  }

  const latestPayrunRecord = relevantPayruns.length > 0 ? relevantPayruns[0] : null;

  // Calculate department-scoped or overall payrun metrics
  let latestPayrun: DashboardMetrics['latestPayrun'] = null;
  let grossPayroll = 0;
  let netPayroll = 0;
  let totalDeductions = 0;

  const totalBaseWageCost = filteredEmployees.reduce((sum, e) => sum + (e.wage || 0), 0);

  if (latestPayrunRecord) {
    const allPayslips = latestPayrunRecord.payslips || [];

    // If department filter is active, scope payrun payslips to that department
    let relevantPayslips = allPayslips;
    if (filters?.department && filters.department !== 'ALL') {
      const deptFilterLower = filters.department.trim().toLowerCase();
      relevantPayslips = allPayslips.filter(
        (s) => (s.department || '').trim().toLowerCase() === deptFilterLower
      );
    }

    if (filters?.department && filters.department !== 'ALL') {
      if (relevantPayslips.length > 0) {
        grossPayroll = relevantPayslips.reduce((sum, s) => sum + (Number(s.gross) || 0), 0);
        netPayroll = relevantPayslips.reduce((sum, s) => sum + (Number(s.net) || 0), 0);
        totalDeductions = Math.max(0, grossPayroll - netPayroll);
        latestPayrun = {
          id: latestPayrunRecord.id,
          name: latestPayrunRecord.name,
          period: latestPayrunRecord.period,
          status: latestPayrunRecord.status,
          employeeCount: relevantPayslips.length,
          totalGross: grossPayroll,
          totalNet: netPayroll,
        };
      } else {
        // Department exists in employees but has no payslips in this cycle
        grossPayroll = totalBaseWageCost;
        netPayroll = 0;
        totalDeductions = 0;
        latestPayrun = {
          id: latestPayrunRecord.id,
          name: latestPayrunRecord.name,
          period: latestPayrunRecord.period,
          status: latestPayrunRecord.status,
          employeeCount: 0,
          totalGross: 0,
          totalNet: 0,
        };
      }
    } else {
      // Overall company view
      grossPayroll = Number(latestPayrunRecord.totalGross) || totalBaseWageCost;
      netPayroll = Number(latestPayrunRecord.totalNet) || 0;
      totalDeductions = Math.max(0, grossPayroll - netPayroll);
      latestPayrun = {
        id: latestPayrunRecord.id,
        name: latestPayrunRecord.name,
        period: latestPayrunRecord.period,
        status: latestPayrunRecord.status,
        employeeCount: latestPayrunRecord.employeeCount || allPayslips.length,
        totalGross: grossPayroll,
        totalNet: netPayroll,
      };
    }
  } else {
    // If a period filter was selected and no payrun matches that period: zero out payrun financials
    if (filters?.period && filters.period !== 'ALL') {
      grossPayroll = 0;
      netPayroll = 0;
      totalDeductions = 0;
      latestPayrun = null;
    } else {
      grossPayroll = totalBaseWageCost;
      netPayroll = 0;
      totalDeductions = 0;
      latestPayrun = null;
    }
  }

  const totalPayrollCost = grossPayroll > 0 ? grossPayroll : totalBaseWageCost;

  // Attendance metrics from real records
  const empIds = new Set(filteredEmployees.map((e) => e.id));
  const filteredAttendance = attendance.filter((a) => empIds.has(a.employeeId));

  const attendanceTotalRecords = filteredAttendance.length;
  const attendancePresentCount = filteredAttendance.filter(
    (a) => a.status === 'PRESENT' || a.status === 'OVERTIME'
  ).length;

  const attendanceRate =
    attendanceTotalRecords > 0
      ? Math.round((attendancePresentCount / attendanceTotalRecords) * 1000) / 10
      : null;

  // Time off metrics from real records
  const filteredTimeOff = timeOff.filter((t) => empIds.has(t.employeeId));
  const pendingTimeOffCount = filteredTimeOff.filter((t) => t.status === 'PENDING').length;
  const approvedTimeOffCount = filteredTimeOff.filter((t) => t.status === 'APPROVED').length;

  // Dynamic live alerts based on real system state
  const alerts: DashboardAlert[] = [];

  if (latestPayrun && latestPayrun.employeeCount > 0) {
    if (latestPayrun.status === 'DRAFT') {
      alerts.push({
        id: 'alert-payrun-draft',
        type: 'warning',
        title: 'Payrun Calculation Pending',
        message: `${latestPayrun.name} (${latestPayrun.period}) is in DRAFT. Run Compute to calculate salary vouchers.`,
      });
    } else if (latestPayrun.status === 'COMPUTED') {
      alerts.push({
        id: 'alert-payrun-computed',
        type: 'info',
        title: 'Payrun Awaiting Validation',
        message: `${latestPayrun.name} calculations are ready. Validate before marking as paid.`,
      });
    } else if (latestPayrun.status === 'VALIDATED') {
      alerts.push({
        id: 'alert-payrun-validated',
        type: 'info',
        title: 'Payrun Ready for Disbursement',
        message: `${latestPayrun.name} is validated and approved for payment disbursement.`,
      });
    }
  }

  if (pendingTimeOffCount > 0) {
    alerts.push({
      id: 'alert-pending-timeoff',
      type: 'warning',
      title: `${pendingTimeOffCount} Leave Request${pendingTimeOffCount > 1 ? 's' : ''} Pending`,
      message: 'Pending time-off requests require managerial review before payroll cut-off.',
    });
  }

  const probationCount = filteredEmployees.filter((e) => e.status === 'PROBATION').length;
  if (probationCount > 0) {
    alerts.push({
      id: 'alert-probation-review',
      type: 'info',
      title: `${probationCount} Employee${probationCount > 1 ? 's' : ''} on Probation`,
      message: 'Probationary reviews are pending evaluation against active contracts.',
    });
  }

  const attendanceAnalytics = calculateAttendanceAnalytics(filteredAttendance, filteredEmployees, filters);
  const timeOffAnalytics = calculateTimeOffAnalytics(filteredTimeOff, filteredEmployees, filters);

  return {
    totalEmployees,
    activeEmployees,
    departmentCount,
    totalPayrollCost,
    grossPayroll,
    netPayroll,
    totalDeductions,
    latestPayrun,
    departmentCosts,
    statusCounts: calculateStatusCounts(payruns),
    trends: calculateTrends(payruns, filters),
    attendanceRate,
    attendancePresentCount,
    attendanceTotalRecords,
    pendingTimeOffCount,
    approvedTimeOffCount,
    alerts,
    attendanceAnalytics,
    timeOffAnalytics,
    isPendingBackendAggregation: false,
  };
}

export function matchesPeriod(dateStr: string, periodFilter?: string): boolean {
  if (!periodFilter || periodFilter === 'ALL' || !dateStr) return true;
  const p = periodFilter.trim();

  // Range match: "2026-09-01 - 2026-09-30"
  const rangeMatch = p.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  if (rangeMatch) {
    const start = rangeMatch[1];
    const end = rangeMatch[2];
    const d = dateStr.slice(0, 10);
    return d >= start && d <= end;
  }

  // Month match: "2026-09"
  const ymMatch = p.match(/^(\d{4}-\d{2})/);
  if (ymMatch) {
    return dateStr.startsWith(ymMatch[1]);
  }

  return dateStr.includes(p);
}

export function matchesTimeOffPeriod(startDate: string, endDate: string, periodFilter?: string): boolean {
  if (!periodFilter || periodFilter === 'ALL') return true;
  const p = periodFilter.trim();

  const rangeMatch = p.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  if (rangeMatch) {
    const start = rangeMatch[1];
    const end = rangeMatch[2];
    return (startDate ? startDate.slice(0, 10) : '') <= end && (endDate ? endDate.slice(0, 10) : '') >= start;
  }

  const ymMatch = p.match(/^(\d{4})-(\d{2})/);
  if (ymMatch) {
    const year = parseInt(ymMatch[1], 10);
    const month = parseInt(ymMatch[2], 10);
    const start = `${ymMatch[1]}-${ymMatch[2]}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${ymMatch[1]}-${ymMatch[2]}-${String(lastDay).padStart(2, '0')}`;
    return (startDate ? startDate.slice(0, 10) : '') <= end && (endDate ? endDate.slice(0, 10) : '') >= start;
  }

  return Boolean((startDate && startDate.includes(p)) || (endDate && endDate.includes(p)));
}

export function calculateAttendanceAnalytics(
  attendanceRecords: AttendanceRecord[],
  employees: Employee[],
  filters?: DashboardFilters
): AttendanceAnalyticsData {
  const empMap = new Map<string, Employee>();
  employees.forEach((e) => empMap.set(e.id, e));

  let filtered = attendanceRecords;

  if (filters?.department && filters.department !== 'ALL') {
    const deptLower = filters.department.trim().toLowerCase();
    filtered = filtered.filter((r) => {
      const emp = empMap.get(r.employeeId);
      return (emp?.department || '').trim().toLowerCase() === deptLower;
    });
  }

  if (filters?.employeeType && filters.employeeType !== 'ALL') {
    const typeLower = filters.employeeType.trim().toLowerCase();
    filtered = filtered.filter((r) => {
      const emp = empMap.get(r.employeeId);
      if (!emp) return false;
      const empType = ((emp as any).employeeType || '').trim().toLowerCase();
      const sched = (emp.schedule || '').trim().toLowerCase();
      if (empType) return empType === typeLower;
      if (typeLower === 'part_time') return sched.includes('part');
      if (typeLower === 'full_time') return sched.includes('standard') || sched.includes('40h');
      return true;
    });
  }

  if (filters?.period && filters.period !== 'ALL') {
    filtered = filtered.filter((r) => matchesPeriod(r.date, filters.period));
  }

  const total = filtered.length;
  const present = filtered.filter((r) => r.status === 'PRESENT').length;
  const absent = filtered.filter((r) => r.status === 'ABSENT').length;
  const late = filtered.filter((r) => r.status === 'LATE').length;
  const overtime = filtered.filter((r) => r.status === 'OVERTIME').length;
  const missingCheckout = filtered.filter((r) => r.status === 'MISSING_CHECKOUT').length;

  const rate = total > 0 ? Math.round(((present + overtime) / total) * 1000) / 10 : null;

  const statusCounts: AttendanceStatusCounts = {
    present,
    absent,
    late,
    overtime,
    missingCheckout,
    total,
    rate,
  };

  // Group by date for trends
  const dateMap = new Map<
    string,
    { present: number; absent: number; late: number; overtime: number; missingCheckout: number; total: number }
  >();

  filtered.forEach((r) => {
    const d = r.date ? r.date.slice(0, 10) : 'Unknown';
    if (!dateMap.has(d)) {
      dateMap.set(d, { present: 0, absent: 0, late: 0, overtime: 0, missingCheckout: 0, total: 0 });
    }
    const item = dateMap.get(d)!;
    item.total += 1;
    if (r.status === 'PRESENT') item.present += 1;
    else if (r.status === 'ABSENT') item.absent += 1;
    else if (r.status === 'LATE') item.late += 1;
    else if (r.status === 'OVERTIME') item.overtime += 1;
    else if (r.status === 'MISSING_CHECKOUT') item.missingCheckout += 1;
  });

  const sortedDates = Array.from(dateMap.keys()).sort();
  // Provide up to last 14 dates for clean, legible bar visualization
  const trends: AttendanceTrendPoint[] = sortedDates.slice(-14).map((d) => {
    const val = dateMap.get(d)!;
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
      ...val,
    };
  });

  // Department breakdown
  const deptMap = new Map<string, { total: number; present: number }>();
  filtered.forEach((r) => {
    const emp = empMap.get(r.employeeId);
    const dept = emp?.department || 'Unassigned';
    if (!deptMap.has(dept)) {
      deptMap.set(dept, { total: 0, present: 0 });
    }
    const dItem = deptMap.get(dept)!;
    dItem.total += 1;
    if (r.status === 'PRESENT' || r.status === 'OVERTIME') dItem.present += 1;
  });

  const departmentBreakdown: AttendanceDeptBreakdown[] = Array.from(deptMap.entries())
    .map(([dept, counts]) => ({
      department: dept,
      total: counts.total,
      present: counts.present,
      rate: counts.total > 0 ? Math.round((counts.present / counts.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    statusCounts,
    trends,
    departmentBreakdown,
    totalRecords: total,
    attendanceRate: rate,
  };
}

export function calculateTimeOffAnalytics(
  timeOffRequests: TimeOffRequest[],
  employees: Employee[],
  filters?: DashboardFilters
): TimeOffAnalyticsData {
  const empMap = new Map<string, Employee>();
  employees.forEach((e) => empMap.set(e.id, e));

  let filtered = timeOffRequests;

  if (filters?.department && filters.department !== 'ALL') {
    const deptLower = filters.department.trim().toLowerCase();
    filtered = filtered.filter((t) => {
      const emp = empMap.get(t.employeeId);
      return (emp?.department || '').trim().toLowerCase() === deptLower;
    });
  }

  if (filters?.employeeType && filters.employeeType !== 'ALL') {
    const typeLower = filters.employeeType.trim().toLowerCase();
    filtered = filtered.filter((t) => {
      const emp = empMap.get(t.employeeId);
      if (!emp) return false;
      const empType = ((emp as any).employeeType || '').trim().toLowerCase();
      const sched = (emp.schedule || '').trim().toLowerCase();
      if (empType) return empType === typeLower;
      if (typeLower === 'part_time') return sched.includes('part');
      if (typeLower === 'full_time') return sched.includes('standard') || sched.includes('40h');
      return true;
    });
  }

  if (filters?.period && filters.period !== 'ALL') {
    filtered = filtered.filter((t) => matchesTimeOffPeriod(t.startDate, t.endDate, filters.period));
  }

  const approved = filtered.filter((t) => t.status === 'APPROVED').length;
  const pending = filtered.filter((t) => t.status === 'PENDING').length;
  const refused = filtered.filter((t) => t.status === 'REFUSED').length;
  const totalRequests = filtered.length;

  const totalDays = filtered.reduce((sum, t) => sum + (Number(t.durationDays) || 0), 0);
  const approvedDays = filtered
    .filter((t) => t.status === 'APPROVED')
    .reduce((sum, t) => sum + (Number(t.durationDays) || 0), 0);

  const statusCounts: TimeOffStatusCounts = {
    approved,
    pending,
    refused,
    totalRequests,
    totalDays,
    approvedDays,
  };

  // Breakdown by leave type
  const typeMap = new Map<string, { count: number; days: number }>();
  filtered.forEach((t) => {
    const type = t.leaveType || 'Other Leave';
    if (!typeMap.has(type)) {
      typeMap.set(type, { count: 0, days: 0 });
    }
    const item = typeMap.get(type)!;
    item.count += 1;
    item.days += Number(t.durationDays) || 0;
  });

  const byType: TimeOffTypeBreakdown[] = Array.from(typeMap.entries())
    .map(([type, val]) => ({
      type,
      count: val.count,
      days: val.days,
      percentage: totalDays > 0 ? Math.round((val.days / totalDays) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.days - a.days);

  // Breakdown by department
  const deptMap = new Map<string, { count: number; days: number }>();
  filtered.forEach((t) => {
    const emp = empMap.get(t.employeeId);
    const dept = emp?.department || 'Unassigned';
    if (!deptMap.has(dept)) {
      deptMap.set(dept, { count: 0, days: 0 });
    }
    const item = deptMap.get(dept)!;
    item.count += 1;
    item.days += Number(t.durationDays) || 0;
  });

  const byDepartment: TimeOffDeptBreakdown[] = Array.from(deptMap.entries())
    .map(([department, val]) => ({
      department,
      count: val.count,
      days: val.days,
      percentage: totalDays > 0 ? Math.round((val.days / totalDays) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.days - a.days);

  return {
    statusCounts,
    byType,
    byDepartment,
    totalRequests,
    totalDays,
  };
}

export function calculateTrends(payruns: Payrun[], filters?: DashboardFilters): PayrollTrendPoint[] {
  if (!payruns || payruns.length === 0) return [];

  // Sort payruns chronologically (oldest to newest)
  const sorted = payruns.slice().reverse();

  return sorted.map((p) => {
    const allPayslips = p.payslips || [];
    let relevantPayslips = allPayslips;

    if (filters?.department && filters.department !== 'ALL') {
      const deptLower = filters.department.trim().toLowerCase();
      relevantPayslips = allPayslips.filter(
        (s) => (s.department || '').trim().toLowerCase() === deptLower
      );
    }

    let gross = 0;
    let net = 0;
    let count = relevantPayslips.length;

    if (filters?.department && filters.department !== 'ALL') {
      gross = relevantPayslips.reduce((sum, s) => sum + (Number(s.gross) || 0), 0);
      net = relevantPayslips.reduce((sum, s) => sum + (Number(s.net) || 0), 0);
    } else {
      gross = Number(p.totalGross) || relevantPayslips.reduce((sum, s) => sum + (Number(s.gross) || 0), 0);
      net = Number(p.totalNet) || relevantPayslips.reduce((sum, s) => sum + (Number(s.net) || 0), 0);
      count = p.employeeCount || count;
    }

    const deductions = Math.max(0, gross - net);

    return {
      period: p.period,
      name: p.name,
      gross,
      net,
      deductions,
      employeeCount: count,
      status: p.status,
    };
  });
}

export function calculateStatusCounts(payruns: Payrun[]): PayrunStatusCounts {
  return {
    draft: payruns.filter((p) => p.status === 'DRAFT').length,
    computed: payruns.filter((p) => p.status === 'COMPUTED').length,
    validated: payruns.filter((p) => p.status === 'VALIDATED').length,
    paid: payruns.filter((p) => p.status === 'PAID').length,
  };
}

export const dashboardApi = {
  /**
   * Fetches Dashboard Metrics.
   * First tries the dedicated backend endpoint; if not yet available,
   * aggregates live data from core database endpoints with zero mock data.
   */
  async getMetrics(filters?: DashboardFilters): Promise<DashboardMetrics> {
    const params = new URLSearchParams();
    if (filters?.period && filters.period !== 'ALL') params.set('period', filters.period);
    if (filters?.department && filters.department !== 'ALL') params.set('department', filters.department);
    if (filters?.employeeType && filters.employeeType !== 'ALL') params.set('employeeType', filters.employeeType);

    const queryString = params.toString() ? `?${params.toString()}` : '';

    // 1. Try dedicated dashboard endpoint (Phase 6 backend)
    try {
      const [dashResponse, payruns, attendance, timeOff, employees] = await Promise.all([
        apiFetch<any>(`/api/dashboard${queryString}`),
        payrollApi.getAll().catch(() => []),
        attendanceApi.getAll().catch(() => []),
        timeOffApi.getAll().catch(() => []),
        employeesApi.getAll().catch(() => []),
      ]);

      if (dashResponse && dashResponse.success && dashResponse.data) {
        const backendData = dashResponse.data;
        const trends = calculateTrends(payruns, filters);
        const statusCounts: PayrunStatusCounts =
          backendData.payroll?.statusCounts ||
          backendData.statusCounts ||
          calculateStatusCounts(payruns);

        const attendanceAnalytics =
          backendData.attendanceAnalytics ||
          calculateAttendanceAnalytics(attendance, employees, filters);

        const timeOffAnalytics =
          backendData.timeOffAnalytics ||
          calculateTimeOffAnalytics(timeOff, employees, filters);

        return {
          ...backendData,
          statusCounts,
          trends,
          departmentCosts: backendData.departmentCosts || backendData.payroll?.departmentCosts || {},
          attendanceAnalytics,
          timeOffAnalytics,
        };
      }
    } catch (err) {
      // If 404 or backend route not yet added, proceed to live aggregation
      if (err instanceof ApiError && err.statusCode === 404) {
        // Fall back to live aggregation below
      } else {
        // If it's a 401/403 or network error, rethrow
        if (err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 0)) {
          throw err;
        }
      }
    }

    // 2. Aggregate from live backend endpoints
    const [employees, payruns, attendance, timeOff] = await Promise.all([
      employeesApi.getAll().catch(() => []),
      payrollApi.getAll().catch(() => []),
      attendanceApi.getAll().catch(() => []),
      timeOffApi.getAll().catch(() => []),
    ]);

    const metrics = aggregateLiveMetrics(employees, payruns, attendance, timeOff, filters);
    metrics.isPendingBackendAggregation = true;
    return metrics;
  },

  /**
   * Fetches distinct departments from live employees for filter dropdowns.
   */
  async getDepartments(): Promise<string[]> {
    try {
      const employees = await employeesApi.getAll();
      const depts = Array.from(new Set(employees.map((e) => e.department).filter(Boolean))).sort();
      return depts;
    } catch {
      return [];
    }
  },

  /**
   * Fetches distinct payroll periods from live payruns for filter dropdowns.
   */
  async getPeriods(): Promise<string[]> {
    try {
      const payruns = await payrollApi.getAll();
      const periods = Array.from(new Set(payruns.map((p) => p.period).filter(Boolean))).sort().reverse();
      return periods;
    } catch {
      return [];
    }
  },

  /**
   * Dedicated helper to retrieve operational alerts and insights with optional filters.
   */
  async getAlerts(filters?: DashboardFilters): Promise<DashboardAlert[]> {
    const metrics = await this.getMetrics(filters);
    return metrics.alerts || [];
  },

  /**
   * Dedicated helper to retrieve attendance analytics with optional filters.
   */
  async getAttendanceAnalytics(filters?: DashboardFilters): Promise<AttendanceAnalyticsData> {
    const metrics = await this.getMetrics(filters);
    return (
      metrics.attendanceAnalytics || {
        statusCounts: { present: 0, absent: 0, late: 0, overtime: 0, missingCheckout: 0, total: 0, rate: null },
        trends: [],
        departmentBreakdown: [],
        totalRecords: 0,
        attendanceRate: null,
      }
    );
  },

  /**
   * Dedicated helper to retrieve time-off analytics with optional filters.
   */
  async getTimeOffAnalytics(filters?: DashboardFilters): Promise<TimeOffAnalyticsData> {
    const metrics = await this.getMetrics(filters);
    return (
      metrics.timeOffAnalytics || {
        statusCounts: { approved: 0, pending: 0, refused: 0, totalRequests: 0, totalDays: 0, approvedDays: 0 },
        byType: [],
        byDepartment: [],
        totalRequests: 0,
        totalDays: 0,
      }
    );
  },
};

