import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  UserCheck, 
  CreditCard, 
  Clock, 
  FileText, 
  Users, 
  PlayCircle, 
  Save, 
  CheckCircle2, 
  Sliders, 
  Sun, 
  Moon, 
  LogOut,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getTokenRemainingMs } from '../utils/jwt';
import { getStoredToken } from '../api/client';
import type { UserRole } from '../types';

interface SettingsProps {
  onNavigateTab: (tab: string) => void;
}

interface SystemPreferences {
  organizationName: string;
  orgCode: string;
  defaultCurrency: string;
  timezone: string;
  autoOvertimeCalc: boolean;
  scheduleGracePeriodMinutes: number;
  notifyOnPayrunApproval: boolean;
  twoFactorAuthEnforced: boolean;
}

const DEFAULT_PREFERENCES: SystemPreferences = {
  organizationName: 'PeoplePay360 Global Technologies Pvt. Ltd.',
  orgCode: 'PP360-CORP-2026',
  defaultCurrency: 'INR (₹)',
  timezone: 'Asia/Kolkata (IST, UTC+05:30)',
  autoOvertimeCalc: true,
  scheduleGracePeriodMinutes: 15,
  notifyOnPayrunApproval: true,
  twoFactorAuthEnforced: false,
};

const SYSTEM_ROLES_CATALOG: Array<{
  role: UserRole;
  name: string;
  email: string;
  employeeId: string;
  badgeType: 'primary' | 'success' | 'warning' | 'info';
  scope: string;
  permissions: string[];
}> = [
  {
    role: 'Admin',
    name: 'System Administrator',
    email: 'admin@company.com',
    employeeId: 'Platform Admin',
    badgeType: 'primary',
    scope: 'Superadmin — Unrestricted System-Wide Access',
    permissions: ['System Settings', 'Salary Rules & Structures', 'Contracts Editing', 'Payroll Execution', 'Employee 360', 'Attendance Oversight'],
  },
  {
    role: 'HR Manager',
    name: 'Sarah Connor',
    email: 'sarah@company.com',
    employeeId: 'EMP-006',
    badgeType: 'success',
    scope: 'People & Workforce Operations',
    permissions: ['Employee Directory Management', 'Contracts Creation & Edit', 'Working Schedules', 'Time-Off Approvals', 'Attendance Tracking'],
  },
  {
    role: 'HR Payroll Manager',
    name: 'Elena Rostova',
    email: 'elena@company.com',
    employeeId: 'EMP-004',
    badgeType: 'warning',
    scope: 'Payroll Controller & Financial Approval',
    permissions: ['Payrun Computation & Validation', 'Payrun Payment Execution', 'Payslip Vouchers & PDF Engine', 'Employee Read Access'],
  },
  {
    role: 'HR Payroll User',
    name: 'Alex Rivera',
    email: 'alex@company.com',
    employeeId: 'EMP-003',
    badgeType: 'info',
    scope: 'Payroll Specialist & Verification',
    permissions: ['Payrun Drafting & Generation', 'Attendance Cross-Verification', 'Payslips Overview', 'Employee Read Access'],
  },
  {
    role: 'Employee',
    name: 'John Doe',
    email: 'john.doe@company.com',
    employeeId: 'EMP-001',
    badgeType: 'info',
    scope: 'Self-Service Portal Access',
    permissions: ['Self Clock-In / Clock-Out', 'Personal Leave Requests', 'Personal Payslip History & PDF Download'],
  },
];

export const Settings: React.FC<SettingsProps> = ({ onNavigateTab }) => {
  const { user, displayRole, logout, token } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'general' | 'shortcuts' | 'rbac' | 'account'>('general');
  const [preferences, setPreferences] = useState<SystemPreferences>(() => {
    try {
      const saved = localStorage.getItem('peoplepay360_system_preferences');
      return saved ? JSON.parse(saved) : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });

  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [sessionRemaining, setSessionRemaining] = useState<string>('20m 00s');

  useEffect(() => {
    const updateTimer = () => {
      const activeToken = token || getStoredToken();
      if (!activeToken) {
        setSessionRemaining('Expired');
        return;
      }
      const ms = getTokenRemainingMs(activeToken);
      if (ms <= 0) {
        setSessionRemaining('Expired');
        return;
      }
      const effectiveMs = Math.min(ms, 20 * 60 * 1000);
      const totalSec = Math.floor(effectiveMs / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      setSessionRemaining(`${mins}m ${String(secs).padStart(2, '0')}s remaining`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [token]);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('peoplepay360_system_preferences', JSON.stringify(preferences));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('[Settings] Failed to save preferences:', err);
    }
  };

  const handleResetDefaults = () => {
    setPreferences(DEFAULT_PREFERENCES);
    localStorage.removeItem('peoplepay360_system_preferences');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div className="page-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Enterprise System Administration</h1>
            <span className="badge badge-success" style={{ fontSize: '11px', fontWeight: 700 }}>
              Live System
            </span>
          </div>
          <p className="page-desc">
            Manage organization parameters, role-based access control, configuration shortcuts, and account security.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={toggleTheme}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun size={14} color="#f59e0b" /> : <Moon size={14} color="#6366f1" />}
            <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px', overflowX: 'auto' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'general' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('general')}
          style={{ borderRadius: '8px 8px 0 0', padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}
        >
          <Building2 size={15} />
          <span>Organization & Platform</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'shortcuts' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('shortcuts')}
          style={{ borderRadius: '8px 8px 0 0', padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}
        >
          <Sliders size={15} />
          <span>Payroll & HR Shortcuts</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'rbac' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('rbac')}
          style={{ borderRadius: '8px 8px 0 0', padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}
        >
          <ShieldCheck size={15} />
          <span>System Users & RBAC</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'account' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('account')}
          style={{ borderRadius: '8px 8px 0 0', padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}
        >
          <UserCheck size={15} />
          <span>Account & Security</span>
        </button>
      </div>

      {/* Feedback Alert Pill */}
      {saveSuccess && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius)',
            color: 'var(--success-text)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13.5px',
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease',
          }}
          role="status"
        >
          <CheckCircle2 size={16} />
          <span>System configuration and operational preferences saved successfully.</span>
        </div>
      )}

      {/* Tab 1: Organization & Platform Settings */}
      {activeTab === 'general' && (
        <form onSubmit={handleSavePreferences} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={18} color="var(--primary)" />
              Enterprise Profile & Locale
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Core legal identity, fiscal currency, and operational timezone applied across payruns and attendance records.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div className="form-field">
                <label className="form-label" htmlFor="pref-org-name">Legal Entity / Company Name</label>
                <input
                  id="pref-org-name"
                  type="text"
                  className="form-input"
                  value={preferences.organizationName}
                  onChange={(e) => setPreferences({ ...preferences, organizationName: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="pref-org-code">Enterprise Registration Code</label>
                <input
                  id="pref-org-code"
                  type="text"
                  className="form-input"
                  value={preferences.orgCode}
                  onChange={(e) => setPreferences({ ...preferences, orgCode: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="pref-currency">System Accounting Currency</label>
                <select
                  id="pref-currency"
                  className="form-input"
                  value={preferences.defaultCurrency}
                  onChange={(e) => setPreferences({ ...preferences, defaultCurrency: e.target.value })}
                >
                  <option value="INR (₹)">INR — Indian Rupee (₹)</option>
                  <option value="USD ($)">USD — United States Dollar ($)</option>
                  <option value="EUR (€)">EUR — Euro (€)</option>
                  <option value="GBP (£)">GBP — British Pound (£)</option>
                </select>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="pref-timezone">Operating Timezone</label>
                <select
                  id="pref-timezone"
                  className="form-input"
                  value={preferences.timezone}
                  onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                >
                  <option value="Asia/Kolkata (IST, UTC+05:30)">Asia/Kolkata (IST, UTC+05:30)</option>
                  <option value="UTC (UTC+00:00)">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York (EST, UTC-05:00)">America/New_York (EST, UTC-05:00)</option>
                  <option value="Europe/London (GMT, UTC+00:00)">Europe/London (GMT, UTC+00:00)</option>
                  <option value="Asia/Singapore (SGT, UTC+08:00)">Asia/Singapore (SGT, UTC+08:00)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} color="var(--primary)" />
              Automation & Policy Preferences
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Control deterministic calculation thresholds for attendance and notification rules.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={preferences.autoOvertimeCalc}
                  onChange={(e) => setPreferences({ ...preferences, autoOvertimeCalc: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                />
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>Automatic Overtime Aggregation</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Automatically classify shift durations beyond 8 daily hours into the Overtime KPI bucket.</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={preferences.notifyOnPayrunApproval}
                  onChange={(e) => setPreferences({ ...preferences, notifyOnPayrunApproval: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                />
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>Operational Alerts on Payrun State Transitions</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Display dashboard banner alerts when payruns transition between COMPUTED, VALIDATED, and PAID.</div>
                </div>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px' }}>
                <label className="form-label" htmlFor="pref-grace-period" style={{ marginBottom: 0 }}>Attendance Grace Period (Minutes)</label>
                <input
                  id="pref-grace-period"
                  type="number"
                  min="0"
                  max="60"
                  className="form-input"
                  style={{ width: '90px' }}
                  value={preferences.scheduleGracePeriodMinutes}
                  onChange={(e) => setPreferences({ ...preferences, scheduleGracePeriodMinutes: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetDefaults}
            >
              Reset to Defaults
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={15} />
              <span>Save System Preferences</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Payroll & HR Configuration Shortcuts */}
      {activeTab === 'shortcuts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} color="var(--primary)" />
              Direct Module Configuration Hub
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Quick administrative access to core database tables and business calculation components.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Salary Rules */}
              <div
                className="card"
                style={{ padding: '20px', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'all 0.15s ease' }}
                onClick={() => onNavigateTab('salary-rules')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--primary-light)', color: 'var(--primary)' }}>
                      <FileText size={18} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--text-main)' }}>Salary Rules & Structures</div>
                  </div>
                  <ChevronRight size={16} color="var(--text-subtle)" />
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Configure deterministic allowance percentages, HRA formulas, statutory tax brackets, and rule sequences.
                </p>
                <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }}>
                  <span>Open Salary Rules</span>
                  <ExternalLink size={12} />
                </div>
              </div>

              {/* Working Schedules */}
              <div
                className="card"
                style={{ padding: '20px', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'all 0.15s ease' }}
                onClick={() => onNavigateTab('schedules')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--info-bg)', color: 'var(--info)' }}>
                      <Clock size={18} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--text-main)' }}>Working Schedules</div>
                  </div>
                  <ChevronRight size={16} color="var(--text-subtle)" />
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Define standard weekly working hours, shift templates, and linked schedules for employment contracts.
                </p>
                <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--info)', fontWeight: 700 }}>
                  <span>Open Working Schedules</span>
                  <ExternalLink size={12} />
                </div>
              </div>

              {/* Contracts Management */}
              <div
                className="card"
                style={{ padding: '20px', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'all 0.15s ease' }}
                onClick={() => onNavigateTab('contracts')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                      <CreditCard size={18} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--text-main)' }}>Contracts Registry</div>
                  </div>
                  <ChevronRight size={16} color="var(--text-subtle)" />
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Admin-only contract wages, start/end dates, active status toggles, and salary structure associations.
                </p>
                <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--warning)', fontWeight: 700 }}>
                  <span>Open Contracts Registry</span>
                  <ExternalLink size={12} />
                </div>
              </div>

              {/* Employees Directory */}
              <div
                className="card"
                style={{ padding: '20px', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'all 0.15s ease' }}
                onClick={() => onNavigateTab('employees')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--success-bg)', color: 'var(--success)' }}>
                      <Users size={18} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--text-main)' }}>Employee 360 Records</div>
                  </div>
                  <ChevronRight size={16} color="var(--text-subtle)" />
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Directory of corporate staff, departments, banking information, personal records, and compensation.
                </p>
                <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--success)', fontWeight: 700 }}>
                  <span>Open Employee Directory</span>
                  <ExternalLink size={12} />
                </div>
              </div>

              {/* Payruns Workflow */}
              <div
                className="card"
                style={{ padding: '20px', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'all 0.15s ease' }}
                onClick={() => onNavigateTab('payruns')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--primary-light)', color: 'var(--primary)' }}>
                      <PlayCircle size={18} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--text-main)' }}>Payrun Workflow Engine</div>
                  </div>
                  <ChevronRight size={16} color="var(--text-subtle)" />
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Execute four-stage payroll cycles (Draft → Computed → Validated → Paid) and generate bulk vouchers.
                </p>
                <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }}>
                  <span>Open Payruns Engine</span>
                  <ExternalLink size={12} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: System Users & RBAC Matrix */}
      {activeTab === 'rbac' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="var(--primary)" />
                  Corporate User Directory & RBAC Security Matrix
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Live authentication accounts seeded in relational MySQL storage, mapped to enterprise authority levels.
                </p>
              </div>
              <span className="badge badge-info" style={{ fontSize: '12px', padding: '4px 10px' }}>
                5 Active Accounts
              </span>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Account Holder</th>
                    <th>Email Address</th>
                    <th>Security Role</th>
                    <th>Staff ID</th>
                    <th>Authority Scope</th>
                    <th>Module Permissions</th>
                  </tr>
                </thead>
                <tbody>
                  {SYSTEM_ROLES_CATALOG.map((cat) => (
                    <tr key={cat.email}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{cat.name}</div>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>{cat.email}</td>
                      <td>
                        <span className={`badge badge-${cat.badgeType}`}>
                          {cat.role}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '12px' }}>{cat.employeeId}</td>
                      <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{cat.scope}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '280px' }}>
                          {cat.permissions.map((p) => (
                            <span
                              key={p}
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'var(--slate-100)',
                                color: 'var(--slate-700)',
                                border: '1px solid var(--border-subtle)',
                                fontWeight: 600,
                              }}
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Account & Security Settings */}
      {activeTab === 'account' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck size={18} color="var(--primary)" />
              Active Authenticated Session
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Details of your current enterprise JWT login session.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ padding: '14px', background: 'var(--bg-page)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>User Name</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>{user?.name || 'Administrator'}</div>
              </div>

              <div style={{ padding: '14px', background: 'var(--bg-page)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Email Account</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>{user?.email || 'admin@company.com'}</div>
              </div>

              <div style={{ padding: '14px', background: 'var(--bg-page)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Active Security Role</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>{displayRole}</div>
              </div>

              <div style={{ padding: '14px', background: 'var(--bg-page)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>JWT Session Expiration</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{sessionRemaining}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '18px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={toggleTheme}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {theme === 'dark' ? <Sun size={14} color="#f59e0b" /> : <Moon size={14} color="#6366f1" />}
                <span>Toggle {theme === 'dark' ? 'Light' : 'Dark'} Appearance</span>
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={logout}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <LogOut size={14} />
                <span>Sign Out of Current Session</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
