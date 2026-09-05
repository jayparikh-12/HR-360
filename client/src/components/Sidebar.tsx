import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  PlayCircle, 
  Clock, 
  Palmtree, 
  FileText, 
  Settings,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  employeeCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, employeeCount }) => {
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
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="logo-box">P</div>
        <div>
          <div className="logo-text">PeoplePay360</div>
        </div>
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
                >
                  <div className="nav-link-left">
                    <Palmtree size={17} />
                    <span>Time Off</span>
                  </div>
                  {isHRManager && <span className="nav-badge">1 pending</span>}
                </button>
              </li>
            )}
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
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--slate-100)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Sparkles size={14} color="#10b981" />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-600)' }}>Hackathon Live</span>
      </div>
    </aside>
  );
};
