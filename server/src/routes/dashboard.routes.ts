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
} from '../services/dashboard.service.js';
import type { DashboardFilterParams } from '../repositories/dashboard.repository.js';

const router = Router();

// All dashboard endpoints require a valid JWT token
router.use(authenticateToken);

// Dashboard requires staff reading permissions (Admin, HR Payroll Manager, HR Manager, HR Payroll User)
router.use(authorize(PERMISSIONS.EMPLOYEE_READ));

/**
 * Handler for dashboard metrics aggregation.
 * Supports query parameters:
 * - ?period=2026-09
 * - ?department=Engineering
 * - ?employeeType=FULL_TIME
 */
async function handleDashboardMetrics(req: Request, res: Response): Promise<void> {
  try {
    const period = typeof req.query.period === 'string' ? req.query.period : undefined;
    const department = typeof req.query.department === 'string' ? req.query.department : undefined;
    const employeeType = typeof req.query.employeeType === 'string' ? req.query.employeeType : undefined;

    const filters: DashboardFilterParams = {
      period,
      department,
      employeeType,
    };

    const summary = await getDashboardSummary(filters);
    res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    console.error('[Dashboard API] Aggregation error:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to aggregate dashboard metrics. Please try again.',
    });
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
  try {
    const period = typeof req.query.period === 'string' ? req.query.period : undefined;
    const department = typeof req.query.department === 'string' ? req.query.department : undefined;
    const employeeType = typeof req.query.employeeType === 'string' ? req.query.employeeType : undefined;

    const filters: DashboardFilterParams = {
      period,
      department,
      employeeType,
    };

    const analytics = await getDashboardAnalytics(filters);
    res.json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    console.error('[Dashboard API] Analytics error:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to aggregate payroll visual analytics. Please try again.',
    });
  }
});

// ── GET /api/dashboard/alerts ─────────────────────────────────────────────────
router.get('/alerts', async (req: Request, res: Response): Promise<void> => {
  try {
    const period = typeof req.query.period === 'string' ? req.query.period : undefined;
    const department = typeof req.query.department === 'string' ? req.query.department : undefined;
    const employeeType = typeof req.query.employeeType === 'string' ? req.query.employeeType : undefined;

    const filters: DashboardFilterParams = {
      period,
      department,
      employeeType,
    };

    const alerts = await getDashboardAlerts(filters);
    res.json({
      success: true,
      data: {
        alerts,
      },
    });
  } catch (err) {
    console.error('[Dashboard API] Alerts error:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to aggregate operational alerts. Please try again.',
    });
  }
});

export default router;

