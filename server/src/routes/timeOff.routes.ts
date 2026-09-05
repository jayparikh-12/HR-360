/**
 * Time Off Routes — /api/time-off
 *
 * Design principles:
 * - Route handlers are thin: validate inputs, enforce authentication & authorization,
 *   call repository, and return standardized JSON responses.
 * - All SQL and database operations live exclusively in timeOff.repository.ts.
 * - Enforces authentication via authenticateToken middleware.
 * - Enforces role-based authorization for administrative actions (approve/refuse).
 * - Implements strict state machine transition rules (PENDING -> APPROVED / REFUSED),
 *   returning 409 Conflict for invalid transitions.
 * - Validates date format, start/end date ordering, positive duration, and employee existence.
 * - Error status codes:
 *     400 -> Invalid request data / malformed ID / date validation errors
 *     401 -> Unauthenticated / invalid or missing JWT
 *     403 -> Insufficient permission (e.g. Employee attempting to approve/refuse)
 *     404 -> Leave request or employee not found
 *     409 -> Invalid workflow state transition
 *     500 -> Unexpected server error (never leaking SQL or stack traces)
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
  getAllTimeOffRequests,
  getTimeOffRequestById,
  getTimeOffRequests,
  createTimeOffRequest,
  approveTimeOffRequest,
  refuseTimeOffRequest,
  calculateLeaveDays,
  parseYMD,
  TimeOffWorkflowError,
  TimeOffValidationError,
} from '../repositories/timeOff.repository.js';
import { getEmployeeById } from '../repositories/employee.repository.js';

const router = Router();

// All Time Off endpoints require a valid JWT token
router.use(authenticateToken);

const VALID_STATUSES = ['PENDING', 'APPROVED', 'REFUSED'] as const;

// ─── GET /api/time-off ────────────────────────────────────────────────────────
// Returns database-backed time off requests, with optional ?employeeId= and ?status= filters.
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, status } = req.query;

    let statusFilter: string | undefined;
    if (typeof status === 'string' && status.trim().length > 0) {
      const upperStatus = status.trim().toUpperCase();
      if (!VALID_STATUSES.includes(upperStatus as (typeof VALID_STATUSES)[number])) {
        res.status(400).json({
          success: false,
          message: 'Invalid status filter. Allowed values are PENDING, APPROVED, or REFUSED.',
        });
        return;
      }
      statusFilter = upperStatus;
    }

    const employeeIdFilter = typeof employeeId === 'string' && employeeId.trim().length > 0
      ? employeeId.trim().slice(0, 50)
      : undefined;

    const records = await getTimeOffRequests({
      employeeId: employeeIdFilter,
      status: statusFilter,
    });

    res.json({ success: true, data: records });
  } catch (err) {
    console.error('[TimeOff API] Failed to list time off requests:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve time off records. Please try again.',
    });
  }
});

// ─── GET /api/time-off/:id ────────────────────────────────────────────────────
// Returns a single time off request by ID from MySQL, or 404 if not found.
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    res.status(400).json({ success: false, message: 'Invalid time off request ID.' });
    return;
  }

  const sanitizedId = id.trim().slice(0, 50);

  try {
    const record = await getTimeOffRequestById(sanitizedId);
    if (!record) {
      res.status(404).json({ success: false, message: 'Time off request not found.' });
      return;
    }

    res.json({ success: true, data: record });
  } catch (err) {
    console.error('[TimeOff API] Failed to fetch time off request:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve time off record. Please try again.',
    });
  }
});

// ─── POST /api/time-off ───────────────────────────────────────────────────────
// Creates a new leave request in MySQL after comprehensive validation.
router.post('/', async (req: Request, res: Response): Promise<void> => {
  // 1. Validate empty body
  if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
    res.status(400).json({ success: false, message: 'Request body cannot be empty.' });
    return;
  }

  const { employeeId, leaveType, startDate, endDate, reason, durationDays } = req.body;

  // 2. Validate required fields
  if (!employeeId || !leaveType || !startDate || !endDate) {
    res.status(400).json({
      success: false,
      message: 'Missing required fields: employeeId, leaveType, startDate, and endDate are required.',
    });
    return;
  }

  if (typeof employeeId !== 'string' || employeeId.trim().length === 0) {
    res.status(400).json({ success: false, message: 'Invalid employeeId provided.' });
    return;
  }

  if (typeof leaveType !== 'string' || leaveType.trim().length === 0) {
    res.status(400).json({ success: false, message: 'Invalid leaveType provided.' });
    return;
  }

  // 3. Validate date format (YYYY-MM-DD)
  const startParsed = parseYMD(startDate);
  const endParsed = parseYMD(endDate);

  if (!startParsed || !endParsed) {
    res.status(400).json({
      success: false,
      message: 'Invalid date format. Expected YYYY-MM-DD.',
    });
    return;
  }

  // 4. Validate date ordering and calculate duration
  const calculatedDuration = calculateLeaveDays(startDate, endDate);
  if (calculatedDuration === -1) {
    res.status(400).json({
      success: false,
      message: 'End date cannot be before start date.',
    });
    return;
  }

  if (calculatedDuration <= 0) {
    res.status(400).json({
      success: false,
      message: 'Leave duration must be at least 1 day.',
    });
    return;
  }

  try {
    // 5. Verify employee exists in MySQL database
    const employee = await getEmployeeById(employeeId.trim());
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    // 6. Create record in MySQL
    const newRecord = await createTimeOffRequest({
      employeeId: employeeId.trim(),
      leaveType: leaveType.trim(),
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      durationDays: typeof durationDays === 'number' && durationDays > 0 && durationDays <= calculatedDuration
        ? durationDays
        : calculatedDuration,
      reason: typeof reason === 'string' ? reason.trim() : undefined,
      status: 'PENDING',
    });

    res.status(201).json({ success: true, data: newRecord });
  } catch (err) {
    if (err instanceof TimeOffValidationError) {
      res.status(400).json({ success: false, message: err.message });
      return;
    }

    console.error('[TimeOff API] Failed to create time off request:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to submit leave request. Please try again.',
    });
  }
});

// ─── PATCH /api/time-off/:id/approve ──────────────────────────────────────────
// Approves a PENDING leave request (PENDING -> APPROVED).
router.patch('/:id/approve', async (req: Request, res: Response): Promise<void> => {
  // Authorization check: Employees cannot approve leave requests
  if (req.user && req.user.role === 'Employee') {
    res.status(403).json({
      success: false,
      message: 'Forbidden: Insufficient permission to approve leave requests.',
    });
    return;
  }

  const { id } = req.params;
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    res.status(400).json({ success: false, message: 'Invalid time off request ID.' });
    return;
  }

  const sanitizedId = id.trim().slice(0, 50);
  const approvedBy = req.user?.name || (typeof req.body?.approvedBy === 'string' ? req.body.approvedBy.trim() : 'HR Manager');

  try {
    const updated = await approveTimeOffRequest(sanitizedId, approvedBy);
    res.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof TimeOffWorkflowError) {
      if (err.code === 'NOT_FOUND') {
        res.status(404).json({ success: false, message: err.message });
        return;
      }
      if (err.code === 'INVALID_TRANSITION') {
        res.status(409).json({ success: false, message: err.message });
        return;
      }
    }

    console.error('[TimeOff API] Failed to approve leave request:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to approve leave request. Please try again.',
    });
  }
});

// ─── PATCH /api/time-off/:id/refuse ───────────────────────────────────────────
// Refuses a PENDING leave request (PENDING -> REFUSED).
router.patch('/:id/refuse', async (req: Request, res: Response): Promise<void> => {
  // Authorization check: Employees cannot refuse leave requests
  if (req.user && req.user.role === 'Employee') {
    res.status(403).json({
      success: false,
      message: 'Forbidden: Insufficient permission to refuse leave requests.',
    });
    return;
  }

  const { id } = req.params;
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    res.status(400).json({ success: false, message: 'Invalid time off request ID.' });
    return;
  }

  const sanitizedId = id.trim().slice(0, 50);
  const refusedBy = req.user?.name || (typeof req.body?.refusedBy === 'string' ? req.body.refusedBy.trim() : 'HR Manager');

  try {
    const updated = await refuseTimeOffRequest(sanitizedId, refusedBy);
    res.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof TimeOffWorkflowError) {
      if (err.code === 'NOT_FOUND') {
        res.status(404).json({ success: false, message: err.message });
        return;
      }
      if (err.code === 'INVALID_TRANSITION') {
        res.status(409).json({ success: false, message: err.message });
        return;
      }
    }

    console.error('[TimeOff API] Failed to refuse leave request:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to refuse leave request. Please try again.',
    });
  }
});

export default router;
