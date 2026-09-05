import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  onBack?: () => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  description,
  badge,
  actions,
  children,
}) => {
  return (
    <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 className="page-title" style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            {title}
          </h1>
          {badge}
        </div>
        {(subtitle || description) && (
          <p className="page-desc" style={{ fontSize: '14px', color: '#64748b', marginTop: '6px', margin: 0 }}>
            {subtitle || description}
          </p>
        )}
      </div>
      {(actions || children) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {actions}
          {children}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
