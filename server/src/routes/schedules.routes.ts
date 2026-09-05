/**
 * Schedule Routes
 *
 * GET    /api/schedules       — List all working schedules (MySQL-backed)
 * GET    /api/schedules/:id  — Get single working schedule by ID (MySQL-backed)
 * POST   /api/schedules       — Create a new working schedule (MySQL-backed)
 *
 * Design principles:
 * - Route handlers are thin: validate input, call repository, return response.
 * - All database logic lives in schedule.repository.ts.
 * - authenticateToken middleware is applied to all schedule endpoints.
 * - 500 responses never expose SQL, stack traces, or internal error details.
 * - DUPLICATE_SCHEDULE repository errors are surfaced as 409 Conflict.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/authorize.js';
import { PERMISSIONS } from '../types/rbac.js';
import {
  getAllSchedules,
  getScheduleById,
  createSchedule,
  type ScheduleRecord,
  type CreateScheduleInput,
} from '../repositories/schedule.repository.js';

const router = Router();

// All schedule endpoints require a valid JWT
router.use(authenticateToken);

// ── Validation helpers ────────────────────────────────────────────────────────

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

// ── GET /api/schedules ────────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const schedules = await getAllSchedules();
    res.json({ success: true, data: schedules });
  } catch (err) {
    console.error('[Schedule API] Failed to list schedules:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve schedule records. Please try again.',
    });
  }
});

// ── GET /api/schedules/:id ────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    res.status(400).json({ success: false, message: 'Invalid schedule ID.' });
    return;
  }

  const sanitizedId = id.trim().slice(0, 191);

  try {
    const schedule = await getScheduleById(sanitizedId);
    if (!schedule) {
      res.status(404).json({ success: false, message: 'Schedule not found.' });
      return;
    }
    res.json({ success: true, data: schedule });
  } catch (err) {
    console.error('[Schedule API] Failed to fetch schedule:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve schedule record. Please try again.',
    });
  }
});

// ── POST /api/schedules ───────────────────────────────────────────────────────

router.post('/', authorize(PERMISSIONS.CONTRACT_WRITE), async (req: Request, res: Response): Promise<void> => {
  const body = req.body;

  if (!body || typeof body !== 'object') {
    res.status(400).json({ success: false, message: 'Request body must be a JSON object.' });
    return;
  }

  // ── Required field validation ──
  const errors: string[] = [];

  if (!isNonEmptyString(body.name)) errors.push('name is required and must be a non-empty string.');
  if (!isNonEmptyString(body.workingHours)) errors.push('workingHours is required and must be a non-empty string.');

  if (errors.length > 0) {
    res.status(400).json({ success: false, message: errors.join(' ') });
    return;
  }

  // ── Optional: validate working hours format (basic check) ──
  const workingHours = body.workingHours.trim();
  // Accept common formats like "40h", "37.5h", "9-to-5", etc.
  const whRegex = /^[a-zA-Z0-9\s\-]+$/;
  if (!whRegex.test(workingHours)) {
    res.status(400).json({ success: false, message: 'workingHours contains invalid characters.' });
    return;
  }

  const input: CreateScheduleInput = {
    name: body.name.trim(),
    workingHours: workingHours,
  };

  try {
    const created = await createSchedule(input);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    if (err instanceof Error && err.message === 'DUPLICATE_SCHEDULE') {
      res.status(409).json({ success: false, message: 'A schedule with this name already exists.' });
      return;
    }
    console.error('[Schedule API] Failed to create schedule:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to create schedule record. Please try again.',
    });
  }
});

export default router;