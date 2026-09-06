import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  LogOut, 
  Sun, 
  Moon, 
  ShieldCheck, 
  Mail, 
  Building, 
  Key, 
  CheckCircle2, 
  Clock,
  ChevronDown
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getStoredToken } from '../api/client';
import { getTokenRemainingMs } from '../utils/jwt';
import type { UserRole } from '../types';

interface RoleProfile {
  initials: string;
  name: string;
  email: string;
  id: string;
  department: string;
  securityLevel: string;
  scope: string;
  badgeColor: string;
  badgeBg: string;
}

interface HeaderProps {
  currentRole: UserRole;
  userName: string;
  currentTab?: string;
  onRoleChange?: (role: UserRole) => void;
  onLogout: () => void;
}

const TAB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  employees: 'Employees',
  contracts: 'Contracts',
  schedules: 'Working Schedules',
  attendance: 'Attendance',
  'time-off': 'Time Off',
  payruns: 'Payruns & Payroll',
  payslips: 'Payslips',
  'salary-rules': 'Salary Rules',
  'salary-structures': 'Salary Structures',
  settings: 'System Settings',
};

export const Header: React.FC<HeaderProps> = ({ 
  currentRole, 
  userName, 
  currentTab,
  onLogout
}) => {
  const { theme, toggleTheme } = useTheme();
  const { user, token } = useAuth();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const closeTimeoutRef = useRef<any>(null);

  // Live session remaining time tracker
  const [remainingTimeStr, setRemainingTimeStr] = useState<string>('20m 00s');
  const [remainingColor, setRemainingColor] = useState<string>('#10b981');

  useEffect(() => {
    const updateRemaining = () => {
      const activeToken = token || getStoredToken();
      if (!activeToken) {
        setRemainingTimeStr('Expired');
        setRemainingColor('#ef4444');
        return;
      }

      const ms = getTokenRemainingMs(activeToken);
      if (ms <= 0) {
        setRemainingTimeStr('Expired');
        setRemainingColor('#ef4444');
        return;
      }

      // Enforce strict 20-minute maximum session validity window
      const MAX_SESSION_MS = 20 * 60 * 1000;
      const effectiveMs = Math.min(ms, MAX_SESSION_MS);

      const totalSec = Math.floor(effectiveMs / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;

      if (mins < 2) {
        setRemainingColor('#ef4444');
      } else if (mins < 5) {
        setRemainingColor('#f59e0b');
      } else {
        setRemainingColor('#10b981');
      }

      if (mins > 0) {
        setRemainingTimeStr(`${mins}m ${secs.toString().padStart(2, '0')}s remaining`);
      } else {
        setRemainingTimeStr(`${secs}s remaining`);
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [token]);

  // Clean up any pending dropdown close timeout on component unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsDropdownOpen(false);
    }, 220);
  };

  const getProfile = (role: UserRole): RoleProfile => {
    switch (role) {
      case 'Admin':
        return {
          initials: 'SR',
          name: user?.name || userName || 'Administrator',
          email: user?.email || '',
          id: user?.id || '',
          department: 'Platform & Infrastructure',
          securityLevel: 'Superadmin (Full Access)',
          scope: 'System RBAC, Master Configuration & Employee 360',
          badgeColor: '#0f766e',
          badgeBg: 'rgba(15, 118, 110, 0.14)',
        };
      case 'HR Manager':
        return {
          initials: 'SC',
          name: user?.name || userName || 'Sarah Connor',
          email: user?.email || 'sarah.c@company.com',
          id: user?.employeeId || user?.id || 'EMP-006',
          department: 'Operations & People',
          securityLevel: 'HR Manager Level',
          scope: 'Employee Directory, Contracts & Time Off Approvals',
          badgeColor: '#10b981',
          badgeBg: 'rgba(16, 185, 129, 0.16)',
        };
      case 'HR Payroll Manager':
        return {
          initials: 'ER',
          name: user?.name || userName || 'Elena Rostova',
          email: user?.email || 'elena.r@company.com',
          id: user?.employeeId || user?.id || 'EMP-004',
          department: 'Human Resources & Finance',
          securityLevel: 'Payroll Controller',
          scope: 'Deterministic Payrun Engine, Salary Rules & Approval',
          badgeColor: '#0284c7',
          badgeBg: 'rgba(2, 132, 199, 0.14)',
        };
      case 'HR Payroll User':
        return {
          initials: 'AR',
          name: user?.name || userName || 'Alex Rivera',
          email: user?.email || 'alex.rivera@company.com',
          id: user?.employeeId || user?.id || 'EMP-003',
          department: 'Finance Operations',
          securityLevel: 'Payroll Specialist',
          scope: 'Payrun Drafting, Attendance Verification & Payslips',
          badgeColor: '#3b82f6',
          badgeBg: 'rgba(59, 130, 246, 0.16)',
        };
      case 'Employee':
      default:
        return {
          initials: 'JD',
          name: user?.name || userName || 'John Doe',
          email: user?.email || 'john.doe@company.com',
          id: user?.employeeId || user?.id || 'EMP-001',
          department: 'Engineering',
          securityLevel: 'Staff Member',
          scope: 'Self Clock-In/Out, Leave Requests & Payslip Vouchers',
          badgeColor: '#06b6d4',
          badgeBg: 'rgba(6, 182, 212, 0.16)',
        };
    }
  };

  const profile = getProfile(currentRole);

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        {currentTab && (
          <div className="header-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>ERP</span>
            <span style={{ color: 'var(--slate-300)' }}>/</span>
            <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{TAB_LABELS[currentTab] || 'Workspace'}</span>
          </div>
        )}
        {/* Search */}
        <div className="search-box">
          <Search size={15} color="var(--text-subtle)" />
          <input type="text" placeholder="Search employees, payroll, records..." aria-label="Global search" />
          <kbd
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'var(--border-subtle)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-subtle)',
              fontWeight: 700,
              letterSpacing: '0.05em',
              lineHeight: '1.2',
              userSelect: 'none',
            }}
          >
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Actions */}
      <div className="header-actions">
        {/* Active Cycle */}
        <div className="cycle-pill">
          <span className="cycle-dot" />
          <span>Sep 2026 Cycle</span>
        </div>

        {/* Theme Toggle (Light / Dark) */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          style={{ padding: '6px 11px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {theme === 'dark' ? <Sun size={14} color="#f59e0b" /> : <Moon size={14} color="#0f766e" />}
          <span style={{ fontSize: '12px', fontWeight: 600 }}>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        {/* User Profile Trigger with Hover & Click Popover */}
        <div 
          className="user-profile-wrapper"
          style={{ position: 'relative' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div 
            className="user-profile-capsule"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            style={{ 
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '4px 12px 4px 6px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: isDropdownOpen ? `0 0 0 2px ${profile.badgeColor}40` : 'var(--shadow-xs)'
            }}
          >
            <div style={{ position: 'relative' }}>
              <div 
                className="avatar" 
                style={{ 
                  width: '32px', 
                  height: '32px', 
                  fontSize: '12.5px', 
                  fontWeight: 800,
                  backgroundColor: profile.badgeBg,
                  color: profile.badgeColor,
                  border: `1.5px solid ${profile.badgeColor}60`
                }}
              >
                {profile.initials}
              </div>
              <span 
                style={{
                  position: 'absolute',
                  bottom: '-1px',
                  right: '-1px',
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  border: '2px solid var(--bg-card)',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', lineHeight: 1.2 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.name}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: profile.badgeColor }}>
                {currentRole}
              </span>
            </div>
            <ChevronDown 
              size={14} 
              color="var(--text-muted)" 
              style={{ 
                transform: isDropdownOpen ? 'rotate(180deg)' : 'none', 
                transition: 'transform 0.2s ease',
                marginLeft: '2px'
              }} 
            />
          </div>

          {/* Hover Details Card */}
          {isDropdownOpen && (
            <div 
              className="profile-hover-card"
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: '320px',
                backgroundColor: theme === 'dark' ? '#111827' : '#ffffff',
                color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
                borderRadius: '12px',
                padding: '16px',
                boxShadow: theme === 'dark' 
                  ? '0 20px 30px -5px rgba(0, 0, 0, 0.7), 0 8px 12px -3px rgba(0, 0, 0, 0.4)' 
                  : '0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)',
                zIndex: 1000,
                animation: 'fadeInSlideDown 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                backdropFilter: 'blur(8px)',
              }}
            >
              {/* Header: Avatar, Name & Online Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <div style={{ position: 'relative' }}>
                  <div 
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: profile.badgeBg,
                      color: profile.badgeColor,
                      border: `2px solid ${profile.badgeColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: 800,
                    }}
                  >
                    {profile.initials}
                  </div>
                  <span 
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      border: `2px solid ${theme === 'dark' ? '#111827' : '#ffffff'}`,
                    }}
                    title="Active Authenticated Session"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {profile.name}
                  </div>
                  <div style={{ fontSize: '12px', color: theme === 'dark' ? '#94a3b8' : '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <Mail size={12} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.email}</span>
                  </div>
                </div>
              </div>

              {/* Badges / Pill row */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <span 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: profile.badgeBg,
                    color: profile.badgeColor,
                    border: `1px solid ${profile.badgeColor}40`,
                  }}
                >
                  <ShieldCheck size={12} />
                  {currentRole}
                </span>

                <span 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: theme === 'dark' ? '#1e293b' : '#f1f5f9',
                    color: theme === 'dark' ? '#cbd5e1' : '#475569',
                    border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
                  }}
                >
                  <Key size={11} />
                  {profile.id}
                </span>

                <span 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                  }}
                >
                  <CheckCircle2 size={11} />
                  Active
                </span>
              </div>

              {/* Detail Items */}
              <div 
                style={{
                  backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                  border: `1px solid ${theme === 'dark' ? '#1f2937' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '12px',
                  marginBottom: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Building size={13} /> Department
                  </span>
                  <span style={{ fontWeight: 600 }}>{profile.department}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <ShieldCheck size={13} /> Security Scope
                  </span>
                  <span style={{ fontWeight: 600, color: profile.badgeColor }}>{profile.securityLevel}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Clock size={13} /> Session Validity
                  </span>
                  <span style={{ fontWeight: 600, color: remainingColor }}>{remainingTimeStr}</span>
                </div>
              </div>

              {/* Quick Sign Out Action inside Popover */}
              <button
                className="btn btn-secondary btn-sm"
                onClick={onLogout}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                }}
              >
                <LogOut size={13} />
                <span>Sign Out of PeoplePay360</span>
              </button>
            </div>
          )}
        </div>

        {/* Logout / Switch User */}
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={onLogout}
          title="Sign Out to Login Screen"
          style={{ padding: '5px 8px' }}
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
