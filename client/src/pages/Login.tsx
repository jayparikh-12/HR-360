import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

interface LoginProps {
  onLogin?: (role: UserRole, userEmail: string, userName: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { login, user, displayRole } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    // 1. Validation checks
    if (!normalizedEmail || !trimmedPassword) {
      setErrorMessage('Please enter both your work email and password.');
      return;
    }

    if (!normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
      setErrorMessage('Please enter a valid work email address format.');
      return;
    }

    // 2. Prevent duplicate submission while request is pending
    if (isLoading) return;

    setIsLoading(true);

    try {
      // Call backend POST /api/auth/login via centralized AuthContext
      await login(normalizedEmail, trimmedPassword);

      if (onLogin && user) {
        onLogin(displayRole, user.email, user.name);
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Authentication failed. Please check your network connection or credentials.'
      );
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="login-page">
      {/* Left Brand Panel */}
      <div className="login-brand-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div className="logo-box" style={{ width: '40px', height: '40px', fontSize: '20px' }}>P</div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>PeoplePay360</div>
            <div style={{ fontSize: '11px', color: '#a5b4fc', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Integrated HR & Payroll Engine
            </div>
          </div>
        </div>

        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#ffffff', lineHeight: 1.2, marginBottom: '16px', letterSpacing: '-0.03em' }}>
          The Connected Operational Platform for Modern Teams.
        </h1>

        <p style={{ color: '#c7d2fe', fontSize: '15px', lineHeight: 1.6, marginBottom: '36px' }}>
          Connect employees, contracts, schedules, daily attendance, and time-off directly into a deterministic payroll engine with zero calculation discrepancies.
        </p>

        {/* Feature bullets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ padding: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
              <Zap size={18} color="#818cf8" />
            </div>
            <div>
              <div style={{ color: '#ffffff', fontWeight: 600, fontSize: '14px' }}>Deterministic Calculation Pipeline</div>
              <div style={{ color: '#a5b4fc', fontSize: '12px' }}>Ordered rules from Basic to Net with automated absence sync.</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ padding: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
              <CheckCircle2 size={18} color="#34d399" />
            </div>
            <div>
              <div style={{ color: '#ffffff', fontWeight: 600, fontSize: '14px' }}>Automated Role-Based Access</div>
              <div style={{ color: '#a5b4fc', fontSize: '12px' }}>Permissions and dashboards are authenticated securely via backend API.</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ padding: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
              <ShieldCheck size={18} color="#60a5fa" />
            </div>
            <div>
              <div style={{ color: '#ffffff', fontWeight: 600, fontSize: '14px' }}>Official Printable Payslip Vouchers</div>
              <div style={{ color: '#a5b4fc', fontSize: '12px' }}>Audited salary breakdowns with instant PDF generation and email export.</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '32px', borderTop: '1px solid rgba(255, 255, 255, 0.15)' }}>
          <span style={{ color: '#e0e7ff', fontSize: '12px', fontWeight: 500 }}>Enterprise Secure Token Authentication</span>
        </div>
      </div>

      {/* Right Login Panel */}
      <div className="login-form-panel">
        <div className="login-card">
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--slate-900)', letterSpacing: '-0.02em' }}>
              Sign In to PeoplePay360
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--slate-500)', marginTop: '4px' }}>
              Enter your corporate credentials. Your role and authorization session are validated securely.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div 
              style={{ 
                padding: '10px 12px', 
                background: 'var(--danger-bg)', 
                border: '1px solid var(--danger-border)', 
                borderRadius: '6px', 
                color: 'var(--danger-text)', 
                fontSize: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginBottom: '16px' 
              }}
              role="alert"
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="form-label" htmlFor="login-email">Work Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} color="var(--slate-400)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="login-email"
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: '36px', width: '100%' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  disabled={isLoading}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" htmlFor="login-password">Password</label>
                <a 
                  href="#forgot" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    alert('Please contact your administrator or IT department to reset your credentials.'); 
                  }} 
                  style={{ fontSize: '11px', color: 'var(--primary)', textDecoration: 'none' }}
                >
                  Forgot password?
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="var(--slate-400)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingLeft: '36px', paddingRight: '36px', width: '100%' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ 
                    position: 'absolute', 
                    right: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer', 
                    color: 'var(--slate-400)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 20px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--slate-600)', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked disabled={isLoading} />
                <span>Keep session active across reloads</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', height: '42px', fontSize: '14px', justifyContent: 'center', gap: '8px' }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Authenticating Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>


          {/* SSO Footer */}
          <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '11px', color: 'var(--slate-400)' }}>
            Enterprise Single Sign-On (SAML 2.0 / OAuth 2.0) Active
          </div>
        </div>
      </div>
    </div>
  );
};
