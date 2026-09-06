/**
 * PeoplePay360 — Dedicated Error Pages & Error Architecture Test Suite
 * 
 * Verifies:
 * 1. 401 Unauthorized page metadata and action contract
 * 2. 403 Forbidden page metadata, role context, and non-logout contract
 * 3. 404 Not Found page metadata and navigation actions
 * 4. 500 Server Error page metadata, retry capability, and zero stack trace leak
 * 5. Error Boundary integration and recovery fallback
 * 6. Authentication error interception:
 *    - 401 triggers unauthorized flow safely
 *    - 403 does NOT trigger unauthorized flow or log out user
 *    - 404 does NOT trigger unauthorized flow or log out user
 *    - 500 does NOT trigger unauthorized flow or log out user
 *    - Network error (status 0) does NOT trigger unauthorized flow or log out user
 * 7. Role-Based Route permission enforcement returns 403 Forbidden state
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ApiError,
  apiFetch,
  onUnauthorized,
  getDefaultErrorMessage,
  sanitizeErrorMessage,
} from '../api/client';
import { isTabAllowed, getDefaultWorkspacePath } from '../utils/routes';
import type { UserRole } from '../types';

test('PEOPLEPAY360 — DEDICATED ERROR ARCHITECTURE & PAGES SUITE', async (t) => {
  console.log('\n================================================================');
  console.log('🚨 PEOPLEPAY360 — ERROR HANDLING & ERROR PAGES VERIFICATION 🚨');
  console.log('================================================================\n');

  // ── 1. HTTP Error Distinction in API Client ───────────────────────────────
  await t.test('1. HTTP Status Code Distinction in API Client', async (st) => {
    const originalFetch = globalThis.fetch;

    await st.test('1.1 HTTP 401 triggers onUnauthorized callback', async () => {
      let unauthorizedNotified = false;
      const unsubscribe = onUnauthorized(() => {
        unauthorizedNotified = true;
      });

      globalThis.fetch = async () => {
        return new Response(JSON.stringify({ message: 'Token expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      try {
        await assert.rejects(
          async () => apiFetch('/api/employees'),
          (err: any) => {
            assert.equal(err instanceof ApiError, true);
            assert.equal(err.statusCode, 401);
            return true;
          }
        );
        assert.equal(unauthorizedNotified, true, '401 must notify unauthorized listener');
      } finally {
        unsubscribe();
      }
    });

    await st.test('1.2 HTTP 403 DOES NOT trigger onUnauthorized callback (keeps user logged in)', async () => {
      let unauthorizedNotified = false;
      const unsubscribe = onUnauthorized(() => {
        unauthorizedNotified = true;
      });

      globalThis.fetch = async () => {
        return new Response(JSON.stringify({ message: 'You do not have permission to access this resource' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      try {
        await assert.rejects(
          async () => apiFetch('/api/contracts/edit'),
          (err: any) => {
            assert.equal(err instanceof ApiError, true);
            assert.equal(err.statusCode, 403);
            return true;
          }
        );
        assert.equal(unauthorizedNotified, false, '403 must NOT log out or notify unauthorized');
      } finally {
        unsubscribe();
      }
    });

    await st.test('1.3 HTTP 404 DOES NOT trigger onUnauthorized callback', async () => {
      let unauthorizedNotified = false;
      const unsubscribe = onUnauthorized(() => {
        unauthorizedNotified = true;
      });

      globalThis.fetch = async () => {
        return new Response(JSON.stringify({ message: 'Resource not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      try {
        await assert.rejects(
          async () => apiFetch('/api/employees/non-existent-id'),
          (err: any) => {
            assert.equal(err instanceof ApiError, true);
            assert.equal(err.statusCode, 404);
            return true;
          }
        );
        assert.equal(unauthorizedNotified, false, '404 must NOT notify unauthorized');
      } finally {
        unsubscribe();
      }
    });

    await st.test('1.4 HTTP 500 Server Error DOES NOT trigger onUnauthorized callback', async () => {
      let unauthorizedNotified = false;
      const unsubscribe = onUnauthorized(() => {
        unauthorizedNotified = true;
      });

      globalThis.fetch = async () => {
        return new Response(JSON.stringify({ message: 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      try {
        await assert.rejects(
          async () => apiFetch('/api/payroll/calculate'),
          (err: any) => {
            assert.equal(err instanceof ApiError, true);
            assert.equal(err.statusCode, 500);
            return true;
          }
        );
        assert.equal(unauthorizedNotified, false, '500 must NOT notify unauthorized');
      } finally {
        unsubscribe();
      }
    });

    await st.test('1.5 Network failure (Status 0) DOES NOT trigger onUnauthorized callback', async () => {
      let unauthorizedNotified = false;
      const unsubscribe = onUnauthorized(() => {
        unauthorizedNotified = true;
      });

      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch');
      };

      try {
        await assert.rejects(
          async () => apiFetch('/api/dashboard/metrics'),
          (err: any) => {
            assert.equal(err instanceof ApiError, true);
            assert.equal(err.statusCode, 0);
            return true;
          }
        );
        assert.equal(unauthorizedNotified, false, 'Network disconnect must NOT log out the user');
      } finally {
        unsubscribe();
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ── 2. Error Message Sanitization & Zero Technical Information Leakage ─────
  await t.test('2. Error Message Sanitization & Security Hygiene', async (st) => {
    await st.test('2.1 SQL syntax errors and internal column names are completely obscured', () => {
      const rawSqlError = "Table 'peoplepay360.employees' doesn't exist at MySQL.query()";
      const sanitized = sanitizeErrorMessage(rawSqlError, 500);
      assert.equal(sanitized, getDefaultErrorMessage(500));
      assert.equal(sanitized.includes('peoplepay360'), false);
      assert.equal(sanitized.includes('MySQL'), false);
    });

    await st.test('2.2 Stack traces and file system paths are completely obscured', () => {
      const traceError = "Error: crash at d:\\Odoo\\server\\src\\controllers\\payroll.controller.ts:42:15";
      const sanitized = sanitizeErrorMessage(traceError, 500);
      assert.equal(sanitized, getDefaultErrorMessage(500));
      assert.equal(sanitized.includes('payroll.controller.ts'), false);
      assert.equal(sanitized.includes('d:\\Odoo'), false);
    });

    await st.test('2.3 Clean user-facing business validation is preserved without disruption', () => {
      const validMsg = "Leave start date must be before or equal to end date.";
      const sanitized = sanitizeErrorMessage(validMsg, 400);
      assert.equal(sanitized, validMsg);
    });
  });

  // ── 3. Role-Based Route Access & 403 Forbidden Triggering ───────────────────
  await t.test('3. RBAC Route Permission Mapping to 403 Forbidden State', async (st) => {
    const roles: UserRole[] = ['Admin', 'HR Manager', 'HR Payroll Manager', 'HR Payroll User', 'Employee'];

    await st.test('3.1 Admin can access all operational and configuration modules', () => {
      const tabs = ['dashboard', 'employees', 'contracts', 'schedules', 'attendance', 'time-off', 'payruns', 'payslips', 'salary-rules'];
      for (const tab of tabs) {
        assert.equal(isTabAllowed(tab, 'Admin'), true, `Admin should have access to ${tab}`);
      }
    });

    await st.test('3.2 Employee is restricted from management tabs (triggers 403)', () => {
      assert.equal(isTabAllowed('contracts', 'Employee'), false, 'Employee must be restricted from contracts');
      assert.equal(isTabAllowed('payruns', 'Employee'), false, 'Employee must be restricted from payruns');
      assert.equal(isTabAllowed('salary-rules', 'Employee'), false, 'Employee must be restricted from salary-rules');
      assert.equal(isTabAllowed('employees', 'Employee'), false, 'Employee must be restricted from employee management');

      // Allowed employee tabs
      assert.equal(isTabAllowed('dashboard', 'Employee'), true);
      assert.equal(isTabAllowed('attendance', 'Employee'), true);
      assert.equal(isTabAllowed('time-off', 'Employee'), true);
      assert.equal(isTabAllowed('payslips', 'Employee'), true);
    });

    await st.test('3.3 HR Payroll User cannot access Salary Rules configuration (triggers 403)', () => {
      assert.equal(isTabAllowed('salary-rules', 'HR Payroll User'), false);
      assert.equal(isTabAllowed('payruns', 'HR Payroll User'), true);
      assert.equal(isTabAllowed('employees', 'HR Payroll User'), true);
    });
  });

  // ── 4. Standalone Error Routing & Layout Separation Architecture ───────────
  await t.test('4. Standalone Error Routing & Layout Separation Architecture', async (st) => {
    const appTsx = fs.readFileSync(path.resolve(process.cwd(), 'client/src/App.tsx'), 'utf-8');

    await st.test('4.1 Dedicated routes (/unauthorized, /forbidden, /not-found, /server-error) exist at root Routes level', () => {
      assert.ok(appTsx.includes('path="/unauthorized"'), 'Must have /unauthorized route at root');
      assert.ok(appTsx.includes('path="/forbidden"'), 'Must have /forbidden route at root');
      assert.ok(appTsx.includes('path="/not-found"'), 'Must have /not-found route at root');
      assert.ok(appTsx.includes('path="/server-error"'), 'Must have /server-error route at root');

      // Verify they render dedicated error components directly
      const appRoutesSection = appTsx.substring(appTsx.indexOf('const AppRoutes: React.FC'));
      assert.ok(appRoutesSection.includes('<Route path="/unauthorized" element={<UnauthorizedPage />} />'));
      assert.ok(appRoutesSection.includes('<Route path="/forbidden" element={<ForbiddenPage />} />'));
      assert.ok(appRoutesSection.includes('<Route path="/not-found" element={<NotFoundPage />} />'));
      assert.ok(appRoutesSection.includes('<Route path="/server-error" element={<ServerErrorPage />} />'));
    });

    await st.test('4.2 AppLayout / AppShell does NOT render error pages inside shell', () => {
      const appShellSection = appTsx.substring(
        appTsx.indexOf('export const AppShell'),
        appTsx.indexOf('const AppRoutes')
      );
      assert.ok(!appShellSection.includes('<UnauthorizedPage'), 'AppShell must not render UnauthorizedPage inside shell');
      assert.ok(!appShellSection.includes('<ForbiddenPage'), 'AppShell must not render ForbiddenPage inside shell');
      assert.ok(!appShellSection.includes('<ServerErrorPage'), 'AppShell must not render ServerErrorPage inside shell');
      assert.ok(!appShellSection.includes('<NotFoundPage'), 'AppShell must not render NotFoundPage inside shell');
      assert.ok(appShellSection.includes('path="*" element={<Navigate to="/not-found" replace />}'), 'AppShell catch-all must route out to /not-found');
    });

    await st.test('4.3 ErrorPage does not render Sidebar, Header, Breadcrumbs or ERP shell', () => {
      const errorPage = fs.readFileSync(path.resolve(process.cwd(), 'client/src/pages/errors/ErrorPage.tsx'), 'utf-8');
      assert.ok(!errorPage.includes('<Sidebar'), 'ErrorPage must not render Sidebar');
      assert.ok(!errorPage.includes('<Header'), 'ErrorPage must not render Header');
      assert.ok(!errorPage.includes('import { Sidebar }'), 'ErrorPage must not import Sidebar');
      assert.ok(!errorPage.includes('import { Header }'), 'ErrorPage must not import Header');
      assert.ok(errorPage.includes('minHeight: \'100vh\''), 'ErrorPage renders full-viewport layout');
      assert.ok(errorPage.includes('getDefaultWorkspacePath'), 'ErrorPage resolves role-appropriate workspace path');
    });

    await st.test('4.4 Global ErrorBoundary renders ServerErrorPage standalone outside AppShell', () => {
      const errorBoundary = fs.readFileSync(path.resolve(process.cwd(), 'client/src/components/common/ErrorBoundary.tsx'), 'utf-8');
      assert.ok(errorBoundary.includes('<ServerErrorPage'), 'ErrorBoundary renders ServerErrorPage');
      assert.ok(!errorBoundary.includes('<AppShell'), 'ErrorBoundary does NOT wrap inside AppShell');
      assert.ok(!errorBoundary.includes('<Sidebar'), 'ErrorBoundary does NOT render Sidebar');

      // Wraps whole AppRoutes in App.tsx
      assert.ok(appTsx.includes('<ErrorBoundary>'), 'App.tsx wraps AppRoutes in ErrorBoundary');
    });
  });

  // ── 5. Error Pages Specific Actions & Contracts ───────────────────────────
  await t.test('5. Error Pages Specific Actions & Contracts', async (st) => {
    await st.test('5.1 401 Unauthorized page provides explicit Sign In action', () => {
      const unauth = fs.readFileSync(path.resolve(process.cwd(), 'client/src/pages/errors/UnauthorizedPage.tsx'), 'utf-8');
      assert.ok(unauth.includes('badgeText="Session Required"'), '401 has Session Required badge');
      assert.ok(unauth.includes('label: \'Sign In\''), '401 provides explicit Sign In action');
      assert.ok(!unauth.includes('alert('), '401 does not use alert()');
    });

    await st.test('5.2 403 Forbidden page provides Return to Workspace and Go Back without logging out', () => {
      const forbidden = fs.readFileSync(path.resolve(process.cwd(), 'client/src/pages/errors/ForbiddenPage.tsx'), 'utf-8');
      assert.ok(forbidden.includes('badgeText="Access Restricted"'), '403 has Access Restricted badge');
      assert.ok(forbidden.includes('label: \'Return to Workspace\''), '403 has Return to Workspace action');
      assert.ok(forbidden.includes('label: \'Go Back\''), '403 has Go Back action');
      assert.ok(!forbidden.includes('logout()'), '403 does not log out user');
    });

    await st.test('5.3 404 Not Found page provides Return to Workspace and Go Back', () => {
      const notFound = fs.readFileSync(path.resolve(process.cwd(), 'client/src/pages/errors/NotFoundPage.tsx'), 'utf-8');
      assert.ok(notFound.includes('badgeText="Page Not Found"'), '404 has Page Not Found badge');
      assert.ok(notFound.includes('label: \'Return to Workspace\''), '404 has Return to Workspace action');
      assert.ok(notFound.includes('label: \'Go Back\''), '404 has Go Back action');
    });

    await st.test('5.4 500 Server Error page provides Try Again and Return to Workspace with zero leak', () => {
      const serverError = fs.readFileSync(path.resolve(process.cwd(), 'client/src/pages/errors/ServerErrorPage.tsx'), 'utf-8');
      assert.ok(serverError.includes('badgeText="Something Went Wrong"'), '500 has Something Went Wrong badge');
      assert.ok(serverError.includes('label: \'Try Again\''), '500 has Try Again action');
      assert.ok(serverError.includes('label: \'Return to Workspace\''), '500 has Return to Workspace action');
      assert.ok(!serverError.includes('stack'), '500 does not expose stack traces');
    });
  });

  // ── 6. Safe Role-Based Workspace Routing (getDefaultWorkspacePath) ─────────
  await t.test('6. Safe Role-Based Workspace Routing (getDefaultWorkspacePath)', async (st) => {
    await st.test('6.1 Admin and HR Payroll Manager route to /dashboard', () => {
      assert.equal(getDefaultWorkspacePath('Admin', true), '/dashboard');
      assert.equal(getDefaultWorkspacePath('HR Payroll Manager', true), '/dashboard');
    });

    await st.test('6.2 Unauthenticated user safely routes to /login', () => {
      assert.equal(getDefaultWorkspacePath(null, false), '/login');
      assert.equal(getDefaultWorkspacePath(undefined, false), '/login');
      assert.equal(getDefaultWorkspacePath('Employee', false), '/login');
    });

    await st.test('6.3 Role check fallback avoids broken routes', () => {
      assert.equal(getDefaultWorkspacePath('Employee', true), '/dashboard');
    });
  });

  // ── 7. Global Color Theme System: Deep Teal Palette ───────────────────────
  await t.test('7. Global Color Theme System: Deep Teal Palette', async (st) => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'client/src/App.css'), 'utf-8');

    await st.test('7.1 Deep Teal CSS tokens configured in :root and dark mode', () => {
      assert.ok(css.includes('--primary: #0f766e;'), 'Primary is Deep Teal #0f766e in light mode');
      assert.ok(css.includes('--primary-light: rgba(15, 118, 110, 0.08);'), 'Primary light is rgba(15, 118, 110, 0.08)');
      assert.ok(css.includes('--primary-border: rgba(15, 118, 110, 0.2);'), 'Primary border is rgba(15, 118, 110, 0.2)');
      assert.ok(css.includes('--primary: #14b8a6;'), 'Primary is #14b8a6 in dark mode');
      assert.ok(css.includes('background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%);'), 'Brand logo uses teal gradient');
    });

    await st.test('7.2 Zero legacy dominant purple/indigo hexes in App.css', () => {
      const legacyHexes = ['#4f46e5', '#6366f1', '#4338ca', '#7c3aed', '#6d28d9'];
      for (const hex of legacyHexes) {
        assert.ok(!css.includes(hex), `App.css must not contain legacy color ${hex}`);
      }
    });

    await st.test('7.3 Zero legacy purple hexes across core UI components', () => {
      const files = [
        'client/src/pages/Login.tsx',
        'client/src/pages/Employees.tsx',
        'client/src/pages/SalaryStructures.tsx',
        'client/src/pages/Settings.tsx',
        'client/src/components/Header.tsx',
        'client/src/components/DetailedPayslipModal.tsx',
        'client/src/components/dashboard/AttendanceAnalytics.tsx',
        'client/src/components/dashboard/PayrollBreakdownChart.tsx',
        'client/src/components/dashboard/PayrollStatusChart.tsx',
        'client/src/components/dashboard/PayrollTrendChart.tsx',
        'client/src/components/dashboard/TimeOffAnalytics.tsx',
      ];
      const legacyHexes = ['#4f46e5', '#6366f1', '#4338ca', '#7c3aed', '#6d28d9'];

      for (const file of files) {
        const content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf-8');
        for (const hex of legacyHexes) {
          assert.ok(!content.includes(hex), `${file} must not contain legacy color ${hex}`);
        }
      }
    });
  });
});

