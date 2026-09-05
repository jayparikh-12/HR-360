-- Migration: 004_add_validation_metadata_to_payruns.sql
-- Description:
-- Phase 5.3 — Payrun Validation Workflow
-- Adds validation audit metadata columns to `payruns`:
-- 1. validated_at: timestamp when the payrun was validated
-- 2. validated_by: identity of the authorized user who validated the payrun

ALTER TABLE payruns
  ADD COLUMN validated_at TIMESTAMP NULL AFTER status,
  ADD COLUMN validated_by VARCHAR(100) NULL AFTER validated_at;
