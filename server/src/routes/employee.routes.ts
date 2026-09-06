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
import { authorize, requireAdmin } from '../middleware/authorize.js';
import { PERMISSIONS } from '../types/rbac.js';
import { roleHasPermission } from '../config/permissions.js';
import {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from '../repositories/employee.repository.js';
import { isValidDateString, isValidEmail, isNonEmptyString } from '../utils/validators.js';
import { handleDatabaseError } from '../middleware/errorHandler.js';

const router = Router();

// All employee endpoints require a valid JWT
router.use(authenticateToken);

// ── Validation constants ──────────────────────────────────────────────────────

const VALID_EMP_TYPES = new Set(['FULL_TIME', 'PART_TIME', 'CONTRACT']);
const VALID_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'PROBATION', 'TERMINATED']);
const VALID_GENDERS = new Set(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY']);

// ── GET /api/employees ────────────────────────────────────────────────────────

router.get('/', authorize(PERMISSIONS.EMPLOYEE_READ), async (_req: Request, res: Response): Promise<void> => {
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

  // Allow if user is inspecting their own profile or holds EMPLOYEE_READ permission
  const isSelf = req.user?.employeeId && req.user.employeeId === sanitizedId;
  const isManagerOrAdmin = req.user?.role && roleHasPermission(req.user.role, PERMISSIONS.EMPLOYEE_READ);
  if (!isSelf && !isManagerOrAdmin) {
    res.status(403).json({ success: false, message: 'Forbidden: Insufficient permission to view employee record.' });
    return;
  }

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
// Strictly restricted to Administrators per Requirement 4
router.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {

  const body = req.body as Partial<CreateEmployeeInput>;

  // ── Required field validation ──
  const errors: string[] = [];

  // Accept either name or firstName+lastName from legacy clients
  const fullName = isNonEmptyString(body.name)
    ? body.name.trim()
    : [(req.body.firstName || '').trim(), (req.body.lastName || '').trim()].filter(Boolean).join(' ');

  if (!fullName) errors.push('name is required.');
  if (!isNonEmptyString(body.email))      errors.push('email is required.');
  if (!isNonEmptyString(body.department)) errors.push('department is required.');

  if (errors.length > 0) {
    res.status(400).json({ success: false, message: errors.join(' ') });
    return;
  }

  // ── Email format ──
  const emailStr = (body.email as string).trim().toLowerCase();
  if (!isValidEmail(emailStr)) {
    res.status(400).json({ success: false, message: 'Invalid email address format.' });
    return;
  }

  // ── Optional joinDate format validation ──
  if (body.joinDate !== undefined && body.joinDate !== null && body.joinDate !== '') {
    if (!isValidDateString(body.joinDate)) {
      res.status(400).json({ success: false, message: 'joinDate must be a valid date in YYYY-MM-DD format.' });
      return;
    }
  }

  // ── Optional dateOfBirth format validation ──
  if (body.dateOfBirth !== undefined && body.dateOfBirth !== null && body.dateOfBirth !== '') {
    if (!isValidDateString(body.dateOfBirth)) {
      res.status(400).json({ success: false, message: 'dateOfBirth must be a valid date in YYYY-MM-DD format.' });
      return;
    }
  }

  // ── Optional employeeType validation ──
  const rawEmpType = (body.employeeType || (req.body as Record<string, unknown>).employee_type) as string | undefined;
  if (rawEmpType !== undefined && rawEmpType !== null && rawEmpType !== '') {
    const upperType = String(rawEmpType).trim().toUpperCase();
    if (!VALID_EMP_TYPES.has(upperType)) {
      res.status(400).json({ success: false, message: 'employeeType must be FULL_TIME, PART_TIME, or CONTRACT.' });
      return;
    }
  }

  // ── Optional enum validation ──
  if (body.status !== undefined && !VALID_STATUSES.has((body.status as string).toUpperCase())) {
    res.status(400).json({ success: false, message: 'status must be ACTIVE, PROBATION, or TERMINATED.' });
    return;
  }
  if (body.gender !== undefined && body.gender !== null && body.gender !== '') {
    const normalizedGender = String(body.gender).trim().toUpperCase();
    if (!VALID_GENDERS.has(normalizedGender)) {
      res.status(400).json({
        success: false,
        message: 'gender must be one of: MALE, FEMALE, NON_BINARY, OTHER, PREFER_NOT_TO_SAY.',
      });
      return;
    }
  }

  // Accept position from either 'position' or legacy 'jobPosition'
  const position = isNonEmptyString(body.position)
    ? body.position.trim()
    : isNonEmptyString((req.body as Record<string, unknown>).jobPosition as string)
      ? (req.body.jobPosition as string).trim()
      : 'Staff';

  // Accept bankAccount from either 'bankAccount' or legacy 'bankAccountNo'
  const bankAccount = isNonEmptyString(body.bankAccount)
    ? body.bankAccount.trim()
    : isNonEmptyString((req.body as Record<string, unknown>).bankAccountNo as string)
      ? (req.body.bankAccountNo as string).trim()
      : null;

  const rawReq = req.body as Record<string, unknown>;
  const input: CreateEmployeeInput = {
    name:        fullName,
    firstName:   isNonEmptyString(rawReq.firstName as string) ? (rawReq.firstName as string).trim() : undefined,
    lastName:    isNonEmptyString(rawReq.lastName as string) ? (rawReq.lastName as string).trim() : undefined,
    email:       emailStr,
    department:  (body.department as string).trim(),
    position,
    jobPosition: position,
    gender:      body.gender ? String(body.gender).trim().toUpperCase() : null,
    dateOfBirth: isNonEmptyString(body.dateOfBirth) ? body.dateOfBirth.trim() : undefined,
    status:      body.status,
    employeeType: rawEmpType ? String(rawEmpType).trim().toUpperCase() : undefined,
    joinDate:    isNonEmptyString(body.joinDate) ? body.joinDate.trim() : undefined,
    workingSchedule: isNonEmptyString(rawReq.workingSchedule as string) ? (rawReq.workingSchedule as string).trim() : undefined,
    bankName:    isNonEmptyString(rawReq.bankName as string) ? (rawReq.bankName as string).trim() : undefined,
    bankAccount,
    bankAccountNo: bankAccount,
  };

  try {
    const created = await createEmployee(input);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    if (err instanceof Error && err.message === 'DUPLICATE_EMAIL') {
      res.status(409).json({ success: false, message: 'An employee with this email address already exists.' });
      return;
    }
    handleDatabaseError(err, res, 'Failed to create employee');
  }
});

// ── PATCH /api/employees/:id ──────────────────────────────────────────────────

router.patch('/:id', authorize(PERMISSIONS.EMPLOYEE_WRITE), async (req: Request, res: Response): Promise<void> => {

  const { id } = req.params;

  // ── ID validation ──
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    res.status(400).json({ success: false, message: 'Invalid employee ID.' });
    return;
  }

  const sanitizedId = id.trim().slice(0, 191);
  const body = req.body as Partial<CreateEmployeeInput & UpdateEmployeeInput>;

  // ── Field-level validation for provided fields ──
  if (body.email !== undefined) {
    if (!isNonEmptyString(body.email) || !isValidEmail(body.email.trim())) {
      res.status(400).json({ success: false, message: 'Invalid email address format.' });
      return;
    }
  }
  if (body.department !== undefined && !isNonEmptyString(body.department)) {
    res.status(400).json({ success: false, message: 'department cannot be empty.' });
    return;
  }
  if (body.joinDate !== undefined && body.joinDate !== null && body.joinDate !== '') {
    if (!isValidDateString(body.joinDate)) {
      res.status(400).json({ success: false, message: 'joinDate must be a valid date in YYYY-MM-DD format.' });
      return;
    }
  }
  if (body.employeeType !== undefined && body.employeeType !== null && body.employeeType !== '') {
    const upperType = String(body.employeeType).trim().toUpperCase();
    if (!VALID_EMP_TYPES.has(upperType)) {
      res.status(400).json({ success: false, message: 'employeeType must be FULL_TIME, PART_TIME, or CONTRACT.' });
      return;
    }
  }
  if (body.status !== undefined && !VALID_STATUSES.has((body.status as string || '').toUpperCase())) {
    res.status(400).json({ success: false, message: 'status must be ACTIVE, PROBATION, or TERMINATED.' });
    return;
  }
  if (body.gender !== undefined && body.gender !== null && body.gender !== '') {
    const normalizedGender = String(body.gender).trim().toUpperCase();
    if (!VALID_GENDERS.has(normalizedGender)) {
      res.status(400).json({
        success: false,
        message: 'gender must be one of: MALE, FEMALE, NON_BINARY, OTHER, PREFER_NOT_TO_SAY.',
      });
      return;
    }
  }

  if (body.dateOfBirth !== undefined && body.dateOfBirth !== null && body.dateOfBirth !== '') {
    if (!isValidDateString(body.dateOfBirth)) {
      res.status(400).json({ success: false, message: 'dateOfBirth must be a valid date in YYYY-MM-DD format.' });
      return;
    }
  }

  // Accept legacy field names from older clients
  const rawBody = req.body as Record<string, unknown>;
  const input: UpdateEmployeeInput = {
    name:        isNonEmptyString(body.name) ? body.name.trim() : undefined,
    firstName:   isNonEmptyString(rawBody.firstName as string) ? (rawBody.firstName as string).trim() : undefined,
    lastName:    isNonEmptyString(rawBody.lastName as string) ? (rawBody.lastName as string).trim() : undefined,
    email:       isNonEmptyString(body.email) ? body.email.trim().toLowerCase() : undefined,
    department:  isNonEmptyString(body.department) ? body.department.trim() : undefined,
    position:    isNonEmptyString(body.position) ? body.position.trim()
                   : isNonEmptyString(rawBody.jobPosition as string) ? (rawBody.jobPosition as string).trim()
                   : undefined,
    gender:      body.gender !== undefined ? (body.gender ? String(body.gender).trim().toUpperCase() : null) : undefined,
    dateOfBirth: isNonEmptyString(body.dateOfBirth) ? body.dateOfBirth.trim() : undefined,
    status:      isNonEmptyString(body.status) ? body.status.trim().toUpperCase() : undefined,
    employeeType: body.employeeType ? String(body.employeeType).trim().toUpperCase() : undefined,
    joinDate:    isNonEmptyString(body.joinDate) ? body.joinDate.trim() : undefined,
    bankName:    isNonEmptyString(rawBody.bankName as string) ? (rawBody.bankName as string).trim() : undefined,
    bankAccount: isNonEmptyString(body.bankAccount) ? body.bankAccount.trim()
                   : isNonEmptyString(rawBody.bankAccountNo as string) ? (rawBody.bankAccountNo as string).trim()
                   : undefined,
    workingSchedule: isNonEmptyString(rawBody.workingSchedule as string) ? (rawBody.workingSchedule as string).trim()
                   : isNonEmptyString(rawBody.schedule as string) ? (rawBody.schedule as string).trim()
                   : undefined,
  };
  // Remove undefined keys so the repository only updates what was actually supplied
  (Object.keys(input) as (keyof UpdateEmployeeInput)[]).forEach((k) => {
    if (input[k] === undefined) delete input[k];
  });

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
    handleDatabaseError(err, res, 'Failed to update employee');
  }
});

// ── DELETE /api/employees/:id ─────────────────────────────────────────────────
// Strictly restricted to Administrators per Requirement 4
router.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    res.status(400).json({ success: false, message: 'Invalid employee ID.' });
    return;
  }

  const sanitizedId = id.trim().slice(0, 191);

  try {
    const deleted = await deleteEmployee(sanitizedId);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }
    res.json({ success: true, message: 'Employee successfully removed.' });
  } catch (err) {
    handleDatabaseError(err, res, 'Failed to delete employee');
  }
});

export default router;
