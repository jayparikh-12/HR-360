/**
 * Salary Rule Routes
 *
 * GET  /api/salary-rules     — List all salary rules (MySQL)
 * GET  /api/salary-rules/:id — Get single salary rule by ID (MySQL)
 * POST /api/salary-rules     — Create a new salary rule (MySQL)
 *
 * Design principles:
 * - authenticateToken middleware applied to all endpoints.
 * - All SQL queries encapsulated in salaryRule.repository.ts.
 * - HTTP status codes: 200, 201, 400, 401, 404, 409, 500.
 * - Never leaks internal SQL details or credentials.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorize, requireAdmin } from '../middleware/authorize.js';
import { PERMISSIONS } from '../types/rbac.js';
import {
  getAllSalaryRules,
  getSalaryRuleById,
  salaryRuleIdExists,
  salaryRuleCodeExists,
  createSalaryRule,
  type CreateSalaryRuleInput,
} from '../repositories/salaryRule.repository.js';
import { getSalaryStructureById } from '../repositories/salaryStructure.repository.js';

const router = Router();

// Protect all salary-rule endpoints with JWT authentication middleware
router.use(authenticateToken);

// ── Validation Constants & Helpers ───────────────────────────────────────────

const VALID_CATEGORIES = ['BASIC', 'ALLOWANCE', 'GROSS', 'DEDUCTION', 'NET'] as const;
const VALID_CALCULATION_TYPES = ['FIXED', 'PERCENTAGE', 'FORMULA'] as const;

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

// ── GET /api/salary-rules ────────────────────────────────────────────────────

router.get('/', authorize(PERMISSIONS.STRUCTURE_READ), async (req: Request, res: Response): Promise<void> => {
  const structureIdQuery = (req.query.structureId || req.query.structure_id) as string | undefined;

  try {
    const rules = await getAllSalaryRules(structureIdQuery);
    res.json({ success: true, data: rules });
  } catch (err) {
    console.error('[SalaryRule API] Failed to list salary rules:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve salary rules. Please try again.',
    });
  }
});

// ── GET /api/salary-rules/:id ────────────────────────────────────────────────

router.get('/:id', authorize(PERMISSIONS.STRUCTURE_READ), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!isNonEmptyString(id)) {
    res.status(400).json({ success: false, message: 'Invalid salary rule ID.' });
    return;
  }

  const sanitizedId = id.trim().slice(0, 50);

  try {
    const rule = await getSalaryRuleById(sanitizedId);

    if (!rule) {
      res.status(404).json({ success: false, message: 'Salary rule not found.' });
      return;
    }

    res.json({ success: true, data: rule });
  } catch (err) {
    console.error('[SalaryRule API] Failed to get salary rule:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve salary rule. Please try again.',
    });
  }
});

// ── POST /api/salary-rules ───────────────────────────────────────────────────

router.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const body = req.body || {};

  const nameInput = body.name;
  const codeInput = body.code;
  const structureIdInput = body.structureId || body.structure_id;
  const sequenceInput = body.sequence;
  const categoryInput = body.category;
  const calculationTypeInput = body.calculationType || body.calculation_type;
  const amountInput = body.amount;
  const percentageInput = body.percentage;
  const formulaInput = body.formula;
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

  // 3. Validate structureId (foreign key reference)
  if (!isNonEmptyString(structureIdInput)) {
    res.status(400).json({ success: false, message: 'structureId is required and must be a non-empty string.' });
    return;
  }
  const structureId = structureIdInput.trim().slice(0, 50);

  // 4. Validate sequence (must be integer >= 1)
  if (sequenceInput === undefined || sequenceInput === null || sequenceInput === '') {
    res.status(400).json({ success: false, message: 'sequence is required and must be an integer >= 1.' });
    return;
  }
  const sequenceNum = Number(sequenceInput);
  if (!Number.isInteger(sequenceNum) || sequenceNum < 1) {
    res.status(400).json({ success: false, message: 'sequence must be an integer >= 1.' });
    return;
  }

  // 5. Validate category
  if (!isNonEmptyString(categoryInput)) {
    res.status(400).json({
      success: false,
      message: `category is required. Allowed values: ${VALID_CATEGORIES.join(', ')}.`,
    });
    return;
  }
  const categoryUpper = categoryInput.trim().toUpperCase() as (typeof VALID_CATEGORIES)[number];
  if (!VALID_CATEGORIES.includes(categoryUpper)) {
    res.status(400).json({
      success: false,
      message: `Invalid category '${categoryInput}'. Allowed values: ${VALID_CATEGORIES.join(', ')}.`,
    });
    return;
  }

  // 6. Validate calculationType
  if (!isNonEmptyString(calculationTypeInput)) {
    res.status(400).json({
      success: false,
      message: `calculationType is required. Allowed values: ${VALID_CALCULATION_TYPES.join(', ')}.`,
    });
    return;
  }
  const calcTypeUpper = calculationTypeInput.trim().toUpperCase() as (typeof VALID_CALCULATION_TYPES)[number];
  if (!VALID_CALCULATION_TYPES.includes(calcTypeUpper)) {
    res.status(400).json({
      success: false,
      message: `Invalid calculationType '${calculationTypeInput}'. Allowed values: ${VALID_CALCULATION_TYPES.join(', ')}.`,
    });
    return;
  }

  // 7. Validate amount (if provided, must be numeric >= 0)
  let parsedAmount: number | null = null;
  if (amountInput !== undefined && amountInput !== null && amountInput !== '') {
    const num = Number(amountInput);
    if (isNaN(num) || !isFinite(num) || num < 0) {
      res.status(400).json({ success: false, message: 'amount must be a non-negative number.' });
      return;
    }
    parsedAmount = num;
  }

  // 8. Validate percentage (if provided, must be numeric 0..100)
  let parsedPercentage: number | null = null;
  if (percentageInput !== undefined && percentageInput !== null && percentageInput !== '') {
    const num = Number(percentageInput);
    if (isNaN(num) || !isFinite(num) || num < 0 || num > 100) {
      res.status(400).json({ success: false, message: 'percentage must be a number between 0 and 100.' });
      return;
    }
    parsedPercentage = num;
  }

  // 9. Validate optional custom ID
  let customId: string | undefined = undefined;
  if (customIdInput !== undefined && customIdInput !== null && customIdInput !== '') {
    if (!isNonEmptyString(customIdInput)) {
      res.status(400).json({ success: false, message: 'id must be a non-empty string.' });
      return;
    }
    customId = customIdInput.trim().slice(0, 50);
  }

  try {
    // 10. Verify referenced salary structure exists (returns 404 if not found)
    const structure = await getSalaryStructureById(structureId);
    if (!structure) {
      res.status(404).json({
        success: false,
        message: `Referenced salary structure '${structureId}' does not exist.`,
      });
      return;
    }

    // 11. Check duplicate ID conflict if custom ID provided (409)
    if (customId) {
      const idConflict = await salaryRuleIdExists(customId);
      if (idConflict) {
        res.status(409).json({
          success: false,
          message: `Salary rule with ID '${customId}' already exists.`,
        });
        return;
      }
    }

    // 12. Check duplicate rule code conflict within the same structure (409)
    const codeConflict = await salaryRuleCodeExists(code, structureId);
    if (codeConflict) {
      res.status(409).json({
        success: false,
        message: `Salary rule with code '${code}' already exists in structure '${structureId}'.`,
      });
      return;
    }

    // 13. Persist in MySQL
    const input: CreateSalaryRuleInput = {
      id: customId,
      structureId,
      name,
      code,
      sequence: sequenceNum,
      category: categoryUpper,
      calculationType: calcTypeUpper,
      amount: parsedAmount,
      percentage: parsedPercentage,
      formula: isNonEmptyString(formulaInput) ? formulaInput.trim() : null,
    };

    const created = await createSalaryRule(input);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('[SalaryRule API] Failed to create salary rule:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to create salary rule. Please try again.',
    });
  }
});

export default router;
