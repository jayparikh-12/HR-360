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

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
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

        <div>
          <div className="menu-group-title">Core Operations</div>
          <ul className="menu-items">
            <li>
              <button
                className={`nav-link ${currentTab === 'employees' ? 'active' : ''}`}
                onClick={() => onSelectTab('employees')}
              >
                <div className="nav-link-left">
                  <Users size={17} />
                  <span>Employees</span>
                </div>
                <span className="nav-badge">6</span>
              </button>
            </li>
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
            <li>
              <button
                className={`nav-link ${currentTab === 'time-off' ? 'active' : ''}`}
                onClick={() => onSelectTab('time-off')}
              >
                <div className="nav-link-left">
                  <Palmtree size={17} />
                  <span>Time Off</span>
                </div>
                <span className="nav-badge">1 pending</span>
              </button>
            </li>
          </ul>
        </div>

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

        <div>
          <div className="menu-group-title">Configuration</div>
          <ul className="menu-items">
            <li>
              <button
                className="nav-link"
                onClick={() => alert('Salary structures and rules are configured deterministically in the Payrun workflow.')}
              >
                <div className="nav-link-left">
                  <FileText size={17} />
                  <span>Salary Rules</span>
                </div>
              </button>
            </li>
            <li>
              <button
                className="nav-link"
                onClick={() => alert('RBAC & Role management configured in header persona switcher.')}
              >
                <div className="nav-link-left">
                  <Settings size={17} />
                  <span>Settings</span>
                </div>
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Footer live mode */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--slate-100)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Sparkles size={14} color="#10b981" />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-600)' }}>Hackathon Live</span>
      </div>
    </aside>
  );
};
