import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { Payruns } from './pages/Payruns';
import { Attendance } from './pages/Attendance';
import { TimeOff } from './pages/TimeOff';
import { Contracts } from './pages/Contracts';
import { Schedules } from './pages/Schedules';
import { SalaryStructures } from './pages/SalaryStructures';
import { employeesApi } from './api/employees';
import { payrollApi } from './api/payroll';
import { initialEmployees } from './data';
import type { Employee, Payrun, UserRole } from './types';
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

const isTabAllowed = (tab: string, role: UserRole): boolean => {
  if (role === 'Admin') return true;
  if (role === 'HR Manager') {
    return ['dashboard', 'employees', 'contracts', 'schedules', 'attendance', 'time-off'].includes(tab);
  }
  if (role === 'HR Payroll Manager' || role === 'HR Payroll User') {
    return ['dashboard', 'employees', 'contracts', 'attendance', 'payruns'].includes(tab);
  }
  if (role === 'Employee') {
    return ['dashboard', 'attendance', 'time-off'].includes(tab);
  }
  return tab === 'dashboard';
};

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user, displayRole, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [activePayrunId, setActivePayrunId] = useState<string | null>(null);

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
    } catch (err: unknown) {
      console.error('[App] Failed to load employees from API:', err);
      setEmployeesError(err instanceof Error ? err.message : 'Could not load employee data from server.');
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  // ── Payrun state ─────────────────────────────────────────────────────────────
  const [payruns, setPayruns] = useState<Payrun[]>([]);

  const fetchPayruns = useCallback(async () => {
    try {
      const apiPayruns = await payrollApi.getAll();
      if (apiPayruns) {
        setPayruns(apiPayruns);
      }
    } catch (err) {
      console.warn('[App] Failed to load payruns from API:', err);
    }
  }, []);

  // Session Boundary: Reset transient UI state upon logout/unauthenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentTab('dashboard');
      setActivePayrunId(null);
      setPayruns([]);
    }
  }, [isAuthenticated]);

  // Fetch employees and payruns when the user authenticates (scoped by role permission)
  useEffect(() => {
    if (isAuthenticated) {
      if (displayRole !== 'Employee') {
        fetchEmployees();
      }
      if (displayRole === 'Admin' || displayRole === 'HR Payroll Manager' || displayRole === 'HR Payroll User') {
        fetchPayruns();
      }
    }
  }, [isAuthenticated, displayRole, fetchEmployees, fetchPayruns]);

  // Ensure currentTab is permissible for the active role
  useEffect(() => {
    if (isAuthenticated && !isTabAllowed(currentTab, displayRole)) {
      setCurrentTab('dashboard');
    }
  }, [isAuthenticated, currentTab, displayRole]);

  const handleUpdatePayrun = (updated: Payrun) => {
    setPayruns((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      if (exists) {
        return prev.map((p) => (p.id === updated.id ? updated : p));
      }
      return [updated, ...prev];
    });
    setActivePayrunId(updated.id);
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
            loading={employeesLoading}
            error={employeesError}
            onNavigateTab={(tab) => setCurrentTab(tab)}
            onRefresh={fetchEmployees}
          />
        );
      case 'payruns':
        return (
          <Payruns
            payruns={payruns}
            employees={employees}
            onUpdatePayrun={handleUpdatePayrun}
            activePayrunId={activePayrunId}
            onSelectPayrun={setActivePayrunId}
          />
        );
      case 'attendance':
        return <Attendance />;
      case 'contracts':
        return <Contracts onNavigateTab={(tab) => setCurrentTab(tab)} />;
      case 'schedules':
        return <Schedules onNavigateTab={(tab) => setCurrentTab(tab)} />;
      case 'time-off':
        return <TimeOff />;
      case 'salary-rules':
      case 'salary-structures':
        return <SalaryStructures onNavigateTab={(tab) => setCurrentTab(tab)} />;
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
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
