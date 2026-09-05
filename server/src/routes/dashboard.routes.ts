/**
 * Dashboard Routes — Secure Endpoint for PeoplePay360 Dashboard Aggregation.
 *
 * GET /api/dashboard          — Retrieve aggregated metrics with optional filters
 * GET /api/dashboard/summary  — Alias for /api/dashboard
 * GET /api/dashboard/filters  — Retrieve available filter options (departments, periods, employeeTypes)
 *
 * Security:
 * - authenticateToken: Requires a valid signed JWT bearer token (401 on missing/invalid).
 * - authorize(PERMISSIONS.EMPLOYEE_READ): Enforces RBAC permissions (403 for unauthorized roles).
 * - Safe error handling without raw SQL or internal credential exposure.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/authorize.js';
import { PERMISSIONS } from '../types/rbac.js';
import {
  getDashboardSummary,
  getDashboardFilterOptions,
  getDashboardAnalytics,
  getDashboardAlerts,
  getAttendanceAnalytics,
  getTimeOffAnalytics,
} from '../services/dashboard.service.js';
import type { DashboardFilterParams } from '../repositories/dashboard.repository.js';
import { isValidPeriodString } from '../utils/validators.js';
import { handleDatabaseError } from '../middleware/errorHandler.js';

const router = Router();

// All dashboard endpoints require a valid JWT token
router.use(authenticateToken);

// Dashboard requires staff reading permissions (Admin, HR Payroll Manager, HR Manager, HR Payroll User)
router.use(authorize(PERMISSIONS.EMPLOYEE_READ));

const VALID_EMP_TYPES = new Set(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'ALL']);

/**
 * Validates and sanitizes dashboard query parameters.
 * Returns null if validation fails (response already sent).
 */
function parseAndValidateDashboardFilters(req: Request, res: Response): DashboardFilterParams | null {
  const { period, department, employeeType } = req.query;

  let validatedPeriod: string | undefined = undefined;
  if (period !== undefined && period !== null && period !== '') {
    if (typeof period !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid period filter format.' });
      return null;
    }
    const trimmed = period.trim();
    if (!isValidPeriodString(trimmed)) {
      res.status(400).json({
        success: false,
        message: 'Invalid period filter format. Expected YYYY-MM, YYYY-MM-DD, or ALL.',
      });
      return null;
    }
    validatedPeriod = trimmed;
  }

  let validatedDept: string | undefined = undefined;
  if (department !== undefined && department !== null && department !== '') {
    if (typeof department !== 'string' || department.trim().length > 100) {
      res.status(400).json({ success: false, message: 'Invalid department filter.' });
      return null;
    }
    validatedDept = department.trim();
  }

  let validatedEmpType: string | undefined = undefined;
  if (employeeType !== undefined && employeeType !== null && employeeType !== '') {
    if (typeof employeeType !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid employeeType filter.' });
      return null;
    }
    const upper = employeeType.trim().toUpperCase();
    if (!VALID_EMP_TYPES.has(upper)) {
      res.status(400).json({
        success: false,
        message: 'employeeType filter must be FULL_TIME, PART_TIME, CONTRACT, or ALL.',
      });
      return null;
    }
    validatedEmpType = upper;
  }

  return {
    period: validatedPeriod,
    department: validatedDept,
    employeeType: validatedEmpType,
  };
}

/**
 * Handler for dashboard metrics aggregation.
 * Supports query parameters:
 * - ?period=2026-09
 * - ?department=Engineering
 * - ?employeeType=FULL_TIME
 */
async function handleDashboardMetrics(req: Request, res: Response): Promise<void> {
  const filters = parseAndValidateDashboardFilters(req, res);
  if (!filters) return;

  try {
    const summary = await getDashboardSummary(filters);
    res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    handleDatabaseError(err, res, 'Unable to aggregate dashboard metrics');
  }
}

// ── GET /api/dashboard & GET /api/dashboard/summary ──────────────────────────
router.get('/', handleDashboardMetrics);
router.get('/summary', handleDashboardMetrics);

// ── GET /api/dashboard/filters ───────────────────────────────────────────────
router.get('/filters', async (_req: Request, res: Response): Promise<void> => {
  try {
    const options = await getDashboardFilterOptions();
    res.json({
      success: true,
      data: options,
    });
  } catch (err) {
    console.error('[Dashboard API] Filter options error:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to load filter options.',
    });
  }
});

// ── GET /api/dashboard/analytics ─────────────────────────────────────────────
router.get('/analytics', async (req: Request, res: Response): Promise<void> => {
  const filters = parseAndValidateDashboardFilters(req, res);
  if (!filters) return;

  try {
    const analytics = await getDashboardAnalytics(filters);
    res.json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    handleDatabaseError(err, res, 'Unable to aggregate payroll visual analytics');
  }
});

// ── GET /api/dashboard/alerts ─────────────────────────────────────────────────
router.get('/alerts', async (req: Request, res: Response): Promise<void> => {
  const filters = parseAndValidateDashboardFilters(req, res);
  if (!filters) return;

  try {
    const alerts = await getDashboardAlerts(filters);
    res.json({
      success: true,
      data: {
        alerts,
      },
    });
  } catch (err) {
    handleDatabaseError(err, res, 'Unable to aggregate operational alerts');
  }
});

// ── GET /api/dashboard/attendance-analytics ───────────────────────────────────
router.get('/attendance-analytics', async (req: Request, res: Response): Promise<void> => {
  const filters = parseAndValidateDashboardFilters(req, res);
  if (!filters) return;

  try {
    const analytics = await getAttendanceAnalytics(filters);
    res.json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    handleDatabaseError(err, res, 'Unable to aggregate attendance analytics');
  }
});

// ── GET /api/dashboard/time-off-analytics ─────────────────────────────────────
router.get('/time-off-analytics', async (req: Request, res: Response): Promise<void> => {
  const filters = parseAndValidateDashboardFilters(req, res);
  if (!filters) return;

  try {
    const analytics = await getTimeOffAnalytics(filters);
    res.json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    handleDatabaseError(err, res, 'Unable to aggregate time-off analytics');
  }
});

export default router;

