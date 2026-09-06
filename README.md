# PeoplePay360

Integrated HR and payroll operations platform for employee records, contracts, attendance, time off, salary rules, and deterministic payruns.

## Overview

PeoplePay360 connects the core operational flow:

`Employee -> Contract -> Working Schedule -> Attendance -> Time Off -> Salary Structure -> Payrun -> Payslip`

The repository is split into three main parts:

- `client/` - React + Vite frontend
- `server/` - Express + TypeScript REST API
- `db/` - MySQL schema and seed data

## Key Capabilities

- Role-aware login with JWT sessions
- Employee directory and employee 360 view
- Contract, schedule, attendance, and time-off management
- Salary structure and salary rule configuration
- Payrun creation, validation, payment, and payslip storage
- Executive dashboard with payroll and attendance summaries

## Architecture

`Browser -> React client -> Express API -> MySQL`

- The frontend stores the JWT in localStorage and restores sessions through `/api/auth/me`.
- The backend uses a MySQL connection pool via `mysql2/promise`.
- Payruns and payslips are persisted in MySQL.
- Demo users are currently defined in memory in `server/src/models/user.model.ts`.

## Technology Stack

- Frontend: React 19, TypeScript, Vite, React Router, Lucide icons
- Backend: Node.js, Express, TypeScript, JWT, cors
- Database: MySQL 8
- Tooling: Oxlint, TypeScript build, Vite build

## Repository Layout

| Path | Purpose |
| --- | --- |
| `client/` | Frontend application |
| `server/` | REST API and payroll engine |
| `db/` | SQL schema and seed data |
| `src/components/` | Shared UI primitives and showcase views |
| `scratch/` | One-off verification scripts and experiments |
| `PROJECT_STATUS.md` | Current implementation status |
| `COMPLETED_TASKS_REPORT.md` | Detailed execution report |

## Frontend Screens

- `/login` - Demo login
- `/dashboard` - Operations dashboard
- `/employees` - Employee directory and 360 hub
- `/contracts` - Contract management
- `/schedules` - Working schedules
- `/attendance` - Attendance tracking
- `/time-off` - Leave requests and approvals
- `/payruns` - Payrun workflow and payslips
- `/salary-rules` - Salary structure and rule configuration
- `/settings` - Admin placeholder using the salary structure screen

## Roles and Access

| Role | Access |
| --- | --- |
| `Employee` | Own attendance, own time off, and own payslip views |
| `HR Payroll User` | Employees, contracts, attendance, and payrun drafts |
| `HR Manager` | Employees, contracts, schedules, attendance, and time-off approvals |
| `HR Payroll Manager` | Payroll creation, validation, payment, and read access to supporting HR data |
| `Admin` | Full access to all modules |

Frontend role switching is display-only. The authenticated role always comes from the backend session token.

## Setup

### Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- MySQL 8

### 1. Create the database

```sql
CREATE DATABASE peoplepay360;
```

### 2. Load schema and seed data

```bash
mysql -u root -p peoplepay360 < db/schema.sql
mysql -u root -p peoplepay360 < db/seeds.sql
```

### 3. Configure the backend

Copy `server/.env.example` to `server/.env` and set the values for:

- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

### 4. Start the backend

```bash
cd server
npm install
npm run dev
```

The API runs on `http://localhost:5000` by default.

### 5. Start the frontend

```bash
cd client
npm install
npm run dev
```

The client runs on `http://localhost:5173` by default.

If the backend is on a different URL, copy `client/.env.example` to `client/.env` and set `VITE_API_URL`. The client defaults to `http://localhost:5000`.

## Useful Scripts

### Client

```bash
cd client
npm run dev
npm run build
npm run lint
npm run preview
```

### Server

```bash
cd server
npm run dev
npm run build
npm run start
```

## Demo Accounts

Primary password: `password123`

The auth service also accepts `Password@123` for compatibility with test harnesses.

| Email | Role | Notes |
| --- | --- | --- |
| `elena@company.com` | `HR Payroll Manager` | Payroll controller and payrun approval workflow |
| `sarah@company.com` | `HR Manager` | Employee, contract, schedule, and time-off management |
| `alex@company.com` | `HR Payroll User` | Payrun drafting and attendance review |
| `john@company.com` | `Employee` | Self-service attendance and leave workflow |
| `admin@company.com` | `Admin` | Full system access |

## API Summary

All protected endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service and MySQL health check |
| `POST` | `/api/auth/login` | Login and receive a JWT |
| `GET` | `/api/auth/me` | Restore the current session |
| `GET` | `/api/auth/whoami` | Demo RBAC inspection endpoint |
| `GET` | `/api/employees` | List employees |
| `POST` | `/api/employees` | Create an employee |
| `GET` | `/api/employees/:id` | Fetch one employee |
| `PATCH` | `/api/employees/:id` | Update an employee |
| `GET` | `/api/contracts` | List contracts |
| `GET` | `/api/schedules` | List working schedules |
| `GET` | `/api/attendance` | List attendance records |
| `POST` | `/api/attendance/check-in` | Create a check-in |
| `POST` | `/api/attendance/check-out` | Create a check-out |
| `GET` | `/api/time-off` | List leave requests |
| `POST` | `/api/time-off` | Submit a leave request |
| `GET` | `/api/time-off/:id` | Fetch one leave request |
| `PATCH` | `/api/time-off/:id/approve` | Approve a leave request |
| `PATCH` | `/api/time-off/:id/refuse` | Refuse a leave request |
| `GET` | `/api/salary-structures` | List salary structures |
| `POST` | `/api/salary-structures` | Create a salary structure |
| `GET` | `/api/salary-rules` | List salary rules |
| `POST` | `/api/salary-rules` | Create a salary rule |
| `GET` | `/api/payroll/payruns` | List payruns and payslips |
| `GET` | `/api/payroll/payruns/:id` | Fetch one payrun |
| `POST` | `/api/payroll/payruns/create` | Create and compute a payrun |
| `PATCH` | `/api/payroll/payruns/:id/validate` | Move a payrun to `VALIDATED` |
| `PATCH` | `/api/payroll/payruns/:id/pay` | Move a payrun to `PAID` |

## Data Model

The schema in `db/schema.sql` includes:

- `employees`
- `working_schedules`
- `salary_structures`
- `salary_rules`
- `contracts`
- `attendance_records`
- `time_off_requests`
- `payruns`
- `payslips`

## Payroll Rules

The current payroll engine is deterministic and uses a fixed baseline formula:

- Basic salary = 60% of monthly wage
- House rent allowance = 25% of monthly wage
- Allowance = remaining 15%
- Gross salary = monthly wage
- Unpaid leave deduction = `(Basic / 30) * unpaidDays`
- Tax = 10% of gross
- Other deductions = 7% of gross
- Net pay = gross - deductions

Payrun states supported by the data model and API:

- `DRAFT`
- `COMPUTED`
- `VALIDATED`
- `PAID`

## Current Implementation Notes

- Salary structures and salary rules are persisted and shown in the UI, but the runtime payroll calculation still uses the deterministic baseline formula above.
- Session lifetime is controlled by `JWT_EXPIRES_IN` and defaults to `20m` in the server example environment file.
- The frontend sidebar only shows sections allowed for the authenticated role.
- `/salary-rules` and `/settings` currently render the same salary-structure screen in the client.

## Related Docs

- [`PROJECT_STATUS.md`](PROJECT_STATUS.md)
- [`COMPLETED_TASKS_REPORT.md`](COMPLETED_TASKS_REPORT.md)
- [`server/README.md`](server/README.md)
- [`db/README.md`](db/README.md)

