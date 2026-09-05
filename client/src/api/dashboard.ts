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

export interface DashboardAlert {
  id: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
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
  attendanceRate: number | null; // e.g. 95.5 or null if no attendance records logged
  attendancePresentCount: number;
  attendanceTotalRecords: number;
  pendingTimeOffCount: number;
  approvedTimeOffCount: number;
  alerts: DashboardAlert[];
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
    attendanceRate,
    attendancePresentCount,
    attendanceTotalRecords,
    pendingTimeOffCount,
    approvedTimeOffCount,
    alerts,
    isPendingBackendAggregation: false,
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

    // 1. Try dedicated dashboard endpoint (Phase 6 backend when mounted)
    try {
      const response = await apiFetch<DashboardApiResponse>(`/api/dashboard${queryString}`);
      if (response && response.success && response.data) {
        return response.data;
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
};
