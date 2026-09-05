-- Migration: 002_normalize_bcnf_and_foreign_keys.sql
-- Description:
-- 1. Normalize database to Boyce-Codd Normal Form (BCNF minimum):
--    - Remove redundant non-prime attributes `employee_name` and `department` from `payslips`
--      which violated BCNF via transitive dependency (employee_id -> employee_name, department).
--    - Add candidate key constraint UNIQUE (payrun_id, employee_id) on `payslips`.
--    - Add candidate key constraint UNIQUE (structure_id, code) on `salary_rules`.
--    - Add candidate key constraint UNIQUE (name) on `working_schedules`.
-- 2. Replace inert MySQL inline `REFERENCES` clauses with explicit `FOREIGN KEY` constraints
--    with referential integrity actions (CASCADE / RESTRICT / SET NULL).

-- ----------------------------------------------------------------------------
-- 1. Table: working_schedules (Candidate Key Enforcement)
-- ----------------------------------------------------------------------------
ALTER TABLE working_schedules
  ADD CONSTRAINT uq_working_schedules_name UNIQUE (name);

-- ----------------------------------------------------------------------------
-- 2. Table: salary_rules (Foreign Key & Candidate Key Enforcement)
-- ----------------------------------------------------------------------------
ALTER TABLE salary_rules
  ADD CONSTRAINT uq_salary_rules_structure_code UNIQUE (structure_id, code),
  ADD CONSTRAINT fk_salary_rules_structure
    FOREIGN KEY (structure_id) REFERENCES salary_structures(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 3. Table: contracts (Foreign Key Enforcement)
-- ----------------------------------------------------------------------------
ALTER TABLE contracts
  ADD CONSTRAINT fk_contracts_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_contracts_salary_structure
    FOREIGN KEY (salary_structure_id) REFERENCES salary_structures(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT fk_contracts_working_schedule
    FOREIGN KEY (working_schedule_id) REFERENCES working_schedules(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 4. Table: attendance_records (Foreign Key Enforcement)
-- ----------------------------------------------------------------------------
ALTER TABLE attendance_records
  ADD CONSTRAINT fk_attendance_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 5. Table: time_off_requests (Foreign Key Enforcement)
-- ----------------------------------------------------------------------------
ALTER TABLE time_off_requests
  ADD CONSTRAINT fk_time_off_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 6. Table: payruns (Foreign Key Enforcement)
-- ----------------------------------------------------------------------------
ALTER TABLE payruns
  ADD CONSTRAINT fk_payruns_salary_structure
    FOREIGN KEY (salary_structure_id) REFERENCES salary_structures(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 7. Table: payslips (BCNF Normalization & Foreign Key Enforcement)
--    Drop transitive attributes (employee_name, department).
--    Enforce candidate key (payrun_id, employee_id) and foreign keys.
-- ----------------------------------------------------------------------------
ALTER TABLE payslips
  DROP COLUMN employee_name,
  DROP COLUMN department;

ALTER TABLE payslips
  ADD CONSTRAINT uq_payslips_payrun_employee UNIQUE (payrun_id, employee_id),
  ADD CONSTRAINT fk_payslips_payrun
    FOREIGN KEY (payrun_id) REFERENCES payruns(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_payslips_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE ON UPDATE CASCADE;
