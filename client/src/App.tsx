import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { Payruns } from './pages/Payruns';
import { Attendance } from './pages/Attendance';
import { TimeOff } from './pages/TimeOff';
import { employeesApi } from './api/employees';
import { initialEmployees, initialPayruns, initialAttendance, initialTimeOff } from './data';
import type { Employee, Payrun, AttendanceRecord } from './types';
import './App.css';

/**
 * Phase 2.3 shim: attendance rate and leave balance are not yet persisted in MySQL.
 * Until the attendance/time-off verticals are wired, we merge the locally-known
 * values onto API records so the UI stays accurate during the transition.
 */
const LOCAL_STAT_SHIMS: Record<string, { attendanceRate: number; leaveBalance: number }> = {};
initialEmployees.forEach((e) => {
  LOCAL_STAT_SHIMS[e.id] = { attendanceRate: e.attendanceRate, leaveBalance: e.leaveBalance };
});

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user, displayRole, setDisplayRole, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // ── Employee state (MySQL-backed, Phase 2.2) ────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState<boolean>(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    setEmployeesError(null);
    try {
      const apiEmployees = await employeesApi.getAll();
      // Merge Phase 2.3 shims so attendance/leave columns display correctly
      const merged = apiEmployees.map((emp) => ({
        ...emp,
        ...(LOCAL_STAT_SHIMS[emp.id] ?? { attendanceRate: 0, leaveBalance: 0 }),
      }));
      setEmployees(merged);
    } catch (err) {
      console.error('[App] Failed to load employees from API:', err);
      setEmployeesError('Could not load employee data. Showing cached data.');
      // Fallback: keep previously loaded employees (or initial data if first load)
      setEmployees((prev) => (prev.length > 0 ? prev : initialEmployees));
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  // Fetch employees when the user authenticates
  useEffect(() => {
    if (isAuthenticated) {
      fetchEmployees();
    }
  }, [isAuthenticated, fetchEmployees]);

  // ── Other module state (still local — Phase 2.3+) ──────────────────────────
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
          <>
            {employeesError && (
              <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#fef3c7', border: '1px solid #d97706', borderRadius: '8px', fontSize: '13px', color: '#92400e' }}>
                ⚠️ {employeesError}
              </div>
            )}
            {employeesLoading && employees.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--slate-400)', fontSize: '14px' }}>
                Loading employees…
              </div>
            ) : (
              <Employees
                employees={employees}
                onNavigateTab={(tab) => setCurrentTab(tab)}
              />
            )}
          </>
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
