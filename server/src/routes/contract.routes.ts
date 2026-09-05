/**
 * Contract Routes
 *
 * GET   /api/contracts     — List all contracts (MySQL-backed)
 * GET   /api/contracts/:id — Get single contract by ID (MySQL-backed)
 * POST  /api/contracts     — Create contract (MySQL-backed)
 *
 * Design principles:
 * - Route handlers validate input, enforce business rules, call repository.
 * - All database logic lives in contract.repository.ts.
 * - authenticateToken middleware is applied to all contract endpoints.
 * - 500 responses never expose SQL, stack traces, or internal error details.
 * - Foreign-key and active contract conflicts are cleanly returned as 404 and 409.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
  getAllContracts,
  getContractById,
  getActiveContractByEmployeeId,
  findEmployeeByIdOrCode,
  contractIdExists,
  createContract,
  type CreateContractInput,
} from '../repositories/contract.repository.js';
import {
  getAllSchedules,
  getScheduleById,
} from '../repositories/schedule.repository.js';

const router = Router();

// Protect all contract endpoints with JWT authentication middleware
router.use(authenticateToken);

// ── Validation Helpers ────────────────────────────────────────────────────────

const VALID_STATUSES = new Set(['ACTIVE', 'FUTURE', 'HISTORICAL']);
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

// ── GET /api/contracts ────────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const contracts = await getAllContracts();
    res.json({ success: true, data: contracts });
  } catch (err) {
    console.error('[Contract API] Failed to list contracts:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve contract records. Please try again.',
    });
  }
});

// ── GET /api/contracts/:id ────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!isNonEmptyString(id)) {
    res.status(400).json({ success: false, message: 'Invalid contract ID.' });
    return;
  }

  const sanitizedId = id.trim().slice(0, 50);

  try {
    const contract = await getContractById(sanitizedId);

    if (!contract) {
      res.status(404).json({ success: false, message: 'Contract not found.' });
      return;
    }

    res.json({ success: true, data: contract });
  } catch (err) {
    console.error('[Contract API] Failed to get contract:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve contract record. Please try again.',
    });
  }
});

// ── POST /api/contracts ───────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const body = req.body;

  if (!body || typeof body !== 'object') {
    res.status(400).json({ success: false, message: 'Request body must be a JSON object.' });
    return;
  }

  // Support both camelCase and snake_case inputs
  const employeeIdInput = body.employeeId || body.employee_id;
  const wageInput = body.wage;
  const startDateInput = body.startDate || body.start_date;
  const endDateInput = body.endDate !== undefined ? body.endDate : body.end_date;
  const statusInput = body.status;
  const salaryStructureInput = body.salaryStructureId || body.salary_structure_id || body.salaryStructure || body.structure;
  const workingScheduleInput = body.workingScheduleId || body.working_schedule_id || body.workingSchedule || body.schedule;
  const customIdInput = body.id;

  // 1. Required field: employeeId
  if (!isNonEmptyString(employeeIdInput)) {
    res.status(400).json({ success: false, message: 'employeeId is required.' });
    return;
  }

  // 2. Required field: wage
  if (wageInput === undefined || wageInput === null || wageInput === '') {
    res.status(400).json({ success: false, message: 'wage is required.' });
    return;
  }
  const numericWage = Number(wageInput);
  if (isNaN(numericWage) || !isFinite(numericWage) || numericWage < 0) {
    res.status(400).json({ success: false, message: 'wage must be a non-negative number.' });
    return;
  }

  // 3. Required field: startDate
  if (!isNonEmptyString(startDateInput)) {
    res.status(400).json({ success: false, message: 'startDate is required.' });
    return;
  }
  if (!isValidDateString(startDateInput)) {
    res.status(400).json({ success: false, message: 'startDate must be a valid date in YYYY-MM-DD format.' });
    return;
  }
  const startDateFormatted = startDateInput.trim();

  // 4. Optional field: endDate
  let endDateFormatted: string | null = null;
  if (endDateInput !== undefined && endDateInput !== null && endDateInput !== '') {
    if (!isValidDateString(endDateInput)) {
      res.status(400).json({ success: false, message: 'endDate must be a valid date in YYYY-MM-DD format.' });
      return;
    }
    endDateFormatted = (endDateInput as string).trim();
    if (new Date(endDateFormatted) < new Date(startDateFormatted)) {
      res.status(400).json({ success: false, message: 'endDate cannot be before startDate.' });
      return;
    }
  }

  // 5. Optional field: status
  let contractStatus: 'ACTIVE' | 'FUTURE' | 'HISTORICAL' = 'ACTIVE';
  if (statusInput !== undefined && statusInput !== null && statusInput !== '') {
    const upperStatus = String(statusInput).trim().toUpperCase();
    if (!VALID_STATUSES.has(upperStatus)) {
      res.status(400).json({
        success: false,
        message: 'status must be ACTIVE, FUTURE, or HISTORICAL.',
      });
      return;
    }
    contractStatus = upperStatus as 'ACTIVE' | 'FUTURE' | 'HISTORICAL';
  }

  // 6. Optional field: custom contract ID
  let customId: string | undefined = undefined;
  if (customIdInput !== undefined && customIdInput !== null && customIdInput !== '') {
    if (!isNonEmptyString(customIdInput)) {
      res.status(400).json({ success: false, message: 'Custom contract ID must be a non-empty string.' });
      return;
    }
    customId = customIdInput.trim().slice(0, 50);
  }

  // 7. Validate working schedule reference if provided
  let workingScheduleId: string | null = null;
  if (isNonEmptyString(workingScheduleInput)) {
    const schedule = await getScheduleById(workingScheduleInput.trim());
    if (!schedule) {
      res.status(400).json({ success: false, message: 'Referenced working schedule does not exist.' });
      return;
    }
    workingScheduleId = schedule.id;
  }

  try {
    // 8. Verify referenced employee exists in MySQL
    const employee = await findEmployeeByIdOrCode(employeeIdInput.trim());
    if (!employee) {
      res.status(404).json({
        success: false,
        message: `Employee '${employeeIdInput}' does not exist.`,
      });
      return;
    }

    // 9. If custom ID provided, ensure it does not already exist
    if (customId) {
      const exists = await contractIdExists(customId);
      if (exists) {
        res.status(409).json({
          success: false,
          message: `Contract ID '${customId}' already exists.`,
        });
        return;
      }
    }

    // 10. Prevent overlapping active contracts: An employee can have at most one ACTIVE contract
    if (contractStatus === 'ACTIVE') {
      const existingActive = await getActiveContractByEmployeeId(employee.id);
      if (existingActive) {
        res.status(409).json({
          success: false,
          message: `Employee already has an active contract (${existingActive.id}). Cannot create multiple active contracts for the same employee.`,
        });
        return;
      }
    }

    // 11. Persist contract in MySQL
    const input: CreateContractInput = {
      id: customId,
      employeeId: employee.id, // canonical DB UUID
      salaryStructureId: isNonEmptyString(salaryStructureInput) ? salaryStructureInput.trim() : 'STR-001',
      workingScheduleId,
      wage: numericWage,
      startDate: startDateFormatted,
      endDate: endDateFormatted,
      status: contractStatus,
    };

    const createdContract = await createContract(input);
    res.status(201).json({ success: true, data: createdContract });
  } catch (err) {
    console.error('[Contract API] Failed to create contract:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to create contract record. Please try again.',
    });
  }
});

export default router;
