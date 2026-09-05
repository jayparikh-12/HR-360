-- Migration: 006_database_integrity_hardening.sql
-- Description:
-- 1. Historical Payroll Protection:
--    Modify fk_payslips_employee from ON DELETE CASCADE to ON DELETE RESTRICT
--    to prevent accidental deletion of historical payroll snapshots/payslips.
-- 2. Domain & Range Check Constraints:
--    - time_off_requests: chk_time_off_dates (end_date >= start_date)
--    - contracts: chk_contracts_dates (end_date IS NULL OR end_date >= start_date)
--    - contracts: chk_contracts_wage (wage >= 0)
--    - attendance_records: chk_attendance_worked_hours (worked_hours >= 0)
-- 3. Index Optimization for Frequent Query Paths & Foreign Keys:
--    - attendance_records: idx_attendance_emp_date (employee_id, date), idx_attendance_date (date)
--    - time_off_requests: idx_time_off_emp_status (employee_id, status), idx_time_off_dates (start_date, end_date)
--    - employees: idx_employees_dept_status (department, status)
--    - payruns: idx_payruns_period_status (period, status)

-- ----------------------------------------------------------------------------
-- 1. Table: payslips (Historical Payroll Protection)
-- ----------------------------------------------------------------------------
ALTER TABLE payslips
  DROP FOREIGN KEY fk_payslips_employee;

ALTER TABLE payslips
  ADD CONSTRAINT fk_payslips_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 2. Domain Check Constraints
-- ----------------------------------------------------------------------------
ALTER TABLE time_off_requests
  ADD CONSTRAINT chk_time_off_dates
    CHECK (end_date >= start_date);

ALTER TABLE contracts
  ADD CONSTRAINT chk_contracts_dates
    CHECK (end_date IS NULL OR end_date >= start_date),
  ADD CONSTRAINT chk_contracts_wage
    CHECK (wage >= 0);

ALTER TABLE attendance_records
  ADD CONSTRAINT chk_attendance_worked_hours
    CHECK (worked_hours >= 0);

-- ----------------------------------------------------------------------------
-- 3. Indexes for Frequent Lookups and Filters
-- ----------------------------------------------------------------------------
ALTER TABLE attendance_records
  ADD INDEX idx_attendance_emp_date (employee_id, date),
  ADD INDEX idx_attendance_date (date);

ALTER TABLE time_off_requests
  ADD INDEX idx_time_off_emp_status (employee_id, status),
  ADD INDEX idx_time_off_dates (start_date, end_date);

ALTER TABLE employees
  ADD INDEX idx_employees_dept_status (department, status);

ALTER TABLE payruns
  ADD INDEX idx_payruns_period_status (period, status);
