import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from server root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import authRoutes from './routes/auth.routes.js';
import employeeRoutes from './routes/employee.routes.js';
import contractRoutes from './routes/contract.routes.js';
import scheduleRoutes from './routes/schedules.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import timeOffRoutes from './routes/timeOff.routes.js';
import salaryStructureRoutes from './routes/salaryStructure.routes.js';
import salaryRuleRoutes from './routes/salaryRule.routes.js';
import payrollRoutes from './routes/payroll.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import { testDatabaseConnection, pool } from './config/database.js';
import { apiNotFoundError, globalErrorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : '*';

app.use(
  cors({
    origin: allowedOrigins === '*' ? true : allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());

// API Health Check
app.get('/api/health', async (_req, res) => {
  const dbResult = await testDatabaseConnection();
  res.json({
    status: 'ok',
    service: 'PeoplePay360 Server',
    timestamp: new Date().toISOString(),
    database: {
      connected: dbResult.connected,
      type: 'mysql',
      message: dbResult.message,
      ...(dbResult.details ? { name: dbResult.details.database } : {}),
    },
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/time-off', timeOffRoutes);
app.use('/api/salary-structures', salaryStructureRoutes);
app.use('/api/salary-rules', salaryRuleRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Catch-all for undefined /api routes (returns JSON 404 instead of Express HTML)
app.use('/api', apiNotFoundError);

// Global unhandled error middleware (safe 500 JSON without stack trace leakage)
app.use(globalErrorHandler);

export { app };

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, async () => {
    console.log(`[PeoplePay360] Server running on http://localhost:${PORT}`);
    const dbResult = await testDatabaseConnection();
    if (dbResult.connected) {
      console.log(`[Database] MySQL connection established (database: ${dbResult.details?.database})`);
    } else {
      console.error(`[Database] MySQL connection warning: ${dbResult.message}`);
    }
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`[PeoplePay360] Received ${signal}. Initiating graceful shutdown...`);
    server.close(async () => {
      console.log('[PeoplePay360] HTTP server closed.');
      try {
        await pool.end();
        console.log('[Database] MySQL connection pool closed.');
        process.exit(0);
      } catch (err) {
        console.error('[Database] Error closing MySQL pool:', err);
        process.exit(1);
      }
    });

    setTimeout(() => {
      console.error('[PeoplePay360] Forcefully shutting down after timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}
