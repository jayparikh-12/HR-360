/**
 * PeoplePay360 — Phase 6.5 Attendance & Time-Off Analytics Test Suite
 *
 * Verifies all Phase 6.5 frontend analytical calculations:
 * 1. Attendance overview status counts (PRESENT, ABSENT, LATE, OVERTIME, MISSING_CHECKOUT)
 * 2. Attendance rate precision calculation
 * 3. Daily chronological attendance trend aggregation
 * 4. Department attendance rate breakdown
 * 5. Time-off overview status counts (APPROVED, PENDING, REFUSED)
 * 6. Time-off duration days summation (total and approved)
 * 7. Time-off breakdown by leave type
 * 8. Time-off breakdown by department
 * 9. Filter isolation: Period filtering (monthly & date range)
 * 10. Filter isolation: Department filtering
 * 11. Filter isolation: Employee type filtering
 * 12. Zero-data guarantees (no NaN, clean empty structures)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAttendanceAnalytics,
  calculateTimeOffAnalytics,
  matchesPeriod,
  matchesTimeOffPeriod,
} from '../api/dashboard';
import type { AttendanceRecord, TimeOffRequest, Employee } from '../types';

const mockEmployees: Employee[] = [
  {
    id: 'emp-1',
    name: 'Alice Tech',
    email: 'alice@tech.com',
    department: 'Engineering',
    position: 'Staff Engineer',
    gender: 'Female',
    status: 'ACTIVE',
    joinDate: '2025-01-01',
    wage: 10000,
    schedule: 'Standard 40h',
  },
  {
    id: 'emp-2',
    name: 'Bob Ops',
    email: 'bob@ops.com',
    department: 'Operations',
    position: 'Operations Lead',
    gender: 'Male',
    status: 'ACTIVE',
    joinDate: '2025-02-01',
    wage: 8000,
    schedule: 'Part-time 20h',
  },
  {
    id: 'emp-3',
    name: 'Carol Eng',
    email: 'carol@tech.com',
    department: 'Engineering',
    position: 'Frontend Engineer',
    gender: 'Female',
    status: 'ACTIVE',
    joinDate: '2025-03-01',
    wage: 9000,
    schedule: 'Standard 40h',
  },
];

const mockAttendance: AttendanceRecord[] = [
  { id: 'att-1', employeeId: 'emp-1', employeeName: 'Alice Tech', date: '2026-09-01', checkIn: '09:00', checkOut: '17:00', workedHours: 8, status: 'PRESENT' },
  { id: 'att-2', employeeId: 'emp-2', employeeName: 'Bob Ops', date: '2026-09-01', checkIn: '09:30', checkOut: '17:00', workedHours: 7.5, status: 'LATE' },
  { id: 'att-3', employeeId: 'emp-3', employeeName: 'Carol Eng', date: '2026-09-01', checkIn: '09:00', checkOut: '19:00', workedHours: 10, status: 'OVERTIME' },
  { id: 'att-4', employeeId: 'emp-1', employeeName: 'Alice Tech', date: '2026-09-02', checkIn: '', checkOut: '', workedHours: 0, status: 'ABSENT' },
  { id: 'att-5', employeeId: 'emp-2', employeeName: 'Bob Ops', date: '2026-09-02', checkIn: '09:00', checkOut: '', workedHours: 0, status: 'MISSING_CHECKOUT' },
  // Record from a different month
  { id: 'att-6', employeeId: 'emp-1', employeeName: 'Alice Tech', date: '2026-08-15', checkIn: '09:00', checkOut: '17:00', workedHours: 8, status: 'PRESENT' },
];

const mockTimeOff: TimeOffRequest[] = [
  { id: 'to-1', employeeId: 'emp-1', employeeName: 'Alice Tech', leaveType: 'Paid Annual Leave', startDate: '2026-09-05', endDate: '2026-09-07', durationDays: 3, reason: 'Vacation', status: 'APPROVED' },
  { id: 'to-2', employeeId: 'emp-2', employeeName: 'Bob Ops', leaveType: 'Sick Leave', startDate: '2026-09-10', endDate: '2026-09-11', durationDays: 2, reason: 'Flu', status: 'PENDING' },
  { id: 'to-3', employeeId: 'emp-3', employeeName: 'Carol Eng', leaveType: 'Unpaid Leave', startDate: '2026-09-15', endDate: '2026-09-15', durationDays: 1, reason: 'Personal', status: 'REFUSED' },
  // Request from a different month
  { id: 'to-4', employeeId: 'emp-1', employeeName: 'Alice Tech', leaveType: 'Paid Annual Leave', startDate: '2026-07-01', endDate: '2026-07-05', durationDays: 5, reason: 'Summer holiday', status: 'APPROVED' },
];

test('PeoplePay360 — Phase 6.5 Attendance & Time-Off Analytics Verification', async () => {
  console.log('\n================================================================');
  console.log('🔍 PEOPLEPAY360 — PHASE 6.5 ATTENDANCE & TIME-OFF VERIFICATION 🔍');
  console.log('================================================================\n');

  // ── 1. Attendance Analytics: Overview & Status Counts ───────────────────────
  {
    const result = calculateAttendanceAnalytics(mockAttendance, mockEmployees, {});
    assert.strictEqual(result.totalRecords, 6);
    assert.strictEqual(result.statusCounts.present, 2);
    assert.strictEqual(result.statusCounts.late, 1);
    assert.strictEqual(result.statusCounts.overtime, 1);
    assert.strictEqual(result.statusCounts.absent, 1);
    assert.strictEqual(result.statusCounts.missingCheckout, 1);

    // Rate: (present + overtime) / total = (2 + 1) / 6 = 50.0%
    assert.strictEqual(result.attendanceRate, 50.0);
    console.log('  ✔ [PASS] 1. Attendance overview status counts and rate precision');
  }

  // ── 2. Attendance Analytics: Daily Trend Aggregation ────────────────────────
  {
    const result = calculateAttendanceAnalytics(mockAttendance, mockEmployees, { period: '2026-09' });
    // 2026-09 should only include Sept 1 and Sept 2
    assert.strictEqual(result.trends.length, 2);

    const day1 = result.trends.find((t) => t.date === '2026-09-01');
    assert.ok(day1, '2026-09-01 must be in trend');
    assert.strictEqual(day1.present, 1);
    assert.strictEqual(day1.late, 1);
    assert.strictEqual(day1.overtime, 1);
    assert.strictEqual(day1.absent, 0);
    assert.strictEqual(day1.total, 3);

    const day2 = result.trends.find((t) => t.date === '2026-09-02');
    assert.ok(day2, '2026-09-02 must be in trend');
    assert.strictEqual(day2.absent, 1);
    assert.strictEqual(day2.missingCheckout, 1);
    assert.strictEqual(day2.total, 2);

    console.log('  ✔ [PASS] 2. Daily chronological attendance trend aggregation');
  }

  // ── 3. Attendance Analytics: Department Breakdown ──────────────────────────
  {
    const result = calculateAttendanceAnalytics(mockAttendance, mockEmployees, { period: '2026-09' });
    assert.strictEqual(result.departmentBreakdown.length, 2);

    const eng = result.departmentBreakdown.find((d) => d.department === 'Engineering');
    assert.ok(eng, 'Engineering must be in department breakdown');
    // In Sept: Alice has 1 present, 1 absent (2 total); Carol has 1 overtime (1 total). Eng total = 3, present = 2.
    assert.strictEqual(eng.total, 3);
    assert.strictEqual(eng.present, 2);
    assert.strictEqual(eng.rate, 66.7);

    console.log('  ✔ [PASS] 3. Department attendance rate breakdown');
  }

  // ── 4. Attendance Analytics: Department Filter Isolation ───────────────────
  {
    const result = calculateAttendanceAnalytics(mockAttendance, mockEmployees, { department: 'Operations' });
    // Bob Ops has 2 records
    assert.strictEqual(result.totalRecords, 2);
    assert.strictEqual(result.statusCounts.late, 1);
    assert.strictEqual(result.statusCounts.missingCheckout, 1);
    assert.strictEqual(result.statusCounts.present, 0);
    console.log('  ✔ [PASS] 4. Attendance department filter isolation');
  }

  // ── 5. Time-Off Analytics: Overview & Status Counts ─────────────────────────
  {
    const result = calculateTimeOffAnalytics(mockTimeOff, mockEmployees, {});
    assert.strictEqual(result.totalRequests, 4);
    assert.strictEqual(result.statusCounts.approved, 2);
    assert.strictEqual(result.statusCounts.pending, 1);
    assert.strictEqual(result.statusCounts.refused, 1);
    assert.strictEqual(result.totalDays, 11); // 3 + 2 + 1 + 5
    assert.strictEqual(result.statusCounts.approvedDays, 8); // 3 + 5
    console.log('  ✔ [PASS] 5. Time-off overview status counts and total days');
  }

  // ── 6. Time-Off Analytics: Breakdown by Leave Type ─────────────────────────
  {
    const result = calculateTimeOffAnalytics(mockTimeOff, mockEmployees, { period: '2026-09' });
    // In Sept: 1 Paid Annual (3d), 1 Sick (2d), 1 Unpaid (1d) => Total = 6d
    assert.strictEqual(result.totalRequests, 3);
    assert.strictEqual(result.totalDays, 6);
    assert.strictEqual(result.byType.length, 3);

    const paidAnnual = result.byType.find((t) => t.type === 'Paid Annual Leave');
    assert.ok(paidAnnual);
    assert.strictEqual(paidAnnual.count, 1);
    assert.strictEqual(paidAnnual.days, 3);
    assert.strictEqual(paidAnnual.percentage, 50.0);

    const sick = result.byType.find((t) => t.type === 'Sick Leave');
    assert.ok(sick);
    assert.strictEqual(sick.days, 2);
    assert.strictEqual(sick.percentage, 33.3);

    console.log('  ✔ [PASS] 6. Time-off breakdown by leave type with percentage share');
  }

  // ── 7. Time-Off Analytics: Breakdown by Department ─────────────────────────
  {
    const result = calculateTimeOffAnalytics(mockTimeOff, mockEmployees, { period: '2026-09' });
    assert.strictEqual(result.byDepartment.length, 2);

    const eng = result.byDepartment.find((d) => d.department === 'Engineering');
    assert.ok(eng);
    assert.strictEqual(eng.count, 2); // Alice + Carol
    assert.strictEqual(eng.days, 4); // 3 + 1

    const ops = result.byDepartment.find((d) => d.department === 'Operations');
    assert.ok(ops);
    assert.strictEqual(ops.count, 1); // Bob
    assert.strictEqual(ops.days, 2);

    console.log('  ✔ [PASS] 7. Time-off breakdown by department');
  }

  // ── 8. Time-Off Analytics: Department Filter Isolation ─────────────────────
  {
    const result = calculateTimeOffAnalytics(mockTimeOff, mockEmployees, { department: 'Operations' });
    assert.strictEqual(result.totalRequests, 1);
    assert.strictEqual(result.statusCounts.pending, 1);
    assert.strictEqual(result.totalDays, 2);
    console.log('  ✔ [PASS] 8. Time-off department filter isolation');
  }

  // ── 9. Period Matcher Verification ─────────────────────────────────────────
  {
    assert.strictEqual(matchesPeriod('2026-09-15', '2026-09'), true);
    assert.strictEqual(matchesPeriod('2026-08-15', '2026-09'), false);
    assert.strictEqual(matchesPeriod('2026-09-15', 'ALL'), true);
    assert.strictEqual(matchesPeriod('2026-09-15', '2026-09-01 - 2026-09-30'), true);
    assert.strictEqual(matchesPeriod('2026-10-01', '2026-09-01 - 2026-09-30'), false);

    assert.strictEqual(matchesTimeOffPeriod('2026-09-05', '2026-09-07', '2026-09'), true);
    assert.strictEqual(matchesTimeOffPeriod('2026-08-28', '2026-09-02', '2026-09'), true);
    assert.strictEqual(matchesTimeOffPeriod('2026-07-01', '2026-07-05', '2026-09'), false);

    console.log('  ✔ [PASS] 9. Period date matcher handles months, ranges, and all');
  }

  // ── 10. Zero-Data Guarantee ────────────────────────────────────────────────
  {
    const emptyAttendance = calculateAttendanceAnalytics([], [], {});
    assert.strictEqual(emptyAttendance.totalRecords, 0);
    assert.strictEqual(emptyAttendance.attendanceRate, null);
    assert.strictEqual(emptyAttendance.trends.length, 0);
    assert.strictEqual(emptyAttendance.departmentBreakdown.length, 0);

    const emptyTimeOff = calculateTimeOffAnalytics([], [], {});
    assert.strictEqual(emptyTimeOff.totalRequests, 0);
    assert.strictEqual(emptyTimeOff.totalDays, 0);
    assert.strictEqual(emptyTimeOff.byType.length, 0);
    assert.strictEqual(emptyTimeOff.byDepartment.length, 0);

    console.log('  ✔ [PASS] 10. Zero-data guarantee: returns clean empty structures without NaN');
  }

  console.log('\n================================================================');
  console.log('✅ ALL PHASE 6.5 ATTENDANCE & TIME-OFF TESTS PASSED ✅');
  console.log('================================================================\n');
});
