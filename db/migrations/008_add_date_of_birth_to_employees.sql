-- ============================================================================
-- PeoplePay360 Database Migration 008
-- Purpose: Add dateOfBirth column to employees table for employee records
-- ============================================================================

ALTER TABLE employees
ADD COLUMN dateOfBirth DATE NULL AFTER gender;
