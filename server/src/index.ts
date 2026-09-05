import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth.routes.js';
import employeeRoutes from './routes/employee.routes.js';
import contractRoutes from './routes/contract.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import timeOffRoutes from './routes/timeOff.routes.js';
import payrollRoutes from './routes/payroll.routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// API Health Check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'PeoplePay360 Server', timestamp: new Date().toISOString() });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/time-off', timeOffRoutes);
app.use('/api/payroll', payrollRoutes);

app.listen(PORT, () => {
  console.log(`[PeoplePay360] Server running on http://localhost:${PORT}`);
});
