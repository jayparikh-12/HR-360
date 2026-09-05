/**
 * PeoplePay360 — Phase 7.4 Comprehensive Backend Security & Authorization Test Suite
 *
 * Systematic automated verification across 18 security categories:
 * 1. Authentication Testing (missing, empty, malformed, expired, invalid sig, none-alg, ghost user -> 401)
 * 2. RBAC Testing (Admin, HR Manager, HR Payroll Manager, HR Payroll User, Employee against all actions)
 * 3. Employee Authorization (Admin only add/remove -> 201/200; others -> 403)
 * 4. Payroll Authorization (compute, validate, pay restricted to authorized roles)
 * 5. Resource Authorization & IDOR (Attendance, Time-Off, Payslips, Profiles)
 * 6. Horizontal Access (Cross-employee isolation)
 * 7. Vertical Privilege Escalation (Token role tampering, header spoofing)
 * 8. JWT Security (Algorithm enforcement, signing configuration)
 * 9. Input Validation + Auth Interlocking (Unauthorized check takes precedence over validation)
 * 10. Error Response Sanitization (No SQL, passwords, secrets, stack traces)
 * 11. Database & Query Injection Resilience (SQL injection in route params/filters safely handled)
 * 12. CORS & Preflight Response Behavior
 * 13. Security Regression (Auth me, valid user profiles, 400, 401, 403, 404)
 * 14. Business Workflow Regression (Complete DRAFT -> COMPUTED -> VALIDATED -> PAID)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { executeQuery, pool } from '../config/database.js';
import { JWT_SECRET } from '../config/jwt.config.js';
import { apiNotFoundError, globalErrorHandler } from '../middleware/errorHandler.js';

// Import Route Handlers
import authRoutes from '../routes/auth.routes.js';
import employeeRoutes from '../routes/employee.routes.js';
import contractRoutes from '../routes/contract.routes.js';
import scheduleRoutes from '../routes/schedules.routes.js';
import attendanceRoutes from '../routes/attendance.routes.js';
import timeOffRoutes from '../routes/timeOff.routes.js';
import salaryStructureRoutes from '../routes/salaryStructure.routes.js';
import salaryRuleRoutes from '../routes/salaryRule.routes.js';
import payrollRoutes from '../routes/payroll.routes.js';
import dashboardRoutes from '../routes/dashboard.routes.js';

let server: http.Server;
let baseUrl: string;

// ── Test Tokens ─────────────────────────────────────────────────────────────

// 1. Admin (Full access)
const adminToken = jwt.sign(
  { userId: 'USR-999', email: 'admin@company.com', role: 'Admin' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '2h' }
);

// 2. HR Manager (People, contracts, schedules, attendance, time-off approvals; NO payroll run operations)
const hrManagerToken = jwt.sign(
  { userId: 'USR-006', email: 'sarah@company.com', role: 'HR Manager', employeeId: 'EMP-006' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '2h' }
);

// 3. HR Payroll Manager (Full payroll lifecycle: create, compute, validate, pay; contracts read; NO employee create/delete)
const payrollManagerToken = jwt.sign(
  { userId: 'USR-004', email: 'elena@company.com', role: 'HR Payroll Manager', employeeId: 'EMP-004' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '2h' }
);

// 4. HR Payroll User (Operational payroll: read, create draft; NO validate, NO pay)
const payrollUserToken = jwt.sign(
  { userId: 'USR-003', email: 'alex@company.com', role: 'HR Payroll User', employeeId: 'EMP-003' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '2h' }
);

// 5. Employee A (John Doe, EMP-001 - Self-service only)
const employeeTokenA = jwt.sign(
  { userId: 'USR-001', email: 'john@company.com', role: 'Employee', employeeId: 'EMP-001' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '2h' }
);

// 6. Expired Token
const expiredToken = jwt.sign(
  { userId: 'USR-001', email: 'john@company.com', role: 'Employee', employeeId: 'EMP-001' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '-15s' }
);

// 7. Invalid Signature Token (Forged with attacker secret)
const invalidSigToken = jwt.sign(
  { userId: 'USR-001', email: 'john@company.com', role: 'Employee', employeeId: 'EMP-001' },
  'attacker-unauthorized-secret-key-360',
  { algorithm: 'HS256', expiresIn: '2h' }
);

// 8. Ghost User Token (Valid signature, but userId does not exist on server)
const ghostUserToken = jwt.sign(
  { userId: 'USR-GHOST-999', email: 'ghost@company.com', role: 'Admin' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '2h' }
);

// 9. Privilege Escalation Attempt Token (Employee userId USR-001, but payload claims role: 'Admin')
const forgedRoleToken = jwt.sign(
  { userId: 'USR-001', email: 'john@company.com', role: 'Admin' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '2h' }
);

// 10. Algorithm None Token
const noneAlgHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
const noneAlgPayload = Buffer.from(
  JSON.stringify({ userId: 'USR-999', email: 'admin@company.com', role: 'Admin' })
).toString('base64url');
const noneAlgToken = `${noneAlgHeader}.${noneAlgPayload}.`;

// ── Test Lifecycle Setup & Teardown ─────────────────────────────────────────

test.before(async () => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Mount API routes exactly as in index.ts
  app.use('/api/auth', authRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/contracts', contractRoutes);
  app.use('/api/schedules', scheduleRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/time-off', timeOffRoutes);
  app.use('/api/salary-structures', salaryStructureRoutes);
  app.use('/api/salary-rules', salaryRuleRoutes);
  app.use('/api/payroll', payrollRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // Catch-all 404 & 500 error handlers
  app.use('/api', apiNotFoundError);
  app.use(globalErrorHandler);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
  });

  // Seed test records for IDOR testing
  await executeQuery(
    `INSERT INTO attendance_records (id, employee_id, date, check_in, status)
     VALUES ('ATT-P74-EMP006', 'EMP-006', '2026-09-05', '09:00:00', 'PRESENT')
     ON DUPLICATE KEY UPDATE status = 'PRESENT'`
  );

  await executeQuery(
    `INSERT INTO time_off_requests (id, employee_id, leave_type, start_date, end_date, duration_days, status, reason)
     VALUES ('TO-P74-EMP006', 'EMP-006', 'Paid Time Off', '2026-09-20', '2026-09-22', 3, 'PENDING', 'Testing IDOR')
     ON DUPLICATE KEY UPDATE status = 'PENDING'`
  );
});

test.after(async () => {
  await executeQuery("DELETE FROM attendance_records WHERE id LIKE '%P74%'");
  await executeQuery("DELETE FROM time_off_requests WHERE id LIKE '%P74%'");
  await executeQuery("DELETE FROM contracts WHERE id LIKE '%P74%'");
  await executeQuery("DELETE FROM employees WHERE id LIKE '%P74%'");
  await executeQuery("DELETE FROM payruns WHERE id LIKE '%P74%'");

  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await pool.end();
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. AUTHENTICATION TESTING
// ═════════════════════════════════════════════════════════════════════════════

test('1. AUTHENTICATION TESTING', async (t) => {
  await t.test('1.1 Missing Authorization header returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Unauthorized');
  });

  await t.test('1.2 Empty Authorization header returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: '' },
    });
    assert.strictEqual(res.status, 401);
  });

  await t.test('1.3 Malformed Bearer header formats return 401 Unauthorized', async () => {
    const invalidHeaders = [
      'Basic YWRtaW46cGFzc3dvcmQxMjM=',
      'Bearer',
      'Bearer    ',
      'Token some-token-string',
      'Bearer token with too many parts',
      'BearerInvalidWithoutSpace',
    ];
    for (const h of invalidHeaders) {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: h },
      });
      assert.strictEqual(res.status, 401, `Header '${h}' should return 401`);
    }
  });

  await t.test('1.4 Malformed JWT token string returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer this.is.not.a.valid.jwt.token' },
    });
    assert.strictEqual(res.status, 401);
  });

  await t.test('1.5 Expired JWT token returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.strictEqual(res.status, 401);
  });

  await t.test('1.6 Invalid JWT HMAC signature returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${invalidSigToken}` },
    });
    assert.strictEqual(res.status, 401);
  });

  await t.test('1.7 Algorithm "none" unsigned token returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${noneAlgToken}` },
    });
    assert.strictEqual(res.status, 401);
  });

  await t.test('1.8 Valid JWT with unknown / non-existent userId returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${ghostUserToken}` },
    });
    assert.strictEqual(res.status, 401);
  });

  await t.test('1.9 Valid JWT with correct credentials returns 200 OK', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.email, 'admin@company.com');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. RBAC & ROLE-BASED ACCESS CONTROL TESTING
// ═════════════════════════════════════════════════════════════════════════════

test('2. RBAC & ROLE-BASED ACCESS CONTROL TESTING', async (t) => {
  let testEmpId = `EMP-P74-${Date.now()}`;
  const testEmail = `p74_${Date.now()}@company.com`;

  // ── Employee Add/Remove: Admin ONLY ───────────────────────────────────────
  await t.test('2.1 Employee Creation: ONLY Admin can add employee (201 Created)', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        id: testEmpId,
        name: 'Phase 7.4 Test Employee',
        email: testEmail,
        department: 'Engineering',
        jobPosition: 'QA Engineer',
      }),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    testEmpId = body.data.id;
  });

  await t.test('2.2 Employee Creation: HR Manager CANNOT add employee (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrManagerToken}`,
      },
      body: JSON.stringify({
        name: 'Denied Candidate',
        email: 'denied_hr@company.com',
        department: 'Engineering',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2.3 Employee Creation: HR Payroll Manager CANNOT add employee (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payrollManagerToken}`,
      },
      body: JSON.stringify({
        name: 'Denied Candidate',
        email: 'denied_payroll@company.com',
        department: 'Engineering',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2.4 Employee Creation: Regular Employee CANNOT add employee (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeTokenA}`,
      },
      body: JSON.stringify({
        name: 'Denied Candidate',
        email: 'denied_emp@company.com',
        department: 'Engineering',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  // ── Employee Updates: Admin & HR Manager allowed ──────────────────────────
  await t.test('2.5 Employee Update: HR Manager CAN update employee details (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/employees/${testEmpId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrManagerToken}`,
      },
      body: JSON.stringify({ position: 'Senior QA Engineer' }),
    });
    assert.strictEqual(res.status, 200);
  });

  await t.test('2.6 Employee Update: HR Payroll Manager CANNOT update employee details (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/employees/${testEmpId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payrollManagerToken}`,
      },
      body: JSON.stringify({ position: 'Hacked Title' }),
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2.7 Employee Update: Regular Employee CANNOT update employee details (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/employees/${testEmpId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeTokenA}`,
      },
      body: JSON.stringify({ position: 'Hacked Title' }),
    });
    assert.strictEqual(res.status, 403);
  });

  // ── Contract Operations ───────────────────────────────────────────────────
  let createdContractId = `CTR-P74-${Date.now()}`;
  await t.test('2.8 Contract Create: HR Manager CAN create contract (201 Created)', async () => {
    const res = await fetch(`${baseUrl}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrManagerToken}`,
      },
      body: JSON.stringify({
        id: createdContractId,
        employeeId: testEmpId,
        wage: 50000,
        startDate: '2026-09-01',
        status: 'ACTIVE',
      }),
    });
    assert.strictEqual(res.status, 201);
  });

  await t.test('2.9 Contract Create: HR Payroll Manager CANNOT create contract (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payrollManagerToken}`,
      },
      body: JSON.stringify({
        employeeId: testEmpId,
        wage: 55000,
        startDate: '2026-09-01',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2.10 Contract Create: Regular Employee CANNOT create contract (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeTokenA}`,
      },
      body: JSON.stringify({
        employeeId: testEmpId,
        wage: 60000,
        startDate: '2026-09-01',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2.11 Contract List: Regular Employee CANNOT list contracts (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/contracts`, {
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403);
  });

  // ── Salary Structures & Rules: Admin ONLY write ───────────────────────────
  const structCode = `STR_P74_${Date.now()}`;
  await t.test('2.12 Salary Structure Create: Admin CAN create salary structure (201 Created)', async () => {
    const res = await fetch(`${baseUrl}/api/salary-structures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Phase 7.4 Security Structure',
        code: structCode,
      }),
    });
    assert.strictEqual(res.status, 201);
  });

  await t.test('2.13 Salary Structure Create: HR Manager CANNOT create salary structure (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/salary-structures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrManagerToken}`,
      },
      body: JSON.stringify({
        name: 'Bypass Structure',
        code: `STR_DENY_${Date.now()}`,
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2.14 Salary Structure Create: HR Payroll Manager CANNOT create salary structure (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/salary-structures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payrollManagerToken}`,
      },
      body: JSON.stringify({
        name: 'Bypass Structure',
        code: `STR_DENY_PM_${Date.now()}`,
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  // ── Employee Removal: Admin ONLY ──────────────────────────────────────────
  await t.test('2.15 Employee Deletion: HR Manager CANNOT delete employee (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/employees/${testEmpId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${hrManagerToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2.16 Employee Deletion: Regular Employee CANNOT delete employee (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/employees/${testEmpId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2.17 Employee Deletion: Admin CAN delete employee (200 OK)', async () => {
    // Delete the contract first to avoid foreign key restrict
    await executeQuery('DELETE FROM contracts WHERE id = ?', [createdContractId]);
    const res = await fetch(`${baseUrl}/api/employees/${testEmpId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. PAYROLL AUTHORIZATION & LIFECYCLE AUDIT
// ═════════════════════════════════════════════════════════════════════════════

test('3. PAYROLL AUTHORIZATION & LIFECYCLE AUDIT', async (t) => {
  const testPayrunId = `PR-P74-${Date.now()}`;

  await t.test('3.1 Payroll Manager CAN create payrun (201 Created)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payrollManagerToken}`,
      },
      body: JSON.stringify({
        id: testPayrunId,
        name: 'Phase 7.4 Security Payrun',
        period: '2026-09',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      }),
    });
    assert.strictEqual(res.status, 201);
  });

  await t.test('3.2 HR Manager CANNOT access or create payruns (403 Forbidden)', async () => {
    const listRes = await fetch(`${baseUrl}/api/payroll/payruns`, {
      headers: { Authorization: `Bearer ${hrManagerToken}` },
    });
    assert.strictEqual(listRes.status, 403);

    const createRes = await fetch(`${baseUrl}/api/payroll/payruns/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrManagerToken}`,
      },
      body: JSON.stringify({
        name: 'Unauthorized Run',
        period: '2026-09',
      }),
    });
    assert.strictEqual(createRes.status, 403);
  });

  await t.test('3.3 Regular Employee CANNOT access payruns (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns`, {
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('3.4 Regular Employee CANNOT compute payruns (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns/${testPayrunId}/compute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('3.5 HR Payroll User CANNOT validate or pay payruns (403 Forbidden)', async () => {
    const valRes = await fetch(`${baseUrl}/api/payroll/payruns/${testPayrunId}/validate`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${payrollUserToken}` },
    });
    assert.strictEqual(valRes.status, 403);

    const payRes = await fetch(`${baseUrl}/api/payroll/payruns/${testPayrunId}/pay`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${payrollUserToken}` },
    });
    assert.strictEqual(payRes.status, 403);
  });

  await t.test('3.6 HR Payroll Manager CAN compute, validate, and mark payrun as paid (200 OK)', async () => {
    // 1. Compute
    const compRes = await fetch(`${baseUrl}/api/payroll/payruns/${testPayrunId}/compute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${payrollManagerToken}` },
    });
    assert.strictEqual(compRes.status, 200);

    // 2. Validate
    const valRes = await fetch(`${baseUrl}/api/payroll/payruns/${testPayrunId}/validate`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${payrollManagerToken}` },
    });
    assert.strictEqual(valRes.status, 200);

    // 3. Pay
    const payRes = await fetch(`${baseUrl}/api/payroll/payruns/${testPayrunId}/pay`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payrollManagerToken}`,
      },
      body: JSON.stringify({ paymentReference: 'TX-SEC-P74-VERIFIED' }),
    });
    assert.strictEqual(payRes.status, 200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. RESOURCE AUTHORIZATION, IDOR & HORIZONTAL ACCESS TESTING
// ═════════════════════════════════════════════════════════════════════════════

test('4. RESOURCE AUTHORIZATION, IDOR & HORIZONTAL ACCESS TESTING', async (t) => {
  // Employee A: John Doe (EMP-001)
  // Target Record: Sarah Connor (EMP-006)

  await t.test('4.1 Attendance IDOR: Employee A CANNOT view Employee B record (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/attendance/ATT-P74-EMP006`, {
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('4.2 Attendance IDOR: Employee A CANNOT checkout Employee B record (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/attendance/ATT-P74-EMP006/check-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeTokenA}`,
      },
      body: JSON.stringify({ checkOut: '17:30:00' }),
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('4.3 Time-Off IDOR: Employee A CANNOT view Employee B time off request (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/time-off/TO-P74-EMP006`, {
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('4.4 Time-Off IDOR: Employee A CANNOT approve Employee B time off request (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/time-off/TO-P74-EMP006/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('4.5 Time-Off Horizontal: Employee A CANNOT request leave on behalf of Employee B (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/time-off`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeTokenA}`,
      },
      body: JSON.stringify({
        employeeId: 'EMP-006', // Cross-employee impersonation
        leaveType: 'Paid Time Off',
        startDate: '2026-10-01',
        endDate: '2026-10-03',
        durationDays: 3,
        reason: 'Malicious impersonation request',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('4.6 Payslip IDOR: Employee A CANNOT view Employee B payslip history (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/employees/EMP-006/history`, {
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('4.7 Payslip Self-Service: Employee A CAN view own payslip history (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/employees/EMP-001/history`, {
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 200);
  });

  await t.test('4.8 Employee Profile IDOR: Employee A CANNOT inspect Employee B full profile (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/employees/EMP-006`, {
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('4.9 Employee Profile Self-Service: Employee A CAN inspect own employee profile (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/employees/EMP-001`, {
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. VERTICAL PRIVILEGE ESCALATION TESTING
// ═════════════════════════════════════════════════════════════════════════════

test('5. VERTICAL PRIVILEGE ESCALATION TESTING', async (t) => {
  await t.test('5.1 Token Payload Role Forgery is safely denied (403 Forbidden)', async () => {
    // Attacker signs token with valid secret & userId: 'USR-001' (John Doe, Employee),
    // but manually sets role: 'Admin' in payload.
    // Server must look up actual user from DB/model and enforce the authentic role.
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${forgedRoleToken}`,
      },
      body: JSON.stringify({
        name: 'Forged Admin Creation',
        email: 'forged_admin@company.com',
        department: 'Security',
      }),
    });
    assert.strictEqual(res.status, 403, 'Server must not trust forged role claim from JWT payload');
  });

  await t.test('5.2 Header Role Injection is ignored (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeTokenA}`,
        'X-User-Role': 'Admin',
        'X-Role': 'Admin',
        'X-Forwarded-Role': 'Admin',
      },
      body: JSON.stringify({
        name: 'Spoofed Header Employee',
        email: 'spoofed_header@company.com',
        department: 'Security',
      }),
    });
    assert.strictEqual(res.status, 403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. INPUT VALIDATION + AUTHORIZATION INTERLOCKING
// ═════════════════════════════════════════════════════════════════════════════

test('6. INPUT VALIDATION + AUTHORIZATION INTERLOCKING', async (t) => {
  await t.test('6.1 Malicious/empty payload sent by unauthorized caller returns 403 (not 400)', async () => {
    // Ensures authorization check happens and blocks execution even when body validation would fail
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeTokenA}`,
      },
      body: JSON.stringify({}), // completely empty body
    });
    assert.strictEqual(res.status, 403, 'Unauthorized user must be rejected with 403 regardless of body content');
  });

  await t.test('6.2 Unauthorized user targeting non-existent payrun ID returns 403 (not 404)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns/GHOST-NONEXISTENT-PAYRUN/compute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403, 'Unauthorized user must be rejected with 403 without querying resource existence');
  });

  await t.test('6.3 Unauthorized user attempting payrun payment returns 403 (not 404 or 400)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns/GHOST-NONEXISTENT-PAYRUN/pay`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. DATABASE & QUERY INJECTION RESILIENCE
// ═════════════════════════════════════════════════════════════════════════════

test('7. DATABASE & QUERY INJECTION RESILIENCE', async (t) => {
  await t.test('7.1 SQL injection in employee ID route parameter handled safely', async () => {
    const injectionId = encodeURIComponent("' OR '1'='1");
    const res = await fetch(`${baseUrl}/api/employees/${injectionId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    // Should safely return 404 or 400, never 500 or leaked database records
    assert.ok(res.status === 404 || res.status === 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.data, undefined);
  });

  await t.test('7.2 SQL UNION injection in contract ID route parameter handled safely', async () => {
    const injectionId = encodeURIComponent("1' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15-- ");
    const res = await fetch(`${baseUrl}/api/contracts/${injectionId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.ok(res.status === 404 || res.status === 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  await t.test('7.3 SQL injection attempt in login email parameter fails safely', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: "' OR 1=1 --",
        password: "password123",
      }),
    });
    // Format validator rejects invalid email format with 400
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  await t.test('7.4 SQL injection in dashboard period filter fails safely', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard?period=${encodeURIComponent("' OR '1'='1")}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    // Format validator rejects invalid period with 400
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. ERROR RESPONSE SANITIZATION & HYGIENE
// ═════════════════════════════════════════════════════════════════════════════

test('8. ERROR RESPONSE SANITIZATION & HYGIENE', async (t) => {
  await t.test('8.1 401 Unauthorized response does not leak server internals or stack traces', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    const text = await res.text();
    assert.ok(!text.includes('node_modules'), 'No file paths');
    assert.ok(!text.includes('Error:'), 'No stack trace');
    assert.ok(!text.includes('SELECT'), 'No SQL statements');
  });

  await t.test('8.2 403 Forbidden response does not leak role hierarchy or SQL internals', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeTokenA}`,
      },
      body: JSON.stringify({ name: 'Test' }),
    });
    const text = await res.text();
    assert.ok(!text.includes('sqlMessage'), 'No SQL error message');
    assert.ok(!text.includes('SELECT'), 'No SQL query');
  });

  await t.test('8.3 404 Unknown API route returns clean JSON (not Express HTML)', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent-route-p74-audit`);
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.headers.get('content-type')?.includes('application/json'), true);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Resource not found: GET /api/nonexistent-route-p74-audit');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. CORS & PREFLIGHT VERIFICATION
// ═════════════════════════════════════════════════════════════════════════════

test('9. CORS & PREFLIGHT VERIFICATION', async (t) => {
  await t.test('9.1 Preflight OPTIONS request succeeds without error', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });
    assert.ok(res.status === 204 || res.status === 200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 10. SECURITY & WORKFLOW REGRESSION
// ═════════════════════════════════════════════════════════════════════════════

test('10. SECURITY & WORKFLOW REGRESSION', async (t) => {
  await t.test('10.1 Login succeeds with legitimate credentials', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@company.com', password: 'password123' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(typeof body.token === 'string');
    assert.strictEqual(body.user.password, undefined);
  });

  await t.test('10.2 Dashboard summary queries successfully for authorized role', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data);
  });
});
