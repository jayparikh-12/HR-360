# PeoplePay360 Database Setup

This folder contains the complete relational schema and initial seed data for the hackathon.

## Files
- `schema.sql`: Full SQL schema normalized to Boyce-Codd Normal Form (BCNF minimum) with explicit `FOREIGN KEY` constraints and referential integrity actions for employees, contracts, working schedules, attendance, time-off, salary rules, payruns, and payslips.
- `seeds.sql`: Pre-populated initial seed data matching the demo workflow.
- `migrations/`: Versioned migration scripts:
  - `001_add_gender_to_employees.sql`: Adds gender column to employees.
  - `002_normalize_bcnf_and_foreign_keys.sql`: Normalizes `payslips` (drops redundant transitive `employee_name` & `department`), adds candidate keys, and applies explicit `FOREIGN KEY` constraints.

## Quick Setup with MySQL
```bash
mysql -u root -p peoplepay360 < schema.sql
mysql -u root -p peoplepay360 < seeds.sql
```

## Quick Setup with SQLite
```bash
sqlite3 peoplepay360.db < schema.sql
sqlite3 peoplepay360.db < seeds.sql
```

## Quick Setup with PostgreSQL
```bash
psql -U postgres -d peoplepay360 -f schema.sql
psql -U postgres -d peoplepay360 -f seeds.sql
```
