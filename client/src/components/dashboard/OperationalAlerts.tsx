import React from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle2, 
  ArrowRight, 
  ShieldAlert, 
  Calendar, 
  Clock, 
  Users, 
  CreditCard,
  RefreshCw
} from 'lucide-react';
import type { DashboardAlert } from '../../api/dashboard';

export interface OperationalAlertsProps {
  alerts: DashboardAlert[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onNavigate: (tab: string) => void;
  activeFilterSummary?: string;
}

interface EnrichedAlert extends DashboardAlert {
  normalizedSeverity: 'critical' | 'warning' | 'info';
  area: 'Payroll' | 'Attendance' | 'Time Off' | 'Employees';
  actionLabel: string;
  actionTab: 'payruns' | 'attendance' | 'time-off' | 'employees';
  areaIcon: React.ReactNode;
}

/**
 * Maps raw backend alert into typed actionable insight with navigation link.
 */
function enrichAlert(alert: DashboardAlert): EnrichedAlert {
  const idLower = (alert.id || '').toLowerCase();
  const titleLower = (alert.title || '').toLowerCase();
  const typeLower = (alert.type || '').toLowerCase();

  // Determine operational area & primary action
  if (idLower.includes('checkout') || idLower.includes('attendance') || titleLower.includes('check-out')) {
    return {
      ...alert,
      normalizedSeverity: typeLower === 'critical' ? 'critical' : 'warning',
      area: 'Attendance',
      actionLabel: 'Verify Attendance',
      actionTab: 'attendance',
      areaIcon: <Clock size={14} />,
    };
  }

  if (idLower.includes('timeoff') || idLower.includes('leave') || titleLower.includes('leave')) {
    return {
      ...alert,
      normalizedSeverity: typeLower === 'critical' ? 'critical' : 'warning',
      area: 'Time Off',
      actionLabel: 'Review Requests',
      actionTab: 'time-off',
      areaIcon: <Calendar size={14} />,
    };
  }

  if (idLower.includes('probation') || idLower.includes('employee') || titleLower.includes('employee')) {
    return {
      ...alert,
      normalizedSeverity: typeLower === 'critical' ? 'critical' : 'info',
      area: 'Employees',
      actionLabel: 'View Directory',
      actionTab: 'employees',
      areaIcon: <Users size={14} />,
    };
  }

  // Default to Payroll area
  let actionLabel = 'Open Payruns';
  let severity: 'critical' | 'warning' | 'info' = 'warning';

  if (titleLower.includes('draft') || alert.message.includes('Compute')) {
    actionLabel = 'Launch Payrun';
    severity = 'warning';
  } else if (titleLower.includes('awaiting validation') || alert.message.includes('Validate')) {
    actionLabel = 'Review & Validate';
    severity = 'warning';
  } else if (titleLower.includes('disbursement') || alert.message.includes('disbursement')) {
    actionLabel = 'Process Disbursement';
    severity = 'info';
  }

  if (typeLower === 'critical' || typeLower === 'danger') {
    severity = 'critical';
  }

  return {
    ...alert,
    normalizedSeverity: severity,
    area: 'Payroll',
    actionLabel,
    actionTab: 'payruns',
    areaIcon: <CreditCard size={14} />,
  };
}

export const OperationalAlerts: React.FC<OperationalAlertsProps> = ({
  alerts,
  loading = false,
  error = null,
  onRefresh,
  onNavigate,
  activeFilterSummary,
}) => {
  // Sort alerts by severity weight: Critical (0) > Warning (1) > Info (2)
  const severityRank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  const enrichedList = (alerts || [])
    .map(enrichAlert)
    .sort((a, b) => (severityRank[a.normalizedSeverity] ?? 1) - (severityRank[b.normalizedSeverity] ?? 1));

  const criticalCount = enrichedList.filter((a) => a.normalizedSeverity === 'critical').length;
  const warningCount = enrichedList.filter((a) => a.normalizedSeverity === 'warning').length;

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Alerts & Operational Insights
            </h3>
            {criticalCount > 0 ? (
              <span className="badge badge-danger" style={{ fontSize: '11px', fontWeight: 700 }}>
                {criticalCount} Critical
              </span>
            ) : warningCount > 0 ? (
              <span className="badge badge-warning" style={{ fontSize: '11px', fontWeight: 700 }}>
                {warningCount} Action Required
              </span>
            ) : enrichedList.length > 0 ? (
              <span className="badge badge-info" style={{ fontSize: '11px', fontWeight: 700 }}>
                {enrichedList.length} Insights
              </span>
            ) : (
              <span className="badge badge-success" style={{ fontSize: '11px', fontWeight: 700 }}>
                Operational Clear
              </span>
            )}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '3px 0 0 0' }}>
            Real-time operational alerts derived deterministically from active MySQL payroll cycles, attendance logs, and leave requests.
            {activeFilterSummary && <span style={{ fontWeight: 600, color: 'var(--slate-700)' }}> ({activeFilterSummary})</span>}
          </p>
        </div>

        {onRefresh && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={onRefresh}
            disabled={loading}
            style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh operational alerts from server"
            aria-label="Refresh operational alerts"
          >
            <RefreshCw size={12} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* Loading Skeleton State */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '12px' }}>
          {[1, 2].map((i) => (
            <div 
              key={i} 
              style={{ 
                padding: '16px', 
                borderRadius: 'var(--radius)', 
                background: 'var(--slate-100)', 
                minHeight: '90px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                justifyContent: 'center'
              }}
            >
              <div style={{ width: '35%', height: '12px', background: 'var(--slate-200)', borderRadius: '4px' }} />
              <div style={{ width: '70%', height: '14px', background: 'var(--slate-200)', borderRadius: '4px' }} />
              <div style={{ width: '90%', height: '11px', background: 'var(--slate-200)', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      )}

      {/* Error State Banner */}
      {!loading && error && (
        <div 
          style={{ 
            padding: '14px 16px', 
            background: 'var(--danger-bg)', 
            border: '1px solid var(--danger-border)', 
            borderRadius: 'var(--radius)', 
            color: 'var(--danger-text)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '13px' }}>
            <strong>Unable to load operational alerts:</strong> {error}
          </div>
        </div>
      )}

      {/* Zero Alert State (Positive Operational Confirmation) */}
      {!loading && !error && enrichedList.length === 0 && (
        <div 
          style={{ 
            padding: '28px 20px', 
            textAlign: 'center', 
            background: 'var(--success-bg)', 
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <CheckCircle2 size={28} color="var(--success-text)" />
          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--success-text)' }}>
            No Operational Issues Detected
          </div>
          <div style={{ fontSize: '12px', color: 'var(--slate-600)', maxWidth: '460px' }}>
            All employee attendance logs, leave approval workflows, and payroll cycles are currently fully synchronized with no pending exceptions.
          </div>
        </div>
      )}

      {/* Live Alerts List */}
      {!loading && !error && enrichedList.length > 0 && (
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', 
            gap: '12px' 
          }}
        >
          {enrichedList.map((item) => {
            const isCritical = item.normalizedSeverity === 'critical';
            const isWarning = item.normalizedSeverity === 'warning';

            const bg = isCritical ? 'var(--danger-bg)' : isWarning ? 'var(--warning-bg)' : 'var(--info-bg)';
            const border = isCritical ? 'var(--danger-border)' : isWarning ? 'var(--warning-border)' : 'var(--info-border)';
            const textColor = isCritical ? 'var(--danger-text)' : isWarning ? 'var(--warning-text)' : 'var(--info-text)';
            const severityLabel = isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'INFO';
            const badgeClass = isCritical ? 'badge-danger' : isWarning ? 'badge-warning' : 'badge-info';

            return (
              <div
                key={item.id}
                style={{
                  padding: '14px 16px',
                  background: bg,
                  border: `1px solid ${border}`,
                  borderRadius: 'var(--radius)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '10px',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div>
                  {/* Top metadata tags */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`badge ${badgeClass}`} style={{ fontSize: '10px', padding: '2px 6px', fontWeight: 700 }}>
                        {severityLabel}
                      </span>
                      <span 
                        style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '4px', 
                          fontSize: '11px', 
                          fontWeight: 600, 
                          color: 'var(--slate-600)' 
                        }}
                      >
                        {item.areaIcon}
                        <span>{item.area}</span>
                      </span>
                    </div>

                    {isCritical ? (
                      <AlertCircle size={16} color="var(--danger-text)" />
                    ) : isWarning ? (
                      <AlertTriangle size={16} color="var(--warning-text)" />
                    ) : (
                      <Info size={16} color="var(--info-text)" />
                    )}
                  </div>

                  {/* Title & Message */}
                  <div style={{ fontWeight: 700, fontSize: '13px', color: textColor, lineHeight: 1.3 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--slate-600)', marginTop: '4px', lineHeight: 1.4 }}>
                    {item.message}
                  </div>
                </div>

                {/* Bottom Navigation CTA Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
                  <button
                    onClick={() => onNavigate(item.actionTab)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 600,
                      borderColor: border,
                      backgroundColor: 'var(--bg-card)',
                      color: textColor,
                    }}
                    title={`Navigate to ${item.area} module`}
                  >
                    <span>{item.actionLabel}</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
