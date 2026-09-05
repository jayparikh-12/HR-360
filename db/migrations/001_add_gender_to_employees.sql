-- Migration: 001_add_gender_to_employees.sql
-- Description: Add gender column to employees table with controlled enum values.

ALTER TABLE employees
  ADD COLUMN gender ENUM('MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY') NULL DEFAULT NULL AFTER jobPosition;

-- Seed existing known employees with appropriate gender values
UPDATE employees SET gender = 'MALE' WHERE firstName = 'John' AND lastName = 'Doe';
UPDATE employees SET gender = 'FEMALE' WHERE firstName = 'Jane' AND lastName = 'Smith';
UPDATE employees SET gender = 'FEMALE' WHERE firstName = 'Maya' AND lastName = 'Lin';
UPDATE employees SET gender = 'NON_BINARY' WHERE firstName = 'Alex' AND lastName = 'Rivera';
UPDATE employees SET gender = 'FEMALE' WHERE firstName = 'Elena' AND lastName = 'Rostova';
UPDATE employees SET gender = 'MALE' WHERE firstName = 'David' AND lastName = 'Kim';
UPDATE employees SET gender = 'FEMALE' WHERE firstName = 'Sarah' AND lastName = 'Connor';
