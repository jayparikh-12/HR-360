import React from 'react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: { delta: string; isPositive: boolean };
  icon?: React.ElementType | React.ReactNode;
  subtext?: string;
  color?: string;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  trend,
  icon: Icon,
  subtext,
  color,
  onClick,
}) => {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: '20px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>{title}</span>
        {Icon && (
          <span style={{ color: color || '#6366f1', display: 'flex', alignItems: 'center' }}>
            {typeof Icon === 'function' ? <Icon size={20} /> : Icon}
          </span>
        )}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 700, color: color || '#0f172a', lineHeight: 1.2 }}>
        {value}
      </div>
      {(trend || subtext) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '12px' }}>
          {trend && (
            <span style={{ color: trend.isPositive ? '#10b981' : '#f43f5e', fontWeight: 600 }}>
              {trend.isPositive ? '↑' : '↓'} {trend.delta}
            </span>
          )}
          {subtext && <span style={{ color: '#94a3b8' }}>{subtext}</span>}
        </div>
      )}
    </div>
  );
};

export default MetricCard;
