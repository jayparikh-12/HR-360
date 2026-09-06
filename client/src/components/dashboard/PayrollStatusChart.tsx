import React from 'react';
import { PieChart, CheckCircle2, Clock, Cog, ShieldCheck } from 'lucide-react';
import type { PayrunStatusCounts } from '../../api/dashboard';

interface PayrollStatusChartProps {
  statusCounts: PayrunStatusCounts;
  totalPayruns: number;
  loading?: boolean;
}

export const PayrollStatusChart: React.FC<PayrollStatusChartProps> = ({
  statusCounts,
  totalPayruns,
  loading = false,
}) => {
  const { draft = 0, computed = 0, validated = 0, paid = 0 } = statusCounts || {};
  const total = totalPayruns || (draft + computed + validated + paid);

  // Calculate percentages
  const pctPaid = total > 0 ? Math.round((paid / total) * 100) : 0;
  const pctValidated = total > 0 ? Math.round((validated / total) * 100) : 0;
  const pctComputed = total > 0 ? Math.round((computed / total) * 100) : 0;
  const pctDraft = total > 0 ? Math.max(0, 100 - pctPaid - pctValidated - pctComputed) : 0;

  // SVG Donut calculation
  const radius = 56;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius; // ~351.86

  // Cumulative offsets
  const strokePaid = (pctPaid / 100) * circumference;
  const strokeValidated = (pctValidated / 100) * circumference;
  const strokeComputed = (pctComputed / 100) * circumference;
  const strokeDraft = (pctDraft / 100) * circumference;

  const offsetPaid = 0;
  const offsetValidated = -strokePaid;
  const offsetComputed = -(strokePaid + strokeValidated);
  const offsetDraft = -(strokePaid + strokeValidated + strokeComputed);

  const completionRate = total > 0 ? Math.round(((paid + validated) / total) * 100) : 0;

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PieChart size={18} color="var(--primary)" />
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            Payrun Status Distribution
          </h3>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '3px 0 0 0' }}>
          Operational workflow completion across active and archived payrun cycles.
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: 'var(--slate-400)', fontSize: '13px' }}>Loading status distribution…</div>
        </div>
      )}

      {/* Donut & Metrics Content */}
      {!loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '20px' }}>
          {/* SVG Donut Ring */}
          <div style={{ position: 'relative', width: '160px', height: '160px', flexShrink: 0 }}>
            <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
              {/* Background Track */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke="var(--slate-100)"
                strokeWidth={strokeWidth}
              />

              {total > 0 ? (
                <>
                  {/* Paid Segment */}
                  {pctPaid > 0 && (
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="transparent"
                      stroke="#059669"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${strokePaid} ${circumference}`}
                      strokeDashoffset={offsetPaid}
                      strokeLinecap="round"
                    />
                  )}

                  {/* Validated Segment */}
                  {pctValidated > 0 && (
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="transparent"
                      stroke="#0284c7"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${strokeValidated} ${circumference}`}
                      strokeDashoffset={offsetValidated}
                      strokeLinecap="round"
                    />
                  )}

                  {/* Computed Segment */}
                  {pctComputed > 0 && (
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="transparent"
                      stroke="#0f766e"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${strokeComputed} ${circumference}`}
                      strokeDashoffset={offsetComputed}
                      strokeLinecap="round"
                    />
                  )}

                  {/* Draft Segment */}
                  {pctDraft > 0 && (
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="transparent"
                      stroke="#d97706"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${strokeDraft} ${circumference}`}
                      strokeDashoffset={offsetDraft}
                      strokeLinecap="round"
                    />
                  )}
                </>
              ) : null}
            </svg>

            {/* Inner Center Label */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>
                {total}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--slate-500)', marginTop: '3px' }}>
                Total Cycles
              </div>
            </div>
          </div>

          {/* Status Breakdown Pills Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 200px', minWidth: '180px' }}>
            {/* Paid */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 10px',
              background: 'rgba(5, 150, 105, 0.08)',
              border: '1px solid rgba(5, 150, 105, 0.2)',
              borderRadius: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <CheckCircle2 size={14} color="#059669" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#047857' }}>PAID</span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#047857' }}>
                {paid} <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.85 }}>({pctPaid}%)</span>
              </div>
            </div>

            {/* Validated */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 10px',
              background: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.2)',
              borderRadius: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <ShieldCheck size={14} color="#0284c7" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#0369a1' }}>VALIDATED</span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0369a1' }}>
                {validated} <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.85 }}>({pctValidated}%)</span>
              </div>
            </div>

            {/* Computed */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 10px',
              background: 'rgba(15, 118, 110, 0.08)',
              border: '1px solid rgba(15, 118, 110, 0.2)',
              borderRadius: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Cog size={14} color="#0f766e" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f766e' }}>COMPUTED</span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f766e' }}>
                {computed} <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.85 }}>({pctComputed}%)</span>
              </div>
            </div>

            {/* Draft */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 10px',
              background: 'rgba(217, 119, 6, 0.08)',
              border: '1px solid rgba(217, 119, 6, 0.2)',
              borderRadius: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Clock size={14} color="#d97706" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#b45309' }}>DRAFT</span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#b45309' }}>
                {draft} <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.85 }}>({pctDraft}%)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Progress Summary */}
      {!loading && total > 0 && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', fontSize: '12px', color: 'var(--slate-600)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span>Approval & Settlement Rate:</span>
            <strong style={{ color: completionRate >= 70 ? '#047857' : 'var(--primary)' }}>
              {completionRate}% of cycles finalized
            </strong>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'var(--slate-100)', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, Math.max(0, completionRate))}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--primary) 0%, #059669 100%)',
                borderRadius: '999px',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
