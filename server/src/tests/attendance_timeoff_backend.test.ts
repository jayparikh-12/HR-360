/**
 * PeoplePay360 — Phase 6.5 Attendance & Time-Off Analytics Verification Suite (Backend Only)
 *
 * Verifies all Phase 6.5 backend requirements:
 * 1. Security: Authentication enforcement (401 on missing token)
 * 2. Security: RBAC authorization (403 for unauthorized Employee role, 200 for HR/Admin)
 * 3. Attendance Aggregation: Real MySQL data, present, absent, late, overtime, missing checkout counts, attendanceRate
 * 4. Attendance Trends: Daily grouping, chronological ordering, total & status breakdown
 * 5. Attendance Department Breakdown: Volume and presence rate by department
 * 6. Time-Off Aggregation: Real MySQL data, approved, pending, refused/rejected requests, total & approved days
 * 7. Time-Off Type Breakdown: Aggregated requests and days by leave type with percentages
 * 8. Time-Off Department Breakdown: Aggregated requests and days by department with percentages
 * 9. Filter Isolation: Period date range, Department, and Employee Type filters
 * 10. Empty Data Guarantees: Safe empty arrays and 0s on non-matching filters or zero records
 * 11. Endpoint Contracts: /api/dashboard/attendance-analytics, /api/dashboard/time-off-analytics, and summary inclusion
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { executeQuery, pool } from '../config/database.js';
import {
  getAttendanceAnalytics,
  getTimeOffAnalytics,
  getDashboardSummary,
} from '../services/dashboard.service.js';
import {
  getAttendanceMetrics,
  getTimeOffMetrics,
  getAttendanceTrendAggregation,
  getAttendanceDepartmentBreakdown,
  getTimeOffTypeBreakdown,
  getTimeOffDepartmentBreakdown,
} from '../repositories/dashboard.repository.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/authorize.js';
import { PERMISSIONS } from '../types/rbac.js';
import type { Request, Response } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'peoplepay360-hackathon-jwt-secret-2026';

function createMockReqRes(authHeader?: string, user?: any, query: Record<string, string> = {}) {
  const req: Partial<Request> = {
    headers: authHeader ? { authorization: authHeader } : {},
    user,
    query,
  };

  let statusCode = 200;
  let jsonBody: any = null;

  const res: Partial<Response> = {
    status(code: number) {
      statusCode = code;
      return this as Response;
    },
    json(body: any) {
      jsonBody = body;
      return this as Response;
    },
  };

  return { req: req as Request, res: res as Response, getStatus: () => statusCode, getBody: () => jsonBody };
}

let passed = 0;
let failed = 0;

function pass(testName: string) {
  passed++;
  console.log(`  ✔ [PASS] ${testName}`);
}

function fail(testName: string, err: unknown) {
  failed++;
  console.error(`  ❌ [FAIL] ${testName}:`, err instanceof Error ? err.message : err);
}

test('PeoplePay360 — Phase 6.5 Attendance & Time-Off Analytics Backend Verification Suite', async () => {
  console.log('\n================================================================');
  console.log('🔍 PEOPLEPAY360 — PHASE 6.5 ATTENDANCE & TIME-OFF BACKEND TESTS 🔍');
  console.log('================================================================\n');

  // ── 1. Security: Authentication Enforcement ────────────────────────────────
  try {
    const { req, res, getStatus, getBody } = createMockReqRes();
    let nextCalled = false;
    authenticateToken(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Next must not be called without bearer token');
    assert.strictEqual(getStatus(), 401, 'Must return 401 Unauthorized for missing token');
    assert.strictEqual(getBody()?.success, false);
    pass('1. Authentication enforcement (401 on missing token)');
  } catch (err) {
    fail('1. Authentication enforcement', err);
  }

  // ── 2. Security: RBAC Authorization ────────────────────────────────────────
  try {
    const employeeUser = {
      id: 'emp-normal',
      email: 'employee@peoplepay360.internal',
      role: 'EMPLOYEE',
      permissions: [PERMISSIONS.PAYSLIP_READ],
    };
    const { req, res, getStatus } = createMockReqRes(undefined, employeeUser);
    let nextCalled = false;
    authorize(PERMISSIONS.EMPLOYEE_READ)(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Unauthorized employee role must be blocked');
    assert.strictEqual(getStatus(), 403, 'Must return 403 Forbidden for role lacking EMPLOYEE_READ');

    const adminUser = {
      id: 'admin-1',
      email: 'admin@peoplepay360.internal',
      role: 'ADMIN',
      permissions: [PERMISSIONS.EMPLOYEE_READ, PERMISSIONS.PAYRUN_READ],
    };
    const adminReqRes = createMockReqRes(undefined, adminUser);
    let adminNextCalled = false;
    authorize(PERMISSIONS.EMPLOYEE_READ)(adminReqRes.req, adminReqRes.res, () => { adminNextCalled = true; });

    assert.strictEqual(adminNextCalled, true, 'Admin role with EMPLOYEE_READ must be authorized');
    pass('2. RBAC authorization (403 for unauthorized Employee, 200 for Admin/HR)');
  } catch (err) {
    fail('2. RBAC authorization', err);
  }

  // ── Setup: Seed test records into MySQL ─────────────────────────────────────
  const testPrefix = 'P65_TEST_';
  try {
    // Check existing employees or ensure at least two employees exist
    const employees = await executeQuery<any[]>('SELECT id, department FROM employees LIMIT 3');
    let emp1Id = employees[0]?.id || 'EMP-P65-01';
    let emp2Id = employees[1]?.id || 'EMP-P65-02';

    if (employees.length === 0) {
      await executeQuery(
        `INSERT INTO employees (id, empCode, firstName, lastName, email, department, jobPosition, createdAt) VALUES 
         (?, ?, 'Alice', 'Dev', 'alice.test@peoplepay360.internal', 'Engineering', 'Developer', '2026-01-01'),
         (?, ?, 'Bob', 'Ops', 'bob.test@peoplepay360.internal', 'Operations', 'Coordinator', '2026-01-01')`,
        [emp1Id, emp1Id, emp2Id, emp2Id]
      );
    }

    // Clean up any old test records
    await executeQuery('DELETE FROM attendance_records WHERE id LIKE ?', [`${testPrefix}%`]);
    await executeQuery('DELETE FROM time_off_requests WHERE id LIKE ?', [`${testPrefix}%`]);

    // Insert 5 Attendance Records across statuses:
    // 2 PRESENT, 1 LATE, 1 OVERTIME, 1 ABSENT, 1 MISSING_CHECKOUT
    await executeQuery(
      `INSERT INTO attendance_records (id, employee_id, date, check_in, check_out, worked_hours, status) VALUES
       (?, ?, '2026-09-01', '09:00', '17:00', 8.0, 'PRESENT'),
       (?, ?, '2026-09-01', '09:45', '17:00', 7.25, 'LATE'),
       (?, ?, '2026-09-02', '09:00', '19:00', 10.0, 'OVERTIME'),
       (?, ?, '2026-09-02', NULL, NULL, 0.0, 'ABSENT'),
       (?, ?, '2026-09-03', '09:00', NULL, 4.0, 'MISSING_CHECKOUT')`,
      [
        `${testPrefix}ATT_1`, emp1Id,
        `${testPrefix}ATT_2`, emp2Id,
        `${testPrefix}ATT_3`, emp1Id,
        `${testPrefix}ATT_4`, emp2Id,
        `${testPrefix}ATT_5`, emp1Id,
      ]
    );

    // Insert 4 Time-Off Requests across statuses:
    // 2 APPROVED (Paid 2 days, Sick 3 days), 1 PENDING (Paid 1 day), 1 REFUSED (Unpaid 2 days)
    await executeQuery(
      `INSERT INTO time_off_requests (id, employee_id, leave_type, start_date, end_date, duration_days, reason, status) VALUES
       (?, ?, 'Paid Leave', '2026-09-10', '2026-09-11', 2, 'Family event', 'APPROVED'),
       (?, ?, 'Sick Leave', '2026-09-15', '2026-09-17', 3, 'Flu recovery', 'APPROVED'),
       (?, ?, 'Paid Leave', '2026-09-20', '2026-09-20', 1, 'Doctor appointment', 'PENDING'),
       (?, ?, 'Unpaid Leave', '2026-09-25', '2026-09-26', 2, 'Personal travel', 'REFUSED')`,
      [
        `${testPrefix}TO_1`, emp1Id,
        `${testPrefix}TO_2`, emp2Id,
        `${testPrefix}TO_3`, emp1Id,
        `${testPrefix}TO_4`, emp2Id,
      ]
    );

    // ── 3. Attendance Status Aggregation & Rate ───────────────────────────────
    try {
      const analytics = await getAttendanceAnalytics({ period: '2026-09' });
      assert.ok(analytics, 'Attendance analytics response must exist');
      assert.ok(analytics.statusCounts, 'statusCounts must exist');
      assert.ok(analytics.statusCounts.total >= 5, 'Total records must be >= 5');
      assert.ok(analytics.statusCounts.present >= 1, 'Present count must be >= 1');
      assert.ok(analytics.statusCounts.late >= 1, 'Late count must be >= 1');
      assert.ok(analytics.statusCounts.overtime >= 1, 'Overtime count must be >= 1');
      assert.ok(analytics.statusCounts.absent >= 1, 'Absent count must be >= 1');
      assert.ok(analytics.statusCounts.missingCheckout >= 1, 'Missing checkout count must be >= 1');
      assert.ok(typeof analytics.attendanceRate === 'number' && analytics.attendanceRate > 0, 'attendanceRate must be a positive number');
      assert.strictEqual(analytics.totalRecords, analytics.statusCounts.total, 'totalRecords must match statusCounts.total');
      pass('3. Attendance aggregation matches MySQL data across all real statuses');
    } catch (err) {
      fail('3. Attendance aggregation', err);
    }

    // ── 4. Attendance Daily Trend Aggregation ──────────────────────────────────
    try {
      const analytics = await getAttendanceAnalytics({ period: '2026-09' });
      assert.ok(Array.isArray(analytics.trends), 'trends must be an array');
      assert.ok(analytics.trends.length >= 3, 'Must contain at least 3 distinct daily dates');

      const dates = analytics.trends.map((t) => t.date);
      const isSorted = dates.slice(1).every((d, i) => d >= dates[i]);
      assert.strictEqual(isSorted, true, 'Daily trends must be sorted chronologically');

      const day1 = analytics.trends.find((t) => t.date === '2026-09-01');
      assert.ok(day1, '2026-09-01 trend point must exist');
      assert.strictEqual(day1.present, 1, '2026-09-01 present count must be 1');
      assert.strictEqual(day1.late, 1, '2026-09-01 late count must be 1');
      assert.ok(day1.displayDate.length > 0, 'displayDate must be formatted');
      pass('4. Attendance daily trend aggregation with chronological ordering');
    } catch (err) {
      fail('4. Attendance daily trends', err);
    }

    // ── 5. Attendance Department Breakdown ────────────────────────────────────
    try {
      const analytics = await getAttendanceAnalytics({ period: '2026-09' });
      assert.ok(Array.isArray(analytics.departmentBreakdown), 'departmentBreakdown must be an array');
      assert.ok(analytics.departmentBreakdown.length >= 1, 'Must contain department items');

      const firstDept = analytics.departmentBreakdown[0];
      assert.ok(typeof firstDept.department === 'string', 'Department name must be string');
      assert.ok(typeof firstDept.total === 'number' && firstDept.total > 0, 'Total records must be positive');
      assert.ok(typeof firstDept.rate === 'number' && firstDept.rate >= 0, 'Presence rate must be non-negative');
      pass('5. Attendance department breakdown with volume and presence rate');
    } catch (err) {
      fail('5. Attendance department breakdown', err);
    }

    // ── 6. Time-Off Aggregation & Status Counts ───────────────────────────────
    try {
      const toAnalytics = await getTimeOffAnalytics({ period: '2026-09' });
      assert.ok(toAnalytics, 'TimeOff analytics response must exist');
      assert.ok(toAnalytics.statusCounts, 'statusCounts must exist');
      assert.ok(toAnalytics.statusCounts.totalRequests >= 4, 'totalRequests must be >= 4');
      assert.ok(toAnalytics.statusCounts.approved >= 2, 'approved count must be >= 2');
      assert.ok(toAnalytics.statusCounts.pending >= 1, 'pending count must be >= 1');
      assert.ok(toAnalytics.statusCounts.refused >= 1, 'refused count must be >= 1');
      assert.strictEqual(toAnalytics.statusCounts.rejected, toAnalytics.statusCounts.refused, 'rejected alias must match refused');
      assert.ok(toAnalytics.statusCounts.totalDays >= 8, 'totalDays must be >= 8');
      assert.ok(toAnalytics.statusCounts.approvedDays >= 5, 'approvedDays must be >= 5');
      pass('6. Time-off metrics match database records (approved, pending, refused, duration days)');
    } catch (err) {
      fail('6. Time-off aggregation', err);
    }

    // ── 7. Time-Off Leave Type Breakdown ──────────────────────────────────────
    try {
      const toAnalytics = await getTimeOffAnalytics({ period: '2026-09' });
      assert.ok(Array.isArray(toAnalytics.byType), 'byType breakdown must be an array');
      assert.ok(toAnalytics.byType.length >= 2, 'Must include at least Paid Leave and Sick Leave');

      const paidLeave = toAnalytics.byType.find((b) => b.type === 'Paid Leave');
      assert.ok(paidLeave, 'Paid Leave breakdown item must exist');
      assert.ok(paidLeave.count >= 2, 'Paid Leave count must be >= 2');
      assert.ok(paidLeave.days >= 3, 'Paid Leave days must be >= 3');
      assert.ok(paidLeave.percentage > 0, 'Percentage must be greater than 0');

      const totalPercentage = toAnalytics.byType.reduce((s, b) => s + b.percentage, 0);
      assert.ok(Math.abs(totalPercentage - 100) <= 1.0, 'Leave type percentages must sum to approximately 100%');
      pass('7. Time-off leave type breakdown with accurate day sums and percentages');
    } catch (err) {
      fail('7. Time-off type breakdown', err);
    }

    // ── 8. Time-Off Department Breakdown ──────────────────────────────────────
    try {
      const toAnalytics = await getTimeOffAnalytics({ period: '2026-09' });
      assert.ok(Array.isArray(toAnalytics.byDepartment), 'byDepartment breakdown must be an array');
      assert.ok(toAnalytics.byDepartment.length >= 1, 'Must contain department breakdown items');

      const firstDept = toAnalytics.byDepartment[0];
      assert.ok(typeof firstDept.department === 'string', 'Department name must be string');
      assert.ok(typeof firstDept.count === 'number' && firstDept.count > 0, 'Request count must be positive');
      assert.ok(typeof firstDept.days === 'number' && firstDept.days > 0, 'Days must be positive');
      assert.ok(typeof firstDept.percentage === 'number' && firstDept.percentage > 0, 'Percentage must be positive');
      pass('8. Time-off department breakdown with accurate counts, days, and percentages');
    } catch (err) {
      fail('8. Time-off department breakdown', err);
    }

    // ── 9. Filter Isolation: Period and Department Filters ─────────────────────
    try {
      // Test Period Filter: Non-existent month
      const pastPeriod = await getAttendanceAnalytics({ period: '2024-01' });
      assert.strictEqual(pastPeriod.statusCounts.total, 0, 'Non-matching period must return 0 attendance records');
      assert.strictEqual(pastPeriod.trends.length, 0, 'Non-matching period must return empty trends array');
      assert.strictEqual(pastPeriod.attendanceRate, null, 'Rate on 0 records must be null');

      // Test Department Filter: Non-existent department
      const ghostDept = await getTimeOffAnalytics({ department: 'NonExistentDept999' });
      assert.strictEqual(ghostDept.statusCounts.totalRequests, 0, 'Non-matching department must return 0 time-off requests');
      assert.strictEqual(ghostDept.byType.length, 0, 'Non-matching department must return empty byType array');
      assert.strictEqual(ghostDept.byDepartment.length, 0, 'Non-matching department must return empty byDepartment array');

      // Test Employee Type Filter: Gracefully handled without SQL errors
      const empTypeFilter = await getAttendanceAnalytics({ employeeType: 'FULL_TIME' });
      assert.ok(empTypeFilter.statusCounts.total >= 0, 'Employee type filter must not error');
      pass('9. Filter isolation: Period, Department, and Employee Type work cleanly');
    } catch (err) {
      fail('9. Filter isolation', err);
    }

    // ── 10. Empty Data Guarantees & Non-Crash Handling ─────────────────────────
    try {
      const emptyAnalytics = await getAttendanceAnalytics({ period: '1999-12', department: 'Ghost' });
      assert.strictEqual(emptyAnalytics.totalRecords, 0);
      assert.strictEqual(emptyAnalytics.statusCounts.present, 0);
      assert.strictEqual(emptyAnalytics.statusCounts.absent, 0);
      assert.strictEqual(emptyAnalytics.statusCounts.late, 0);
      assert.strictEqual(emptyAnalytics.statusCounts.overtime, 0);
      assert.strictEqual(emptyAnalytics.statusCounts.missingCheckout, 0);
      assert.strictEqual(emptyAnalytics.attendanceRate, null);
      assert.deepStrictEqual(emptyAnalytics.trends, []);
      assert.deepStrictEqual(emptyAnalytics.departmentBreakdown, []);

      const emptyTimeOff = await getTimeOffAnalytics({ period: '1999-12', department: 'Ghost' });
      assert.strictEqual(emptyTimeOff.totalRequests, 0);
      assert.strictEqual(emptyTimeOff.totalDays, 0);
      assert.strictEqual(emptyTimeOff.statusCounts.approved, 0);
      assert.strictEqual(emptyTimeOff.statusCounts.pending, 0);
      assert.strictEqual(emptyTimeOff.statusCounts.refused, 0);
      assert.deepStrictEqual(emptyTimeOff.byType, []);
      assert.deepStrictEqual(emptyTimeOff.byDepartment, []);
      pass('10. Zero-data guarantee: Clean numeric 0s, null rates, and empty arrays [] without exceptions');
    } catch (err) {
      fail('10. Zero-data handling', err);
    }

    // ── 11. Endpoint Integration: Summary Inclusion ───────────────────────────
    try {
      const summary = await getDashboardSummary({ period: '2026-09' });
      assert.ok(summary.attendanceAnalytics, 'summary must include attendanceAnalytics');
      assert.ok(summary.timeOffAnalytics, 'summary must include timeOffAnalytics');
      assert.ok(summary.attendanceAnalytics.statusCounts.total >= 5, 'summary attendance total must be >= 5');
      assert.ok(summary.timeOffAnalytics.statusCounts.totalRequests >= 4, 'summary time-off total must be >= 4');
      assert.strictEqual(summary.attendanceRate, summary.attendanceAnalytics.attendanceRate, 'attendanceRate alias must match');
      pass('11. Integration: getDashboardSummary includes attendanceAnalytics and timeOffAnalytics');
    } catch (err) {
      fail('11. Summary integration', err);
    }
  } finally {
    // Clean up seeded test records
    await executeQuery('DELETE FROM attendance_records WHERE id LIKE ?', [`${testPrefix}%`]);
    await executeQuery('DELETE FROM time_off_requests WHERE id LIKE ?', [`${testPrefix}%`]);
    await pool.end();
  }

  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} verification tests failed.`);
  }
});
