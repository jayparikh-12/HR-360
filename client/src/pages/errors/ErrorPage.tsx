import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Shield } from 'lucide-react';

export interface ErrorAction {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ReactNode;
  to?: string;
}

export interface ErrorPageProps {
  statusCode: string | number;
  title: string;
  message: string;
  detail?: string;
  icon?: React.ReactNode;
  primaryAction?: ErrorAction;
  secondaryAction?: ErrorAction;
  badgeText?: string;
  badgeType?: 'danger' | 'warning' | 'info' | 'neutral';
}

export const ErrorPage: React.FC<ErrorPageProps> = ({
  statusCode,
  title,
  message,
  detail,
  icon,
  primaryAction,
  secondaryAction,
  badgeText,
  badgeType = 'danger',
}) => {
  const navigate = useNavigate();

  const handleActionClick = (action?: ErrorAction, defaultFallback?: () => void) => {
    if (action?.onClick) {
      action.onClick();
    } else if (action?.to) {
      navigate(action.to);
    } else if (defaultFallback) {
      defaultFallback();
    }
  };

  const badgeStyles = {
    danger: { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
    warning: { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },
    info: { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' },
    neutral: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  }[badgeType];

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-page, #f8fafc)',
        padding: '24px 16px',
        color: 'var(--text-main, #0f172a)',
        fontFamily: 'inherit',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '32px',
          cursor: 'pointer',
        }}
        onClick={() => navigate('/dashboard')}
      >
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--primary, #4f46e5) 0%, #3730a3 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '18px',
            boxShadow: '0 4px 10px rgba(79, 70, 229, 0.25)',
          }}
        >
          P
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-main, #0f172a)' }}>
            PeoplePay360
          </span>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary, #4f46e5)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Enterprise HR & Payroll
          </span>
        </div>
      </div>

      {/* Main Error Card */}
      <div
        className="card"
        style={{
          maxWidth: '560px',
          width: '100%',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '16px',
          border: '1px solid var(--border-color, #e2e8f0)',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
          padding: '40px 32px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle Top Accent Border */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: badgeType === 'danger'
              ? 'linear-gradient(90deg, #ef4444, #f43f5e)'
              : badgeType === 'warning'
              ? 'linear-gradient(90deg, #f59e0b, #d97706)'
              : 'linear-gradient(90deg, var(--primary, #4f46e5), #6366f1)',
          }}
        />

        {/* Icon / Illustration Graphic */}
        <div
          style={{
            width: '76px',
            height: '76px',
            borderRadius: '20px',
            backgroundColor: badgeStyles.bg,
            border: `1px solid ${badgeStyles.border}`,
            color: badgeStyles.text,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
          }}
        >
          {icon || <Shield size={36} />}
        </div>

        {/* Error Code Pill */}
        <div style={{ marginBottom: '12px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 12px',
              borderRadius: '999px',
              backgroundColor: badgeStyles.bg,
              border: `1px solid ${badgeStyles.border}`,
              color: badgeStyles.text,
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {badgeText || `Error ${statusCode}`}
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 800,
            color: 'var(--text-main, #0f172a)',
            marginBottom: '10px',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h1>

        {/* Friendly Message */}
        <p
          style={{
            fontSize: '14.5px',
            color: 'var(--text-secondary, #475569)',
            lineHeight: 1.6,
            marginBottom: detail ? '12px' : '28px',
            maxWidth: '440px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {message}
        </p>

        {/* Optional Detail Note */}
        {detail && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--slate-50, #f8fafc)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle, #f1f5f9)',
              fontSize: '12.5px',
              color: 'var(--text-muted, #64748b)',
              marginBottom: '24px',
              lineHeight: 1.5,
              textAlign: 'left',
            }}
          >
            {detail}
          </div>
        )}

        {/* Actions Row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {secondaryAction && (
            <button
              type="button"
              className={`btn btn-${secondaryAction.variant || 'secondary'}`}
              onClick={() => handleActionClick(secondaryAction, () => navigate(-1))}
              style={{
                padding: '10px 20px',
                fontSize: '13.5px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '8px',
              }}
            >
              {secondaryAction.icon || <ArrowLeft size={16} />}
              <span>{secondaryAction.label}</span>
            </button>
          )}

          {primaryAction && (
            <button
              type="button"
              className={`btn btn-${primaryAction.variant || 'primary'}`}
              onClick={() => handleActionClick(primaryAction, () => navigate('/dashboard'))}
              style={{
                padding: '10px 24px',
                fontSize: '13.5px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '8px',
              }}
            >
              {primaryAction.icon || <Home size={16} />}
              <span>{primaryAction.label}</span>
            </button>
          )}
        </div>
      </div>

      {/* Footer Support Info */}
      <div
        style={{
          marginTop: '28px',
          fontSize: '12px',
          color: 'var(--text-muted, #94a3b8)',
          textAlign: 'center',
        }}
      >
        <span>Need assistance? Contact your PeoplePay360 System Administrator.</span>
      </div>
    </div>
  );
};
