import React from 'react';
import { Search, Plus } from 'lucide-react';
import type { UserRole } from '../types';

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onQuickPayrun: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentRole, onRoleChange, onQuickPayrun }) => {
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
        <div className="avatar" title={currentRole}>
          {currentRole === 'Employee' ? 'JD' : 'ER'}
        </div>
      </div>
    </header>
  );
};
