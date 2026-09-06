/**
 * PeoplePay360 — Direct Entry Flow & Enterprise Login Redesign Test Suite
 * 
 * Verifies:
 * 1. Root routing flow:
 *    - Unauthenticated opening of '/' renders Login directly
 *    - Authenticated opening of '/' navigates to authorized workspace
 *    - Explicit '/login' routes to Login (or workspace when authenticated)
 *    - Legacy '/landing' redirects to '/'
 *    - Standalone error routes (/unauthorized, /forbidden, /not-found, /server-error) remain standalone
 *    - Zero references to obsolete Landing.tsx or Landing component
 * 2. Enterprise Login Page Redesign:
 *    - Professional PeoplePay360 branding
 *    - Product capabilities informational panel contains all 6 required modules:
 *      * Employee Management
 *      * Attendance Tracking
 *      * Leave & Time-Off
 *      * Contract Management
 *      * Payroll Processing
 *      * Payslips & Reporting
 *    - Informational features panel is non-interactive / non-marketing (no landing CTAs)
 *    - Absolutely NO "Remember Me" checkbox
 *    - Zero hardcoded credentials or demo login buttons
 *    - Zero purple/indigo dominant styling in Login.tsx
 *    - Input validation, loading states, password visibility toggle, error alert handling
 * 3. Responsive Desktop / Mobile Layout:
 *    - Desktop dual-panel container (.login-split-container, .login-features-panel, .login-form-panel)
 *    - Responsive media queries prioritizing login card on mobile screens
 *    - Obsolete pre-auth landing page CSS completely purged
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getDefaultWorkspacePath, isTabAllowed } from '../utils/routes';

test('PEOPLEPAY360 — DIRECT ENTRY FLOW & LOGIN REDESIGN SUITE', async (t) => {
  console.log('\n================================================================');
  console.log('🔐 PEOPLEPAY360 — ENTRY FLOW & ENTERPRISE LOGIN AUDIT 🔐');
  console.log('================================================================\n');

  const appTsx = fs.readFileSync(path.resolve(process.cwd(), 'client/src/App.tsx'), 'utf-8');
  const loginTsx = fs.readFileSync(path.resolve(process.cwd(), 'client/src/pages/Login.tsx'), 'utf-8');
  const appCss = fs.readFileSync(path.resolve(process.cwd(), 'client/src/App.css'), 'utf-8');

  // ── 1. Routing Architecture & Immediate Login Entry ────────────────────────
  await t.test('1. Application Entry Flow & Routing Architecture', async (st) => {
    await st.test('1.1 Root route "/" renders Login when unauthenticated and workspace when authenticated', () => {
      // Must not render Landing
      assert.ok(!appTsx.includes('<Landing'), 'App.tsx must not render Landing component');
      assert.ok(!appTsx.includes("import { Landing }"), 'App.tsx must not import Landing');
      
      // Verify root route logic
      assert.ok(
        appTsx.includes('path="/"') && appTsx.includes('isAuthenticated ? <Navigate to={destination} replace /> : <Login />'),
        'Root route "/" must render Login for unauthenticated visits and redirect to destination when authenticated'
      );
    });

    await st.test('1.2 Route "/login" renders Login when unauthenticated and workspace when authenticated', () => {
      assert.ok(
        appTsx.includes('path="/login"') && appTsx.includes('isAuthenticated ? <Navigate to={destination} replace /> : <Login />'),
        'Route "/login" must render Login or redirect to workspace'
      );
    });

    await st.test('1.3 Legacy route "/landing" redirects to root "/"', () => {
      assert.ok(
        appTsx.includes('path="/landing"') && appTsx.includes('<Navigate to="/" replace />'),
        'Route "/landing" must redirect to "/"'
      );
    });

    await st.test('1.4 Standalone error routes remain independent outside AppShell', () => {
      const errorRoutes = ['/unauthorized', '/forbidden', '/not-found', '/server-error'];
      for (const r of errorRoutes) {
        assert.ok(appTsx.includes(`path="${r}"`), `App.tsx must define route ${r}`);
      }
    });

    await st.test('1.5 Obsolete Landing.tsx file is deleted from pages directory', () => {
      const landingPath = path.resolve(process.cwd(), 'client/src/pages/Landing.tsx');
      assert.strictEqual(fs.existsSync(landingPath), false, 'Landing.tsx must not exist in pages directory');
    });
  });

  // ── 2. Login Page Redesign & Enterprise Requirements ─────────────────────────
  await t.test('2. Login Page Redesign & Enterprise Requirements', async (st) => {
    await st.test('2.1 Zero "Remember Me" checkbox or remember-me token logic', () => {
      assert.ok(!loginTsx.toLowerCase().includes('remember me'), 'Login.tsx must not contain "Remember Me"');
      assert.ok(!loginTsx.toLowerCase().includes('remember-me'), 'Login.tsx must not contain "remember-me"');
      assert.ok(!loginTsx.toLowerCase().includes('remember_me'), 'Login.tsx must not contain "remember_me"');
    });

    await st.test('2.2 Zero hardcoded credentials or demo login buttons', () => {
      assert.ok(!loginTsx.includes('admin@company.com'), 'Login.tsx must not hardcode admin email');
      assert.ok(!loginTsx.includes('password123'), 'Login.tsx must not hardcode admin password');
      assert.ok(!loginTsx.toLowerCase().includes('demo account'), 'Login.tsx must not have demo account buttons');
      assert.ok(!loginTsx.toLowerCase().includes('quick login'), 'Login.tsx must not have quick login buttons');
    });

    await st.test('2.3 Product capabilities panel lists all 6 required capabilities', () => {
      const requiredCapabilities = [
        'Employee Management',
        'Attendance Tracking',
        'Leave & Time-Off',
        'Contract Management',
        'Payroll Processing',
        'Payslips & Reporting',
      ];
      for (const cap of requiredCapabilities) {
        assert.ok(loginTsx.includes(cap), `Login.tsx capabilities panel must include "${cap}"`);
      }
    });

    await st.test('2.4 Features panel is informational only (no marketing landing buttons)', () => {
      assert.ok(!loginTsx.includes('landing-hero'), 'Login.tsx must not use landing-hero classes');
      assert.ok(!loginTsx.includes('landing-cta'), 'Login.tsx must not contain landing CTAs');
    });

    await st.test('2.5 Form validation, loading state, error alert, and password visibility toggle present', () => {
      assert.ok(loginTsx.includes('handleSubmit'), 'Login.tsx must handle submit');
      assert.ok(loginTsx.includes('isLoading'), 'Login.tsx must handle loading state');
      assert.ok(loginTsx.includes('errorMessage'), 'Login.tsx must display error messages');
      assert.ok(loginTsx.includes('showPassword'), 'Login.tsx must provide password reveal toggle');
      assert.ok(loginTsx.includes('normalizedEmail'), 'Login.tsx must sanitize and validate email');
      assert.ok(loginTsx.includes('trimmedPassword'), 'Login.tsx must validate password presence');
    });

    await st.test('2.6 Zero legacy purple/indigo hexes in Login.tsx', () => {
      const legacyPurpleHexes = ['#4f46e5', '#6366f1', '#4338ca', '#7c3aed', '#6d28d9'];
      for (const hex of legacyPurpleHexes) {
        assert.ok(!loginTsx.includes(hex), `Login.tsx must not contain legacy color ${hex}`);
      }
    });
  });

  // ── 3. CSS Styles & Responsive Architecture ────────────────────────────────
  await t.test('3. CSS Styles & Responsive Architecture', async (st) => {
    await st.test('3.1 Modern dual-panel classes exist in App.css', () => {
      assert.ok(appCss.includes('.login-split-container'), 'App.css must have .login-split-container');
      assert.ok(appCss.includes('.login-features-panel'), 'App.css must have .login-features-panel');
      assert.ok(appCss.includes('.login-form-panel'), 'App.css must have .login-form-panel');
      assert.ok(appCss.includes('.login-capabilities-grid'), 'App.css must have .login-capabilities-grid');
    });

    await st.test('3.2 Mobile responsiveness hides features panel and prioritizes login card', () => {
      assert.ok(
        appCss.includes('.login-features-panel {\n    display: none;') || 
        appCss.includes('.login-features-panel {\r\n    display: none;'),
        'App.css must hide .login-features-panel on smaller viewports'
      );
      assert.ok(
        appCss.includes('.login-mobile-header {\n    display: flex;') ||
        appCss.includes('.login-mobile-header {\r\n    display: flex;'),
        'App.css must display .login-mobile-header on mobile'
      );
    });

    await st.test('3.3 Obsolete pre-auth landing page CSS classes are completely removed', () => {
      const obsoleteLandingClasses = [
        '.landing-container',
        '.landing-navbar',
        '.landing-hero',
        '.landing-features-grid',
        '.landing-preview-tab',
        '.landing-benefits-grid',
        '.landing-cta-section',
        '.landing-footer',
      ];
      for (const cls of obsoleteLandingClasses) {
        assert.ok(!appCss.includes(cls), `App.css must not contain obsolete landing class ${cls}`);
      }
    });

    await st.test('3.4 Zero legacy dominant purple/indigo hexes in App.css', () => {
      const legacyPurpleHexes = ['#4f46e5', '#6366f1', '#4338ca', '#7c3aed', '#6d28d9'];
      for (const hex of legacyPurpleHexes) {
        assert.ok(!appCss.includes(hex), `App.css must not contain legacy color ${hex}`);
      }
    });
  });

  // ── 4. Workspace Path Resolution Contract ──────────────────────────────────
  await t.test('4. Workspace Path Resolution Contract', async (st) => {
    await st.test('4.1 Unauthenticated state resolves to /login', () => {
      assert.strictEqual(getDefaultWorkspacePath('Admin', false), '/login');
      assert.strictEqual(getDefaultWorkspacePath(null, false), '/login');
    });

    await st.test('4.2 Authenticated roles resolve to appropriate workspaces', () => {
      assert.strictEqual(getDefaultWorkspacePath('Admin', true), '/dashboard');
      assert.strictEqual(getDefaultWorkspacePath('HR Manager', true), '/dashboard');
      assert.strictEqual(getDefaultWorkspacePath('HR Payroll Manager', true), '/dashboard');
      assert.strictEqual(getDefaultWorkspacePath('Employee', true), '/dashboard');
    });
  });

  // ── 5. Descendant Route Architecture & No 404 Bounce ──────────────────────
  await t.test('5. Descendant Route Architecture & No 404 Bounce', async (st) => {
    await st.test('5.1 AppShell is rendered under a wildcard path "/*" in AppRoutes', () => {
      assert.ok(
        appTsx.includes('path="/*"') && appTsx.includes('<ProtectedRoute>\n            <AppShell />\n          </ProtectedRoute>') ||
        appTsx.includes('path="/*"') && appTsx.includes('<ProtectedRoute>\r\n            <AppShell />\r\n          </ProtectedRoute>'),
        'AppRoutes must render AppShell using path="/*" so nested routes in AppShell match correctly'
      );
    });

    await st.test('5.2 ProtectedRoute redirects unauthenticated access to /login directly', () => {
      assert.ok(
        appTsx.includes('if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;'),
        'ProtectedRoute must redirect to /login directly with return state'
      );
    });
  });
});

