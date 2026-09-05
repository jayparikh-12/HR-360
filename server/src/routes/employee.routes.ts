/**
 * Employee Routes
 *
 * GET    /api/employees       — list all employees (MySQL)
 * GET    /api/employees/:id   — get single employee (MySQL)
 * POST   /api/employees       — create employee (MySQL)
 * PATCH  /api/employees/:id   — update employee fields (MySQL)
 *
 * Design principles:
 * - Route handlers are thin: validate input, call repository, return response.
 * - All database logic lives in employee.repository.ts.
 * - authenticateToken middleware is applied to all employee endpoints.
 * - 500 responses never expose SQL, stack traces, or internal error details.
 * - DUPLICATE_EMAIL repository errors are surfaced as 409 Conflict.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from '../repositories/employee.repository.js';

const router = Router();

// All employee endpoints require a valid JWT
router.use(authenticateToken);

// ── Validation helpers ────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_EMP_TYPES = new Set(['FULL_TIME', 'PART_TIME', 'CONTRACT']);
const VALID_STATUSES = new Set(['ACTIVE', 'INACTIVE']);

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

// ── GET /api/employees ────────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const employees = await getAllEmployees();
    res.json({ success: true, data: employees });
  } catch (err) {
    console.error('[Employee API] Failed to list employees:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve employee records. Please try again.',
    });
  }
});

// ── GET /api/employees/:id ────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    res.status(400).json({ success: false, message: 'Invalid employee ID.' });
    return;
  }

  const sanitizedId = id.trim().slice(0, 191);

  try {
    const employee = await getEmployeeById(sanitizedId);
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }
    res.json({ success: true, data: employee });
  } catch (err) {
    console.error('[Employee API] Failed to fetch employee:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve employee record. Please try again.',
    });
  }
});

// ── POST /api/employees ───────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Partial<CreateEmployeeInput>;

  // ── Required field validation ──
  const errors: string[] = [];

  if (!isNonEmptyString(body.firstName)) errors.push('firstName is required.');
  if (!isNonEmptyString(body.lastName))  errors.push('lastName is required.');
  if (!isNonEmptyString(body.email))     errors.push('email is required.');
  if (!isNonEmptyString(body.department)) errors.push('department is required.');
  if (!isNonEmptyString(body.jobPosition)) errors.push('jobPosition is required.');

  if (errors.length > 0) {
    res.status(400).json({ success: false, message: errors.join(' ') });
    return;
  }

  // ── Email format ──
  const emailStr = (body.email as string).trim().toLowerCase();
  if (!EMAIL_REGEX.test(emailStr)) {
    res.status(400).json({ success: false, message: 'Invalid email address format.' });
    return;
  }

  // ── Optional enum validation ──
  if (body.employeeType !== undefined && !VALID_EMP_TYPES.has(body.employeeType as string)) {
    res.status(400).json({ success: false, message: 'employeeType must be FULL_TIME, PART_TIME, or CONTRACT.' });
    return;
  }
  if (body.status !== undefined && !VALID_STATUSES.has(body.status as string)) {
    res.status(400).json({ success: false, message: 'status must be ACTIVE or INACTIVE.' });
    return;
  }

  const input: CreateEmployeeInput = {
    firstName:       (body.firstName as string).trim(),
    lastName:        (body.lastName as string).trim(),
    email:           emailStr,
    department:      (body.department as string).trim(),
    jobPosition:     (body.jobPosition as string).trim(),
    employeeType:    body.employeeType,
    status:          body.status,
    phone:           typeof body.phone === 'string' ? body.phone.trim() || null : null,
    workingSchedule: typeof body.workingSchedule === 'string' ? body.workingSchedule.trim() || null : null,
    managerId:       typeof body.managerId === 'string' ? body.managerId.trim() || null : null,
    bankName:        typeof body.bankName === 'string' ? body.bankName.trim() || null : null,
    bankAccountNo:   typeof body.bankAccountNo === 'string' ? body.bankAccountNo.trim() || null : null,
    ifscRouting:     typeof body.ifscRouting === 'string' ? body.ifscRouting.trim() || null : null,
  };

  try {
    const created = await createEmployee(input);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    if (err instanceof Error && err.message === 'DUPLICATE_EMAIL') {
      res.status(409).json({ success: false, message: 'An employee with this email address already exists.' });
      return;
    }
    console.error('[Employee API] Failed to create employee:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to create employee record. Please try again.',
    });
  }
});

// ── PATCH /api/employees/:id ──────────────────────────────────────────────────

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // ── ID validation ──
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    res.status(400).json({ success: false, message: 'Invalid employee ID.' });
    return;
  }

  const sanitizedId = id.trim().slice(0, 191);
  const body = req.body as Partial<UpdateEmployeeInput>;

  // ── Field-level validation for provided fields ──
  if (body.email !== undefined) {
    if (!isNonEmptyString(body.email) || !EMAIL_REGEX.test(body.email.trim())) {
      res.status(400).json({ success: false, message: 'Invalid email address format.' });
      return;
    }
  }

  if (body.firstName !== undefined && !isNonEmptyString(body.firstName)) {
    res.status(400).json({ success: false, message: 'firstName cannot be empty.' });
    return;
  }
  if (body.lastName !== undefined && !isNonEmptyString(body.lastName)) {
    res.status(400).json({ success: false, message: 'lastName cannot be empty.' });
    return;
  }
  if (body.department !== undefined && !isNonEmptyString(body.department)) {
    res.status(400).json({ success: false, message: 'department cannot be empty.' });
    return;
  }
  if (body.jobPosition !== undefined && !isNonEmptyString(body.jobPosition)) {
    res.status(400).json({ success: false, message: 'jobPosition cannot be empty.' });
    return;
  }

  if (body.employeeType !== undefined && !VALID_EMP_TYPES.has(body.employeeType as string)) {
    res.status(400).json({ success: false, message: 'employeeType must be FULL_TIME, PART_TIME, or CONTRACT.' });
    return;
  }
  if (body.status !== undefined && !VALID_STATUSES.has(body.status as string)) {
    res.status(400).json({ success: false, message: 'status must be ACTIVE or INACTIVE.' });
    return;
  }

  // ── Strip protected/system fields the client should never control ──
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...safeBody
  } = body as Record<string, unknown>;
  // Explicitly remove any attempt to set protected fields
  delete safeBody['id'];
  delete safeBody['empCode'];
  delete safeBody['createdAt'];
  delete safeBody['updatedAt'];

  const input: UpdateEmployeeInput = safeBody as UpdateEmployeeInput;

  try {
    const updated = await updateEmployee(sanitizedId, input);
    if (!updated) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof Error && err.message === 'DUPLICATE_EMAIL') {
      res.status(409).json({ success: false, message: 'An employee with this email address already exists.' });
      return;
    }
    console.error('[Employee API] Failed to update employee:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to update employee record. Please try again.',
    });
  }
});

export default router;
