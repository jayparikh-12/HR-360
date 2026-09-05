import React from 'react';

export interface SmartStatPillProps {
  label: string;
  count: number | string;
  icon?: React.ElementType | React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'active' | 'warning' | 'info' | 'success';
}

export const SmartStatPill: React.FC<SmartStatPillProps> = ({
  label,
  count,
  icon: Icon,
  onClick,
  variant = 'default',
}) => {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'active':
      case 'success':
        return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
      case 'warning':
        return { bg: '#fffbeb', text: '#d97706', border: '#fde68a' };
      case 'info':
        return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
      default:
        return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' };
    }
  };

  const style = getBadgeStyle();

  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '9999px',
        fontSize: '13px',
        fontWeight: 500,
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
      }}
    >
      {Icon && (
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {typeof Icon === 'function' ? <Icon size={14} /> : Icon}
        </span>
      )}
      <span>{label}:</span>
      <span style={{ fontWeight: 700 }}>{count}</span>
    </button>
  );
};

export default SmartStatPill;
