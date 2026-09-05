import React from 'react';
import { Search, Plus, LogOut } from 'lucide-react';
import type { UserRole } from '../types';

interface HeaderProps {
  currentRole: UserRole;
  userName: string;
  onRoleChange: (role: UserRole) => void;
  onQuickPayrun: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  currentRole, 
  userName,
  onRoleChange, 
  onQuickPayrun,
  onLogout
}) => {
  const getInitials = (role: UserRole) => {
    switch (role) {
      case 'Employee': return 'JD';
      case 'HR Manager': return 'SC';
      case 'HR Payroll User': return 'AR';
      case 'Admin': return 'SR';
      case 'HR Payroll Manager':
      default: return 'ER';
    }
  };

  return (
    <header className="header">
      {/* Search */}
      <div className="search-box">
        <Search size={15} color="var(--slate-400)" />
        <input type="text" placeholder="Search employees, payroll, records..." />
      </div>

      {/* Actions */}
      <div className="header-actions">
        {/* Active Cycle */}
        <div className="cycle-pill">
          <span className="cycle-dot" />
          <span>Sep 2026 Cycle</span>
        </div>

        {/* Quick Action */}
        <button className="btn btn-primary btn-sm" onClick={onQuickPayrun}>
          <Plus size={14} />
          <span>Run Payroll</span>
        </button>

        {/* Role Switcher */}
        <select 
          className="role-select" 
          value={currentRole}
          onChange={(e) => onRoleChange(e.target.value as UserRole)}
        >
          <option value="HR Payroll Manager">Role: HR Payroll Manager</option>
          <option value="HR Manager">Role: HR Manager</option>
          <option value="HR Payroll User">Role: HR Payroll User</option>
          <option value="Employee">Role: Employee (Self-Service)</option>
          <option value="Admin">Role: Admin</option>
        </select>

        {/* Avatar */}
        <div className="avatar" title={`${userName} (${currentRole})`}>
          {getInitials(currentRole)}
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
