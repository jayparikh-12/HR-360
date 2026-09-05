import React from 'react';
import { 
  Users,
  CheckCircle2, 
  TrendingUp, 
  AlertTriangle, 
  ArrowRight,
  Play
} from 'lucide-react';
import type { Employee, Payrun } from '../types';

interface DashboardProps {
  employees: Employee[];
  payruns: Payrun[];
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ employees, payruns, onNavigate }) => {
  const latestPayrun = payruns[0];
  const totalCost = employees.reduce((acc, e) => acc + e.wage, 0);

  // Group by department
  const depts = employees.reduce((acc, emp) => {
    acc[emp.department] = (acc[emp.department] || 0) + emp.wage;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Operations Dashboard</h1>
          <p className="page-desc">Real-time overview of September 2026 HR operations and payroll health.</p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('payruns')}>
          <Play size={14} />
          <span>Launch Payrun Workflow</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid-4">
        <div className="card">
          <div className="metric-title">Total Payroll Cost</div>
          <div className="metric-val">${totalCost.toLocaleString()}.00</div>
          <div className="metric-trend">
            <TrendingUp size={13} />
            <span>+2.4% vs August</span>
          </div>
        </div>

        <div className="card">
          <div className="metric-title">Active Employees</div>
          <div className="metric-val">{employees.length} Staff</div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: '6px' }}>
            Across 5 functional departments
          </div>
        </div>

        <div className="card">
          <div className="metric-title">September Payrun</div>
          <div className="metric-val">
            <span className="badge badge-info">{latestPayrun?.status || 'DRAFT'}</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: '6px' }}>
            {latestPayrun ? `${latestPayrun.employeeCount} payslips calculated` : 'Ready to compute'}
          </div>
        </div>

        <div className="card">
          <div className="metric-title">Attendance Health</div>
          <div className="metric-val">96.5%</div>
          <div className="metric-trend">
            <CheckCircle2 size={13} />
            <span>Target 95% met</span>
          </div>
        </div>
      </div>

      {/* Operational Sections Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Department Salary Breakdown */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--slate-900)' }}>
              Salary Cost by Department
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('employees')}>
              View All <ArrowRight size={12} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(depts).map(([dept, cost]) => {
              const percent = Math.round((cost / totalCost) * 100);
              return (
                <div key={dept}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600 }}>{dept}</span>
                    <span style={{ color: 'var(--slate-500)' }}>${cost.toLocaleString()} ({percent}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--slate-100)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', background: 'var(--primary)', borderRadius: '999px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Payroll Alerts Feed */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--slate-900)' }}>
              Payroll Action Items & Alerts
            </h3>
            <span className="badge badge-warning">2 Action Items</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ padding: '12px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: '6px', display: 'flex', gap: '10px' }}>
              <AlertTriangle size={18} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--warning-text)' }}>
                  Unpaid Leave Deduction Sync
                </div>
                <div style={{ fontSize: '12px', color: 'var(--slate-600)', marginTop: '2px' }}>
                  Sarah Connor has 1 unpaid absence day in September. Automatically deducted in payrun calculations.
                </div>
              </div>
            </div>

            <div style={{ padding: '12px', background: 'var(--info-bg)', border: '1px solid var(--info-border)', borderRadius: '6px', display: 'flex', gap: '10px' }}>
              <Users size={18} color="#0369a1" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--info-text)' }}>
                  1 Employee on Probation
                </div>
                <div style={{ fontSize: '12px', color: 'var(--slate-600)', marginTop: '2px' }}>
                  David Kim probation review due at end of Q3. Active contract attached.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
