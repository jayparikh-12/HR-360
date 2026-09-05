# PeoplePay360 Database

MySQL schema and seed data for the PeoplePay360 HR and payroll platform.

## Files

- `schema.sql` - core tables and relationships
- `seeds.sql` - sample employee, contract, attendance, leave, and payroll data

## Import into MySQL

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

