import React from 'react';

export interface AlertBannerProps {
  type?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  message?: string;
  children?: React.ReactNode;
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type = 'info',
  title,
  message,
  children,
  action,
  onClose,
}) => {
  const getStyles = () => {
    switch (type) {
      case 'success':
        return { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' };
      case 'warning':
        return { bg: '#fffbeb', text: '#92400e', border: '#fde68a' };
      case 'error':
        return { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' };
      default:
        return { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' };
    }
  };

  const style = getStyles();

  return (
    <div
      style={{
        padding: '12px 16px',
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        fontSize: '14px',
      }}
    >
      <div>
        {title && <strong style={{ marginRight: '8px' }}>{title}</strong>}
        <span>{message || children}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {action && (
          <button
            onClick={action.onClick}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: `1px solid ${style.text}`,
              background: 'transparent',
              color: style.text,
              cursor: 'pointer',
            }}
          >
            {action.label}
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: style.text,
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default AlertBanner;
