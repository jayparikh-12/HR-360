-- Migration 005: Add Payment Audit Metadata to payruns table
-- Supports Phase 5.4 Controlled Payrun Payment Workflow

ALTER TABLE payruns
    ADD COLUMN paid_at TIMESTAMP NULL AFTER validated_by,
    ADD COLUMN paid_by VARCHAR(100) NULL AFTER paid_at,
    ADD COLUMN payment_reference VARCHAR(100) NULL AFTER paid_by;
