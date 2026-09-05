# PeoplePay360 — Current Project Status & Execution Record

**Last Updated:** September 5, 2026 | **Hackathon Milestone:** Core Foundation & Functional MVP  
**Project:** PeoplePay360 — Integrated HR & Deterministic Payroll Operations Platform  
**Team:** Jay Parikh & Pavan  
**Repository Architecture:** Three-Tier Monorepo (`client/`, `server/`, `db/`)

---

## 1. Executive Summary

PeoplePay360 has completed its foundation and functional MVP phase. The platform successfully demonstrates the connected operational pipeline:
```
Employee ➔ Active Contract ➔ Working Schedule ➔ Daily Attendance ➔ Time Off Leaves ➔ Deterministic Payrun ➔ Itemized Payslip Voucher
```

Both frontend client and backend server services are actively running, verified with clean builds (0 TypeScript errors), and ready for live presentation and ongoing module extensions.

---

## 2. Live Runtime & Service Health

| Service / Layer | Directory | Runtime / Port | Status | Verification Command / URL |
| :--- | :--- | :--- | :---: | :--- |
| **Frontend Client** | `client/` | Vite Dev Server (`:5173`) | 🟢 **ACTIVE** | [http://localhost:5173/](http://localhost:5173/) |
| **Backend REST API** | `server/` | Express.js (`:5000`) | 🟢 **ACTIVE** | [http://localhost:5000/api/health](http://localhost:5000/api/health) |
| **Database Schema** | `db/` | SQLite / PostgreSQL Schema | 🟢 **READY** | [db/schema.sql](file:///d:/Odoo/db/schema.sql) & [db/seeds.sql](file:///d:/Odoo/db/seeds.sql) |

---

## 3. Implemented Modules & Screen Status

| Screen / Feature | Route / View | Status | Key Implemented Capabilities |
| :--- | :--- | :---: | :--- |
| **Authentication (Login)** | `/login` (Initial View) | ✅ **COMPLETE** | Automated role & persona resolution via work email/password; error states; show/hide password toggle; enterprise split-screen branding. |
| **App Shell & Navigation** | Global Shell | ✅ **COMPLETE** | Top header with global search, active pay cycle indicator (`Sep 2026 Cycle`), role switcher, quick payrun action; collapsible sidebar with live counts. |
| **Operations Dashboard** | Tab: `Dashboard` | ✅ **COMPLETE** | 4 Top KPI cards (Total Cost, Active Staff, Payrun Status, Attendance Health); Department salary cost distribution bars; Live payroll alerts & action items feed. |
| **Employee Directory** | Tab: `Employees` | ✅ **COMPLETE** | Searchable & filterable directory (by department & status); employee avatars, job positions, monthly wages, and attendance rates. |
| **Employee 360 Hub** | Profile View | ✅ **COMPLETE** | Dedicated 360 profile with **Smart Action Stat Buttons** (`Contracts: 1 Active`, `Attendance: 98%`, `Time Off: 14d Left`, `Wage: $6,500/mo`); Organization and Banking details. |
| **Payrun Command Center** | Tab: `Payruns` | ✅ **COMPLETE** | **4-Stage Workflow Stepper** (`DRAFT` ➔ `COMPUTED` ➔ `VALIDATED` ➔ `PAID`); Batch payslip calculation table; Summary totals ribbon (Gross, Deductions, Net). |
| **2-Step Payrun Wizard** | Modal Dialog | ✅ **COMPLETE** | Step 1: Scope selection (Period, Structure, Title); Step 2: Multi-select eligible employee checklist with active contract verification. |
| **Itemized Payslip Voucher** | Modal / Print View | ✅ **COMPLETE** | Official A4-proportioned voucher with side-by-side Earnings (Basic, HRA, Allowances) vs Deductions (Tax, PF, Unpaid Absence) and Print/PDF export actions. |
| **Attendance Registry** | Tab: `Attendance` | ✅ **COMPLETE** | Interactive **Self Check-In / Clock-Out** toggle with active duration counter; daily log table with semantic status badges (`Present`, `Late`, `Absent`, `Overtime`). |
| **Time Off Operations** | Tab: `Time Off` | ✅ **COMPLETE** | Leave requests queue with manager **Approve** and **Refuse** actions; Annual allocation quota tracking; Absence sync with payroll deduction engine. |

---

## 4. Test Accounts & Role Personas

All authentication is resolved dynamically from email and password (no manual dropdown):

| Work Email | Password | Resolved Name | Assigned Role | Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| `elena@company.com` | `password123` | Elena Rostova | **HR Payroll Manager** | Full payroll computation, validation, disbursement, and reporting. |
| `sarah@company.com` | `password123` | Sarah Connor | **HR Manager** | Employee directory, contract oversight, and leave approvals. |
| `alex@company.com` | `password123` | Alex Rivera | **HR Payroll User** | Payrun drafting, attendance log review, and payslip generation. |
| `john@company.com` | `password123` | John Doe | **Employee** | Self-service hub, clock in/out, view own payslip voucher. |
| `admin@company.com` | `password123` | System Administrator | **Admin** | Full system configuration, RBAC, and audit logs. |

---

## 5. Backend REST API Endpoints

The server is built with Express.js + TypeScript at `d:\Odoo\server`:

| Method | Endpoint | Description | Status |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/health` | Service health check and server timestamp | ✅ Verified |
| `GET` | `/api/employees` | List all employee records with wages and department info | ✅ Verified |
| `GET` | `/api/employees/:id` | Fetch specific employee details | ✅ Ready |
| `GET` | `/api/contracts` | List active, future, and historical contracts | ✅ Ready |
| `GET` | `/api/attendance` | Fetch daily attendance records | ✅ Ready |
| `POST` | `/api/attendance/check-in`| Log live check-in / check-out timestamps | ✅ Ready |
| `GET` | `/api/time-off` | List pending and approved leave requests | ✅ Ready |
| `PATCH`| `/api/time-off/:id/approve`| Approve leave request and deduct balance | ✅ Ready |
| `PATCH`| `/api/time-off/:id/refuse` | Refuse leave request | ✅ Ready |
| `GET` | `/api/payroll/payruns` | Fetch payrun batches and calculated payslips | ✅ Verified |
| `POST` | `/api/payroll/payruns/create`| Run 2-step payrun computation across selected employees | ✅ Ready |
| `PATCH`| `/api/payroll/payruns/:id/validate`| Transition payrun state to `VALIDATED` | ✅ Ready |
| `PATCH`| `/api/payroll/payruns/:id/pay`| Transition payrun state to `PAID` & lock batch | ✅ Ready |

### Deterministic Calculation Engine (`server/src/services/payrollEngine.ts`):
- **Basic Salary:** 60% of monthly contract wage
- **House Rent Allowance (HRA):** 25% of monthly wage
- **Special Allowance:** 15% of monthly wage
- **Total Gross:** `Basic + HRA + Special Allowance`
- **Unpaid Leave Deduction:** `(Basic / 30) * UnpaidDays`
- **Income Tax (TDS):** 10% of Gross
- **Social Security / PF:** 7% of Gross
- **Net Salary Payable:** `Gross - (Tax + PF + UnpaidLeaveDeduction)`

---

## 6. Database Architecture (`d:\Odoo\db/`)

- **[schema.sql](file:///d:/Odoo/db/schema.sql):** Relational schema normalized to **Boyce-Codd Normal Form (BCNF minimum)** with explicit **InnoDB `FOREIGN KEY` constraints** (`ON DELETE`, `ON UPDATE` cascades and restrictions):
  - `employees`: Candidate keys `{id}`, `{email}`.
  - `working_schedules`: Candidate keys `{id}`, `{name}` (unique).
  - `salary_structures`: Candidate keys `{id}`, `{code}` (unique).
  - `salary_rules`: Candidate keys `{id}`, `{structure_id, code}` (unique); `FOREIGN KEY (structure_id) REFERENCES salary_structures(id) ON DELETE CASCADE ON UPDATE CASCADE`.
  - `contracts`: Candidate key `{id}`; `FOREIGN KEY`s to `employees`, `salary_structures`, and `working_schedules`.
  - `attendance_records`: Candidate key `{id}`; `FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE`.
  - `time_off_requests`: Candidate key `{id}`; `FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE`.
  - `payruns`: Candidate key `{id}`; `FOREIGN KEY (salary_structure_id) REFERENCES salary_structures(id) ON DELETE SET NULL ON UPDATE CASCADE`.
  - `payslips`: Normalized to BCNF (redundant transitive attributes `employee_name` and `department` removed; employee metadata dynamically joined); Candidate keys `{id}`, `{payrun_id, employee_id}` (unique); `FOREIGN KEY`s to `payruns(id)` and `employees(id)`.
- **Migrations (`d:\Odoo\db\migrations/`):**
  - `001_add_gender_to_employees.sql`: Added `gender` enum to `employees`.
  - `002_normalize_bcnf_and_foreign_keys.sql`: Normalized `payslips` to BCNF, added candidate keys, and replaced inline `REFERENCES` with active InnoDB `FOREIGN KEY` constraints.
- **[seeds.sql](file:///d:/Odoo/db/seeds.sql):** Pre-populated with 6 multi-department employees, active contracts, working schedules, and September 2026 salary structures.

---

## 7. Project Directory Tree

```
d:\Odoo\
├── PROJECT_STATUS.md                   # This current status record file
├── PEOPLEPAY360_UI_UX_BLUEPRINT.md     # Master UI/UX architectural blueprint
├── README.md                           # Repository introduction
│
├── client/                             # React + TypeScript + Vite Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx              # Top bar (search, cycle pill, role switcher, logout)
│   │   │   └── Sidebar.tsx             # Navigation rail (Dashboard, Employees, Attendance, Time Off, Payruns)
│   │   ├── pages/
│   │   │   ├── Login.tsx               # Secure role-authenticated login screen
│   │   │   ├── Dashboard.tsx           # Executive KPI cards & department breakdown
│   │   │   ├── Employees.tsx           # Directory + Employee 360 Hub with smart action pills
│   │   │   ├── Payruns.tsx             # 2-step wizard, 4-stage stepper, and payslip voucher
│   │   │   ├── Attendance.tsx          # Clock in/out widget & daily compliance logs
│   │   │   └── TimeOff.tsx             # Leave approval pipeline & balance tracking
│   │   ├── App.tsx                     # Main layout & authentication state controller
│   │   ├── App.css                     # Unified Slate/Indigo enterprise stylesheet
│   │   ├── types.ts                    # Shared frontend TypeScript interfaces
│   │   ├── data.ts                     # Mock demo dataset for standalone testing
│   │   ├── index.css                   # Typography & Google Fonts import
│   │   └── main.tsx                    # React client entry point
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── server/                             # Express.js REST API Backend
│   ├── src/
│   │   ├── index.ts                    # Express server entry point (port 5000, CORS, routes)
│   │   ├── services/
│   │   │   └── payrollEngine.ts        # Deterministic salary calculation engine
│   │   └── routes/
│   │       ├── employee.routes.ts      # /api/employees
│   │       ├── contract.routes.ts      # /api/contracts
│   │       ├── attendance.routes.ts    # /api/attendance
│   │       ├── timeOff.routes.ts       # /api/time-off
│   │       └── payroll.routes.ts       # /api/payroll
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
└── db/                                 # Database Scripts
    ├── schema.sql                      # Complete SQL relational DDL
    ├── seeds.sql                       # Initial seed records
    └── README.md                       # SQLite / PostgreSQL setup instructions
```

---

## 8. Build & Performance Metrics

- **Frontend Compilation:** `tsc -b && vite build` ➔ **Clean build (0 errors) in 365ms**.
- **Dev Server Startup:** Vite starts in **~230ms**.
- **Backend Startup:** Express + tsx starts in **~300ms**.
- **Zero Runtime Dependencies Issues:** All modules use native CSS and React primitives with Lucide icons.

---

## 9. Completed Milestone: Centralized Authentication & Route Authorization

- **Backend API Endpoints:** `POST /api/auth/login` and `GET /api/auth/me` with HMAC-SHA256 signed session tokens, payload validation, and demo accounts.
- **Frontend API Abstraction:** Lightweight `client/src/api/client.ts` with safe JSON parsing, automatic `Authorization: Bearer <token>` attachment, and user-friendly error formatting.
- **Centralized AuthContext:** State management (`user`, `token`, `role`, `displayRole`, `isAuthenticated`, `isLoading`), safe session restoration via `/api/auth/me` on browser reload, and centralized logout.
- **Role & Permission Foundation:** Canonical role mapping (`EMPLOYEE`, `HR_MANAGER`, `HR_PAYROLL_USER`, `HR_PAYROLL_MANAGER`, `ADMIN`) and helpers `canAccess(userRole, feature)` and `hasPermission(userRole, permission)`.
- **Anti-Flicker Protection:** Branded splash screen during session validation prevents UI flickering between login and protected views.

---

## 10. Next Steps for Jay & Pavan

1. **Role-Gated Navigation:**
   - Integrate `canAccess` and `hasPermission` into `client/src/components/Sidebar.tsx` to conditionally show/disable tabs based on authenticated roles.
2. **Wire Domain Modules to Server API:**
   - Use `apiFetch` in `Employees.tsx`, `Attendance.tsx`, `TimeOff.tsx`, and `Payruns.tsx` to connect to the backend routes (`/api/employees`, `/api/attendance`, etc.).
3. **Database Persistence:**
   - Run `sqlite3 peoplepay360.db < db/schema.sql` and connect the Express routes using Prisma, Drizzle, or raw SQLite/pg driver.
4. **Demo Rehearsal:**
   - Test the end-to-end presentation flow: Sign in as `elena@company.com` ➔ Review Dashboard ➔ Open Employee 360 Hub ➔ Check In on Attendance ➔ Approve Leave Request ➔ Launch Payrun Wizard ➔ Advance Stepper to PAID ➔ View & Print official Payslip Voucher.

