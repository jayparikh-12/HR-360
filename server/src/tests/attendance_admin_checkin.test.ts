import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import attendanceRoutes from '../routes/attendance.routes.js';
import { JWT_SECRET } from '../config/jwt.config.js';
import { pool } from '../config/database.js';

describe('Attendance Admin & Employee Resolution Tests', () => {
  let server: http.Server;
  let baseUrl: string;
  let targetEmpId = 'ff3d1311-e4fa-42bb-956c-ecf9c5adbc74';

  const adminToken = jwt.sign(
    { userId: 'USR-999', email: 'admin@company.com', role: 'Admin' },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/attendance', attendanceRoutes);

    const [empRows] = (await pool.query(
      "SELECT id FROM employees WHERE LOWER(email) = 'admin@company.com' LIMIT 1"
    )) as any;
    if (empRows && empRows.length > 0) {
      targetEmpId = empRows[0].id;
    }

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await pool.query('DELETE FROM attendance_records WHERE employee_id = ? AND date IN (?, ?)', [
      targetEmpId,
      '2026-09-06',
      '2026-09-07',
    ]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  });

  test('Admin user check-in succeeds via employee resolution', async () => {
    const res = await fetch(`${baseUrl}/api/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        employeeId: targetEmpId,
        date: '2026-09-06',
        checkIn: '09:00 AM',
      }),
    });

    const body = (await res.json()) as any;
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.employeeId, targetEmpId);
    assert.equal(body.data.status, 'PRESENT');
  });

  test('Admin user check-out succeeds for active session', async () => {
    const res = await fetch(`${baseUrl}/api/attendance/check-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        employeeId: targetEmpId,
        checkOut: '05:00 PM',
      }),
    });

    const body = (await res.json()) as any;
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.checkOut, '05:00 PM');
    assert.ok(body.data.workedHours > 0);
  });

  test('Attendance check-in automatically resolves employeeId from user email if omitted', async () => {
    const res = await fetch(`${baseUrl}/api/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        date: '2026-09-07',
        checkIn: '09:15 AM',
      }),
    });

    const body = (await res.json()) as any;
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.employeeId, targetEmpId);
  });
});
