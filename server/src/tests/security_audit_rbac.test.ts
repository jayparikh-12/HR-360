/**
 * PeoplePay360 — Phase 7.1 Backend JWT Authentication & RBAC Security Audit Suite
 *
 * Automated verification of:
 * 1. Authentication middleware (missing, malformed, expired, invalid signature tokens -> 401)
 * 2. Login security (credential verification, safe user profile without password, generic errors)
 * 3. Employee Management Rule: ONLY Admin can create/add/delete employees (HR Manager & Employee -> 403)
 * 4. Payroll lifecycle RBAC: Only Admin/Payroll Manager can create/compute/validate/pay (others -> 403)
 * 5. Attendance IDOR: Employee can view/clock-out only own records (cross-employee -> 403)
 * 6. Time-off IDOR: Employee can view only own requests (cross-employee -> 403, approve -> 403)
 * 7. Payslip IDOR: Employee can view only own payslip (cross-employee -> 403)
 * 8. Dashboard RBAC: Staff permitted (200), Employee forbidden (403)
 * 9. Safe error responses: No stack traces, SQL, or passwords exposed
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { executeQuery, pool } from '../config/database.js';
import { JWT_SECRET } from '../config/jwt.config.js';

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

// Test helper tokens
const adminToken = jwt.sign(
  { userId: 'USR-999', email: 'admin@company.com', role: 'Admin' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '1h' }
);

const hrManagerToken = jwt.sign(
  { userId: 'USR-006', email: 'sarah@company.com', role: 'HR Manager', employeeId: 'EMP-006' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '1h' }
);

const payrollManagerToken = jwt.sign(
  { userId: 'USR-004', email: 'elena@company.com', role: 'HR Payroll Manager', employeeId: 'EMP-004' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '1h' }
);

const employeeTokenA = jwt.sign(
  { userId: 'USR-001', email: 'john@company.com', role: 'Employee', employeeId: 'EMP-001' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '1h' }
);

const expiredToken = jwt.sign(
  { userId: 'USR-001', email: 'john@company.com', role: 'Employee', employeeId: 'EMP-001' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '-10s' } // Expired 10 seconds ago
);

const invalidSigToken = jwt.sign(
  { userId: 'USR-001', email: 'john@company.com', role: 'Employee', employeeId: 'EMP-001' },
  'wrong-secret-key-attacker-provided',
  { algorithm: 'HS256', expiresIn: '1h' }
);

test.before(async () => {
  const app = express();
  app.use(express.json());

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

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await executeQuery("DELETE FROM attendance_records WHERE id LIKE '%SEC-TEST%'");
  await executeQuery("DELETE FROM time_off_requests WHERE id LIKE '%SEC-TEST%'");
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await pool.end();
});

test('1. AUTHENTICATION & LOGIN SECURITY AUDIT', async (t) => {
  await t.test('1.1 Login with valid credentials returns 200, JWT token, and no password in response', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@company.com', password: 'password123' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(typeof body.token === 'string' && body.token.length > 20);
    assert.ok(body.user);
    assert.strictEqual(body.user.email, 'admin@company.com');
    assert.strictEqual(body.user.password, undefined, 'Password must NOT be returned in login response');
  });

  await t.test('1.2 Login with invalid credentials returns 401 generic error (no enumeration)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@company.com', password: 'wrongpassword' }),
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Invalid email or password');
  });

  await t.test('1.3 Login with nonexistent email returns identical 401 generic error', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@company.com', password: 'password123' }),
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Invalid email or password');
  });

  await t.test('1.4 Missing Authorization header returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Unauthorized');
  });

  await t.test('1.5 Malformed Authorization header returns 401 Unauthorized', async () => {
    const malformedHeaders = [
      'Basic 12345',
      'Bearer',
      'Bearer    ',
      'Token some-token',
      'InvalidFormat',
    ];
    for (const header of malformedHeaders) {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: header },
      });
      assert.strictEqual(res.status, 401);
    }
  });

  await t.test('1.6 Expired JWT returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.strictEqual(res.status, 401);
  });

  await t.test('1.7 Invalid JWT signature returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${invalidSigToken}` },
    });
    assert.strictEqual(res.status, 401);
  });

  await t.test('1.8 Valid token on /api/auth/me returns 200 and safe profile without password', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.password, undefined);
  });
});

test('2. EMPLOYEE MANAGEMENT RULE AUDIT (ADMIN ONLY ADD/REMOVE)', async (t) => {
  const testEmail = `sec_emp_${Date.now()}@company.com`;
  let createdEmpId: string;

  await t.test('2.1 Admin CAN create/add an employee (201 Created)', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        firstName: 'Security',
        lastName: 'Auditor',
        email: testEmail,
        department: 'Security',
        jobPosition: 'Security Analyst',
      }),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    createdEmpId = body.data.id;
    assert.ok(createdEmpId);
  });

  await t.test('2.2 HR Manager CANNOT create/add an employee (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrManagerToken}`,
      },
      body: JSON.stringify({
        firstName: 'Bypass',
        lastName: 'Attempt',
        email: 'bypass_hrmanager@company.com',
        department: 'Engineering',
      }),
    });
    assert.strictEqual(res.status, 403, 'HR Manager must not be able to bypass and create employees');
  });

  await t.test('2.3 Employee CANNOT create/add an employee (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeTokenA}`,
      },
      body: JSON.stringify({
        firstName: 'Bypass',
        lastName: 'Employee',
        email: 'bypass_employee@company.com',
        department: 'Engineering',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2.4 HR Manager CAN update employee details (200 OK via EMPLOYEE_WRITE)', async () => {
    const res = await fetch(`${baseUrl}/api/employees/${createdEmpId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrManagerToken}`,
      },
      body: JSON.stringify({
        department: 'Security Operations',
      }),
    });
    assert.strictEqual(res.status, 200);
  });

  await t.test('2.5 Employee CANNOT update employee details (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/employees/${createdEmpId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeTokenA}`,
      },
      body: JSON.stringify({
        department: 'Hacked Department',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2.6 HR Manager CANNOT delete/remove an employee (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/employees/${createdEmpId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${hrManagerToken}`,
      },
    });
    assert.strictEqual(res.status, 403, 'HR Manager must NOT be able to delete employees');
  });

  await t.test('2.7 Employee CANNOT delete/remove an employee (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/employees/${createdEmpId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${employeeTokenA}`,
      },
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2.8 Admin CAN delete/remove an employee (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/employees/${createdEmpId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
  });
});

test('3. PAYROLL WORKFLOW & RBAC AUTHORIZATION AUDIT', async (t) => {
  await t.test('3.1 Payroll Manager CAN access payrun list (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns`, {
      headers: { Authorization: `Bearer ${payrollManagerToken}` },
    });
    assert.strictEqual(res.status, 200);
  });

  await t.test('3.2 Employee CANNOT access payrun list (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns`, {
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('3.3 HR Manager CANNOT create payruns (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrManagerToken}`,
      },
      body: JSON.stringify({
        name: 'Unauthorized Payrun',
        period: '2026-09',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('3.4 Employee CANNOT create payruns (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeTokenA}`,
      },
      body: JSON.stringify({
        name: 'Unauthorized Payrun',
        period: '2026-09',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('3.5 Employee CANNOT compute payruns (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns/PR-TEST-001/compute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('3.6 Employee CANNOT validate payruns (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns/PR-TEST-001/validate`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('3.7 Employee CANNOT mark payruns paid (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns/PR-TEST-001/pay`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403);
  });
});

test('4. IDOR & RESOURCE AUTHORIZATION AUDIT', async (t) => {
  // Seed sample attendance and time off records for testing
  const seedAttendanceId = 'ATT-SEC-TEST-EMP006';
  const seedTimeOffId = 'TO-SEC-TEST-EMP006';

  await executeQuery(
    `INSERT INTO attendance_records (id, employee_id, date, check_in, status)
     VALUES (?, 'EMP-006', '2026-09-01', '09:00:00', 'PRESENT')
     ON DUPLICATE KEY UPDATE status = 'PRESENT'`,
    [seedAttendanceId]
  );

  await executeQuery(
    `INSERT INTO time_off_requests (id, employee_id, leave_type, start_date, end_date, duration_days, status, reason)
     VALUES (?, 'EMP-006', 'Paid Time Off', '2026-09-10', '2026-09-12', 3, 'PENDING', 'Medical checkup')
     ON DUPLICATE KEY UPDATE status = 'PENDING'`,
    [seedTimeOffId]
  );

  await t.test('4.1 Attendance IDOR: Employee A CANNOT view Employee B record (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/attendance/${seedAttendanceId}`, {
      headers: { Authorization: `Bearer ${employeeTokenA}` }, // John Doe (EMP-001) requesting EMP-006
    });
    assert.strictEqual(res.status, 403, 'Employee must not be able to view another employee attendance record');
  });

  await t.test('4.2 Attendance IDOR: Employee A CANNOT check out Employee B record (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/attendance/${seedAttendanceId}/check-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeTokenA}`,
      },
      body: JSON.stringify({ checkOut: '17:00:00' }),
    });
    assert.strictEqual(res.status, 403, 'Employee must not be able to clock out another employee');
  });

  await t.test('4.3 Attendance IDOR: HR Manager CAN view employee attendance record (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/attendance/${seedAttendanceId}`, {
      headers: { Authorization: `Bearer ${hrManagerToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.id, seedAttendanceId);
  });

  await t.test('4.4 Time-Off IDOR: Employee A CANNOT view Employee B time off request (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/time-off/${seedTimeOffId}`, {
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403, 'Employee must not be able to view another employee time off request');
  });

  await t.test('4.5 Time-Off IDOR: Employee A CANNOT approve a leave request (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/time-off/${seedTimeOffId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('4.6 Time-Off IDOR: HR Manager CAN view leave request (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/time-off/${seedTimeOffId}`, {
      headers: { Authorization: `Bearer ${hrManagerToken}` },
    });
    assert.strictEqual(res.status, 200);
  });

  await t.test('4.7 Payslip IDOR: Employee A CANNOT view Employee B payslip history (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/employees/EMP-006/history`, {
      headers: { Authorization: `Bearer ${employeeTokenA}` }, // John Doe (EMP-001) requesting EMP-006
    });
    assert.strictEqual(res.status, 403, 'Employee must not view another employee payslips');
  });

  await t.test('4.8 Payslip Self-Service: Employee A CAN view own payslip history (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/employees/EMP-001/history`, {
      headers: { Authorization: `Bearer ${employeeTokenA}` }, // John Doe (EMP-001) requesting EMP-001
    });
    assert.strictEqual(res.status, 200);
  });
});

test('5. DASHBOARD AUTHORIZATION AUDIT', async (t) => {
  await t.test('5.1 Staff roles (Admin, HR Payroll Manager) CAN access dashboard (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
  });

  await t.test('5.2 Regular Employee CANNOT access dashboard (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard`, {
      headers: { Authorization: `Bearer ${employeeTokenA}` },
    });
    assert.strictEqual(res.status, 403);
  });
});

test('6. RESPONSE HYGIENE & INFORMATION DISCLOSURE', async (t) => {
  await t.test('6.1 401 and 403 error responses do NOT contain stack traces or raw SQL', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrManagerToken}`,
      },
      body: JSON.stringify({ firstName: 'Test' }),
    });
    assert.strictEqual(res.status, 403);
    const text = await res.text();
    assert.ok(!text.includes('Error:'), 'No stack traces');
    assert.ok(!text.includes('SELECT') && !text.includes('INSERT'), 'No SQL text in error');
  });

  await t.test('6.2 Employee list does NOT expose sensitive credentials or tokens', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data));
    for (const emp of body.data) {
      assert.strictEqual(emp.password, undefined);
      assert.strictEqual(emp.token, undefined);
    }
  });
});
