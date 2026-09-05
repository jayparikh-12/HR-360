import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { Payruns } from './pages/Payruns';
import { Attendance } from './pages/Attendance';
import { TimeOff } from './pages/TimeOff';
import { initialEmployees, initialPayruns, initialAttendance, initialTimeOff } from './data';
import type { Employee, Payrun, AttendanceRecord } from './types';
import './App.css';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user, displayRole, setDisplayRole, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
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

  // 1. Initial loading: Render subtle splash screen to eliminate UI flicker
  if (isLoading) {
    return (
      <div 
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          gap: '20px',
        }}
      >
        <div 
          className="logo-box" 
          style={{ 
            width: '52px', 
            height: '52px', 
            fontSize: '26px', 
            animation: 'pulse 1.8s ease-in-out infinite' 
          }}
        >
          P
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
            PeoplePay360
          </div>
          <div style={{ fontSize: '13px', color: '#a5b4fc', marginTop: '6px', fontWeight: 500 }}>
            Restoring secure session...
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Render Login page
  if (!isAuthenticated) {
    return <Login />;
  }

  // 3. Authenticated: Render Protected Application Shell
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
          if (tab === 'login') {
            logout();
            return;
          }
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* 2. Main Area */}
      <div className="main-wrapper">
        <Header
          currentRole={displayRole}
          userName={user?.name || 'Elena Rostova'}
          onRoleChange={setDisplayRole}
          onQuickPayrun={() => setCurrentTab('payruns')}
          onLogout={logout}
        />
        <main className="content">{renderContent()}</main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
