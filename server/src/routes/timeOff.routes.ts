/**
 * Time Off Routes
 *
 * GET   /api/time-off             — List all time off requests (MySQL)
 * GET   /api/time-off/:id         — Get single time off request (MySQL)
 * POST  /api/time-off             — Create a new time off request (MySQL)
 * PATCH /api/time-off/:id/approve — Approve a pending request (MySQL)
 * PATCH /api/time-off/:id/refuse  — Refuse a pending request (MySQL)
 *
 * Design principles:
 * - authenticateToken middleware applied to all routes.
 * - All database logic isolated in timeOff.repository.ts.
 * - HTTP status codes: 200, 201, 400, 401, 404, 500.
 * - Enforces state transition safety: only PENDING requests can be approved or refused.
 * - Never leaks internal SQL, credentials, or stack traces.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
  getAllTimeOffRequests,
  getTimeOffRequestById,
  findEmployeeByIdOrCode,
  createTimeOffRequest,
  approveTimeOffRequest,
  refuseTimeOffRequest,
  type CreateTimeOffInput,
} from '../repositories/timeOff.repository.js';

const router = Router();

// Protect all time-off endpoints with JWT authentication middleware
router.use(authenticateToken);

// ── Validation Helpers ────────────────────────────────────────────────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!DATE_REGEX.test(trimmed)) return false;
  const parsed = new Date(trimmed);
  return !isNaN(parsed.getTime());
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

// ── GET /api/time-off ─────────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const requests = await getAllTimeOffRequests();
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error('[TimeOff API] Failed to list requests:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve time-off requests. Please try again.',
    });
  }
});

// ── GET /api/time-off/:id ─────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!isNonEmptyString(id)) {
    res.status(400).json({ success: false, message: 'Invalid request ID.' });
    return;
  }

  const sanitizedId = id.trim().slice(0, 50);

  try {
    const request = await getTimeOffRequestById(sanitizedId);

    if (!request) {
      res.status(404).json({ success: false, message: 'Time-off request not found.' });
      return;
    }

    res.json({ success: true, data: request });
  } catch (err) {
    console.error('[TimeOff API] Failed to get request:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve time-off request. Please try again.',
    });
  }
});

// ── POST /api/time-off ────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const body = req.body || {};

  const employeeIdInput = body.employeeId || body.employee_id || req.user?.employeeId;
  const leaveTypeInput = body.leaveType || body.leave_type;
  const startDateInput = body.startDate || body.start_date;
  const endDateInput = body.endDate || body.end_date;
  const durationInput = body.durationDays || body.duration_days;
  const reasonInput = body.reason;

  // 1. Validate employeeId
  if (!isNonEmptyString(employeeIdInput)) {
    res.status(400).json({ success: false, message: 'employeeId is required.' });
    return;
  }

  // 2. Validate leaveType
  if (!isNonEmptyString(leaveTypeInput)) {
    res.status(400).json({ success: false, message: 'leaveType is required.' });
    return;
  }

  // 3. Validate startDate
  if (!isNonEmptyString(startDateInput) || !isValidDateString(startDateInput)) {
    res.status(400).json({ success: false, message: 'startDate must be a valid date in YYYY-MM-DD format.' });
    return;
  }

  // 4. Validate endDate
  if (!isNonEmptyString(endDateInput) || !isValidDateString(endDateInput)) {
    res.status(400).json({ success: false, message: 'endDate must be a valid date in YYYY-MM-DD format.' });
    return;
  }

  const startDateFormatted = startDateInput.trim();
  const endDateFormatted = endDateInput.trim();

  // 5. Date chronological check
  if (new Date(endDateFormatted) < new Date(startDateFormatted)) {
    res.status(400).json({ success: false, message: 'endDate cannot be before startDate.' });
    return;
  }

  // 6. Validate durationDays if supplied
  let parsedDuration: number | undefined = undefined;
  if (durationInput !== undefined && durationInput !== null && durationInput !== '') {
    const num = Number(durationInput);
    if (isNaN(num) || !isFinite(num) || num <= 0 || !Number.isInteger(num)) {
      res.status(400).json({ success: false, message: 'durationDays must be a positive integer.' });
      return;
    }
    parsedDuration = num;
  }

  try {
    // 7. Verify referenced employee exists in MySQL
    const employee = await findEmployeeByIdOrCode(employeeIdInput.trim());
    if (!employee) {
      res.status(404).json({
        success: false,
        message: `Employee '${employeeIdInput}' does not exist.`,
      });
      return;
    }

    // 8. Create time-off request in MySQL
    const input: CreateTimeOffInput = {
      id: body.id ? String(body.id).trim().slice(0, 50) : undefined,
      employeeId: employee.id, // canonical DB UUID
      leaveType: leaveTypeInput.trim(),
      startDate: startDateFormatted,
      endDate: endDateFormatted,
      durationDays: parsedDuration,
      reason: isNonEmptyString(reasonInput) ? reasonInput.trim() : null,
    };

    const created = await createTimeOffRequest(input);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('[TimeOff API] Failed to create request:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to create time-off request. Please try again.',
    });
  }
});

// ── PATCH /api/time-off/:id/approve ───────────────────────────────────────────

router.patch('/:id/approve', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!isNonEmptyString(id)) {
    res.status(400).json({ success: false, message: 'Invalid request ID.' });
    return;
  }

  try {
    const updated = await approveTimeOffRequest(id.trim());
    res.json({ success: true, data: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg === 'REQUEST_NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Time-off request not found.' });
      return;
    }

    if (msg.startsWith('INVALID_STATE_TRANSITION:')) {
      const currentStatus = msg.split(':')[1];
      res.status(400).json({
        success: false,
        message: `Cannot approve request with status '${currentStatus}'. Only PENDING requests can be approved.`,
      });
      return;
    }

    console.error('[TimeOff API] Failed to approve request:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to approve time-off request. Please try again.',
    });
  }
});

// ── PATCH /api/time-off/:id/refuse ────────────────────────────────────────────

router.patch('/:id/refuse', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!isNonEmptyString(id)) {
    res.status(400).json({ success: false, message: 'Invalid request ID.' });
    return;
  }

  try {
    const updated = await refuseTimeOffRequest(id.trim());
    res.json({ success: true, data: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg === 'REQUEST_NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Time-off request not found.' });
      return;
    }

    if (msg.startsWith('INVALID_STATE_TRANSITION:')) {
      const currentStatus = msg.split(':')[1];
      res.status(400).json({
        success: false,
        message: `Cannot refuse request with status '${currentStatus}'. Only PENDING requests can be refused.`,
      });
      return;
    }

    console.error('[TimeOff API] Failed to refuse request:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to refuse time-off request. Please try again.',
    });
  }
});

export default router;
