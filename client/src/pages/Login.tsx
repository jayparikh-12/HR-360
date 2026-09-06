import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle,
  Sun,
  Moon,
  Users,
  Clock,
  Calendar,
  FileText,
  Calculator,
  ShieldCheck,
  Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { UserRole } from '../types';

interface LoginProps {
  onLogin?: (role: UserRole, userEmail: string, userName: string) => void;
}

const PRODUCT_CAPABILITIES = [
  {
    icon: Users,
    title: 'Employee Management',
    description: 'Centralized directory, departmental structure, and complete employee profiles.'
  },
  {
    icon: Clock,
    title: 'Attendance Tracking',
    description: 'Shift scheduling, automated hours calculation, and real-time attendance logs.'
  },
  {
    icon: Calendar,
    title: 'Leave & Time-Off',
    description: 'Multi-category leave requests, balance tracking, and manager approvals.'
  },
  {
    icon: FileText,
    title: 'Contract Management',
    description: 'Formal wage agreements, salary structures, and contractual terms with audit trails.'
  },
  {
    icon: Calculator,
    title: 'Payroll Processing',
    description: 'Accurate gross-to-net computation, statutory deduction rules, and automated payruns.'
  },
  {
    icon: ShieldCheck,
    title: 'Payslips & Reporting',
    description: 'Itemized salary breakdowns, confidential distribution, and PDF report exports.'
  }
];

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { login, user, displayRole } = useAuth();
  const { theme, toggleTheme } = useTheme();

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

    if (!normalizedEmail || !trimmedPassword) {
      setErrorMessage('Please enter both your work email and password.');
      return;
    }

    if (!normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
      setErrorMessage('Please enter a valid work email address format.');
      return;
    }

    if (isLoading) return;

    setIsLoading(true);

    try {
      await login(normalizedEmail, trimmedPassword);

      if (onLogin && user) {
        onLogin(displayRole, user.email, user.name);
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Authentication failed. Please verify your credentials and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Top Floating Controls */}
      <div className="login-top-bar">
        <button
          type="button"
          className="login-theme-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <>
              <Sun size={15} color="#f59e0b" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon size={15} color="#0f766e" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      <div className="login-split-container">
        {/* Left Informational Panel (Desktop only) */}
        <aside className="login-features-panel" aria-label="Product capabilities">
          <div className="login-features-header">
            <div className="login-brand-group">
              <div className="login-brand-badge">P</div>
              <div>
                <div className="login-brand-row">
                  <span className="login-brand-name">PeoplePay360</span>
                  <span className="login-brand-tag">Enterprise ERP</span>
                </div>
                <p className="login-brand-sub">Human Capital & Payroll Automation</p>
              </div>
            </div>

            <div className="login-hero-pitch">
              <h1 className="login-pitch-title">
                Unified workforce operations & compliant payroll.
              </h1>
              <p className="login-pitch-desc">
                An all-in-one corporate system built for transparent employee management, 
                high-precision salary computation, and regulatory compliance.
              </p>
            </div>
          </div>

          <div className="login-capabilities-grid">
            {PRODUCT_CAPABILITIES.map((cap) => {
              const IconComponent = cap.icon;
              return (
                <div key={cap.title} className="login-capability-item">
                  <div className="login-capability-icon">
                    <IconComponent size={18} />
                  </div>
                  <div>
                    <h2 className="login-capability-title">{cap.title}</h2>
                    <p className="login-capability-desc">{cap.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="login-features-footer">
            <div className="login-security-tag">
              <Shield size={14} />
              <span>Role-Based Access Control & 256-bit TLS Data Encryption</span>
            </div>
          </div>
        </aside>

        {/* Right Form Panel (Desktop & Mobile) */}
        <main className="login-form-panel">
          <div className="login-card">
            {/* Mobile Branding (Visible when features panel is hidden) */}
            <div className="login-mobile-header">
              <div className="login-brand-badge">P</div>
              <div>
                <span className="login-brand-name">PeoplePay360</span>
                <span className="login-brand-tag" style={{ marginLeft: '6px' }}>Enterprise</span>
              </div>
            </div>

            <div className="login-card-header">
              <h2 className="login-card-title">Sign In</h2>
              <p className="login-card-subtitle">
                Enter your work credentials to access your enterprise workspace.
              </p>
            </div>

            {/* Error Notification */}
            {errorMessage && (
              <div className="login-error-banner" role="alert">
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-field">
                <label className="form-label" htmlFor="login-email">
                  Work Email <span style={{ color: 'var(--danger-text)' }}>*</span>
                </label>
                <div className="login-input-wrapper">
                  <Mail 
                    size={16} 
                    className="login-input-icon"
                  />
                  <input
                    id="login-email"
                    type="email"
                    className="form-input login-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    disabled={isLoading}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="form-field" style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" htmlFor="login-password" style={{ marginBottom: 0 }}>
                    Password <span style={{ color: 'var(--danger-text)' }}>*</span>
                  </label>
                  <a 
                    href="#forgot" 
                    onClick={(e) => { 
                      e.preventDefault(); 
                      alert('To reset your credentials, please contact your company IT administrator.'); 
                    }} 
                    className="login-forgot-link"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="login-input-wrapper">
                  <Lock 
                    size={16} 
                    className="login-input-icon"
                  />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input login-input"
                    style={{ paddingRight: '40px' }}
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
                    className="login-eye-btn"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary login-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Workspace</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="login-card-footer">
              <p className="login-footer-notice">
                Protected corporate portal. Unauthorized access attempts are monitored and logged.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
