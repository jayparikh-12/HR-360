import React, { useState, useEffect, useCallback } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { Payruns } from './pages/Payruns';
import { Payslips } from './pages/Payslips';
import { Attendance } from './pages/Attendance';
import { TimeOff } from './pages/TimeOff';
import { Contracts } from './pages/Contracts';
import { Schedules } from './pages/Schedules';
import { SalaryStructures } from './pages/SalaryStructures';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { employeesApi } from './api/employees';
import { payrollApi } from './api/payroll';
import { initialEmployees } from './data';
import type { Employee, Payrun } from './types';
import './App.css';

// Phase 2.3 shim: merge static attendance/leave stats onto API records
const LOCAL_STAT_SHIMS: Record<string, { attendanceRate: number; leaveBalance: number }> = {};
initialEmployees.forEach((e) => {
  LOCAL_STAT_SHIMS[e.id] = { attendanceRate: e.attendanceRate, leaveBalance: e.leaveBalance };
});

import { PATH_TO_TAB, TAB_TO_PATH, isTabAllowed } from './utils/routes';
export { PATH_TO_TAB, TAB_TO_PATH, isTabAllowed };

// ── Session Restoration Loader ─────────────────────────────────────────────────

export const SessionRestoreLoader: React.FC = () => (
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
        animation: 'pulse 1.8s ease-in-out infinite',
      }}
    />
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: '20px',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: '#ffffff',
        }}
      >
        PeoplePay360
      </div>
      <div
        style={{
          fontSize: '13px',
          color: '#a5b4fc',
          marginTop: '6px',
          fontWeight: 500,
        }}
      >
        Restoring secure session...
      </div>
    </div>
  </div>
);

// ── Role-Based Route Guard ─────────────────────────────────────────────────────

export const RoleRoute: React.FC<{ tab: string; children: React.ReactNode }> = ({
  tab,
  children,
}) => {
  const { displayRole } = useAuth();

  if (!isTabAllowed(tab, displayRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// ── Protected Route wrapper ────────────────────────────────────────────────────

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <SessionRestoreLoader />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
};

// ── Main authenticated shell ───────────────────────────────────────────────────

const AppShell: React.FC = () => {
  const { isAuthenticated, isLoading, user, displayRole, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activePayrunId, setActivePayrunId] = useState<string | null>(null);

  // Derive the active sidebar tab from the current URL path
  const currentTab = PATH_TO_TAB[location.pathname] ?? 'dashboard';

  // ── Employee state ──────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    setEmployeesError(null);
    try {
      const apiEmployees = await employeesApi.getAll();
      const merged = apiEmployees.map((emp) => ({
        ...emp,
        ...(LOCAL_STAT_SHIMS[emp.id] ?? { attendanceRate: 0, leaveBalance: 0 }),
      }));
      setEmployees(merged);
    } catch (err: unknown) {
      console.error('[App] Failed to load employees from API:', err instanceof Error ? err.message : String(err));
      setEmployeesError(err instanceof Error ? err.message : 'Could not load employee data from server.');
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  // ── Payrun state ────────────────────────────────────────────────────────────
  const [payruns, setPayruns] = useState<Payrun[]>([]);

  const fetchPayruns = useCallback(async () => {
    try {
      const apiPayruns = await payrollApi.getAll();
      if (apiPayruns) setPayruns(apiPayruns);
    } catch (err) {
      console.warn('[App] Failed to load payruns from API:', err);
    }
  }, []);

  // Fetch data on auth
  useEffect(() => {
    if (isAuthenticated) {
      if (displayRole !== 'Employee') fetchEmployees();
      if (['Admin', 'HR Payroll Manager', 'HR Payroll User'].includes(displayRole)) fetchPayruns();
    }
  }, [isAuthenticated, displayRole, fetchEmployees, fetchPayruns]);

  // Redirect to login on logout
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleUpdatePayrun = (updated: Payrun) => {
    setPayruns((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      return exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [updated, ...prev];
    });
    setActivePayrunId(updated.id);
  };

  const handleSelectTab = (tab: string) => {
    if (tab === 'login') { logout(); return; }
    if (!isTabAllowed(tab, displayRole)) return;
    const path = TAB_TO_PATH[tab] ?? '/dashboard';
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return <SessionRestoreLoader />;
  }

  return (
    <div className="app-container">
      <Sidebar
        currentTab={currentTab}
        employeeCount={employees.length}
        onSelectTab={handleSelectTab}
      />
      <div className="main-wrapper">
        <Header
          currentRole={displayRole}
          userName={user?.name || 'Administrator'}
          onLogout={logout}
        />
        <main className="content">
          <Routes>
            <Route path="/dashboard" element={
              <Dashboard employees={employees} payruns={payruns} onNavigate={(tab) => navigate(TAB_TO_PATH[tab] ?? '/dashboard')} />
            } />
            <Route path="/employees" element={
              <RoleRoute tab="employees">
                <Employees
                  employees={employees}
                  loading={employeesLoading}
                  error={employeesError}
                  onNavigateTab={(tab) => navigate(TAB_TO_PATH[tab] ?? '/dashboard')}
                  onRefresh={fetchEmployees}
                />
              </RoleRoute>
            } />
            <Route path="/payruns" element={
              <RoleRoute tab="payruns">
                <Payruns
                  payruns={payruns}
                  employees={employees}
                  onUpdatePayrun={handleUpdatePayrun}
                  activePayrunId={activePayrunId}
                  onSelectPayrun={setActivePayrunId}
                />
              </RoleRoute>
            } />
            <Route path="/payslips" element={<Payslips />} />
            <Route path="/contracts" element={
              <RoleRoute tab="contracts">
                <Contracts onNavigateTab={(tab) => navigate(TAB_TO_PATH[tab] ?? '/dashboard')} />
              </RoleRoute>
            } />
            <Route path="/schedules" element={
              <RoleRoute tab="schedules">
                <Schedules onNavigateTab={(tab) => navigate(TAB_TO_PATH[tab] ?? '/dashboard')} />
              </RoleRoute>
            } />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/time-off" element={
              <RoleRoute tab="time-off">
                <TimeOff />
              </RoleRoute>
            } />
            <Route path="/salary-rules" element={
              <RoleRoute tab="salary-rules">
                <SalaryStructures onNavigateTab={(tab) => navigate(TAB_TO_PATH[tab] ?? '/dashboard')} />
              </RoleRoute>
            } />
            <Route path="/settings" element={
              <RoleRoute tab="settings">
                <SalaryStructures onNavigateTab={(tab) => navigate(TAB_TO_PATH[tab] ?? '/dashboard')} />
              </RoleRoute>
            } />
            {/* Catch-all → dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

// ── Root app with router ───────────────────────────────────────────────────────

export const AppRoutes: React.FC = () => {
  const { isAuthenticated, isLoading, displayRole } = useAuth();
  const location = useLocation();

  if (isLoading) return <SessionRestoreLoader />;

  // Respect return URL if provided, but verify role permissions
  const targetPath = (location.state as any)?.from?.pathname;
  const targetTab = targetPath ? PATH_TO_TAB[targetPath] : undefined;
  const destination = targetTab && isTabAllowed(targetTab, displayRole) ? targetPath : '/dashboard';

  return (
    <Routes>
      {/* Public: Landing Page */}
      <Route path="/" element={<Landing />} />
      <Route path="/landing" element={<Landing />} />

      {/* Public: Login */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={destination} replace /> : <Login />}
      />
      {/* Protected: everything else renders inside AppShell */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export const App: React.FC = () => (
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);

export default App;
