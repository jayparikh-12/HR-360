# PeoplePay360 Database

MySQL schema and seed data for the PeoplePay360 HR and payroll platform.

## Files

- `schema.sql`: Full SQL schema normalized to Boyce-Codd Normal Form (BCNF minimum) with explicit `FOREIGN KEY` constraints and referential integrity actions for employees, contracts, working schedules, attendance, time-off, salary rules, payruns, and payslips.
- `seeds.sql`: Pre-populated initial seed data matching the demo workflow.
- `migrations/`: Versioned migration scripts:
  - `001_add_gender_to_employees.sql`: Adds gender column to employees.
  - `002_normalize_bcnf_and_foreign_keys.sql`: Normalizes `payslips` (drops redundant transitive `employee_name` & `department`), adds candidate keys, and applies explicit `FOREIGN KEY` constraints.
  - `003_add_payroll_snapshot_to_payslips.sql`: Adds historical calculation snapshot, period bounds, contract wage, and structured earnings/deductions breakdown columns to `payslips`.
  - `004_add_validation_metadata_to_payruns.sql`: Adds validation audit metadata (`validated_at`, `validated_by`) to `payruns`.
  - `005_add_payment_metadata_to_payruns.sql`: Adds payment audit metadata (`paid_at`, `paid_by`, `payment_reference`) to `payruns`.
  - `006_database_integrity_hardening.sql`: Enforces historical payroll protection (`ON DELETE RESTRICT`), domain `CHECK` constraints, and performance indexes.
  - `007_backend_performance_indexes.sql`: Enforces unique constraint on `working_schedules.name` and active contract lookup index on `contracts(employee_id, status)`.
  - `008_add_date_of_birth_to_employees.sql`: Adds `dateOfBirth` column to `employees` table for employee records.

## Quick Setup with MySQL

```bash
mysql -u root -p peoplepay360 < schema.sql
mysql -u root -p peoplepay360 < seeds.sql
```

## Core Tables

- `employees`
- `working_schedules`
- `salary_structures`
- `salary_rules`
- `contracts`
- `attendance_records`
- `time_off_requests`
- `payruns`
- `payslips`

## Notes

- The backend expects a MySQL database named `peoplepay360` by default.
- The schema is designed for the Express API in `server/`.
- Payruns and payslips are persisted in MySQL, so they survive server restarts.

