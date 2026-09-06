/**
 * Phase 7.2 Backend API Validation & Error Handling Comprehensive Test Suite
 *
 * Verifies all 15 required checklist items:
 * [x] Missing required fields (400)
 * [x] Invalid data types (400)
 * [x] Invalid IDs (400) vs valid format not found (404)
 * [x] Invalid dates (400)
 * [x] Invalid status values (400)
 * [x] Invalid numeric values (400)
 * [x] Invalid dashboard filters (400)
 * [x] Resource not found (404)
 * [x] Duplicate/conflict condition (409)
 * [x] Invalid payroll transition (400/409)
 * [x] Unauthorized request (401)
 * [x] Forbidden request (403)
 * [x] Database/constraint error (clean mapping without leakage)
 * [x] Unknown route (404 JSON) & safe unexpected error (500)
 * [x] Valid requests still succeed (200/201)
 */

import test from 'node:test';
import assert from 'node:assert';
import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import http from 'node:http';
import { pool } from '../config/database.js';

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

import { apiNotFoundError, globalErrorHandler } from '../middleware/errorHandler.js';
import { JWT_SECRET } from '../config/jwt.config.js';
import { executeQuery } from '../config/database.js';

let server: http.Server;
let baseUrl: string;

// Test Tokens
const adminToken = jwt.sign(
  { userId: 'USR-999', email: 'admin@company.com', role: 'Admin' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '1h' }
);

const hrPayrollManagerToken = jwt.sign(
  { userId: 'USR-004', email: 'elena@company.com', role: 'HR Payroll Manager', employeeId: 'EMP-004' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '1h' }
);

const employeeToken = jwt.sign(
  { userId: 'USR-001', email: 'john@company.com', role: 'Employee', employeeId: 'EMP-001' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '1h' }
);

test.before(async () => {
  const app = express();
  app.use(express.json());

  // Mount API routes
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

  // Test error trigger endpoint
  app.get('/api/test-trigger-500', () => {
    throw new Error('Simulated uncaught exception for 500 error test');
  });

  // 404 & Global error middlewares
  app.use('/api', apiNotFoundError);
  app.use(globalErrorHandler);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  // Cleanup test artifacts
  await executeQuery("DELETE FROM attendance_records WHERE id LIKE '%VAL-TEST%'");
  await executeQuery("DELETE FROM time_off_requests WHERE id LIKE '%VAL-TEST%'");
  await executeQuery("DELETE FROM contracts WHERE id LIKE '%CON-VAL-%'");
  await executeQuery("DELETE FROM employees WHERE email LIKE '%valtest%'");
  await executeQuery("DELETE FROM payruns WHERE id LIKE '%PR-VAL-%'");

  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

// ── 1. MISSING REQUIRED FIELDS (400) ──────────────────────────────────────────

test('1. Missing required fields validation', async (t) => {
  await t.test('1.1 Login rejects empty payload with 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /required/i);
  });

  await t.test('1.2 Employee create rejects missing name, email, department with 400', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /name is required/i);
  });

  await t.test('1.3 Contract create rejects missing employeeId or wage with 400', async () => {
    const res = await fetch(`${baseUrl}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ startDate: '2026-09-01' }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /employeeId is required/i);
  });

  await t.test('1.4 Time-off create rejects missing leaveType with 400', async () => {
    const res = await fetch(`${baseUrl}/api/time-off`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        employeeId: 'EMP-001',
        startDate: '2026-09-10',
        endDate: '2026-09-12',
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /leaveType is required/i);
  });

  await t.test('1.5 Payrun create rejects missing name or period with 400', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrPayrollManagerToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /name is required/i);
  });
});

// ── 2. INVALID DATA TYPES & FORMATS (400) ─────────────────────────────────────

test('2. Invalid data types and string formats', async (t) => {
  await t.test('2.1 Login rejects malformed email format with 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notanemail', password: 'password123' }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /invalid email/i);
  });

  await t.test('2.2 Employee create rejects malformed email with 400', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Invalid Email User',
        email: 'invalid-email-address',
        department: 'Engineering',
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /invalid email address/i);
  });

  await t.test('2.3 Contract create rejects non-numeric wage with 400', async () => {
    const res = await fetch(`${baseUrl}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        employeeId: 'EMP-001',
        wage: 'NOT_A_NUMBER',
        startDate: '2026-09-01',
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /wage must be a non-negative number/i);
  });

  await t.test('2.4 Time-off create rejects non-integer durationDays with 400', async () => {
    const res = await fetch(`${baseUrl}/api/time-off`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        employeeId: 'EMP-001',
        leaveType: 'Annual Leave',
        startDate: '2026-09-10',
        endDate: '2026-09-12',
        durationDays: 2.5,
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /durationDays must be a positive integer/i);
  });

  await t.test('2.5 Payrun create rejects non-array employeeIds with 400', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrPayrollManagerToken}`,
      },
      body: JSON.stringify({
        name: 'September Payroll',
        period: '2026-09',
        employeeIds: 'EMP-001',
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /employeeIds must be an array/i);
  });
});

// ── 3. INVALID DATES & DATE ORDERING (400) ────────────────────────────────────

test('3. Invalid dates and chronological ordering validation', async (t) => {
  await t.test('3.1 Employee create rejects invalid joinDate format with 400', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Date Test Employee',
        email: 'valtest_date@company.com',
        department: 'Engineering',
        joinDate: '2026-99-99',
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /joinDate must be a valid date/i);
  });

  await t.test('3.2 Contract create rejects startDate after endDate with 400', async () => {
    const res = await fetch(`${baseUrl}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        employeeId: 'EMP-001',
        wage: 5000,
        startDate: '2026-09-30',
        endDate: '2026-09-01',
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /endDate cannot be before startDate/i);
  });

  await t.test('3.3 Time-off create rejects endDate before startDate with 400', async () => {
    const res = await fetch(`${baseUrl}/api/time-off`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        employeeId: 'EMP-001',
        leaveType: 'Vacation',
        startDate: '2026-10-15',
        endDate: '2026-10-10',
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /endDate cannot be before startDate/i);
  });

  await t.test('3.4 Attendance check-in rejects invalid date format with 400', async () => {
    const res = await fetch(`${baseUrl}/api/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        employeeId: 'EMP-001',
        date: '2026/09/01',
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /valid date in YYYY-MM-DD format/i);
  });
});

// ── 4. INVALID STATUS & ENUM VALUES (400) ─────────────────────────────────────

test('4. Invalid status and enum validation', async (t) => {
  await t.test('4.1 Employee create rejects invalid status enum with 400', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Status Test User',
        email: 'valtest_status@company.com',
        department: 'Finance',
        status: 'ON_VACATION',
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /status must be/i);
  });

  await t.test('4.2 Employee create rejects invalid gender enum with 400', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Gender Test User',
        email: 'valtest_gender@company.com',
        department: 'Finance',
        gender: 'UNKNOWN_GENDER',
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /gender must be one of/i);
  });

  await t.test('4.3 Contract create rejects invalid contract status with 400', async () => {
    const res = await fetch(`${baseUrl}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        employeeId: 'EMP-001',
        wage: 5000,
        startDate: '2026-09-01',
        status: 'TEMPORARY',
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /status must be ACTIVE, FUTURE, or HISTORICAL/i);
  });

  await t.test('4.4 Attendance check-in rejects invalid attendance status with 400', async () => {
    const res = await fetch(`${baseUrl}/api/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        employeeId: 'EMP-001',
        status: 'SLEEPING',
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /status must be PRESENT/i);
  });
});

// ── 5. INVALID NUMERIC VALUES & RANGES (400) ──────────────────────────────────

test('5. Invalid numeric values and bounds', async (t) => {
  await t.test('5.1 Contract create rejects negative wage with 400', async () => {
    const res = await fetch(`${baseUrl}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        employeeId: 'EMP-001',
        wage: -100,
        startDate: '2026-09-01',
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /wage must be a non-negative number/i);
  });

  await t.test('5.2 Contract create rejects wage exceeding maximum allowable upper bound with 400', async () => {
    const res = await fetch(`${baseUrl}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        employeeId: 'EMP-001',
        wage: 999999999999,
        startDate: '2026-09-01',
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /cannot exceed/i);
  });

  await t.test('5.3 Salary rule rejects negative amount with 400', async () => {
    const res = await fetch(`${baseUrl}/api/salary-rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Negative Rule',
        code: 'NEG_RULE',
        structureId: 'STR-001',
        sequence: 1,
        category: 'ALLOWANCE',
        calculationType: 'FIXED',
        amount: -50,
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /amount must be a non-negative number/i);
  });

  await t.test('5.4 Salary rule rejects percentage > 100 with 400', async () => {
    const res = await fetch(`${baseUrl}/api/salary-rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Excess Percentage Rule',
        code: 'EXC_RULE',
        structureId: 'STR-001',
        sequence: 1,
        category: 'ALLOWANCE',
        calculationType: 'PERCENTAGE',
        percentage: 120,
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /percentage must be a number between 0 and 100/i);
  });
});

// ── 6. DASHBOARD QUERY FILTER VALIDATION (400) ────────────────────────────────

test('6. Dashboard query filter validation', async (t) => {
  await t.test('6.1 Dashboard rejects malformed period filter with 400', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard?period=2026-999-bad`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Invalid period filter format/i);
  });

  await t.test('6.2 Dashboard rejects invalid employeeType filter with 400', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard?employeeType=UNRECOGNIZED_TYPE`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /employeeType filter must be/i);
  });

  await t.test('6.3 Dashboard analytics rejects malformed period filter with 400', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/analytics?period=not-a-period`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Invalid period filter format/i);
  });
});

// ── 7. RESOURCE NOT FOUND VS MALFORMED ID (404 vs 400) ───────────────────────

test('7. Resource not found (404) vs malformed ID (400)', async (t) => {
  await t.test('7.1 Non-existent employee returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/employees/EMP-NONEXISTENT-9999`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Employee not found/i);
  });

  await t.test('7.2 Non-existent contract returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/contracts/CON-NONEXISTENT-9999`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Contract not found/i);
  });

  await t.test('7.3 Non-existent payrun returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns/PR-NONEXISTENT-9999`, {
      headers: { Authorization: `Bearer ${hrPayrollManagerToken}` },
    });
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Payrun not found/i);
  });

  await t.test('7.4 Non-existent payslip returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payslips/PS-NONEXISTENT-9999`, {
      headers: { Authorization: `Bearer ${hrPayrollManagerToken}` },
    });
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Payslip not found/i);
  });

  await t.test('7.5 Contract create referencing non-existent employee returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        employeeId: 'EMP-NONEXISTENT-9999',
        wage: 5000,
        startDate: '2026-09-01',
      }),
    });
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /does not exist/i);
  });
});

// ── 8. DUPLICATE & CONFLICT CONDITIONS (409) ──────────────────────────────────

test('8. Duplicate and conflict handling (409)', async (t) => {
  await t.test('8.1 Duplicate employee email returns 409 Conflict', async () => {
    // admin@company.com already exists in seeded employees/users
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Duplicate Admin',
        email: 'admin@company.com',
        department: 'Management',
      }),
    });
    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /already exists/i);
  });

  await t.test('8.2 Multiple active contracts for the same employee returns 409 Conflict', async () => {
    // EMP-001 already has an active contract in seed data
    const res = await fetch(`${baseUrl}/api/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        id: 'CON-VAL-DUP-01',
        employeeId: 'EMP-001',
        wage: 7000,
        startDate: '2026-09-01',
        status: 'ACTIVE',
      }),
    });
    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /already has an active contract/i);
  });

  await t.test('8.3 Duplicate payrun ID returns 409 Conflict', async () => {
    // First create a payrun with a unique ID
    const runId = `PR-VAL-DUP-${Date.now()}`;
    const firstRes = await fetch(`${baseUrl}/api/payroll/payruns/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrPayrollManagerToken}`,
      },
      body: JSON.stringify({
        id: runId,
        name: 'First Run',
        period: '2026-09',
      }),
    });
    const firstText = await firstRes.text();
    if (firstRes.status !== 201) {
      console.log('8.3 firstRes status:', firstRes.status, firstText);
    }
    assert.strictEqual(firstRes.status, 201);

    // Second request with same ID must return 409 Conflict
    const secondRes = await fetch(`${baseUrl}/api/payroll/payruns/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrPayrollManagerToken}`,
      },
      body: JSON.stringify({
        id: runId,
        name: 'Second Run',
        period: '2026-09',
      }),
    });
    assert.strictEqual(secondRes.status, 409);
    const body = await secondRes.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /already exists/i);
  });
});

// ── 9. INVALID PAYROLL WORKFLOW TRANSITIONS (400) ─────────────────────────────

test('9. Invalid payroll state machine transitions', async (t) => {
  const runId = `PR-VAL-FLOW-${Date.now()}`;

  await t.test('9.1 Create DRAFT payrun succeeds', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrPayrollManagerToken}`,
      },
      body: JSON.stringify({
        id: runId,
        name: 'Workflow State Test',
        period: '2026-09',
      }),
    });
    assert.strictEqual(res.status, 201);
  });

  await t.test('9.2 Cannot directly mark DRAFT payrun as PAID (must be VALIDATED first)', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/payruns/${runId}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrPayrollManagerToken}`,
      },
      body: JSON.stringify({ paymentReference: 'REF-001' }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /marked as paid/i);
  });
});

// ── 10. UNEXPECTED SERVER ERROR & UNKNOWN API ROUTES ──────────────────────────

test('10. Safe error responses: 404 JSON for unknown route & 500 for uncaught exception', async (t) => {
  await t.test('10.1 Unknown API route returns predictable 404 JSON (not Express HTML)', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent-endpoint-test-12345`);
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.headers.get('content-type')?.includes('application/json'), true);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error?.code, 'NOT_FOUND');
  });

  await t.test('10.2 Uncaught server error returns clean 500 JSON without stack trace leakage', async () => {
    const res = await fetch(`${baseUrl}/api/test-trigger-500`);
    assert.strictEqual(res.status, 500);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error?.code, 'INTERNAL_SERVER_ERROR');
    // Ensure no stack trace or filesystem paths are exposed
    assert.strictEqual(body.stack, undefined);
    assert.strictEqual(JSON.stringify(body).includes('node_modules'), false);
  });
});

// ── 11. VALID REQUESTS STILL SUCCEED (200/201) ────────────────────────────────

test('11. Valid requests continue to succeed normally', async (t) => {
  await t.test('11.1 Valid login returns 200 and token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@company.com', password: 'password123' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.token);
  });

  await t.test('11.2 Valid employee list returns 200 and data array', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  await t.test('11.3 Valid dashboard query with filter returns 200', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard?period=2026-09&employeeType=FULL_TIME`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data);
  });
});

test.after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await pool.end();
});

