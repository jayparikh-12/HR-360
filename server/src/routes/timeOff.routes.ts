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
import { authorize } from '../middleware/authorize.js';
import { PERMISSIONS } from '../types/rbac.js';
import { roleHasPermission } from '../config/permissions.js';
import {
  getAllTimeOffRequests,
  getTimeOffRequestById,
  getTimeOffRequests,
  findEmployeeByIdOrCode,
  createTimeOffRequest,
  approveTimeOffRequest,
  refuseTimeOffRequest,
  TimeOffWorkflowError,
  TimeOffValidationError,
  type CreateTimeOffInput,
} from '../repositories/timeOff.repository.js';
import { handleDatabaseError } from '../middleware/errorHandler.js';

const router = Router();

// All Time Off endpoints require a valid JWT token
router.use(authenticateToken);

const VALID_STATUSES = ['PENDING', 'APPROVED', 'REFUSED'] as const;
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

// ─── GET /api/time-off ────────────────────────────────────────────────────────
// Returns database-backed time off requests, with optional ?employeeId= and ?status= filters.
router.get('/', authorize(PERMISSIONS.TIMEOFF_READ), async (req: Request, res: Response): Promise<void> => {
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

    let employeeIdFilter = typeof employeeId === 'string' && employeeId.trim().length > 0
      ? employeeId.trim().slice(0, 50)
      : undefined;

    // Self-service scoping: Regular employees only see their own requests
    if (req.user && req.user.role === 'Employee' && req.user.employeeId) {
      employeeIdFilter = req.user.employeeId;
    }

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
// Returns a single leave request by unique ID.
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!isNonEmptyString(id)) {
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

    // IDOR Protection: Employee can only view their own leave requests
    const isSelf = req.user?.employeeId && req.user.employeeId === record.employeeId;
    const isManagerOrAdmin = req.user?.role && roleHasPermission(req.user.role, PERMISSIONS.TIMEOFF_APPROVE);
    if (!isSelf && !isManagerOrAdmin) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view this time off request.',
      });
      return;
    }

    res.json({ success: true, data: record });
  } catch (err) {
    console.error('[TimeOff API] Failed to retrieve time off request:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve time off record. Please try again.',
    });
  }
});

// ─── POST /api/time-off ───────────────────────────────────────────────────────
// Creates a new leave request in MySQL backed by state machine validation.
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const body = req.body || {};

  const employeeIdInput = body.employeeId || body.employee_id || req.user?.employeeId;

  // Authorization check: Employees can only request leave for themselves
  if (req.user && req.user.role === 'Employee' && req.user.employeeId) {
    if (typeof employeeIdInput === 'string' && employeeIdInput.trim() !== req.user.employeeId) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Employees can only request leave for themselves.',
      });
      return;
    }
  }

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
    res.status(400).json({
      success: false,
      message: 'startDate must be a valid date in YYYY-MM-DD format.',
    });
    return;
  }

  // 4. Validate endDate
  if (!isNonEmptyString(endDateInput) || !isValidDateString(endDateInput)) {
    res.status(400).json({
      success: false,
      message: 'endDate must be a valid date in YYYY-MM-DD format.',
    });
    return;
  }

  const startDateFormatted = startDateInput.trim();
  const endDateFormatted = endDateInput.trim();

  // 5. Date chronological check
  if (new Date(endDateFormatted) < new Date(startDateFormatted)) {
    res.status(400).json({
      success: false,
      message: 'endDate cannot be before startDate.',
    });
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
      status: 'PENDING',
    };

    const newRecord = await createTimeOffRequest(input);
    res.status(201).json({ success: true, data: newRecord });
  } catch (err) {
    if (err instanceof TimeOffValidationError) {
      res.status(400).json({ success: false, message: err.message });
      return;
    }

    handleDatabaseError(err, res, 'Failed to create time off request');
  }
});

// ─── PATCH /api/time-off/:id/approve ──────────────────────────────────────────
// Approves a PENDING leave request (PENDING -> APPROVED).
router.patch('/:id/approve', authorize(PERMISSIONS.TIMEOFF_APPROVE), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!isNonEmptyString(id)) {
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

    handleDatabaseError(err, res, 'Failed to approve leave request');
  }
});

// ─── PATCH /api/time-off/:id/refuse ───────────────────────────────────────────
// Refuses a PENDING leave request (PENDING -> REFUSED).
router.patch('/:id/refuse', authorize(PERMISSIONS.TIMEOFF_APPROVE), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!isNonEmptyString(id)) {
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

    handleDatabaseError(err, res, 'Failed to refuse leave request');
  }
});

export default router;
