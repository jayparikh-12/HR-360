# PeoplePay360

> **Integrated HR & Deterministic Payroll Operations Platform**  
> Connects employee lifecycle management directly into deterministic payroll calculations.

---

## 📌 Workflow Pipeline

```
Employee Directory ➔ Contract ➔ Working Schedule ➔ Attendance & Time Off ➔ Salary Structure & Rules ➔ Payrun Batch ➔ Itemized Payslip
```

---

## 🚀 Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Custom CSS (Dark/Indigo theme), Lucide Icons
- **Backend:** Express.js, TypeScript (ESM), JWT Authentication (`jsonwebtoken`)
- **Database:** MySQL 8.0 (`mysql2/promise` connection pool)
- **Architecture:** Monorepo (`client/`, `server/`, `db/`) with a repository data-access pattern

---

## 🚦 Project Status

| Module | Status | Persistence | Description |
| :--- | :---: | :---: | :--- |
| **Authentication** | ✅ Complete | In-Memory Users + JWT | Signed 8-hour JWTs, `/api/auth/me` session restoration |
| **Employees** | ✅ Complete | MySQL (`employees`) | Directory & Employee 360 Hub with CRUD & email validation |
| **Contracts** | ✅ Complete | MySQL (`contracts`) | Wage terms, structure/schedule links, active overlap protection |
| **Working Schedules** | ✅ Complete | MySQL (`working_schedules`) | Standard weekly operating hours (0–168h) |
| **Attendance** | ✅ Complete | MySQL (`attendance_records`) | Clock-in/out with live duration timer & compliance statuses |
| **Time Off** | ✅ Complete | MySQL (`time_off_requests`) | Leave requests, day calculations, manager Approve/Refuse |
| **Salary Structures** | ✅ Complete | MySQL (`salary_structures`) | Compensation templates with unique code constraint |
| **Salary Rules** | ✅ Complete | MySQL (`salary_rules`) | Precedence sequence ordering, categories & rate validations |
| **Payruns & Payslips** | 🟡 Prototype | In-Memory / Planned MySQL | 4-stage stepper (`DRAFT` ➔ `PAID`), 2-step wizard, A4 voucher |
| **Payroll Engine** | 🟡 Baseline | Hardcoded Formula | 60% Basic, 25% HRA, 10% Tax, 7% PF, unpaid leave deductions |

---

## ⚡ Quick Start

### 1. Database Setup (MySQL)
Ensure MySQL is running on `localhost:3306`:
```sql
CREATE DATABASE peoplepay360;
```
Import schema and seed data:
```bash
mysql -u root -p peoplepay360 < db/schema.sql
mysql -u root -p peoplepay360 < db/seeds.sql
```

### 2. Backend Setup
```bash
cd server
npm install
```
Configure `server/.env` (or copy from `.env.example`):
```ini
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=peoplepay360
JWT_SECRET=your-secret-key-min-32-chars
```
Start server:
```bash
npm run dev
# Running on http://localhost:5000
```

### 3. Frontend Setup
```bash
cd client
npm install
npm run dev
# Running on http://localhost:5173
```

---

## 🔑 Demo Test Accounts

All accounts use password: **`password123`** *(or `Password@123`)*

| Email | Role | Persona |
| :--- | :--- | :--- |
| `elena@company.com` | **HR Payroll Manager** | Full payroll computation, approval & disbursement |
| `sarah@company.com` | **HR Manager** | Employee directory & leave approvals |
| `alex@company.com` | **HR Payroll User** | Payrun drafting & attendance review |
| `john@company.com` | **Employee** | Self-service portal, check-in/out & personal payslip |
| `admin@company.com` | **Admin** | Full system configuration |

---

## 📡 API Endpoints Summary

All protected endpoints require header: `Authorization: Bearer <token>`

### Auth & Health
- `GET  /api/health` — Service health & MySQL status *(Public)*
- `POST /api/auth/login` — Authenticate & receive JWT *(Public)*
- `GET  /api/auth/me` — Current user profile *(Protected)*

### Core HR & Operations (MySQL)
- `GET  /api/employees` | `POST /api/employees` — List / create employees
- `GET  /api/employees/:id` | `PATCH /api/employees/:id` — Detail / update employee
- `GET  /api/contracts` | `POST /api/contracts` — List / create employment contracts
- `GET  /api/schedules` | `POST /api/schedules` — List / create working schedules
- `GET  /api/attendance` — List daily attendance logs
- `POST /api/attendance/check-in` | `POST /api/attendance/check-out` — Clock-in & clock-out
- `GET  /api/time-off` | `POST /api/time-off` — List / request leaves
- `PATCH /api/time-off/:id/approve` | `PATCH /api/time-off/:id/refuse` — Approve / refuse leave

### Compensation (MySQL)
- `GET  /api/salary-structures` | `POST /api/salary-structures` — List / create structures
- `GET  /api/salary-rules` | `POST /api/salary-rules` — List / create rules (supports `?structureId=...`)

### Payroll (Prototype / In-Memory)
- `GET  /api/payroll/payruns` — List payrun batches
- `POST /api/payroll/payruns/create` — Run batch calculation for selected employees
- `PATCH /api/payroll/payruns/:id/validate` — Advance status to `VALIDATED`
- `PATCH /api/payroll/payruns/:id/pay` — Advance status to `PAID`

---

## 📁 Repository Structure

```
HR-360/
├── client/                 # React 19 + TypeScript + Vite Frontend
│   ├── src/
│   │   ├── api/            # Typed API clients with Bearer token injection
│   │   ├── components/     # App Shell (Header, Sidebar)
│   │   ├── context/        # AuthContext & Session management
│   │   └── pages/          # Login, Dashboard, Employees, Attendance, TimeOff, Payruns
├── server/                 # Express.js REST API Backend
│   ├── src/
│   │   ├── config/         # Centralized MySQL connection pool (database.ts)
│   │   ├── middleware/     # JWT authentication middleware
│   │   ├── repositories/   # MySQL parameterized queries (Employee, Contract, Attendance, Rules...)
│   │   ├── routes/         # Express route handlers
│   │   └── services/       # Deterministic Payroll Engine (payrollEngine.ts)
└── db/                     # Relational DDL (schema.sql) & seeds (seeds.sql)
```

---

## 🗺️ Next Steps

1. **Payrun & Payslip Persistence:** Migrate `payruns` and `payslips` from in-memory arrays to MySQL.
2. **Dynamic Rule Engine:** Execute calculation formulas directly from active `salary_rules` records.
3. **Route-Level RBAC:** Restrict sensitive endpoints by role claims (`Admin`, `HR Payroll Manager`).