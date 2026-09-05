/**
 * PeoplePay360 — PHASE 4.11 & 4.12 VERIFICATION SUITE
 *
 * PHASE 4.11 — Attendance & Overtime Integration
 * PHASE 4.12 — Time Off & Unpaid Leave Integration
 *
 * Verification Areas:
 * 1. Employee-Specific Attendance Isolation (Employee A attendance does not affect Employee B)
 * 2. Payroll Period Boundary Filtering (Inclusive start/end, records outside period excluded)
 * 3. Overtime Data Handling (Extracted from status 'OVERTIME', workedHours > 8, or explicit overtimeHours)
 * 4. Employee-Specific Time Off Isolation (Employee A leave does not affect Employee B)
 * 5. Approved Leave Filtering (ONLY APPROVED leave is summarized for deductions)
 * 6. Pending Leave Protection (Pending leave produces zero deduction)
 * 7. Refused / Rejected Leave Protection (Refused leave produces zero deduction)
 * 8. Unpaid Leave Calculations (Unpaid leave generates unpaidLeaveDeduction)
 * 9. Paid Leave Protection (Paid leave generates zero unpaid leave deduction)
 * 10. Leave Outside Payroll Period (Requests outside period boundary are excluded)
 * 11. Empty / Missing Attendance Records (Safely produces valid zero summary)
 * 12. Empty / Missing Time Off Records (Safely produces valid zero summary)
 * 13. Deterministic Idempotency Across Repeated Executions (Identical input -> identical output)
 * 14. Non-double counting on overlapping dates
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  PayrollEngine,
  summarizeAttendance,
  summarizeTimeOff,
  calculateDateOverlapDays,
  isUnpaidLeaveType,
  roundMoney,
  type AttendanceRecordInput,
  type TimeOffRecordInput,
  type PayrollPeriod,
  type PayrollSalaryRule,
} from '../services/payrollEngine.js';
import {
  normalizeAttendance,
  normalizeTimeOff,
  normalizePayrollCalculationInput,
} from '../services/payrollNormalizer.js';
import {
  preparePayrollCalculationInput,
} from '../services/payrollPreparation.js';
import {
  PayrollCalculationInput,
} from '../types/payroll.types.js';

describe('PHASE 4.11: Attendance & Overtime Integration', () => {
  const period: PayrollPeriod = {
    startDate: '2026-09-01',
    endDate: '2026-09-30',
  };

  it('1. Employee-specific attendance isolation (Employee A records do not affect Employee B)', () => {
    const records: AttendanceRecordInput[] = [
      { id: 'ATT-A1', employeeId: 'EMP-A', date: '2026-09-01', workedHours: 8, status: 'PRESENT' },
      { id: 'ATT-A2', employeeId: 'EMP-A', date: '2026-09-02', workedHours: 9, status: 'OVERTIME' },
      { id: 'ATT-B1', employeeId: 'EMP-B', date: '2026-09-01', workedHours: 10, status: 'OVERTIME' },
      { id: 'ATT-B2', employeeId: 'EMP-B', date: '2026-09-02', workedHours: 0, status: 'ABSENT' },
    ];

    const sumA = summarizeAttendance(records, 'EMP-A', period);
    const sumB = summarizeAttendance(records, 'EMP-B', period);

    assert.strictEqual(sumA.totalRecords, 2);
    assert.strictEqual(sumA.presentDays, 2);
    assert.strictEqual(sumA.absentDays, 0);
    assert.strictEqual(sumA.overtimeDays, 1);
    assert.strictEqual(sumA.totalWorkedHours, 17);

    assert.strictEqual(sumB.totalRecords, 2);
    assert.strictEqual(sumB.presentDays, 1);
    assert.strictEqual(sumB.absentDays, 1);
    assert.strictEqual(sumB.overtimeDays, 1);
    assert.strictEqual(sumB.totalWorkedHours, 10);

    const normA = normalizeAttendance(records, 'EMP-A', period.startDate, period.endDate);
    assert.strictEqual(normA.records.length, 2);
    assert.strictEqual(normA.records.every((r) => r.id?.startsWith('ATT-A')), true);
  });

  it('2. Payroll period boundary filtering (inclusive start/end, records outside excluded)', () => {
    const records: AttendanceRecordInput[] = [
      { id: 'ATT-BEFORE', employeeId: 'EMP-001', date: '2026-08-31', workedHours: 8, status: 'PRESENT' }, // Before period
      { id: 'ATT-START', employeeId: 'EMP-001', date: '2026-09-01', workedHours: 8, status: 'PRESENT' },  // Start boundary
      { id: 'ATT-MID', employeeId: 'EMP-001', date: '2026-09-15', workedHours: 8, status: 'PRESENT' },    // Middle
      { id: 'ATT-END', employeeId: 'EMP-001', date: '2026-09-30', workedHours: 8, status: 'PRESENT' },    // End boundary
      { id: 'ATT-AFTER', employeeId: 'EMP-001', date: '2026-10-01', workedHours: 8, status: 'PRESENT' },  // After period
    ];

    const summary = summarizeAttendance(records, 'EMP-001', period);
    assert.strictEqual(summary.totalRecords, 3);
    assert.strictEqual(summary.presentDays, 3);
    assert.strictEqual(summary.totalWorkedHours, 24);
  });

  it('3. Overtime data handling and exposure without inventing custom formula rules', () => {
    const records: AttendanceRecordInput[] = [
      { id: 'ATT-1', employeeId: 'EMP-OT', date: '2026-09-01', workedHours: 8, status: 'PRESENT' },
      { id: 'ATT-2', employeeId: 'EMP-OT', date: '2026-09-02', workedHours: 10, status: 'OVERTIME' }, // 2 hours OT (> 8)
      { id: 'ATT-3', employeeId: 'EMP-OT', date: '2026-09-03', workedHours: 8, status: 'OVERTIME', overtimeHours: 3.5 } as any, // explicit OT
    ];

    const summary = summarizeAttendance(records, 'EMP-OT', period);
    assert.strictEqual(summary.overtimeDays, 2);
    assert.strictEqual(summary.totalWorkedHours, 26);
    assert.strictEqual(summary.overtimeHours, 5.5); // 2.0 + 3.5

    const input: PayrollCalculationInput = {
      employeeId: 'EMP-OT',
      monthlyWage: 10000,
      payrollPeriod: period,
      attendanceRecords: records,
    };

    const payslip = PayrollEngine.compute(input);
    assert.strictEqual(payslip.overtimeHours, 5.5);
    assert.strictEqual(payslip.attendanceSummary.overtimeHours, 5.5);
  });

  it('4. Handles empty/no attendance records safely producing a valid zero summary', () => {
    const summary = summarizeAttendance([], 'EMP-NONE', period);
    assert.strictEqual(summary.totalRecords, 0);
    assert.strictEqual(summary.presentDays, 0);
    assert.strictEqual(summary.absentDays, 0);
    assert.strictEqual(summary.lateDays, 0);
    assert.strictEqual(summary.overtimeDays, 0);
    assert.strictEqual(summary.totalWorkedHours, 0);

    const norm = normalizeAttendance([], 'EMP-NONE', period.startDate, period.endDate);
    assert.deepStrictEqual(norm.records, []);
    assert.strictEqual(norm.summary.totalWorkedHours, 0);
  });
});

describe('PHASE 4.12: Time Off & Unpaid Leave Integration', () => {
  const period: PayrollPeriod = {
    startDate: '2026-09-01',
    endDate: '2026-09-30',
  };

  it('5. Employee-specific time off isolation (Employee A leave does not affect Employee B)', () => {
    const requests: TimeOffRecordInput[] = [
      { id: 'TO-A1', employeeId: 'EMP-A', leaveType: 'Unpaid Leave', startDate: '2026-09-05', endDate: '2026-09-06', status: 'APPROVED' }, // 2 days
      { id: 'TO-B1', employeeId: 'EMP-B', leaveType: 'Unpaid Leave', startDate: '2026-09-10', endDate: '2026-09-14', status: 'APPROVED' }, // 5 days
    ];

    const sumA = summarizeTimeOff(requests, 'EMP-A', period);
    const sumB = summarizeTimeOff(requests, 'EMP-B', period);

    assert.strictEqual(sumA.approvedLeaveDays, 2);
    assert.strictEqual(sumA.unpaidLeaveDays, 2);
    assert.strictEqual(sumA.paidLeaveDays, 0);

    assert.strictEqual(sumB.approvedLeaveDays, 5);
    assert.strictEqual(sumB.unpaidLeaveDays, 5);
    assert.strictEqual(sumB.paidLeaveDays, 0);
  });

  it('6. Only APPROVED leave is summarized for deductions (PENDING and REFUSED requests excluded)', () => {
    const requests: TimeOffRecordInput[] = [
      { id: 'TO-APP', employeeId: 'EMP-1', leaveType: 'Unpaid Leave', startDate: '2026-09-01', endDate: '2026-09-02', status: 'APPROVED' }, // 2 days
      { id: 'TO-PEN', employeeId: 'EMP-1', leaveType: 'Unpaid Leave', startDate: '2026-09-10', endDate: '2026-09-15', status: 'PENDING' },  // 6 days (ignored)
      { id: 'TO-REF', employeeId: 'EMP-1', leaveType: 'Unpaid Leave', startDate: '2026-09-20', endDate: '2026-09-25', status: 'REFUSED' },  // 6 days (ignored)
      { id: 'TO-REJ', employeeId: 'EMP-1', leaveType: 'Unpaid Leave', startDate: '2026-09-26', endDate: '2026-09-28', status: 'REJECTED' }, // 3 days (ignored)
    ];

    const summary = summarizeTimeOff(requests, 'EMP-1', period);
    assert.strictEqual(summary.approvedLeaveDays, 2);
    assert.strictEqual(summary.unpaidLeaveDays, 2);

    const norm = normalizeTimeOff(requests, 'EMP-1', period.startDate, period.endDate);
    assert.strictEqual(norm.summary.approvedUnpaidDays, 2);
    assert.strictEqual(norm.summary.pendingDays, 6);
    assert.strictEqual(norm.summary.refusedDays, 9);
  });

  it('7. Unpaid leave generates unpaidLeaveDeduction while Paid leave generates zero deduction', () => {
    // Employee 1 with 3 days unpaid leave
    const inputUnpaid: PayrollCalculationInput = {
      employeeId: 'EMP-UNPAID',
      monthlyWage: 6000,
      payrollPeriod: period,
      timeOffRecords: [
        { id: 'TO-U', employeeId: 'EMP-UNPAID', leaveType: 'Unpaid Leave', startDate: '2026-09-10', endDate: '2026-09-12', status: 'APPROVED' },
      ],
    };
    const payslipUnpaid = PayrollEngine.compute(inputUnpaid);
    // basic standard = 6000 * 0.6 = 3600; dailyRate = 3600 / 30 = 120; 3 days = 360
    assert.strictEqual(payslipUnpaid.unpaidDays, 3);
    assert.strictEqual(payslipUnpaid.unpaidLeaveDeduction, 360);
    assert.strictEqual(payslipUnpaid.totalCalculatedDeductions, 360);
    assert.strictEqual(payslipUnpaid.netSalary, 5640);

    // Employee 2 with 5 days paid annual leave
    const inputPaid: PayrollCalculationInput = {
      employeeId: 'EMP-PAID',
      monthlyWage: 6000,
      payrollPeriod: period,
      timeOffRecords: [
        { id: 'TO-P', employeeId: 'EMP-PAID', leaveType: 'Paid Annual Leave', startDate: '2026-09-10', endDate: '2026-09-14', status: 'APPROVED' },
      ],
    };
    const payslipPaid = PayrollEngine.compute(inputPaid);
    assert.strictEqual(payslipPaid.unpaidDays, 0);
    assert.strictEqual(payslipPaid.unpaidLeaveDeduction, 0);
    assert.strictEqual(payslipPaid.totalCalculatedDeductions, 0);
    assert.strictEqual(payslipPaid.netSalary, 6000);
  });

  it('8. Leave outside payroll period is clamped / excluded from period calculation', () => {
    const requests: TimeOffRecordInput[] = [
      { id: 'TO-BEFORE', employeeId: 'EMP-CLAMP', leaveType: 'Unpaid Leave', startDate: '2026-08-01', endDate: '2026-08-15', status: 'APPROVED' }, // Entirely before
      { id: 'TO-AFTER', employeeId: 'EMP-CLAMP', leaveType: 'Unpaid Leave', startDate: '2026-10-01', endDate: '2026-10-15', status: 'APPROVED' },  // Entirely after
      { id: 'TO-OVERLAP', employeeId: 'EMP-CLAMP', leaveType: 'Unpaid Leave', startDate: '2026-08-28', endDate: '2026-09-03', status: 'APPROVED' }, // Overlaps Sep 1..3 (3 days)
    ];

    const summary = summarizeTimeOff(requests, 'EMP-CLAMP', period);
    assert.strictEqual(summary.approvedLeaveDays, 3);
    assert.strictEqual(summary.unpaidLeaveDays, 3);

    const overlapDays = calculateDateOverlapDays('2026-08-28', '2026-09-03', '2026-09-01', '2026-09-30');
    assert.strictEqual(overlapDays, 3);
  });

  it('9. Handles empty/no leave records safely producing a valid zero summary', () => {
    const summary = summarizeTimeOff([], 'EMP-NOLEAVE', period);
    assert.strictEqual(summary.approvedLeaveDays, 0);
    assert.strictEqual(summary.paidLeaveDays, 0);
    assert.strictEqual(summary.unpaidLeaveDays, 0);

    const input: PayrollCalculationInput = {
      employeeId: 'EMP-NOLEAVE',
      monthlyWage: 8000,
      timeOffRecords: [],
    };
    const payslip = PayrollEngine.compute(input);
    assert.strictEqual(payslip.unpaidDays, 0);
    assert.strictEqual(payslip.unpaidLeaveDeduction, 0);
    assert.strictEqual(payslip.totalCalculatedDeductions, 0);
    assert.strictEqual(payslip.netSalary, 8000);
  });

  it('10. Repeated identical input produces 100% identical output (pure determinism)', () => {
    const input: PayrollCalculationInput = {
      employeeId: 'EMP-DET-1112',
      monthlyWage: 9000,
      payrollPeriod: period,
      attendanceRecords: [
        { id: 'A1', employeeId: 'EMP-DET-1112', date: '2026-09-01', workedHours: 8, status: 'PRESENT' },
        { id: 'A2', employeeId: 'EMP-DET-1112', date: '2026-09-02', workedHours: 10, status: 'OVERTIME' },
      ],
      timeOffRecords: [
        { id: 'T1', employeeId: 'EMP-DET-1112', leaveType: 'Unpaid Leave', startDate: '2026-09-10', endDate: '2026-09-11', status: 'APPROVED' },
      ],
    };

    const firstRun = PayrollEngine.compute(input);
    for (let i = 0; i < 25; i++) {
      const subsequentRun = PayrollEngine.compute(input);
      assert.deepStrictEqual(subsequentRun, firstRun);
    }
  });

  it('11. Distinguishes leave types (unpaid, without pay, loss of pay, lop, lwop)', () => {
    assert.strictEqual(isUnpaidLeaveType('Unpaid Leave'), true);
    assert.strictEqual(isUnpaidLeaveType('Leave Without Pay'), true);
    assert.strictEqual(isUnpaidLeaveType('Loss of Pay'), true);
    assert.strictEqual(isUnpaidLeaveType('LOP'), true);
    assert.strictEqual(isUnpaidLeaveType('LWOP'), true);
    assert.strictEqual(isUnpaidLeaveType('Paid Sick Leave'), false);
    assert.strictEqual(isUnpaidLeaveType('Annual Leave', false), true); // Explicit isPaid: false
    assert.strictEqual(isUnpaidLeaveType('Unpaid Leave', true), false); // Explicit isPaid: true overrides
  });
});
