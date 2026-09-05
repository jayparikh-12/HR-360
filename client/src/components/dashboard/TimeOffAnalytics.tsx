import React, { useState } from 'react';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ArrowRight, 
  Building2, 
  Layers, 
  AlertCircle,
  Briefcase
} from 'lucide-react';
import type { TimeOffAnalyticsData } from '../../api/dashboard';

export interface TimeOffAnalyticsProps {
  analytics?: TimeOffAnalyticsData;
  loading?: boolean;
  error?: string | null;
  selectedPeriod?: string;
  selectedDepartment?: string;
  onNavigate: (tab: string) => void;
}

export const TimeOffAnalytics: React.FC<TimeOffAnalyticsProps> = ({
  analytics,
  loading = false,
  error = null,
  selectedPeriod,
  selectedDepartment,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'type' | 'department'>('type');

  const statusCounts = analytics?.statusCounts || {
    approved: 0,
    pending: 0,
    refused: 0,
    totalRequests: 0,
    totalDays: 0,
    approvedDays: 0,
  };

  const byType = analytics?.byType || [];
  const byDepartment = analytics?.byDepartment || [];
  const totalRequests = statusCounts.totalRequests;
  const totalDays = statusCounts.totalDays;

  const getLeaveTypeColor = (type: string, idx: number) => {
    const t = type.toLowerCase();
    if (t.includes('annual') || t.includes('paid')) return '#059669'; // Green
    if (t.includes('sick')) return '#dc2626'; // Red
    if (t.includes('unpaid')) return '#d97706'; // Amber
    if (t.includes('maternity') || t.includes('paternity')) return '#7c3aed'; // Purple
    const palette = ['#4f46e5', '#0284c7', '#0d9488', '#ea580c'];
    return palette[idx % palette.length];
  };

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Time-Off Utilization & Patterns
            </h3>
            {selectedDepartment && selectedDepartment !== 'ALL' && (
              <span className="badge badge-info" style={{ fontSize: '11px' }}>
                {selectedDepartment}
              </span>
            )}
            {selectedPeriod && selectedPeriod !== 'ALL' && (
              <span className="badge badge-secondary" style={{ fontSize: '11px' }}>
                {selectedPeriod}
              </span>
            )}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '3px 0 0 0' }}>
            Leave request approvals, pipeline volume, and department utilization distribution.
          </p>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onNavigate('time-off')}
          style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
          title="Open full leave request management module"
        >
          <span>Manage Requests</span>
          <ArrowRight size={12} />
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: '60px', background: 'var(--slate-100)', borderRadius: 'var(--radius)' }} />
            ))}
          </div>
          <div style={{ height: '180px', background: 'var(--slate-100)', borderRadius: 'var(--radius)' }} />
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div style={{ padding: '16px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius)', color: 'var(--danger-text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={16} />
          <span style={{ fontSize: '13px' }}>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && totalRequests === 0 && (
        <div style={{ padding: '36px 20px', textAlign: 'center', background: 'var(--slate-50)', border: '1px dashed var(--slate-200)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Calendar size={28} color="var(--slate-400)" />
          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--slate-700)' }}>
            No Time-Off Requests Found
          </div>
          <p style={{ fontSize: '12px', color: 'var(--slate-500)', maxWidth: '400px', margin: 0 }}>
            No leave requests are recorded for the selected period or department filter.
          </p>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('time-off')} style={{ marginTop: '6px', fontSize: '11px' }}>
            Submit Time-Off Request
          </button>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && totalRequests > 0 && (
        <>
          {/* Status KPI Chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
            {/* Approved */}
            <div style={{ padding: '10px 12px', background: 'rgba(5, 150, 105, 0.08)', border: '1px solid rgba(5, 150, 105, 0.2)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#047857', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} />
                <span>Approved</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#047857', marginTop: '2px' }}>
                {statusCounts.approved}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--slate-500)' }}>
                {statusCounts.approvedDays} total days
              </div>
            </div>

            {/* Pending */}
            <div style={{ padding: '10px 12px', background: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.2)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} />
                <span>Pending</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#b45309', marginTop: '2px' }}>
                {statusCounts.pending}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--slate-500)' }}>
                Requires review
              </div>
            </div>

            {/* Refused */}
            <div style={{ padding: '10px 12px', background: 'rgba(100, 116, 139, 0.08)', border: '1px solid rgba(100, 116, 139, 0.2)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <XCircle size={12} />
                <span>Refused</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--slate-700)', marginTop: '2px' }}>
                {statusCounts.refused}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--slate-500)' }}>
                Declined requests
              </div>
            </div>

            {/* Total Days Volume */}
            <div style={{ padding: '10px 12px', background: 'rgba(79, 70, 229, 0.08)', border: '1px solid rgba(79, 70, 229, 0.2)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Briefcase size={12} />
                <span>Total Days</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
                {totalDays}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--slate-500)' }}>
                Across {totalRequests} request{totalRequests === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          {/* Breakdown Tabs: By Leave Type vs By Department */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--slate-200)', paddingBottom: '8px', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className={`btn btn-sm ${activeTab === 'type' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('type')}
                style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Layers size={11} />
                <span>By Leave Type</span>
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'department' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('department')}
                style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Building2 size={11} />
                <span>By Department</span>
              </button>
            </div>

            <span style={{ fontSize: '11px', color: 'var(--slate-400)', fontWeight: 600 }}>
              {activeTab === 'type' ? `${byType.length} Leave Types` : `${byDepartment.length} Departments`}
            </span>
          </div>

          {/* Tab 1: Breakdown by Leave Type */}
          {activeTab === 'type' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {byType.length > 0 ? (
                byType.map((item, idx) => {
                  const color = getLeaveTypeColor(item.type, idx);
                  return (
                    <div key={item.type} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: color, display: 'inline-block' }} />
                          <strong style={{ color: 'var(--text-main)' }}>{item.type}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
                            ({item.count} request{item.count === 1 ? '' : 's'})
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--slate-700)' }}>
                          {item.days} days ({item.percentage}%)
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ width: '100%', height: '8px', background: 'var(--slate-100)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(2, item.percentage))}%`,
                            height: '100%',
                            background: color,
                            borderRadius: '4px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--slate-400)', fontSize: '12px' }}>
                  No leave type records found
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Breakdown by Department */}
          {activeTab === 'department' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {byDepartment.length > 0 ? (
                byDepartment.map((item) => {
                  const maxDeptDays = Math.max(...byDepartment.map((d) => d.days), 1);
                  const relPct = Math.round((item.days / maxDeptDays) * 100);

                  return (
                    <div key={item.department} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Building2 size={13} color="var(--slate-500)" />
                          <strong style={{ color: 'var(--text-main)' }}>{item.department}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
                            ({item.count} request{item.count === 1 ? '' : 's'})
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--slate-700)' }}>
                          {item.days} days ({item.percentage}%)
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ width: '100%', height: '8px', background: 'var(--slate-100)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(2, relPct))}%`,
                            height: '100%',
                            background: 'var(--primary)',
                            borderRadius: '4px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--slate-400)', fontSize: '12px' }}>
                  No department leave records found
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
