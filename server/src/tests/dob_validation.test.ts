/**
 * Date of Birth (DOB) Validation Test Suite
 *
 * Verifies all required rules:
 * 1. Exactly 18 years old today -> ACCEPT
 * 2. Older than 18 years old -> ACCEPT (No maximum age limit)
 * 3. 17 years 364 days -> REJECT ("You must be at least 18 years old.")
 * 4. Tomorrow -> REJECT ("Date of birth cannot be in the future.")
 * 5. Today + 1 year -> REJECT ("Date of birth cannot be in the future.")
 * 6. Impossible / malformed dates (e.g. 2005-02-31, leap years) -> REJECT ("Please enter a valid date of birth.")
 * 7. Empty DOB -> REJECT if required, ACCEPT if optional
 * 8. Dynamic age calculation (no hardcoded years)
 * 9. API route integration: POST/PATCH rejects invalid DOB with 400
 * 10. Database protection: Repository prevents invalid DOB from being inserted/updated
 */

import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import jwt from 'jsonwebtoken';
import http from 'node:http';
import { pool, executeQuery } from '../config/database.js';
import employeeRoutes from '../routes/employee.routes.js';
import { apiNotFoundError, globalErrorHandler } from '../middleware/errorHandler.js';
import { JWT_SECRET } from '../config/jwt.config.js';
import {
  validateDateOfBirth,
  getMaxDobString,
  isValidDOB,
} from '../utils/validators.js';
import {
  createEmployee,
  updateEmployee,
  getEmployeeById,
  deleteEmployee,
} from '../repositories/employee.repository.js';

let server: http.Server;
let baseUrl: string;

const adminToken = jwt.sign(
  { userId: 'USR-999', email: 'admin@company.com', role: 'Admin' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '1h' }
);

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/employees', employeeRoutes);
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
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  try {
    await pool.end();
  } catch {}
});

// Helper to format Date as YYYY-MM-DD in local time
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test('DOB Unit Tests: Dynamic Age & Validation Rules', async (t) => {
  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();

  await t.test('VALID: Exactly 18 years old today -> ACCEPT', () => {
    const exactly18 = new Date(todayY - 18, todayM, todayD);
    const dobStr = formatLocalDate(exactly18);
    const res = validateDateOfBirth(dobStr);
    assert.strictEqual(res.isValid, true, `Expected ${dobStr} to be valid`);
    assert.strictEqual(res.age, 18);
  });

  await t.test('VALID: 18 years and 1 day old -> ACCEPT', () => {
    const older18 = new Date(todayY - 18, todayM, todayD - 1);
    const dobStr = formatLocalDate(older18);
    const res = validateDateOfBirth(dobStr);
    assert.strictEqual(res.isValid, true, `Expected ${dobStr} to be valid`);
    assert.ok(res.age !== undefined && res.age >= 18);
  });

  await t.test('VALID: Older than 18 (25, 45, 80 years old, no maximum age limit) -> ACCEPT', () => {
    const age25 = formatLocalDate(new Date(todayY - 25, todayM, todayD));
    const age45 = formatLocalDate(new Date(todayY - 45, todayM, todayD));
    const age80 = formatLocalDate(new Date(todayY - 80, todayM, todayD));

    assert.strictEqual(validateDateOfBirth(age25).isValid, true);
    assert.strictEqual(validateDateOfBirth(age45).isValid, true);
    assert.strictEqual(validateDateOfBirth(age80).isValid, true);
  });

  await t.test('INVALID: 17 years and 364 days old -> REJECT', () => {
    const younger18 = new Date(todayY - 18, todayM, todayD + 1);
    const dobStr = formatLocalDate(younger18);
    const res = validateDateOfBirth(dobStr);
    assert.strictEqual(res.isValid, false, `Expected ${dobStr} to be rejected`);
    assert.strictEqual(res.error, 'You must be at least 18 years old.');
    assert.strictEqual(res.age, 17);
  });

  await t.test('INVALID: Tomorrow -> REJECT', () => {
    const tomorrow = new Date(todayY, todayM, todayD + 1);
    const dobStr = formatLocalDate(tomorrow);
    const res = validateDateOfBirth(dobStr);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.error, 'Date of birth cannot be in the future.');
  });

  await t.test('INVALID: Today + 1 year -> REJECT', () => {
    const nextYear = new Date(todayY + 1, todayM, todayD);
    const dobStr = formatLocalDate(nextYear);
    const res = validateDateOfBirth(dobStr);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.error, 'Date of birth cannot be in the future.');
  });

  await t.test('INVALID: Impossible calendar date (2005-02-31) -> REJECT', () => {
    const res = validateDateOfBirth('2005-02-31');
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.error, 'Please enter a valid date of birth.');
  });

  await t.test('INVALID: Non-leap year February 29 (2021-02-29) -> REJECT', () => {
    const res = validateDateOfBirth('2021-02-29');
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.error, 'Please enter a valid date of birth.');
  });

  await t.test('VALID: Leap year February 29 (2000-02-29) -> ACCEPT', () => {
    const res = validateDateOfBirth('2000-02-29');
    assert.strictEqual(res.isValid, true);
    assert.ok(res.age && res.age >= 18);
  });

  await t.test('INVALID: Malformed dates -> REJECT', () => {
    assert.strictEqual(validateDateOfBirth('06-09-2000').isValid, false);
    assert.strictEqual(validateDateOfBirth('2000/09/06').isValid, false);
    assert.strictEqual(validateDateOfBirth('not-a-date').isValid, false);
    assert.strictEqual(validateDateOfBirth(123456).isValid, false);
  });

  await t.test('Empty DOB: REJECT if required, ACCEPT if optional', () => {
    assert.strictEqual(validateDateOfBirth('', { required: false }).isValid, true);
    assert.strictEqual(validateDateOfBirth(null, { required: false }).isValid, true);
    assert.strictEqual(validateDateOfBirth(undefined, { required: false }).isValid, true);

    const reqEmpty = validateDateOfBirth('', { required: true });
    assert.strictEqual(reqEmpty.isValid, false);
    assert.strictEqual(reqEmpty.error, 'Please enter a valid date of birth.');
  });

  await t.test('Date picker max attribute: getMaxDobString returns exact 18-year date', () => {
    const ref = new Date(2026, 8, 6); // 2026-09-06
    assert.strictEqual(getMaxDobString(ref), '2008-09-06');

    // Leap day test: 2024-02-29 reference date caps target year (2006) to Feb 28
    const leapRef = new Date(2024, 1, 29); // 2024-02-29
    assert.strictEqual(getMaxDobString(leapRef), '2006-02-28');
  });
});

test('DOB Backend API Integration Tests: POST /api/employees', async (t) => {
  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();

  let createdEmployeeId: string | null = null;

  await t.test('POST /api/employees with valid DOB (exactly 18 years old) succeeds with 201', async () => {
    const validDob = formatLocalDate(new Date(todayY - 18, todayM, todayD));
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        firstName: 'Alice',
        lastName: 'Adult',
        email: `alice.adult.${Date.now()}@company.com`,
        department: 'Engineering',
        position: 'Software Engineer',
        dateOfBirth: validDob,
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 201, `Expected 201 but got ${res.status}: ${JSON.stringify(body)}`);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.dateOfBirth, validDob);
    createdEmployeeId = body.data.id;
  });

  await t.test('POST /api/employees with DOB younger than 18 (17 years old) returns 400', async () => {
    const under18Dob = formatLocalDate(new Date(todayY - 18, todayM, todayD + 1));
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        firstName: 'Minor',
        lastName: 'User',
        email: `minor.${Date.now()}@company.com`,
        department: 'Engineering',
        position: 'Intern',
        dateOfBirth: under18Dob,
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'You must be at least 18 years old.');
  });

  await t.test('POST /api/employees with future DOB (tomorrow) returns 400', async () => {
    const futureDob = formatLocalDate(new Date(todayY, todayM, todayD + 1));
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        firstName: 'Future',
        lastName: 'User',
        email: `future.${Date.now()}@company.com`,
        department: 'Engineering',
        position: 'Specialist',
        dateOfBirth: futureDob,
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Date of birth cannot be in the future.');
  });

  await t.test('POST /api/employees with invalid calendar date returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        firstName: 'Invalid',
        lastName: 'Date',
        email: `invalid.date.${Date.now()}@company.com`,
        department: 'Engineering',
        position: 'QA',
        dateOfBirth: '2005-02-31',
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Please enter a valid date of birth.');
  });

  await t.test('PATCH /api/employees/:id with valid DOB (older adult) returns 200', async () => {
    assert.ok(createdEmployeeId, 'Requires created employee from previous step');
    const validDob = formatLocalDate(new Date(todayY - 30, todayM, todayD));
    const res = await fetch(`${baseUrl}/api/employees/${createdEmployeeId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        dateOfBirth: validDob,
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.dateOfBirth, validDob);
  });

  await t.test('PATCH /api/employees/:id with DOB younger than 18 returns 400', async () => {
    assert.ok(createdEmployeeId);
    const under18Dob = formatLocalDate(new Date(todayY - 17, todayM, todayD));
    const res = await fetch(`${baseUrl}/api/employees/${createdEmployeeId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        dateOfBirth: under18Dob,
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'You must be at least 18 years old.');
  });

  await t.test('PATCH /api/employees/:id with future DOB returns 400', async () => {
    assert.ok(createdEmployeeId);
    const futureDob = formatLocalDate(new Date(todayY + 2, todayM, todayD));
    const res = await fetch(`${baseUrl}/api/employees/${createdEmployeeId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        dateOfBirth: futureDob,
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Date of birth cannot be in the future.');
  });

  // Cleanup created test employee
  if (createdEmployeeId) {
    await deleteEmployee(createdEmployeeId);
  }
});

test('DOB Database Protection Tests: Repository rejects invalid DOB', async (t) => {
  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();

  await t.test('createEmployee throws INVALID_DOB when given an under-18 date', async () => {
    const under18Dob = formatLocalDate(new Date(todayY - 17, todayM, todayD));
    await assert.rejects(
      async () => {
        await createEmployee({
          name: 'Direct Repo Minor',
          email: `direct.repo.minor.${Date.now()}@company.com`,
          department: 'Legal',
          position: 'Intern',
          dateOfBirth: under18Dob,
        });
      },
      (err: Error) => {
        assert.ok(err.message.includes('INVALID_DOB: You must be at least 18 years old.'));
        return true;
      }
    );
  });

  await t.test('createEmployee throws INVALID_DOB when given a future date', async () => {
    const futureDob = formatLocalDate(new Date(todayY + 1, todayM, todayD));
    await assert.rejects(
      async () => {
        await createEmployee({
          name: 'Direct Repo Future',
          email: `direct.repo.future.${Date.now()}@company.com`,
          department: 'Legal',
          position: 'Counsel',
          dateOfBirth: futureDob,
        });
      },
      (err: Error) => {
        assert.ok(err.message.includes('INVALID_DOB: Date of birth cannot be in the future.'));
        return true;
      }
    );
  });
});
