import React, { useState } from 'react';
import { TrendingUp, BarChart3, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { PayrollTrendPoint } from '../../api/dashboard';

interface PayrollTrendChartProps {
  trends: PayrollTrendPoint[];
  selectedPeriod?: string;
  selectedDepartment?: string;
  loading?: boolean;
}

export const PayrollTrendChart: React.FC<PayrollTrendChartProps> = ({
  trends,
  selectedPeriod,
  selectedDepartment,
  loading = false,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Filter out any completely zeroed cycles if other cycles have data, or show last up to 8 cycles
  const displayTrends = trends.slice(-8);

  const hasData =
    displayTrends.length > 0 &&
    displayTrends.some((t) => t.gross > 0 || t.net > 0 || t.deductions > 0);

  // Calculate scales
  const rawMax = hasData
    ? Math.max(...displayTrends.map((t) => Math.max(t.gross, t.net, t.deductions)))
    : 10000;
  // Nice round max ceiling for Y-axis
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax || 1)));
  const ceiling = Math.ceil(rawMax / magnitude) * magnitude || 10000;

  // Chart dimensions
  const svgWidth = 740;
  const svgHeight = 260;
  const padLeft = 65;
  const padRight = 25;
  const padTop = 25;
  const padBottom = 40;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // Y-axis grid ticks (4 intervals)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    val: ceiling * pct,
    y: padTop + plotHeight * (1 - pct),
  }));

  const formatShortCurrency = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}k`;
    return `$${num.toFixed(0)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return '#047857';
      case 'VALIDATED':
        return '#0284c7';
      case 'COMPUTED':
        return '#4f46e5';
      case 'DRAFT':
        return '#b45309';
      default:
        return '#64748b';
    }
  };

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header with Title & Interactive Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Payroll Expenditure Trends
            </h3>
            {selectedDepartment && selectedDepartment !== 'ALL' && (
              <span className="badge badge-info" style={{ fontSize: '11px' }}>
                Dept: {selectedDepartment}
              </span>
            )}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '3px 0 0 0' }}>
            Comparative gross salary, net disbursements, and statutory deductions across cycles.
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#4f46e5', display: 'inline-block' }} />
            <span style={{ color: 'var(--slate-700)' }}>Gross</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#059669', display: 'inline-block' }} />
            <span style={{ color: 'var(--slate-700)' }}>Net</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#e11d48', display: 'inline-block' }} />
            <span style={{ color: 'var(--slate-700)' }}>Deductions</span>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--slate-400)', fontSize: '13px' }}>
            Loading historical payroll trends…
          </div>
        </div>
      )}

      {/* Empty / Zero-Data State */}
      {!loading && !hasData && (
        <div style={{
          height: '240px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: 'var(--slate-500)',
          background: 'var(--slate-50)',
          borderRadius: 'var(--radius)',
          border: '1px dashed var(--border-color)',
          padding: '20px'
        }}>
          <BarChart3 size={36} color="var(--slate-400)" />
          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>
            No Payroll Trends Available
          </div>
          <div style={{ fontSize: '12px', textAlign: 'center', maxWidth: '380px' }}>
            {selectedDepartment && selectedDepartment !== 'ALL'
              ? `No payrun snapshot records found for department "${selectedDepartment}".`
              : 'No computed payrun vouchers found. Launch a payrun cycle to generate multi-period analytics.'}
          </div>
        </div>
      )}

      {/* Interactive Responsive SVG Chart */}
      {!loading && hasData && (
        <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ width: '100%', height: 'auto', minWidth: '540px', display: 'block' }}
          >
            {/* Horizontal Grid lines & Y-Axis Labels */}
            {yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={tick.y}
                  x2={svgWidth - padRight}
                  y2={tick.y}
                  stroke="var(--slate-200)"
                  strokeDasharray={i === 0 ? undefined : '3 3'}
                  strokeWidth={i === 0 ? '1.5' : '1'}
                />
                <text
                  x={padLeft - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  fontSize="10.5"
                  fill="var(--slate-400)"
                  fontFamily="Inter, sans-serif"
                >
                  {formatShortCurrency(tick.val)}
                </text>
              </g>
            ))}

            {/* Data Columns */}
            {displayTrends.map((point, idx) => {
              const colWidth = plotWidth / displayTrends.length;
              const groupCenter = padLeft + colWidth * (idx + 0.5);
              const barWidth = Math.min(20, Math.max(8, (colWidth * 0.7) / 3.2));
              const isHovered = hoveredIdx === idx;
              const isSelectedPeriod =
                selectedPeriod &&
                selectedPeriod !== 'ALL' &&
                (point.period === selectedPeriod || point.period.includes(selectedPeriod));

              // Calculate heights relative to plot
              const hGross = Math.max(2, (point.gross / ceiling) * plotHeight);
              const hNet = Math.max(2, (point.net / ceiling) * plotHeight);
              const hDed = Math.max(2, (point.deductions / ceiling) * plotHeight);

              const yGross = padTop + plotHeight - hGross;
              const yNet = padTop + plotHeight - hNet;
              const yDed = padTop + plotHeight - hDed;

              const labelText = point.period.length > 10 ? point.period.slice(0, 7) : point.period;

              return (
                <g
                  key={point.period + idx}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Column Background Highlight on Hover or Selected Period */}
                  {(isHovered || isSelectedPeriod) && (
                    <rect
                      x={groupCenter - colWidth * 0.45}
                      y={padTop}
                      width={colWidth * 0.9}
                      height={plotHeight}
                      fill={isSelectedPeriod ? 'rgba(79, 70, 229, 0.08)' : 'rgba(148, 163, 184, 0.08)'}
                      rx="6"
                      stroke={isSelectedPeriod ? 'var(--primary)' : 'none'}
                      strokeWidth="1"
                      strokeDasharray={isSelectedPeriod ? '2 2' : undefined}
                    />
                  )}

                  {/* Gross Bar */}
                  <rect
                    x={groupCenter - barWidth * 1.6}
                    y={yGross}
                    width={barWidth}
                    height={hGross}
                    fill="#4f46e5"
                    rx="3"
                    style={{ transition: 'all 0.25s ease' }}
                  />

                  {/* Net Bar */}
                  <rect
                    x={groupCenter - barWidth * 0.5}
                    y={yNet}
                    width={barWidth}
                    height={hNet}
                    fill="#059669"
                    rx="3"
                    style={{ transition: 'all 0.25s ease' }}
                  />

                  {/* Deductions Bar */}
                  <rect
                    x={groupCenter + barWidth * 0.6}
                    y={yDed}
                    width={barWidth}
                    height={hDed}
                    fill="#e11d48"
                    rx="3"
                    style={{ transition: 'all 0.25s ease' }}
                  />

                  {/* Active Period Badge */}
                  {isSelectedPeriod && (
                    <circle
                      cx={groupCenter}
                      cy={padTop - 8}
                      r="3.5"
                      fill="var(--primary)"
                    />
                  )}

                  {/* Period X-Axis Label */}
                  <text
                    x={groupCenter}
                    y={svgHeight - 14}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight={isSelectedPeriod || isHovered ? 700 : 500}
                    fill={isSelectedPeriod ? 'var(--primary)' : isHovered ? 'var(--text-main)' : 'var(--slate-500)'}
                    fontFamily="Inter, sans-serif"
                  >
                    {labelText}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Interactive Floating Hover Tooltip */}
          {hoveredIdx !== null && displayTrends[hoveredIdx] && (
            (() => {
              const pt = displayTrends[hoveredIdx];
              const colPct = ((hoveredIdx + 0.5) / displayTrends.length) * 100;
              return (
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: `clamp(10px, ${colPct}%, calc(100% - 210px))`,
                    transform: 'translateX(-50%)',
                    background: 'var(--slate-900)',
                    color: '#ffffff',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: 'var(--shadow-lg)',
                    pointerEvents: 'none',
                    zIndex: 10,
                    minWidth: '190px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '12.5px', color: '#f8fafc' }}>
                      {pt.period}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: getStatusColor(pt.status),
                        fontWeight: 700,
                        color: '#ffffff'
                      }}
                    >
                      {pt.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#93c5fd' }}>Gross:</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(pt.gross)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6ee7b7' }}>Net:</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(pt.net)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#fda4af' }}>Deductions:</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(pt.deductions)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '4px', marginTop: '2px', fontSize: '11px', color: '#cbd5e1' }}>
                      <span>Enrolled:</span>
                      <span>{pt.employeeCount} Staff</span>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* Footer Metrics Row */}
      {hasData && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '12px',
          fontSize: '12px',
          color: 'var(--slate-600)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={13} color="#047857" />
            <span>
              <strong>{displayTrends.length}</strong> payroll cycle{displayTrends.length === 1 ? '' : 's'} plotted from active database history
            </span>
          </div>
          <div>
            Average Net/Cycle:{' '}
            <strong style={{ color: '#047857' }}>
              {formatCurrency(
                displayTrends.reduce((s, t) => s + t.net, 0) / (displayTrends.length || 1)
              )}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
};
