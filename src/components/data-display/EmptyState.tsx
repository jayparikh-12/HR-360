import React from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ElementType | React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
  children,
}) => {
  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '2px dashed #cbd5e1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {Icon && (
        <div style={{ color: '#94a3b8', marginBottom: '16px' }}>
          {typeof Icon === 'function' ? <Icon size={40} /> : Icon}
        </div>
      )}
      <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', margin: '0 0 6px 0' }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px 0', maxWidth: '400px' }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn btn-primary"
          style={{
            padding: '8px 16px',
            backgroundColor: '#4f46e5',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      )}
      {children}
    </div>
  );
};

export default EmptyState;
