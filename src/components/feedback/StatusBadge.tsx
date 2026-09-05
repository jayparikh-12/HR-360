import React from 'react';

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  children?: React.ReactNode;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showDot = true,
  children,
}) => {
  const getColors = (s: string) => {
    switch (s?.toUpperCase()) {
      case 'ACTIVE':
      case 'PRESENT':
      case 'APPROVED':
      case 'PAID':
      case 'SUCCESS':
        return { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', dot: '#10b981' };
      case 'PROBATION':
      case 'LATE':
      case 'PENDING':
      case 'WARNING':
        return { bg: '#fffbeb', text: '#92400e', border: '#fde68a', dot: '#f59e0b' };
      case 'TERMINATED':
      case 'ABSENT':
      case 'REFUSED':
      case 'ERROR':
      case 'DANGER':
        return { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', dot: '#ef4444' };
      case 'OVERTIME':
      case 'COMPUTED':
      case 'VALIDATED':
      case 'INFO':
        return { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe', dot: '#6366f1' };
      default:
        return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', dot: '#94a3b8' };
    }
  };

  const colors = getColors(status);
  const padding = size === 'sm' ? '2px 8px' : size === 'lg' ? '6px 14px' : '4px 10px';
  const fontSize = size === 'sm' ? '11px' : size === 'lg' ? '14px' : '12px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: '9999px',
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      {showDot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: colors.dot,
          }}
        />
      )}
      <span>{children || status}</span>
    </span>
  );
};

export default StatusBadge;
