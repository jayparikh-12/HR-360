/**
 * Phase 7.3: Database & Data Integrity Hardening Test Suite
 *
 * Verifies relational integrity, foreign key enforcement, check constraints,
 * unique constraints, historical payroll preservation, transaction safety,
 * and regression compatibility against live MySQL database.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, executeQuery } from '../config/database.js';
import { deleteEmployee, getEmployeeById } from '../repositories/employee.repository.js';
import { getAllContracts, getContractsByEmployeeId, getActiveContractByEmployeeId } from '../repositories/contract.repository.js';
import { createCheckIn, recordCheckOut, getAttendanceById } from '../repositories/attendance.repository.js';
import { createTimeOffRequest, getTimeOffRequestById } from '../repositories/timeOff.repository.js';
import { PayrunComputeService } from '../services/payrunCompute.service.js';
import { PayrunValidationService } from '../services/payrunValidation.service.js';
import { PayrunPaymentService } from '../services/payrunPayment.service.js';
import { getPayrollSnapshotsByPayrun } from '../repositories/payrollSnapshot.repository.js';
import { getPayrunById } from '../repositories/payrun.repository.js';
import { ResultSetHeader } from 'mysql2/promise';

describe('Phase 7.3: Database & Data Integrity Hardening', () => {

  const testSuffix = `T${Date.now()}`;
  const testEmpId = `EMP-TEST-${testSuffix}`;
  const testEmpEmail = `test.${testSuffix}@example.com`;
  const testPayrunId = `PR-TEST-${testSuffix}`;

  before(async () => {
    // Cleanup any lingering test records
    await executeQuery('DELETE FROM payslips WHERE payrun_id = ?', [testPayrunId]);
    await executeQuery('DELETE FROM payruns WHERE id = ?', [testPayrunId]);
    await executeQuery('DELETE FROM attendance_records WHERE employee_id = ?', [testEmpId]);
    await executeQuery('DELETE FROM time_off_requests WHERE employee_id = ?', [testEmpId]);
    await executeQuery('DELETE FROM contracts WHERE employee_id = ?', [testEmpId]);
    await executeQuery('DELETE FROM employees WHERE id = ? OR email = ?', [testEmpId, testEmpEmail]);
  });

  after(async () => {
    // Teardown
    await executeQuery('DELETE FROM payslips WHERE payrun_id = ?', [testPayrunId]);
    await executeQuery('DELETE FROM payruns WHERE id = ?', [testPayrunId]);
    await executeQuery('DELETE FROM attendance_records WHERE employee_id = ?', [testEmpId]);
    await executeQuery('DELETE FROM time_off_requests WHERE employee_id = ?', [testEmpId]);
    await executeQuery('DELETE FROM contracts WHERE employee_id = ?', [testEmpId]);
    await executeQuery('DELETE FROM employees WHERE id = ? OR email = ?', [testEmpId, testEmpEmail]);
  });

  // ── 1. Schema & Constraints Verification ────────────────────────────────────
  describe('1. Schema & Constraints Inspection', () => {
    it('verifies all 9 core tables exist in the database', async () => {
      const expectedTables = [
        'employees',
        'working_schedules',
        'salary_structures',
        'salary_rules',
        'contracts',
        'attendance_records',
        'time_off_requests',
        'payruns',
        'payslips',
      ];
      const rows = await executeQuery<any[]>('SHOW TABLES');
      const tableNames = rows.map((r) => Object.values(r)[0]);
      for (const t of expectedTables) {
        assert.ok(tableNames.includes(t), `Table ${t} should exist`);
      }
    });

    it('verifies fk_payslips_employee has ON DELETE RESTRICT to protect historical payroll', async () => {
      const rows = await executeQuery<any[]>(`
        SELECT CONSTRAINT_NAME, DELETE_RULE, UPDATE_RULE 
        FROM information_schema.REFERENTIAL_CONSTRAINTS 
        WHERE CONSTRAINT_SCHEMA = 'peoplepay360' AND CONSTRAINT_NAME = 'fk_payslips_employee'
      `);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].DELETE_RULE, 'RESTRICT', 'fk_payslips_employee must be ON DELETE RESTRICT');
      assert.equal(rows[0].UPDATE_RULE, 'CASCADE', 'fk_payslips_employee must be ON UPDATE CASCADE');
    });

    it('verifies all domain check constraints exist in MySQL', async () => {
      const rows = await executeQuery<any[]>(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.CHECK_CONSTRAINTS 
        WHERE CONSTRAINT_SCHEMA = 'peoplepay360'
      `);
      const checkNames = rows.map((r) => r.CONSTRAINT_NAME);
      assert.ok(checkNames.includes('chk_time_off_dates'), 'chk_time_off_dates must exist');
      assert.ok(checkNames.includes('chk_contracts_dates'), 'chk_contracts_dates must exist');
      assert.ok(checkNames.includes('chk_contracts_wage'), 'chk_contracts_wage must exist');
      assert.ok(checkNames.includes('chk_attendance_worked_hours'), 'chk_attendance_worked_hours must exist');
    });

    it('verifies performance and foreign key indexes exist', async () => {
      const checkIndex = async (table: string, indexName: string) => {
        const rows = await executeQuery<any[]>(`SHOW INDEX FROM ${table} WHERE Key_name = ?`, [indexName]);
        assert.ok(rows.length > 0, `Index ${indexName} on ${table} must exist`);
      };

      await checkIndex('attendance_records', 'idx_attendance_emp_date');
      await checkIndex('attendance_records', 'idx_attendance_date');
      await checkIndex('time_off_requests', 'idx_time_off_emp_status');
      await checkIndex('time_off_requests', 'idx_time_off_dates');
      await checkIndex('employees', 'idx_employees_dept_status');
      await checkIndex('payruns', 'idx_payruns_period_status');
    });
  });

  // ── 2. Primary Key & Unique Constraints ──────────────────────────────────────
  describe('2. Primary Key & Unique Constraints', () => {
    it('creates a valid employee successfully', async () => {
      await executeQuery(
        'INSERT INTO employees (id, empCode, firstName, lastName, email, department, jobPosition, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
        [testEmpId, `CODE-${testSuffix}`, 'Integrity Test', 'Employee', testEmpEmail, 'Engineering', 'QA Engineer', 'ACTIVE']
      );
      const emp = await getEmployeeById(testEmpId);
      assert.ok(emp);
      assert.equal(emp.id, testEmpId);
      assert.equal(emp.email, testEmpEmail);
    });

    it('rejects duplicate primary key in employees', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query(
            'INSERT INTO employees (id, empCode, firstName, lastName, email, department, jobPosition, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [testEmpId, `CODE-DUP-${testSuffix}`, 'Duplicate PK', 'Employee', `other.${testSuffix}@example.com`, 'Engineering', 'QA', 'ACTIVE']
          );
        }, (err: any) => err.code === 'ER_DUP_ENTRY');
      } finally {
        conn.release();
      }
    });

    it('rejects duplicate employee email (UNIQUE email constraint)', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query(
            'INSERT INTO employees (id, empCode, firstName, lastName, email, department, jobPosition, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [`${testEmpId}-DIFF`, `CODE-DIFF-${testSuffix}`, 'Duplicate Email', 'Employee', testEmpEmail, 'Engineering', 'QA', 'ACTIVE']
          );
        }, (err: any) => err.code === 'ER_DUP_ENTRY');
      } finally {
        conn.release();
      }
    });

    it('rejects duplicate working schedule name (uq_working_schedules_name)', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query(
            'INSERT INTO working_schedules (id, name, weekly_hours) VALUES (?, ?, ?)',
            [`SCH-DUP-${testSuffix}`, 'Standard 40h Regular', 40.0]
          );
        }, (err: any) => err.code === 'ER_DUP_ENTRY');
      } finally {
        conn.release();
      }
    });

    it('rejects duplicate salary structure code', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query(
            'INSERT INTO salary_structures (id, name, code) VALUES (?, ?, ?)',
            [`STR-DUP-${testSuffix}`, 'Duplicate Code Structure', 'TECH_STD']
          );
        }, (err: any) => err.code === 'ER_DUP_ENTRY');
      } finally {
        conn.release();
      }
    });
  });

  // ── 3. Foreign Key Integrity ────────────────────────────────────────────────
  describe('3. Foreign Key Integrity & Orphan Prevention', () => {
    const nonExistentEmpId = `EMP-NONEXISTENT-${testSuffix}`;

    it('rejects contract creation with nonexistent employee_id', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query(
            'INSERT INTO contracts (id, employee_id, salary_structure_id, working_schedule_id, wage, start_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [`CON-INV-${testSuffix}`, nonExistentEmpId, 'STR-001', 'SCH-001', 5000.0, '2024-01-01', 'ACTIVE']
          );
        }, (err: any) => err.code === 'ER_NO_REFERENCED_ROW_2');
      } finally {
        conn.release();
      }
    });

    it('rejects contract creation with nonexistent salary_structure_id', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query(
            'INSERT INTO contracts (id, employee_id, salary_structure_id, working_schedule_id, wage, start_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [`CON-INV-${testSuffix}`, testEmpId, 'STR-NONEXISTENT', 'SCH-001', 5000.0, '2024-01-01', 'ACTIVE']
          );
        }, (err: any) => err.code === 'ER_NO_REFERENCED_ROW_2');
      } finally {
        conn.release();
      }
    });

    it('rejects contract creation with nonexistent working_schedule_id', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query(
            'INSERT INTO contracts (id, employee_id, salary_structure_id, working_schedule_id, wage, start_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [`CON-INV-${testSuffix}`, testEmpId, 'STR-001', 'SCH-NONEXISTENT', 5000.0, '2024-01-01', 'ACTIVE']
          );
        }, (err: any) => err.code === 'ER_NO_REFERENCED_ROW_2');
      } finally {
        conn.release();
      }
    });

    it('rejects attendance record with nonexistent employee_id', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query(
            'INSERT INTO attendance_records (id, employee_id, date, check_in, status) VALUES (?, ?, ?, ?, ?)',
            [`ATT-INV-${testSuffix}`, nonExistentEmpId, '2024-05-01', '09:00 AM', 'PRESENT']
          );
        }, (err: any) => err.code === 'ER_NO_REFERENCED_ROW_2');
      } finally {
        conn.release();
      }
    });

    it('rejects time-off request with nonexistent employee_id', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query(
            'INSERT INTO time_off_requests (id, employee_id, leave_type, start_date, end_date, duration_days, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [`TO-INV-${testSuffix}`, nonExistentEmpId, 'Paid Leave', '2024-05-01', '2024-05-03', 3, 'PENDING']
          );
        }, (err: any) => err.code === 'ER_NO_REFERENCED_ROW_2');
      } finally {
        conn.release();
      }
    });

    it('rejects payslip with nonexistent employee_id', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query(
            `INSERT INTO payslips (id, payrun_id, employee_id, basic, hra, allowance, gross, tax, other_deductions, net, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [`PS-INV-${testSuffix}`, 'PR-001', nonExistentEmpId, 3000, 1000, 500, 4500, 400, 200, 3900, 'COMPUTED']
          );
        }, (err: any) => err.code === 'ER_NO_REFERENCED_ROW_2');
      } finally {
        conn.release();
      }
    });

    it('rejects payslip with nonexistent payrun_id', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query(
            `INSERT INTO payslips (id, payrun_id, employee_id, basic, hra, allowance, gross, tax, other_deductions, net, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [`PS-INV-${testSuffix}`, 'PR-NONEXISTENT', testEmpId, 3000, 1000, 500, 4500, 400, 200, 3900, 'COMPUTED']
          );
        }, (err: any) => err.code === 'ER_NO_REFERENCED_ROW_2');
      } finally {
        conn.release();
      }
    });
  });

  // ── 4. Domain Check Constraints ─────────────────────────────────────────────
  describe('4. Domain Check Constraints', () => {
    it('rejects negative contract wage via chk_contracts_wage', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query(
            'INSERT INTO contracts (id, employee_id, salary_structure_id, working_schedule_id, wage, start_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [`CON-NEG-${testSuffix}`, testEmpId, 'STR-001', 'SCH-001', -1500.0, '2024-01-01', 'ACTIVE']
          );
        }, (err: any) => err.code === 'ER_CHECK_CONSTRAINT_VIOLATED');
      } finally {
        conn.release();
      }
    });

    it('rejects contract with end_date before start_date via chk_contracts_dates', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query(
            'INSERT INTO contracts (id, employee_id, salary_structure_id, working_schedule_id, wage, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [`CON-DATE-${testSuffix}`, testEmpId, 'STR-001', 'SCH-001', 5000.0, '2024-06-01', '2024-05-01', 'ACTIVE']
          );
        }, (err: any) => err.code === 'ER_CHECK_CONSTRAINT_VIOLATED');
      } finally {
        conn.release();
      }
    });

    it('rejects time-off request with end_date before start_date via chk_time_off_dates', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query(
            'INSERT INTO time_off_requests (id, employee_id, leave_type, start_date, end_date, duration_days, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [`TO-DATE-${testSuffix}`, testEmpId, 'Paid Leave', '2024-06-10', '2024-06-05', 1, 'PENDING']
          );
        }, (err: any) => err.code === 'ER_CHECK_CONSTRAINT_VIOLATED');
      } finally {
        conn.release();
      }
    });

    it('rejects attendance with negative worked_hours via chk_attendance_worked_hours', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query(
            'INSERT INTO attendance_records (id, employee_id, date, check_in, worked_hours, status) VALUES (?, ?, ?, ?, ?, ?)',
            [`ATT-NEG-${testSuffix}`, testEmpId, '2024-05-01', '09:00 AM', -4.5, 'PRESENT']
          );
        }, (err: any) => err.code === 'ER_CHECK_CONSTRAINT_VIOLATED');
      } finally {
        conn.release();
      }
    });
  });

  // ── 5. Historical Payroll Protection & Soft Deletion ─────────────────────────
  describe('5. Historical Payroll Protection & Delete Behavior', () => {
    const testPayslipId = `PS-HIST-${testSuffix}`;

    before(async () => {
      // Create a test payrun and a payslip for the test employee
      await executeQuery(
        'INSERT INTO payruns (id, name, period, salary_structure_id, status) VALUES (?, ?, ?, ?, ?)',
        [testPayrunId, 'Historical Test Payrun', '2026-08', 'STR-001', 'COMPUTED']
      );

      await executeQuery(
        `INSERT INTO payslips (id, payrun_id, employee_id, basic, hra, allowance, gross, tax, other_deductions, net, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [testPayslipId, testPayrunId, testEmpId, 3000, 1000, 500, 4500, 400, 200, 3900, 'COMPUTED']
      );
    });

    it('blocks hard physical deletion of an employee with existing payslips at the MySQL level', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query('DELETE FROM employees WHERE id = ?', [testEmpId]);
        }, (err: any) => err.code === 'ER_ROW_IS_REFERENCED_2');
      } finally {
        conn.release();
      }
    });

    it('safely soft-deactivates employee when deleteEmployee() is called, preserving historical payslips', async () => {
      const deleted = await deleteEmployee(testEmpId);
      assert.equal(deleted, true, 'deleteEmployee should return true for successful handling');

      // Verify employee record still exists with INACTIVE status
      const emp = await getEmployeeById(testEmpId);
      assert.ok(emp);
      assert.equal(emp.status, 'TERMINATED', 'Status should be normalized to TERMINATED/INACTIVE');

      // Verify the payslip record was NOT deleted
      const payslips = await executeQuery<any[]>('SELECT id FROM payslips WHERE id = ?', [testPayslipId]);
      assert.equal(payslips.length, 1, 'Historical payslip must be completely preserved');
    });

    it('rejects duplicate payslip for same (payrun_id, employee_id) via uq_payslips_payrun_employee', async () => {
      const conn = await pool.getConnection();
      try {
        await assert.rejects(async () => {
          await conn.query(
            `INSERT INTO payslips (id, payrun_id, employee_id, basic, hra, allowance, gross, tax, other_deductions, net, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [`${testPayslipId}-DUP`, testPayrunId, testEmpId, 3000, 1000, 500, 4500, 400, 200, 3900, 'COMPUTED']
          );
        }, (err: any) => err.code === 'ER_DUP_ENTRY');
      } finally {
        conn.release();
      }
    });
  });

  // ── 6. Transaction Safety & Rollback ─────────────────────────────────────────
  describe('6. Multi-Step Transaction Safety', () => {
    it('rolls back completely if a step fails during transactional write', async () => {
      const connection = await pool.getConnection();
      const rollbackPayrunId = `PR-ROLLBACK-${testSuffix}`;
      const rollbackPayslipId = `PS-ROLLBACK-${testSuffix}`;

      try {
        await connection.beginTransaction();

        // Step 1: Create a payrun
        await connection.query(
          'INSERT INTO payruns (id, name, period, status) VALUES (?, ?, ?, ?)',
          [rollbackPayrunId, 'Rollback Test Payrun', '2026-09', 'DRAFT']
        );

        // Step 2: Attempt an invalid insert that violates foreign key constraint
        await connection.query(
          `INSERT INTO payslips (id, payrun_id, employee_id, basic, hra, allowance, gross, tax, other_deductions, net, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rollbackPayslipId, rollbackPayrunId, 'EMP-NONEXISTENT', 3000, 1000, 500, 4500, 400, 200, 3900, 'COMPUTED']
        );

        await connection.commit();
        assert.fail('Transaction should have failed on step 2');
      } catch (err: any) {
        await connection.rollback();
      } finally {
        connection.release();
      }

      // Step 3: Verify payrun was rolled back and does not exist
      const payruns = await executeQuery<any[]>('SELECT id FROM payruns WHERE id = ?', [rollbackPayrunId]);
      assert.equal(payruns.length, 0, 'Payrun should not exist after rollback');

      const payslips = await executeQuery<any[]>('SELECT id FROM payslips WHERE id = ?', [rollbackPayslipId]);
      assert.equal(payslips.length, 0, 'Payslip should not exist after rollback');
    });
  });

  // ── 7. Repository & Workflow Regression Verification ────────────────────────
  describe('7. Repository & Workflow Regression Verification', () => {
    it('getAllContracts() executes and returns valid contract list with joined employee details', async () => {
      const contracts = await getAllContracts();
      assert.ok(Array.isArray(contracts));
      assert.ok(contracts.length >= 6);
      const c1 = contracts.find((c) => c.id === 'CON-001');
      assert.ok(c1);
      assert.equal(c1.employeeName, 'John Doe');
      assert.equal(c1.department, 'Engineering');
      assert.ok(c1.wage > 0);
    });

    it('getActiveContractByEmployeeId() retrieves active contract for valid employee', async () => {
      const contract = await getActiveContractByEmployeeId('EMP-001');
      assert.ok(contract);
      assert.equal(contract.id, 'CON-001');
      assert.equal(contract.status, 'ACTIVE');
      assert.equal(contract.wage, 6500.0);
    });

    it('creates and checks out attendance record cleanly', async () => {
      const attId = `ATT-REG-${testSuffix}`;
      const record = await createCheckIn({
        id: attId,
        employeeId: 'EMP-001',
        date: '2026-09-01',
        checkIn: '09:00 AM',
        status: 'PRESENT',
      });
      assert.ok(record);
      assert.equal(record.id, attId);
      assert.equal(record.status, 'PRESENT');

      const checkedOut = await recordCheckOut({
        recordId: attId,
        checkOut: '06:00 PM',
      });
      assert.equal(checkedOut.workedHours, 9.0);
      assert.equal(checkedOut.status, 'OVERTIME');

      // Cleanup
      await executeQuery('DELETE FROM attendance_records WHERE id = ?', [attId]);
    });

    it('creates and retrieves time-off request cleanly', async () => {
      const toId = `TO-REG-${testSuffix}`;
      const to = await createTimeOffRequest({
        id: toId,
        employeeId: 'EMP-001',
        leaveType: 'Paid Time Off',
        startDate: '2026-09-10',
        endDate: '2026-09-12',
        durationDays: 3,
        reason: 'Family vacation',
        status: 'PENDING',
      });
      assert.ok(to);
      assert.equal(to.id, toId);
      assert.equal(to.durationDays, 3);

      const fetched = await getTimeOffRequestById(toId);
      assert.ok(fetched);
      assert.equal(fetched.status, 'PENDING');

      // Cleanup
      await executeQuery('DELETE FROM time_off_requests WHERE id = ?', [toId]);
    });

    it('executes the full payroll lifecycle (DRAFT -> COMPUTED -> VALIDATED -> PAID) without data integrity loss', async () => {
      const lifecyclePayrunId = `PR-LIFE-${testSuffix}`;

      // 1. Create DRAFT payrun
      await executeQuery(
        'INSERT INTO payruns (id, name, period, salary_structure_id, status) VALUES (?, ?, ?, ?, ?)',
        [lifecyclePayrunId, 'Lifecycle Integrity Payrun', '2026-09', 'STR-001', 'DRAFT']
      );

      // 2. Compute payrun
      const computeResult = await PayrunComputeService.computePayrun(lifecyclePayrunId);
      assert.equal(computeResult.payrun.status, 'COMPUTED');
      assert.ok(computeResult.snapshots.length > 0);
      assert.ok(computeResult.summary.totalGross > 0);

      // 3. Validate payrun
      const valResult = await PayrunValidationService.validatePayrun(lifecyclePayrunId, 'Pavan QA Admin');
      assert.equal(valResult.payrun.status, 'VALIDATED');
      for (const s of valResult.snapshots) {
        assert.equal(s.status, 'VALIDATED');
      }

      // 4. Mark payrun as PAID
      const payResult = await PayrunPaymentService.markPayrunAsPaid(
        lifecyclePayrunId,
        'Pavan QA Admin',
        `BATCH-TEST-${testSuffix}`
      );
      assert.equal(payResult.payrun.status, 'PAID');
      for (const s of payResult.snapshots) {
        assert.equal(s.status, 'PAID');
      }

      // 5. Verify snapshot immutability: Gross & net have not drifted
      const finalSnapshots = await getPayrollSnapshotsByPayrun(lifecyclePayrunId);
      assert.equal(finalSnapshots.length, computeResult.snapshots.length);
      for (const finalSnap of finalSnapshots) {
        const computedMatch = computeResult.snapshots.find((s) => s.employeeId === finalSnap.employeeId);
        assert.ok(computedMatch, `Snapshot for employee ${finalSnap.employeeId} should exist`);
        assert.equal(finalSnap.gross, computedMatch.gross);
        assert.equal(finalSnap.net, computedMatch.net);
      }

      // Cleanup
      await executeQuery('DELETE FROM payslips WHERE payrun_id = ?', [lifecyclePayrunId]);
      await executeQuery('DELETE FROM payruns WHERE id = ?', [lifecyclePayrunId]);
    });
  });

  after(async () => {
    await pool.end();
  });

});
