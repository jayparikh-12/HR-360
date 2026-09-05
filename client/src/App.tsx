import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { Payruns } from './pages/Payruns';
import { Attendance } from './pages/Attendance';
import { TimeOff } from './pages/TimeOff';
import { initialEmployees, initialPayruns, initialAttendance, initialTimeOff } from './data';
import type { UserRole, Employee, Payrun, AttendanceRecord } from './types';
import './App.css';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [currentRole, setCurrentRole] = useState<UserRole>('HR Payroll Manager');
  const [employees] = useState<Employee[]>(initialEmployees);
  const [payruns, setPayruns] = useState<Payrun[]>(initialPayruns);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(initialAttendance);
  const [timeOff] = useState(initialTimeOff);

  const handleUpdatePayrun = (updated: Payrun) => {
    setPayruns(payruns.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleAddAttendance = (record: AttendanceRecord) => {
    setAttendance([record, ...attendance]);
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard
            employees={employees}
            payruns={payruns}
            onNavigate={(tab) => setCurrentTab(tab)}
          />
        );
      case 'employees':
        return (
          <Employees
            employees={employees}
            onNavigateTab={(tab) => setCurrentTab(tab)}
          />
        );
      case 'payruns':
        return (
          <Payruns
            payruns={payruns}
            employees={employees}
            onUpdatePayrun={handleUpdatePayrun}
          />
        );
      case 'attendance':
        return (
          <Attendance
            attendanceRecords={attendance}
            onAddRecord={handleAddAttendance}
          />
        );
      case 'time-off':
        return (
          <TimeOff
            requests={timeOff}
            onApprove={(id) => console.log('Approved leave request', id)}
            onRefuse={(id) => console.log('Refused leave request', id)}
          />
        );
      default:
        return (
          <Dashboard
            employees={employees}
            payruns={payruns}
            onNavigate={(tab) => setCurrentTab(tab)}
          />
        );
    }
  };

  return (
    <div className="app-container">
      {/* 1. Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* 2. Main Area */}
      <div className="main-wrapper">
        <Header
          currentRole={currentRole}
          onRoleChange={setCurrentRole}
          onQuickPayrun={() => setCurrentTab('payruns')}
        />
        <main className="content">{renderContent()}</main>
      </div>
    </div>
  );
};

export default App;
