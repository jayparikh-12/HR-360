import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Users, 
  CheckCircle2, 
  TrendingUp, 
  Play,
  RefreshCw,
  Filter,
  CreditCard,
  Building2,
  Calendar,
  Layers,
  AlertCircle,
  Briefcase,
  X
} from 'lucide-react';
import type { Employee, Payrun } from '../types';
import { dashboardApi, type DashboardMetrics, type DashboardFilters } from '../api/dashboard';
import { formatCurrency } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { isTabAllowed } from '../utils/routes';
import { 
  PayrollTrendChart, 
  PayrollStatusChart, 
  PayrollBreakdownChart,
  OperationalAlerts,
  AttendanceAnalytics,
  TimeOffAnalytics,
} from '../components/dashboard';

interface DashboardProps {
  employees?: Employee[];
  payruns?: Payrun[];
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { displayRole } = useAuth();
  const canAccessPayruns = isTabAllowed('payruns', displayRole);

  // ── State Management ────────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState<DashboardFilters>({
    period: 'ALL',
    department: 'ALL',
    employeeType: 'ALL',
  });

  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);

  const requestIdRef = useRef<number>(0);

  // Unmount cleanup to prevent stale async updates
  useEffect(() => {
    return () => {
      requestIdRef.current = -1;
    };
  }, []);

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const fetchDashboardData = useCallback(async (isBackgroundRefresh = false) => {
    const currentReqId = ++requestIdRef.current;
    if (isBackgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await dashboardApi.getMetrics(filters);
      if (currentReqId === requestIdRef.current) {
        setMetrics(data);
      }
    } catch (err: unknown) {
      if (currentReqId === requestIdRef.current) {
        console.error('[Dashboard] Failed to load metrics:', err instanceof Error ? err.message : String(err));
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to connect to the payroll service. Please verify server status and try again.'
        );
      }
    } finally {
      if (currentReqId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [filters]);

  // Fetch when filters change or on initial mount (management roles only)
  useEffect(() => {
    if (displayRole === 'Employee') {
      setLoading(false);
      return;
    }
    fetchDashboardData();
  }, [fetchDashboardData, displayRole]);

  // Load filter options dynamically from live database aggregation
  useEffect(() => {
    if (displayRole === 'Employee') return;
    dashboardApi.getFilterOptions()
      .then((opts) => {
        if (opts.departments?.length) setAvailableDepartments(opts.departments);
        if (opts.periods?.length) setAvailablePeriods(opts.periods);
      })
      .catch(() => {
        dashboardApi.getDepartments().then(setAvailableDepartments).catch(() => {});
        dashboardApi.getPeriods().then(setAvailablePeriods).catch(() => {});
      });
  }, [displayRole]);

  const handleFilterChange = (key: keyof DashboardFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      period: 'ALL',
      department: 'ALL',
      employeeType: 'ALL',
    });
  };

  const isAnyFilterActive =
    (filters.period && filters.period !== 'ALL') ||
    (filters.department && filters.department !== 'ALL') ||
    (filters.employeeType && filters.employeeType !== 'ALL');

  // Helper for payrun status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="badge badge-success"><CheckCircle2 size={11} style={{ marginRight: '4px' }} /> PAID</span>;
      case 'VALIDATED':
        return <span className="badge badge-info"><CheckCircle2 size={11} style={{ marginRight: '4px' }} /> VALIDATED</span>;
      case 'COMPUTED':
        return <span className="badge badge-info">COMPUTED</span>;
      case 'DRAFT':
        return <span className="badge badge-warning">DRAFT</span>;
      default:
        return <span className="badge badge-info">{status || 'READY'}</span>;
    }
  };

  // ── Employee Self-Service Hub View ──────────────────────────────────────────
  if (displayRole === 'Employee') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Employee Self-Service Portal</h1>
            <p className="page-desc">
              Welcome to PeoplePay360. Access your personal attendance, time-off requests, and payslip history.
            </p>
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--slate-800)' }}>
            Quick Actions
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--slate-500)', marginBottom: '20px' }}>
            Executive financial metrics and company-wide payroll runs are restricted to management roles. Use the quick links below to access your personal employee records:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div
              className="card"
              style={{ cursor: 'pointer', border: '1px solid var(--slate-200)', transition: 'transform 0.15s ease' }}
              onClick={() => onNavigate('attendance')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: '#eff6ff', color: 'var(--primary)' }}>
                  <Users size={18} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>Daily Attendance</div>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--slate-500)' }}>
                Perform your daily clock-in / clock-out and review your attendance logs.
              </p>
            </div>

            <div
              className="card"
              style={{ cursor: 'pointer', border: '1px solid var(--slate-200)', transition: 'transform 0.15s ease' }}
              onClick={() => onNavigate('time-off')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: '#fef3c7', color: '#b45309' }}>
                  <Calendar size={18} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>Time Off & Leave</div>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--slate-500)' }}>
                Submit new leave requests, check remaining balance, and track approval status.
              </p>
            </div>

            <div
              className="card"
              style={{ cursor: 'pointer', border: '1px solid var(--slate-200)', transition: 'transform 0.15s ease' }}
              onClick={() => onNavigate('payslips')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: '#ecfdf5', color: '#047857' }}>
                  <CreditCard size={18} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>My Payslips</div>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--slate-500)' }}>
                Inspect your historical payslip vouchers and earnings breakdowns.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Bar */}
      <div className="page-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Executive Operations Dashboard</h1>
            {metrics?.isPendingBackendAggregation && (
              <span 
                className="badge badge-info" 
                style={{ fontSize: '11px', fontWeight: 600 }}
                title="Live data aggregated from active MySQL records while dedicated backend aggregation API is in final deployment"
              >
                Live Feed
              </span>
            )}
          </div>
          <p className="page-desc">
            Deterministic live overview of HR operations, active headcount, and payroll financial health.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Refresh Action (preserves current filters) */}
          <button 
            className="btn btn-secondary" 
            onClick={() => fetchDashboardData(true)} 
            disabled={loading || refreshing}
            title="Refresh dashboard metrics from database using current filters"
            aria-label="Refresh dashboard"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>

          {/* Quick Payrun Navigation */}
          {canAccessPayruns && (
            <button className="btn btn-primary" onClick={() => onNavigate('payruns')}>
              <Play size={14} />
              <span>Launch Payrun Workflow</span>
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Filter Controls Bar */}
      <div 
        className="card" 
        style={{ 
          padding: '14px 18px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap', 
          gap: '14px' 
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--slate-700)', fontWeight: 600, fontSize: '13px' }}>
          <Filter size={15} color="var(--primary)" />
          <span>Dashboard Filters:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Period Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={13} color="var(--slate-500)" />
            <select
              className="form-control"
              style={{ fontSize: '13px', padding: '6px 10px', height: 'auto', minWidth: '160px' }}
              value={filters.period || 'ALL'}
              onChange={(e) => handleFilterChange('period', e.target.value)}
              disabled={loading}
              aria-label="Filter by Payroll Period"
            >
              <option value="ALL">All Payroll Periods</option>
              {availablePeriods.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Department Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={13} color="var(--slate-500)" />
            <select
              className="form-control"
              style={{ fontSize: '13px', padding: '6px 10px', height: 'auto', minWidth: '160px' }}
              value={filters.department || 'ALL'}
              onChange={(e) => handleFilterChange('department', e.target.value)}
              disabled={loading}
              aria-label="Filter by Department"
            >
              <option value="ALL">All Departments</option>
              {availableDepartments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Employee Type Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Briefcase size={13} color="var(--slate-500)" />
            <select
              className="form-control"
              style={{ 
                fontSize: '13px', 
                padding: '6px 10px', 
                height: 'auto', 
                minWidth: '150px',
              }}
              value={filters.employeeType || 'ALL'}
              onChange={(e) => handleFilterChange('employeeType', e.target.value)}
              disabled={loading && !metrics}
              title="Filter by Employee Type"
              aria-label="Filter by Employee Type"
            >
              <option value="ALL">All Employee Types</option>
              <option value="FULL_TIME">Full-Time</option>
              <option value="PART_TIME">Part-Time</option>
              <option value="CONTRACT">Contract</option>
            </select>
          </div>

          {/* Reset button if any filter is active */}
          {isAnyFilterActive && (
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={handleResetFilters}
              style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Reset all filters to default"
            >
              <X size={12} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Error State Banner */}
      {error && !loading && (
        <div style={{ 
          padding: '16px 20px', 
          backgroundColor: 'var(--danger-bg)', 
          border: '1px solid var(--danger-border)', 
          borderRadius: 'var(--radius)', 
          color: 'var(--danger-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Dashboard Synchronization Error</div>
              <div style={{ fontSize: '13px', marginTop: '2px' }}>{error}</div>
            </div>
          </div>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => fetchDashboardData(false)}
            style={{ borderColor: 'var(--danger-border)' }}
          >
            <RefreshCw size={13} />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Initial Loading Skeleton View (Only on initial mount when metrics not yet loaded) */}
      {loading && !metrics && (
        <>
          <div className="grid-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div className="card" key={i} style={{ minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ width: '45%', height: '13px', background: 'var(--slate-200)', borderRadius: '4px', marginBottom: '12px' }} />
                <div style={{ width: '75%', height: '24px', background: 'var(--slate-200)', borderRadius: '4px', marginBottom: '8px' }} />
                <div style={{ width: '55%', height: '11px', background: 'var(--slate-100)', borderRadius: '4px' }} />
              </div>
            ))}
          </div>
          <div className="card" style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px', gap: '16px' }}>
            <div style={{ width: '220px', height: '16px', background: 'var(--slate-200)', borderRadius: '4px' }} />
            <div style={{ width: '100%', height: '180px', background: 'var(--slate-100)', borderRadius: '6px' }} />
          </div>
        </>
      )}

      {/* Fully Dynamic 6-Card KPI Grid (Live Backend Values) */}
      {metrics && (
        <div className="grid-4" style={{ opacity: loading ? 0.75 : 1, transition: 'opacity 0.2s ease' }}>
          {/* Card 1: Gross Payroll */}
          <div className="card">
            <div className="metric-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Gross Payroll</span>
              <CreditCard size={15} color="var(--primary)" />
            </div>
            <div className="metric-val">
              {formatCurrency(metrics.grossPayroll)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: '6px' }}>
              Base wage + active rule earnings
            </div>
          </div>

          {/* Card 2: Net Payable Salary */}
          <div className="card">
            <div className="metric-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Net Payable Salary</span>
              <TrendingUp size={15} color="#047857" />
            </div>
            <div className="metric-val" style={{ color: metrics.netPayroll > 0 ? '#047857' : 'inherit' }}>
              {formatCurrency(metrics.netPayroll)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: '6px' }}>
              Disbursable payroll post-deductions
            </div>
          </div>

          {/* Card 3: Total Deductions */}
          <div className="card">
            <div className="metric-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Total Deductions</span>
              <Layers size={15} color="#be123c" />
            </div>
            <div className="metric-val" style={{ color: metrics.totalDeductions > 0 ? '#be123c' : 'inherit' }}>
              {formatCurrency(metrics.totalDeductions)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: '6px' }}>
              Taxes and statutory deductions
            </div>
          </div>

          {/* Card 4: Active Headcount */}
          <div className="card">
            <div className="metric-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Active Headcount</span>
              <Users size={15} color="var(--primary)" />
            </div>
            <div className="metric-val">
              {metrics.activeEmployees} Staff
            </div>
            <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: '6px' }}>
              Across {metrics.departmentCount} department{metrics.departmentCount === 1 ? '' : 's'} ({metrics.totalEmployees} total enrolled)
            </div>
          </div>

          {/* Card 5: Latest Payrun Cycle & Payslip Count */}
          <div className="card">
            <div className="metric-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Payroll Vouchers</span>
              <Calendar size={15} color="var(--primary)" />
            </div>
            <div className="metric-val" style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '32px' }}>
              {metrics.latestPayrun ? (
                <>
                  <span>{metrics.latestPayrun.employeeCount} Payslip{metrics.latestPayrun.employeeCount === 1 ? '' : 's'}</span>
                  {getStatusBadge(metrics.latestPayrun.status)}
                </>
              ) : (
                <span className="badge badge-warning">0 PAYSLIPS</span>
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: '6px' }}>
              {metrics.latestPayrun ? metrics.latestPayrun.period : 'No active payrun in scope'}
            </div>
          </div>

          {/* Card 6: Attendance & Operations Health */}
          <div className="card">
            <div className="metric-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Attendance Health</span>
              <CheckCircle2 size={15} color="#047857" />
            </div>
            <div className="metric-val">
              {metrics.attendanceRate !== null ? `${metrics.attendanceRate}%` : 'No Records'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: '6px' }}>
              {metrics.attendanceRate !== null
                ? `${metrics.attendancePresentCount} of ${metrics.attendanceTotalRecords} check-ins logged`
                : `${metrics.pendingTimeOffCount} pending leave request${metrics.pendingTimeOffCount === 1 ? '' : 's'}`}
            </div>
          </div>
        </div>
      )}

      {/* Filter Zero-Data State (When Filters Match No Records) */}
      {!loading && metrics && isAnyFilterActive && metrics.totalEmployees === 0 && (
        <div 
          className="card" 
          style={{ 
            textAlign: 'center', 
            padding: '40px 20px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: '10px' 
          }}
        >
          <div style={{ fontSize: '32px' }}>🔍</div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--slate-900)' }}>
            No Records Found for Current Filter Selection
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--slate-500)', maxWidth: '440px' }}>
            No employees, contracts, or payrun calculations match the selected period, department, or type.
          </p>
          <button className="btn btn-secondary btn-sm" onClick={handleResetFilters} style={{ marginTop: '6px' }}>
            <X size={13} />
            <span>Reset Filters</span>
          </button>
        </div>
      )}

      {/* Database Empty State (When Entire System Has No Records) */}
      {!loading && metrics && !isAnyFilterActive && metrics.totalEmployees === 0 && !metrics.latestPayrun && (
        <div 
          className="card" 
          style={{ 
            textAlign: 'center', 
            padding: '48px 24px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: '12px' 
          }}
        >
          <div style={{ fontSize: '36px' }}>📊</div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--slate-900)' }}>
            No Payroll or Employee Data Found
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--slate-500)', maxWidth: '420px' }}>
            The database currently contains no employee records or payruns. Enroll your team members to populate real-time metrics.
          </p>
          <button className="btn btn-primary" onClick={() => onNavigate('employees')} style={{ marginTop: '8px' }}>
            <Users size={14} />
            <span>Go to Employees Module</span>
          </button>
        </div>
      )}

      {/* Visual Analytics & Operational Sections (Phase 6.3 - 6.5) */}
      {metrics && (metrics.totalEmployees > 0 || metrics.latestPayrun) && (
        <>
          {/* Requirement 1: Payroll Trend Analytics Chart */}
          <PayrollTrendChart
            trends={metrics.trends || []}
            selectedPeriod={filters.period}
            selectedDepartment={filters.department}
            loading={loading}
          />

          {/* Requirements 2 & 3: Payrun Status Lifecycle & Department Allocation Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px' }}>
            <PayrollStatusChart
              statusCounts={metrics.statusCounts || { draft: 0, computed: 0, validated: 0, paid: 0 }}
              totalPayruns={
                metrics.statusCounts?.total ??
                (metrics.statusCounts
                  ? metrics.statusCounts.draft +
                    metrics.statusCounts.computed +
                    metrics.statusCounts.validated +
                    metrics.statusCounts.paid
                  : 0)
              }
              loading={loading}
            />

            <PayrollBreakdownChart
              departmentCosts={metrics.departmentCosts || {}}
              totalPayrollCost={metrics.totalPayrollCost || 0}
              selectedDepartment={filters.department}
              onSelectDepartment={(dept) => handleFilterChange('department', filters.department === dept ? 'ALL' : dept)}
              onViewStaff={() => onNavigate('employees')}
              loading={loading}
            />
          </div>

          {/* Phase 6.5: Attendance & Time-Off Visual Analytics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px' }}>
            <AttendanceAnalytics
              analytics={metrics.attendanceAnalytics}
              loading={loading}
              error={error}
              selectedPeriod={filters.period}
              selectedDepartment={filters.department}
              onNavigate={onNavigate}
            />

            <TimeOffAnalytics
              analytics={metrics.timeOffAnalytics}
              loading={loading}
              error={error}
              selectedPeriod={filters.period}
              selectedDepartment={filters.department}
              onNavigate={onNavigate}
            />
          </div>

          {/* Phase 6.4: Alerts & Operational Insights Section */}
          <OperationalAlerts
            alerts={metrics.alerts || []}
            loading={loading}
            error={error}
            onRefresh={() => fetchDashboardData(true)}
            onNavigate={onNavigate}
            activeFilterSummary={
              isAnyFilterActive
                ? [
                    filters.period && filters.period !== 'ALL' ? `Period: ${filters.period}` : '',
                    filters.department && filters.department !== 'ALL' ? `Dept: ${filters.department}` : '',
                    filters.employeeType && filters.employeeType !== 'ALL' ? `Type: ${filters.employeeType}` : '',
                  ]
                    .filter(Boolean)
                    .join(' • ')
                : undefined
            }
          />
        </>
      )}
    </div>
  );
};
