# PeoplePay360 Backend Server

Express + TypeScript API for PeoplePay360.

## What it covers

- JWT login and session restoration
- Employee, contract, schedule, attendance, and time-off endpoints
- Salary structure and salary rule endpoints
- Payroll payrun creation, validation, payment, and payslip persistence
- MySQL health checks through `/api/health`

## Setup

1. Copy `server/.env.example` to `server/.env`.
2. Configure MySQL and JWT values.
3. Install dependencies and start the API.

```bash
cd server
npm install
npm run dev
```

### Build and run production output

```bash
npm run build
npm run start
```

The server runs on `http://localhost:5000` by default.

## Environment Variables

The backend reads these values from `server/.env`:

- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

## Main Routes

All protected routes require `Authorization: Bearer <token>`.

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/auth/whoami`
- `GET /api/employees`
- `POST /api/employees`
- `GET /api/employees/:id`
- `PATCH /api/employees/:id`
- `GET /api/contracts`
- `GET /api/schedules`
- `GET /api/attendance`
- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- `GET /api/time-off`
- `POST /api/time-off`
- `GET /api/time-off/:id`
- `PATCH /api/time-off/:id/approve`
- `PATCH /api/time-off/:id/refuse`
- `GET /api/salary-structures`
- `POST /api/salary-structures`
- `GET /api/salary-rules`
- `POST /api/salary-rules`
- `GET /api/payroll/payruns`
- `GET /api/payroll/payruns/:id`
- `POST /api/payroll/payruns/create`
- `PATCH /api/payroll/payruns/:id/validate`
- `PATCH /api/payroll/payruns/:id/pay`

