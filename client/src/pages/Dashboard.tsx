import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  CheckCircle2, 
  TrendingUp, 
  AlertTriangle, 
  ArrowRight, 
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
import { employeesApi } from '../api/employees';
import { formatCurrency } from '../utils/formatters';

interface DashboardProps {
  employees?: Employee[];
  payruns?: Payrun[];
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
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
  const [hasBackendEmployeeType, setHasBackendEmployeeType] = useState<boolean>(false);

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const fetchDashboardData = useCallback(async (isBackgroundRefresh = false) => {
    if (isBackgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await dashboardApi.getMetrics(filters);
      setMetrics(data);
    } catch (err: unknown) {
      console.error('[Dashboard] Failed to load metrics:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to connect to the payroll service. Please verify server status and try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  // Fetch when filters change or on initial mount
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Load filter options dynamically from live records once
  useEffect(() => {
    dashboardApi.getDepartments().then(setAvailableDepartments).catch(() => {});
    dashboardApi.getPeriods().then(setAvailablePeriods).catch(() => {});
    employeesApi.getAll()
      .then((list) => {
        const hasType = list.some((e: any) => Boolean(e.employeeType));
        setHasBackendEmployeeType(hasType);
      })
      .catch(() => {});
  }, []);

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
          <button className="btn btn-primary" onClick={() => onNavigate('payruns')}>
            <Play size={14} />
            <span>Launch Payrun Workflow</span>
          </button>
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
                opacity: hasBackendEmployeeType ? 1 : 0.75 
              }}
              value={filters.employeeType || 'ALL'}
              onChange={(e) => handleFilterChange('employeeType', e.target.value)}
              disabled={loading || !hasBackendEmployeeType}
              title={hasBackendEmployeeType ? 'Filter by Employee Type' : 'Employee Type filter is pending backend API projection'}
              aria-label="Filter by Employee Type"
            >
              <option value="ALL">All Employee Types</option>
              <option value="FULL_TIME">Full-Time</option>
              <option value="PART_TIME">Part-Time</option>
              <option value="CONTRACT">Contract</option>
            </select>
            {!hasBackendEmployeeType && (
              <span 
                style={{ fontSize: '11px', color: 'var(--slate-400)', fontStyle: 'italic' }}
                title="The employeeType column exists in MySQL, but current /api/employees endpoint does not project it to client"
              >
                (Pending API)
              </span>
            )}
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

      {/* Loading Skeleton View (Maintains Grid Layout) */}
      {loading && (
        <div className="grid-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div className="card" key={i} style={{ minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ width: '45%', height: '13px', background: 'var(--slate-200)', borderRadius: '4px', marginBottom: '12px' }} />
              <div style={{ width: '75%', height: '24px', background: 'var(--slate-200)', borderRadius: '4px', marginBottom: '8px' }} />
              <div style={{ width: '55%', height: '11px', background: 'var(--slate-100)', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      )}

      {/* Fully Dynamic 6-Card KPI Grid (Live Backend Values) */}
      {!loading && metrics && (
        <div className="grid-4">
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

      {/* Operational Sections Grid */}
      {!loading && metrics && (metrics.totalEmployees > 0 || metrics.latestPayrun) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          {/* Department Salary Breakdown */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--slate-900)' }}>
                Salary Cost by Department
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('employees')}>
                View Staff <ArrowRight size={12} />
              </button>
            </div>

            {Object.keys(metrics.departmentCosts).length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--slate-400)', fontStyle: 'italic', padding: '24px 0', textAlign: 'center' }}>
                No department cost allocation recorded for current filters.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {Object.entries(metrics.departmentCosts).map(([dept, cost]) => {
                  const percent = metrics.totalPayrollCost > 0 
                    ? Math.round((cost / metrics.totalPayrollCost) * 100) 
                    : 0;
                  return (
                    <div key={dept}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{dept}</span>
                        <span style={{ color: 'var(--slate-500)' }}>
                          {formatCurrency(cost)} ({percent}%)
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'var(--slate-100)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${Math.min(100, Math.max(0, percent))}%`, 
                            height: '100%', 
                            background: 'var(--primary)', 
                            borderRadius: '999px',
                            transition: 'width 0.4s ease'
                          }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Payroll Alerts & Action Items Feed */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--slate-900)' }}>
                Payroll Action Items & Alerts
              </h3>
              <span className={`badge ${metrics.alerts.length > 0 ? 'badge-warning' : 'badge-success'}`}>
                {metrics.alerts.length} Action Item{metrics.alerts.length === 1 ? '' : 's'}
              </span>
            </div>

            {metrics.alerts.length === 0 ? (
              <div style={{ 
                padding: '24px', 
                textAlign: 'center', 
                color: 'var(--slate-500)', 
                fontSize: '13px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={24} color="#047857" />
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>All Systems Clear</div>
                <div>All payroll cycles and time-off requests are up to date.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {metrics.alerts.map((alert) => (
                  <div 
                    key={alert.id}
                    style={{ 
                      padding: '12px', 
                      background: alert.type === 'warning' ? 'var(--warning-bg)' : 'var(--info-bg)', 
                      border: `1px solid ${alert.type === 'warning' ? 'var(--warning-border)' : 'var(--info-border)'}`, 
                      borderRadius: '6px', 
                      display: 'flex', 
                      gap: '10px',
                      alignItems: 'flex-start'
                    }}
                  >
                    {alert.type === 'warning' ? (
                      <AlertTriangle size={18} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
                    ) : (
                      <Users size={18} color="#0369a1" style={{ flexShrink: 0, marginTop: '2px' }} />
                    )}
                    <div>
                      <div style={{ 
                        fontWeight: 600, 
                        fontSize: '13px', 
                        color: alert.type === 'warning' ? 'var(--warning-text)' : 'var(--info-text)' 
                      }}>
                        {alert.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--slate-600)', marginTop: '2px' }}>
                        {alert.message}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
