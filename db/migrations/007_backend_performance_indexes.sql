-- Migration: 007_backend_performance_indexes.sql
-- Description:
-- 1. Candidate Key Enforcement on working_schedules:
--    - Add candidate key constraint UNIQUE (name) on `working_schedules` to guarantee uniqueness.
-- 2. Query Path & Join Optimization:
--    - contracts: idx_contracts_emp_status (employee_id, status)
--      Optimizes high-frequency active contract resolution across employee directory,
--      payroll computation, and dashboard metric calculations.

-- ----------------------------------------------------------------------------
-- 1. Table: working_schedules
-- ----------------------------------------------------------------------------
ALTER TABLE working_schedules
  ADD CONSTRAINT uq_working_schedules_name UNIQUE (name);

-- ----------------------------------------------------------------------------
-- 2. Table: contracts
-- ----------------------------------------------------------------------------
ALTER TABLE contracts
  ADD INDEX idx_contracts_emp_status (employee_id, status);
