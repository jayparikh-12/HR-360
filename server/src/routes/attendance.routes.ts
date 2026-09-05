/**
 * Attendance Routes
 *
 * GET   /api/attendance           — List all attendance records (MySQL)
 * GET   /api/attendance/:id       — Get single attendance record (MySQL)
 * POST  /api/attendance/check-in  — Record employee check-in (MySQL)
 * POST  /api/attendance/check-out — Record employee check-out (MySQL)
 *
 * Design principles:
 * - authenticateToken middleware applied to all routes.
 * - All database logic encapsulated in attendance.repository.ts.
 * - HTTP status codes: 200, 201, 400, 401, 404, 409, 500.
 * - Internal database errors, queries, and stack traces are never leaked.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
  getAllAttendance,
  getAttendanceById,
  getActiveCheckIn,
  findEmployeeByIdOrCode,
  createCheckIn,
  recordCheckOut,
  type CreateCheckInInput,
  type RecordCheckOutInput,
} from '../repositories/attendance.repository.js';

const router = Router();

// Protect all attendance endpoints with JWT authentication middleware
router.use(authenticateToken);

// ── Validation Helpers ────────────────────────────────────────────────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = new Set(['PRESENT', 'LATE', 'ABSENT', 'OVERTIME', 'MISSING_CHECKOUT']);

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

// ── GET /api/attendance ───────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const records = await getAllAttendance();
    res.json({ success: true, data: records });
  } catch (err) {
    console.error('[Attendance API] Failed to list attendance records:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve attendance records. Please try again.',
    });
  }
});

// ── GET /api/attendance/:id ───────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!isNonEmptyString(id)) {
    res.status(400).json({ success: false, message: 'Invalid attendance record ID.' });
    return;
  }

  const sanitizedId = id.trim().slice(0, 50);

  try {
    const record = await getAttendanceById(sanitizedId);

    if (!record) {
      res.status(404).json({ success: false, message: 'Attendance record not found.' });
      return;
    }

    res.json({ success: true, data: record });
  } catch (err) {
    console.error('[Attendance API] Failed to get attendance record:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve attendance record. Please try again.',
    });
  }
});

// ── POST /api/attendance/check-in ─────────────────────────────────────────────

router.post('/check-in', async (req: Request, res: Response): Promise<void> => {
  const body = req.body || {};

  // Support employeeId from body or authenticated user context
  const employeeIdInput = body.employeeId || body.employee_id || req.user?.employeeId;

  if (!isNonEmptyString(employeeIdInput)) {
    res.status(400).json({ success: false, message: 'employeeId is required.' });
    return;
  }

  // Optional date validation
  if (body.date !== undefined && body.date !== null && body.date !== '') {
    if (!isValidDateString(body.date)) {
      res.status(400).json({ success: false, message: 'date must be a valid date in YYYY-MM-DD format.' });
      return;
    }
  }

  // Optional status validation
  if (body.status !== undefined && body.status !== null && body.status !== '') {
    const upper = String(body.status).trim().toUpperCase();
    if (!VALID_STATUSES.has(upper)) {
      res.status(400).json({ success: false, message: 'status must be PRESENT, LATE, ABSENT, OVERTIME, or MISSING_CHECKOUT.' });
      return;
    }
  }

  try {
    // 1. Verify referenced employee exists in MySQL
    const employee = await findEmployeeByIdOrCode(employeeIdInput.trim());
    if (!employee) {
      res.status(404).json({
        success: false,
        message: `Employee '${employeeIdInput}' does not exist.`,
      });
      return;
    }

    // 2. Prevent duplicate active check-ins for the employee
    const targetDate = body.date ? body.date.trim() : undefined;
    const existingActive = await getActiveCheckIn(employee.id, targetDate);

    if (existingActive) {
      res.status(409).json({
        success: false,
        message: `Employee ${employee.name} already has an active check-in (${existingActive.id}) for this date. Please clock out before checking in again.`,
        activeRecord: existingActive,
      });
      return;
    }

    // 3. Create check-in record
    const input: CreateCheckInInput = {
      id: body.id ? String(body.id).trim().slice(0, 50) : undefined,
      employeeId: employee.id, // canonical DB UUID
      date: targetDate,
      checkIn: isNonEmptyString(body.checkIn) ? body.checkIn.trim() : undefined,
      status: body.status ? (String(body.status).trim().toUpperCase() as CreateCheckInInput['status']) : 'PRESENT',
    };

    const createdRecord = await createCheckIn(input);
    res.status(201).json({ success: true, data: createdRecord });
  } catch (err) {
    console.error('[Attendance API] Failed to check in:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to record check-in. Please try again.',
    });
  }
});

// ── POST /api/attendance/check-out ────────────────────────────────────────────

router.post('/check-out', async (req: Request, res: Response): Promise<void> => {
  const body = req.body || {};

  const recordIdInput = body.recordId || body.id;
  const employeeIdInput = body.employeeId || body.employee_id || req.user?.employeeId;

  if (!isNonEmptyString(recordIdInput) && !isNonEmptyString(employeeIdInput)) {
    res.status(400).json({
      success: false,
      message: 'Either employeeId or recordId must be provided for check-out.',
    });
    return;
  }

  try {
    let resolvedEmployeeId: string | undefined = undefined;

    if (isNonEmptyString(employeeIdInput)) {
      const employee = await findEmployeeByIdOrCode(employeeIdInput.trim());
      if (!employee) {
        res.status(404).json({
          success: false,
          message: `Employee '${employeeIdInput}' does not exist.`,
        });
        return;
      }
      resolvedEmployeeId = employee.id;
    }

    const input: RecordCheckOutInput = {
      recordId: isNonEmptyString(recordIdInput) ? recordIdInput.trim() : undefined,
      employeeId: resolvedEmployeeId,
      checkOut: isNonEmptyString(body.checkOut) ? body.checkOut.trim() : undefined,
    };

    const updated = await recordCheckOut(input);
    res.json({ success: true, data: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg === 'NO_ACTIVE_CHECKIN') {
      res.status(400).json({
        success: false,
        message: 'No active check-in found to clock out from.',
      });
      return;
    }

    if (msg === 'ALREADY_CHECKED_OUT') {
      res.status(400).json({
        success: false,
        message: 'This attendance record has already been checked out.',
      });
      return;
    }

    console.error('[Attendance API] Failed to check out:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to record check-out. Please try again.',
    });
  }
});

// ── POST /api/attendance/:id/check-out ────────────────────────────────────────

router.post('/:id/check-out', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const body = req.body || {};

  if (!isNonEmptyString(id)) {
    res.status(400).json({ success: false, message: 'Invalid attendance record ID.' });
    return;
  }

  try {
    const updated = await recordCheckOut({
      recordId: id.trim(),
      checkOut: isNonEmptyString(body.checkOut) ? body.checkOut.trim() : undefined,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg === 'NO_ACTIVE_CHECKIN') {
      res.status(404).json({
        success: false,
        message: 'Attendance record not found.',
      });
      return;
    }

    if (msg === 'ALREADY_CHECKED_OUT') {
      res.status(400).json({
        success: false,
        message: 'This attendance record has already been checked out.',
      });
      return;
    }

    console.error('[Attendance API] Failed to check out record:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to record check-out. Please try again.',
    });
  }
});

export default router;
