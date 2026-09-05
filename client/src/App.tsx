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
import { Contracts } from './pages/Contracts';
import { Schedules } from './pages/Schedules';
import { SalaryStructures } from './pages/SalaryStructures';
import { employeesApi } from './api/employees';
import { payrollApi } from './api/payroll';
import { initialEmployees, initialPayruns } from './data';
import type { Employee, Payrun } from './types';
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
    } catch (err: any) {
      console.error('[App] Failed to load employees from API:', err);
      setEmployeesError(err?.message || 'Could not load employee data from server.');
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  // ── Payruns state (MySQL-backed) ───────────────────────────────────────────
  const [payruns, setPayruns] = useState<Payrun[]>(initialPayruns);

  const fetchPayruns = useCallback(async () => {
    try {
      const apiPayruns = await payrollApi.getAll();
      if (apiPayruns && apiPayruns.length > 0) {
        setPayruns((prev) => {
          return apiPayruns.map((pr) => {
            const existing = prev.find((p) => p.id === pr.id);
            return {
              ...existing,
              ...pr,
              status: pr.status,
              payslips: (pr.payslips && pr.payslips.length > 0) ? pr.payslips : (existing?.payslips || []),
            };
          });
        });
      }
    } catch (err) {
      console.warn('[App] Failed to load payruns from API:', err);
    }
  }, []);

  // Fetch employees and payruns when the user authenticates
  useEffect(() => {
    if (isAuthenticated) {
      fetchEmployees();
      fetchPayruns();
    }
  }, [isAuthenticated, fetchEmployees, fetchPayruns]);

  const handleUpdatePayrun = (updated: Payrun) => {
    setPayruns((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
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
