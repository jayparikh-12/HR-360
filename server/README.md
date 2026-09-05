# PeoplePay360 Backend Server

Express.js REST API with the deterministic Payroll Calculation Engine.

## Routes
- `GET /api/employees` — List all employees
- `GET /api/employees/:id` — Employee 360 details
- `GET /api/contracts` — Contract list
- `GET /api/attendance` — Attendance records
- `POST /api/attendance/check-in` — Check-in action
- `GET /api/time-off` — Time off requests
- `PATCH /api/time-off/:id/approve` — Approve leave request
- `PATCH /api/time-off/:id/refuse` — Refuse leave request
- `GET /api/payroll/payruns` — Payrun batches
- `POST /api/payroll/payruns/create` — Run 2-step payrun computation
- `PATCH /api/payroll/payruns/:id/validate` — Validate payrun
- `PATCH /api/payroll/payruns/:id/pay` — Mark paid & disburse

## Development
```bash
npm install
npm run dev
```
Runs on `http://localhost:5000`
