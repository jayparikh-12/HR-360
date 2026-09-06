import React, { useState } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  ArrowRight, 
  UserX,
  Clock3,
  Flame
} from 'lucide-react';
import type { AttendanceAnalyticsData } from '../../api/dashboard';

export interface AttendanceAnalyticsProps {
  analytics?: AttendanceAnalyticsData;
  loading?: boolean;
  error?: string | null;
  selectedPeriod?: string;
  selectedDepartment?: string;
  onNavigate: (tab: string) => void;
}

export const AttendanceAnalytics: React.FC<AttendanceAnalyticsProps> = ({
  analytics,
  loading = false,
  error = null,
  selectedPeriod,
  selectedDepartment,
  onNavigate,
}) => {
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);

  const statusCounts = analytics?.statusCounts || {
    present: 0,
    absent: 0,
    late: 0,
    overtime: 0,
    missingCheckout: 0,
    total: 0,
    rate: null,
  };

  const total = statusCounts.total;
  const trends = analytics?.trends || [];
  const rate = statusCounts.rate;

  // Percentages for donut chart
  const pctPresent = total > 0 ? Math.round((statusCounts.present / total) * 100) : 0;
  const pctLate = total > 0 ? Math.round((statusCounts.late / total) * 100) : 0;
  const pctOvertime = total > 0 ? Math.round((statusCounts.overtime / total) * 100) : 0;
  const pctAbsent = total > 0 ? Math.round((statusCounts.absent / total) * 100) : 0;
  const pctMissing = total > 0 ? Math.max(0, 100 - pctPresent - pctLate - pctOvertime - pctAbsent) : 0;

  // Donut geometry
  const radius = 54;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius; // ~339.29

  const strokePresent = (pctPresent / 100) * circumference;
  const strokeLate = (pctLate / 100) * circumference;
  const strokeOvertime = (pctOvertime / 100) * circumference;
  const strokeAbsent = (pctAbsent / 100) * circumference;
  const strokeMissing = (pctMissing / 100) * circumference;

  const offsetPresent = 0;
  const offsetLate = -strokePresent;
  const offsetOvertime = -(strokePresent + strokeLate);
  const offsetAbsent = -(strokePresent + strokeLate + strokeOvertime);
  const offsetMissing = -(strokePresent + strokeLate + strokeOvertime + strokeAbsent);

  // Trend Chart scales
  const maxDayCount = trends.length > 0
    ? Math.max(...trends.map((t) => Math.max(t.total, t.present + t.late + t.absent)))
    : 10;
  const yCeiling = Math.max(5, Math.ceil(maxDayCount * 1.2));

  const chartWidth = 560;
  const chartHeight = 180;
  const padLeft = 36;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 32;
  const plotWidth = chartWidth - padLeft - padRight;
  const plotHeight = chartHeight - padTop - padBottom;

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Attendance Activity & Trends
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
            Daily attendance check-ins, punctuality metrics, and operational shift compliance.
          </p>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onNavigate('attendance')}
          style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
          title="Open full attendance logging module"
        >
          <span>Open Attendance</span>
          <ArrowRight size={12} />
        </button>
      </div>

      {/* Loading State */}
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
          <AlertTriangle size={16} />
          <span style={{ fontSize: '13px' }}>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && total === 0 && (
        <div style={{ padding: '36px 20px', textAlign: 'center', background: 'var(--slate-50)', border: '1px dashed var(--slate-200)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Calendar size={28} color="var(--slate-400)" />
          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--slate-700)' }}>
            No Attendance Records Found
          </div>
          <p style={{ fontSize: '12px', color: 'var(--slate-500)', maxWidth: '400px', margin: 0 }}>
            No shift check-ins or biometric attendance logs match the current filter selection.
          </p>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('attendance')} style={{ marginTop: '6px', fontSize: '11px' }}>
            Record Check-In
          </button>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && total > 0 && (
        <>
          {/* Quick Metrics Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: '10px' }}>
            {/* Present */}
            <div style={{ padding: '10px 12px', background: 'rgba(5, 150, 105, 0.08)', border: '1px solid rgba(5, 150, 105, 0.2)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#047857', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} />
                <span>Present</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#047857', marginTop: '2px' }}>
                {statusCounts.present}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--slate-500)' }}>
                {pctPresent}% of shifts
              </div>
            </div>

            {/* Late */}
            <div style={{ padding: '10px 12px', background: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.2)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock3 size={12} />
                <span>Late</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#b45309', marginTop: '2px' }}>
                {statusCounts.late}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--slate-500)' }}>
                {pctLate}% of shifts
              </div>
            </div>

            {/* Overtime */}
            <div style={{ padding: '10px 12px', background: 'rgba(8, 145, 178, 0.08)', border: '1px solid rgba(8, 145, 178, 0.2)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#0e7490', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Flame size={12} />
                <span>Overtime</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0e7490', marginTop: '2px' }}>
                {statusCounts.overtime}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--slate-500)' }}>
                {pctOvertime}% of shifts
              </div>
            </div>

            {/* Absent */}
            <div style={{ padding: '10px 12px', background: 'rgba(225, 29, 72, 0.08)', border: '1px solid rgba(225, 29, 72, 0.2)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#be123c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <UserX size={12} />
                <span>Absent</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#be123c', marginTop: '2px' }}>
                {statusCounts.absent}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--slate-500)' }}>
                {pctAbsent}% of shifts
              </div>
            </div>

            {/* Missing Checkout */}
            {statusCounts.missingCheckout > 0 && (
              <div style={{ padding: '10px 12px', background: 'rgba(234, 88, 12, 0.08)', border: '1px solid rgba(234, 88, 12, 0.2)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#c2410c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={12} />
                  <span>Missing Checkout</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#c2410c', marginTop: '2px' }}>
                  {statusCounts.missingCheckout}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--slate-500)' }}>
                  Action required
                </div>
              </div>
            )}
          </div>

          {/* Visual Dual Layout: Donut Status on Left, Daily Trend on Right */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', alignItems: 'center' }}>
            {/* Donut Chart & Legend */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '130px', height: '130px', flexShrink: 0 }}>
                <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="65"
                    cy="65"
                    r={radius}
                    fill="transparent"
                    stroke="var(--slate-100)"
                    strokeWidth={strokeWidth}
                  />

                  {pctPresent > 0 && (
                    <circle
                      cx="65"
                      cy="65"
                      r={radius}
                      fill="transparent"
                      stroke="#059669"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${strokePresent} ${circumference}`}
                      strokeDashoffset={offsetPresent}
                      strokeLinecap="round"
                    />
                  )}

                  {pctLate > 0 && (
                    <circle
                      cx="65"
                      cy="65"
                      r={radius}
                      fill="transparent"
                      stroke="#d97706"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${strokeLate} ${circumference}`}
                      strokeDashoffset={offsetLate}
                      strokeLinecap="round"
                    />
                  )}

                  {pctOvertime > 0 && (
                    <circle
                      cx="65"
                      cy="65"
                      r={radius}
                      fill="transparent"
                      stroke="#0891b2"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${strokeOvertime} ${circumference}`}
                      strokeDashoffset={offsetOvertime}
                      strokeLinecap="round"
                    />
                  )}

                  {pctAbsent > 0 && (
                    <circle
                      cx="65"
                      cy="65"
                      r={radius}
                      fill="transparent"
                      stroke="#e11d48"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${strokeAbsent} ${circumference}`}
                      strokeDashoffset={offsetAbsent}
                      strokeLinecap="round"
                    />
                  )}

                  {pctMissing > 0 && (
                    <circle
                      cx="65"
                      cy="65"
                      r={radius}
                      fill="transparent"
                      stroke="#ea580c"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${strokeMissing} ${circumference}`}
                      strokeDashoffset={offsetMissing}
                      strokeLinecap="round"
                    />
                  )}
                </svg>

                {/* Donut Center Rate */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: '#059669', lineHeight: 1 }}>
                    {rate !== null ? `${rate}%` : 'N/A'}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--slate-500)', marginTop: '2px', fontWeight: 600 }}>
                    Attendance
                  </span>
                </div>
              </div>

              {/* Status Legend */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', minWidth: '110px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                    <span style={{ color: 'var(--slate-700)' }}>Present</span>
                  </div>
                  <strong>{statusCounts.present}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
                    <span style={{ color: 'var(--slate-700)' }}>Late</span>
                  </div>
                  <strong>{statusCounts.late}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0891b2', display: 'inline-block' }} />
                    <span style={{ color: 'var(--slate-700)' }}>Overtime</span>
                  </div>
                  <strong>{statusCounts.overtime}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e11d48', display: 'inline-block' }} />
                    <span style={{ color: 'var(--slate-700)' }}>Absent</span>
                  </div>
                  <strong>{statusCounts.absent}</strong>
                </div>

                {statusCounts.missingCheckout > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
                      <span style={{ color: 'var(--slate-700)' }}>Missing</span>
                    </div>
                    <strong>{statusCounts.missingCheckout}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Daily Attendance Trend Bar Chart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)' }}>
                  Daily Attendance Volume
                </span>
                <span style={{ fontSize: '11px', color: 'var(--slate-400)' }}>
                  {trends.length} recorded day{trends.length === 1 ? '' : 's'}
                </span>
              </div>

              {trends.length > 0 ? (
                <div style={{ width: '100%', position: 'relative' }}>
                  <svg
                    width="100%"
                    height={chartHeight}
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    style={{ overflow: 'visible' }}
                  >
                    {/* Horizontal guide lines */}
                    {[0, 0.5, 1].map((pct) => {
                      const yVal = padTop + plotHeight * (1 - pct);
                      return (
                        <g key={pct}>
                          <line
                            x1={padLeft}
                            y1={yVal}
                            x2={chartWidth - padRight}
                            y2={yVal}
                            stroke="var(--slate-200)"
                            strokeDasharray="3 3"
                          />
                          <text
                            x={padLeft - 6}
                            y={yVal + 3}
                            textAnchor="end"
                            fontSize="10"
                            fill="var(--slate-400)"
                          >
                            {Math.round(yCeiling * pct)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Bars for each day */}
                    {trends.map((t, idx) => {
                      const slotWidth = plotWidth / trends.length;
                      const barWidth = Math.max(8, Math.min(24, slotWidth - 6));
                      const x = padLeft + idx * slotWidth + (slotWidth - barWidth) / 2;

                      // Stack heights
                      const hPresent = (t.present / yCeiling) * plotHeight;
                      const hLate = (t.late / yCeiling) * plotHeight;
                      const hOvertime = (t.overtime / yCeiling) * plotHeight;
                      const hAbsent = (t.absent / yCeiling) * plotHeight;

                      const yBase = padTop + plotHeight;
                      const yPresent = yBase - hPresent;
                      const yLate = yPresent - hLate;
                      const yOvertime = yLate - hOvertime;
                      const yAbsent = yOvertime - hAbsent;

                      const isHovered = hoveredDayIdx === idx;

                      return (
                        <g
                          key={t.date}
                          onMouseEnter={() => setHoveredDayIdx(idx)}
                          onMouseLeave={() => setHoveredDayIdx(null)}
                          style={{ cursor: 'pointer' }}
                        >
                          {/* Invisible hover capture area */}
                          <rect
                            x={padLeft + idx * slotWidth}
                            y={padTop}
                            width={slotWidth}
                            height={plotHeight}
                            fill={isHovered ? 'rgba(15, 118, 110, 0.06)' : 'transparent'}
                            rx={4}
                          />

                          {/* Present Segment */}
                          {hPresent > 0 && (
                            <rect
                              x={x}
                              y={yPresent}
                              width={barWidth}
                              height={hPresent}
                              fill="#059669"
                              rx={1}
                            />
                          )}

                          {/* Late Segment */}
                          {hLate > 0 && (
                            <rect
                              x={x}
                              y={yLate}
                              width={barWidth}
                              height={hLate}
                              fill="#d97706"
                              rx={1}
                            />
                          )}

                          {/* Overtime Segment */}
                          {hOvertime > 0 && (
                            <rect
                              x={x}
                              y={yOvertime}
                              width={barWidth}
                              height={hOvertime}
                              fill="#0891b2"
                              rx={1}
                            />
                          )}

                          {/* Absent Segment */}
                          {hAbsent > 0 && (
                            <rect
                              x={x}
                              y={yAbsent}
                              width={barWidth}
                              height={hAbsent}
                              fill="#e11d48"
                              rx={1}
                            />
                          )}

                          {/* X Axis Label */}
                          <text
                            x={x + barWidth / 2}
                            y={yBase + 16}
                            textAnchor="middle"
                            fontSize="10"
                            fill={isHovered ? 'var(--primary)' : 'var(--slate-500)'}
                            fontWeight={isHovered ? 700 : 500}
                          >
                            {t.displayDate}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Tooltip on hover */}
                  {hoveredDayIdx !== null && trends[hoveredDayIdx] && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '16px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--slate-200)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        borderRadius: 'var(--radius)',
                        padding: '8px 12px',
                        fontSize: '11px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        zIndex: 10,
                        pointerEvents: 'none',
                      }}
                    >
                      <strong style={{ color: 'var(--text-main)' }}>{trends[hoveredDayIdx].date}</strong>
                      <span style={{ color: '#059669' }}>Present: {trends[hoveredDayIdx].present}</span>
                      {trends[hoveredDayIdx].late > 0 && <span style={{ color: '#d97706' }}>Late: {trends[hoveredDayIdx].late}</span>}
                      {trends[hoveredDayIdx].overtime > 0 && <span style={{ color: '#0891b2' }}>Overtime: {trends[hoveredDayIdx].overtime}</span>}
                      {trends[hoveredDayIdx].absent > 0 && <span style={{ color: '#e11d48' }}>Absent: {trends[hoveredDayIdx].absent}</span>}
                      <span style={{ color: 'var(--slate-500)', borderTop: '1px solid var(--slate-100)', paddingTop: '2px' }}>
                        Total: {trends[hoveredDayIdx].total} shifts
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-400)', fontSize: '12px' }}>
                  No daily trend data available for period
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
