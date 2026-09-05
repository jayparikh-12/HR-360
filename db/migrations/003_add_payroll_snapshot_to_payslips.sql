-- Migration: 003_add_payroll_snapshot_to_payslips.sql
-- Description:
-- Phase 5.1 — Payroll Calculation Snapshot & Payslip Persistence Foundation
-- Extends the BCNF-normalized `payslips` table with historical snapshot fields:
-- 1. Period bounds (period_start, period_end)
-- 2. Contract wage snapshot at the time of calculation (contract_wage)
-- 3. Structured earnings breakdown JSON (earnings_breakdown)
-- 4. Structured deductions breakdown JSON (deductions_breakdown)
-- 5. Full calculation snapshot JSON (calculation_snapshot)
-- 6. Calculation audit timestamp and version (calculation_timestamp, calculation_version)

ALTER TABLE payslips
  ADD COLUMN period_start DATE NULL AFTER employee_id,
  ADD COLUMN period_end DATE NULL AFTER period_start,
  ADD COLUMN contract_wage DECIMAL(12,2) NULL AFTER period_end,
  ADD COLUMN earnings_breakdown JSON NULL AFTER net,
  ADD COLUMN deductions_breakdown JSON NULL AFTER earnings_breakdown,
  ADD COLUMN calculation_snapshot JSON NULL AFTER deductions_breakdown,
  ADD COLUMN calculation_timestamp TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER calculation_snapshot,
  ADD COLUMN calculation_version INT NOT NULL DEFAULT 1 AFTER calculation_timestamp;

ALTER TABLE payslips
  ADD INDEX idx_payslips_employee_period (employee_id, period_start);
