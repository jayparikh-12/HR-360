/**
 * Salary Structure Routes
 *
 * GET  /api/salary-structures     — List all salary structures (MySQL)
 * GET  /api/salary-structures/:id — Get single salary structure by ID (MySQL)
 * POST /api/salary-structures     — Create a new salary structure (MySQL)
 *
 * Design principles:
 * - authenticateToken middleware applied to all endpoints.
 * - All SQL queries encapsulated in salaryStructure.repository.ts.
 * - HTTP status codes: 200, 201, 400, 401, 404, 409, 500.
 * - Never leaks internal SQL details or credentials.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorize, requireAdmin } from '../middleware/authorize.js';
import { PERMISSIONS } from '../types/rbac.js';
import {
  getAllSalaryStructures,
  getSalaryStructureById,
  salaryStructureCodeExists,
  salaryStructureIdExists,
  createSalaryStructure,
  type CreateSalaryStructureInput,
} from '../repositories/salaryStructure.repository.js';
import { findEmployeeByIdOrCode, getContractById } from '../repositories/contract.repository.js';
import { handleDatabaseError } from '../middleware/errorHandler.js';

const router = Router();

// Protect all salary-structure endpoints with JWT authentication middleware
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

// ── GET /api/salary-structures ────────────────────────────────────────────────

router.get('/', authorize(PERMISSIONS.STRUCTURE_READ), async (_req: Request, res: Response): Promise<void> => {
  try {
    const structures = await getAllSalaryStructures();
    res.json({ success: true, data: structures });
  } catch (err) {
    console.error('[SalaryStructure API] Failed to list structures:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve salary structures. Please try again.',
    });
  }
});

// ── GET /api/salary-structures/:id ────────────────────────────────────────────

router.get('/:id', authorize(PERMISSIONS.STRUCTURE_READ), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!isNonEmptyString(id)) {
    res.status(400).json({ success: false, message: 'Invalid salary structure ID.' });
    return;
  }

  const sanitizedId = id.trim().slice(0, 50);

  try {
    const structure = await getSalaryStructureById(sanitizedId);

    if (!structure) {
      res.status(404).json({ success: false, message: 'Salary structure not found.' });
      return;
    }

    res.json({ success: true, data: structure });
  } catch (err) {
    console.error('[SalaryStructure API] Failed to get structure:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve salary structure. Please try again.',
    });
  }
});

// ── POST /api/salary-structures ───────────────────────────────────────────────

router.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const body = req.body || {};

  const nameInput = body.name;
  const codeInput = body.code;
  const customIdInput = body.id;

  // 1. Validate name
  if (!isNonEmptyString(nameInput)) {
    res.status(400).json({ success: false, message: 'name is required and must be a non-empty string.' });
    return;
  }
  const name = nameInput.trim();
  if (name.length > 100) {
    res.status(400).json({ success: false, message: 'name cannot exceed 100 characters.' });
    return;
  }

  // 2. Validate code
  if (!isNonEmptyString(codeInput)) {
    res.status(400).json({ success: false, message: 'code is required and must be a non-empty string.' });
    return;
  }
  const code = codeInput.trim().toUpperCase();
  if (code.length > 50) {
    res.status(400).json({ success: false, message: 'code cannot exceed 50 characters.' });
    return;
  }

  // 3. Optional ID validation
  let customId: string | undefined = undefined;
  if (customIdInput !== undefined && customIdInput !== null && customIdInput !== '') {
    if (!isNonEmptyString(customIdInput)) {
      res.status(400).json({ success: false, message: 'id must be a non-empty string.' });
      return;
    }
    customId = customIdInput.trim().slice(0, 50);
  }

  // 4. Optional monetary/salary validations if provided in payload
  const monetaryFields = ['baseWage', 'baseSalary', 'amount', 'wage', 'salary'];
  for (const field of monetaryFields) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
      const num = Number(body[field]);
      if (isNaN(num) || !isFinite(num) || num < 0 || num > 999999999.99) {
        res.status(400).json({ success: false, message: `${field} must be a non-negative number and cannot exceed 999,999,999.99.` });
        return;
      }
    }
  }

  // 5. Optional date validation if provided in payload
  const dateFields = ['effectiveDate', 'startDate', 'endDate'];
  for (const field of dateFields) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
      if (!isValidDateString(body[field])) {
        res.status(400).json({ success: false, message: `${field} must be a valid date in YYYY-MM-DD format.` });
        return;
      }
    }
  }

  try {
    // 6. Verify optional referenced employee if supplied
    if (isNonEmptyString(body.employeeId)) {
      const emp = await findEmployeeByIdOrCode(body.employeeId.trim());
      if (!emp) {
        res.status(404).json({ success: false, message: `Referenced employee '${body.employeeId}' does not exist.` });
        return;
      }
    }

    // 7. Verify optional referenced contract if supplied
    if (isNonEmptyString(body.contractId)) {
      const contract = await getContractById(body.contractId.trim());
      if (!contract) {
        res.status(404).json({ success: false, message: `Referenced contract '${body.contractId}' does not exist.` });
        return;
      }
    }

    // 8. Check code uniqueness (returns 409 Conflict)
    const codeConflict = await salaryStructureCodeExists(code);
    if (codeConflict) {
      res.status(409).json({
        success: false,
        message: `Salary structure with code '${code}' already exists.`,
      });
      return;
    }

    // 9. Check custom ID uniqueness if provided
    if (customId) {
      const idConflict = await salaryStructureIdExists(customId);
      if (idConflict) {
        res.status(409).json({
          success: false,
          message: `Salary structure with ID '${customId}' already exists.`,
        });
        return;
      }
    }

    // 10. Persist in MySQL
    const input: CreateSalaryStructureInput = {
      id: customId,
      name,
      code,
    };

    const created = await createSalaryStructure(input);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    handleDatabaseError(err, res, 'Failed to create salary structure');
  }
});

export default router;
