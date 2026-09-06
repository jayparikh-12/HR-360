import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  PlayCircle, 
  Clock, 
  Palmtree, 
  FileText, 
  Settings,
  Sparkles,
  CreditCard,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  employeeCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentTab, 
  onSelectTab, 
  employeeCount,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { displayRole } = useAuth();

  const isAdmin = displayRole === 'Admin';
  const isHRManager = displayRole === 'HR Manager';
  const isPayroll = displayRole === 'HR Payroll Manager' || displayRole === 'HR Payroll User';
  const isEmployee = displayRole === 'Employee';

  // Specific visibility flags
  const showEmployees = isAdmin || isHRManager || isPayroll;
  const showContracts = isAdmin || isHRManager || isPayroll;
  const showSchedules = isAdmin || isHRManager;
  const showAttendance = true; // Everyone: self for Employee, company for managers
  const showTimeOff = isAdmin || isHRManager || isEmployee;
  const showPayrollEngine = isAdmin || isPayroll;
  const showConfiguration = isAdmin;

  const countBadge = employeeCount !== undefined && employeeCount !== null ? employeeCount : 6;

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`} aria-label="Main sidebar navigation">
      {/* Brand Header */}
      <div className="sidebar-header" style={{ justifyContent: isCollapsed ? 'center' : 'space-between', padding: isCollapsed ? '0 10px' : '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="logo-box" title="PeoplePay360 Platform">P</div>
          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="logo-text">PeoplePay360</div>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                HR-360 Platform
              </span>
            </div>
          )}
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            className="btn btn-ghost btn-sm sidebar-toggle-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{ padding: '6px', minWidth: '28px', height: '28px', borderRadius: '6px' }}
          >
            {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        )}
      </div>

      {/* Menu */}
      <div className="sidebar-menu">
        {/* Overview */}
        <div>
          <div className="menu-group-title">Overview</div>
          <ul className="menu-items">
            <li>
              <button
                className={`nav-link ${currentTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => onSelectTab('dashboard')}
                title="Dashboard"
                aria-label="Dashboard"
              >
                <div className="nav-link-left">
                  <LayoutDashboard size={17} />
                  <span>Dashboard</span>
                </div>
              </button>
            </li>
          </ul>
        </div>

        {/* Core Operations */}
        <div>
          <div className="menu-group-title">Core Operations</div>
          <ul className="menu-items">
            {showEmployees && (
              <li>
                <button
                  className={`nav-link ${currentTab === 'employees' ? 'active' : ''}`}
                  onClick={() => onSelectTab('employees')}
                  title="Employees"
                  aria-label="Employees"
                >
                  <div className="nav-link-left">
                    <Users size={17} />
                    <span>Employees</span>
                  </div>
                  <span className="nav-badge">{countBadge}</span>
                </button>
              </li>
            )}
            {showContracts && (
              <li>
                <button
                  className={`nav-link ${currentTab === 'contracts' ? 'active' : ''}`}
                  onClick={() => onSelectTab('contracts')}
                  title="Contracts"
                  aria-label="Contracts"
                >
                  <div className="nav-link-left">
                    <FileText size={17} />
                    <span>Contracts</span>
                  </div>
                </button>
              </li>
            )}
            {showSchedules && (
              <li>
                <button
                  className={`nav-link ${currentTab === 'schedules' ? 'active' : ''}`}
                  onClick={() => onSelectTab('schedules')}
                  title="Working Schedules"
                  aria-label="Working Schedules"
                >
                  <div className="nav-link-left">
                    <Clock size={17} />
                    <span>Working Schedules</span>
                  </div>
                </button>
              </li>
            )}
            {showAttendance && (
              <li>
                <button
                  className={`nav-link ${currentTab === 'attendance' ? 'active' : ''}`}
                  onClick={() => onSelectTab('attendance')}
                  title="Attendance"
                  aria-label="Attendance"
                >
                  <div className="nav-link-left">
                    <Clock size={17} />
                    <span>Attendance</span>
                  </div>
                </button>
              </li>
            )}
            {showTimeOff && (
              <li>
                <button
                  className={`nav-link ${currentTab === 'time-off' ? 'active' : ''}`}
                  onClick={() => onSelectTab('time-off')}
                  title="Time Off"
                  aria-label="Time Off"
                >
                  <div className="nav-link-left">
                    <Palmtree size={17} />
                    <span>Time Off</span>
                  </div>
                  {isHRManager && <span className="nav-badge">1 pending</span>}
                </button>
              </li>
            )}
            <li>
              <button
                className={`nav-link ${currentTab === 'payslips' ? 'active' : ''}`}
                onClick={() => onSelectTab('payslips')}
                title={isEmployee ? 'My Payslips' : 'Payslips'}
                aria-label={isEmployee ? 'My Payslips' : 'Payslips'}
              >
                <div className="nav-link-left">
                  <CreditCard size={17} />
                  <span>{isEmployee ? 'My Payslips' : 'Payslips'}</span>
                </div>
              </button>
            </li>
          </ul>
        </div>

        {/* Payroll Engine */}
        {showPayrollEngine && (
          <div>
            <div className="menu-group-title">Payroll Engine</div>
            <ul className="menu-items">
              <li>
                <button
                  className={`nav-link ${currentTab === 'payruns' ? 'active' : ''}`}
                  onClick={() => onSelectTab('payruns')}
                  title="Payruns & Payslips"
                  aria-label="Payruns & Payslips"
                >
                  <div className="nav-link-left">
                    <PlayCircle size={17} />
                    <span>Payruns & Payslips</span>
                  </div>
                  <span className="nav-badge">Active</span>
                </button>
              </li>
            </ul>
          </div>
        )}

        {/* Configuration (Admin Only) */}
        {showConfiguration && (
          <div>
            <div className="menu-group-title">Configuration</div>
            <ul className="menu-items">
              <li>
                <button
                  className={`nav-link ${currentTab === 'salary-rules' || currentTab === 'salary-structures' ? 'active' : ''}`}
                  onClick={() => onSelectTab('salary-rules')}
                  title="Salary Rules"
                  aria-label="Salary Rules"
                >
                  <div className="nav-link-left">
                    <FileText size={17} />
                    <span>Salary Rules</span>
                  </div>
                </button>
              </li>
              <li>
                <button
                  className={`nav-link ${currentTab === 'settings' ? 'active' : ''}`}
                  onClick={() => alert('Administrator System Settings & Role-Based Access Control.')}
                  title="Settings"
                  aria-label="Settings"
                >
                  <div className="nav-link-left">
                    <Settings size={17} />
                    <span>Settings</span>
                  </div>
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Footer live mode */}
      <div style={{ padding: isCollapsed ? '14px 10px' : '14px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between' }}>
        {!isCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={14} color="#10b981" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Enterprise</span>
          </div>
        )}
        <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '999px', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700 }} title="PeoplePay360 ERP v2.4">
          v2.4
        </span>
      </div>
    </aside>
  );
};
