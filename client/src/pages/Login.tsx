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
  Moon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { UserRole } from '../types';

interface LoginProps {
  onLogin?: (role: UserRole, userEmail: string, userName: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { login, user, displayRole } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState<string>('admin@company.com');
  const [password, setPassword] = useState<string>('password123');
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
      {/* Background Decorative Ambient Glows */}
      <div className="login-ambient-orb-1" />
      <div className="login-ambient-orb-2" />

      {/* Top Bar Theme Toggle */}
      <div className="login-theme-toggle">
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
              <Moon size={15} color="#6366f1" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* Centered Login Card */}
      <div className="login-center-card">
        {/* Header Branding */}
        <div className="login-header">
          <div className="login-logo-badge">P</div>
          <div className="login-brand-name">
            <span className="login-brand-title">PeoplePay360</span>
            <span className="login-brand-pill">Enterprise</span>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', marginTop: '6px' }}>
            Sign in to your account
          </h2>
          <p className="login-subtitle">
            Enter your corporate credentials to access your HR & payroll workspace.
          </p>
        </div>



        {/* Error Notification */}
        {errorMessage && (
          <div 
            style={{ 
              padding: '10px 14px', 
              background: 'var(--danger-bg)', 
              border: '1px solid var(--danger-border)', 
              borderRadius: '8px', 
              color: 'var(--danger-text)', 
              fontSize: '12.5px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              marginBottom: '18px' 
            }}
            role="alert"
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="login-email">Work Email</label>
            <div style={{ position: 'relative' }}>
              <Mail 
                size={16} 
                color="var(--slate-400)" 
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} 
              />
              <input
                id="login-email"
                type="email"
                className="form-input"
                style={{ paddingLeft: '38px', width: '100%', height: '42px' }}
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
                style={{ fontSize: '11px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
              >
                Forgot password?
              </a>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock 
                size={16} 
                color="var(--slate-400)" 
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} 
              />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                style={{ paddingLeft: '38px', paddingRight: '40px', width: '100%', height: '42px' }}
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
                  alignItems: 'center',
                  padding: '4px'
                }}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ 
              width: '100%', 
              height: '44px', 
              marginTop: '20px',
              fontSize: '14px', 
              fontWeight: 700, 
              justifyContent: 'center', 
              gap: '8px',
              borderRadius: '10px',
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
