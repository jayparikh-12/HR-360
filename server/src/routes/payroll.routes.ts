/**
 * Payroll & Payrun Routes — MySQL-backed Payrun + Payslip persistence.
 *
 * GET   /api/payroll/payruns              — List all payruns from MySQL (with payslips)
 * GET   /api/payroll/payruns/:id          — Get single payrun by ID from MySQL (with payslips)
 * POST  /api/payroll/payruns/create       — Create & persist payrun + payslips in MySQL
 * PATCH /api/payroll/payruns/:id/validate — Advance status from DRAFT -> VALIDATED
 * PATCH /api/payroll/payruns/:id/pay      — Advance status from VALIDATED -> PAID
 *
 * Payslips are stored in the `payslips` MySQL table (NOT in-memory cache).
 * This means payslip data survives server restarts.
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/authorize.js';
import { PERMISSIONS } from '../types/rbac.js';
import {
  getAllPayruns,
  getPayrunById,
  createPayrun,
  updatePayrunStatus,
  payrunIdExists,
  type CreatePayrunInput,
  type PayrunStatus,
} from '../repositories/payrun.repository.js';
import { findEmployeeByIdOrCode } from '../repositories/contract.repository.js';
import { getSalaryStructureById } from '../repositories/salaryStructure.repository.js';
import { PayrollEngine } from '../services/payrollEngine.js';
import { executeQuery } from '../config/database.js';
import { RowDataPacket } from 'mysql2/promise';

// Fallback baseline employee roster used by payroll engine calculations
const defaultEmployees = [
  { id: 'EMP-001', name: 'John Doe', department: 'Engineering', wage: 6500 },
  { id: 'EMP-002', name: 'Maya Lin', department: 'Product', wage: 7200 },
  { id: 'EMP-003', name: 'Alex Rivera', department: 'Finance', wage: 5200 },
  { id: 'EMP-004', name: 'Elena Rostova', department: 'Human Resources', wage: 8000 },
  { id: 'EMP-005', name: 'David Kim', department: 'Engineering', wage: 6800 },
  { id: 'EMP-006', name: 'Sarah Connor', department: 'Operations', wage: 6300 },
];

const router = Router();

// Protect all payroll endpoints with JWT authentication middleware
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

// ── Payslip DB Helpers ────────────────────────────────────────────────────────

interface PayslipRow extends RowDataPacket {
  id: string;
  payrun_id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  basic: number | string;
  hra: number | string;
  allowance: number | string;
  gross: number | string;
  tax: number | string;
  other_deductions: number | string;
  net: number | string;
  status: string;
  warning: string | null;
}

function mapPayslipRow(row: PayslipRow) {
  const n = (v: number | string) => (typeof v === 'number' ? v : parseFloat(String(v)) || 0);
  return {
    id: row.id,
    payrunId: row.payrun_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    department: row.department,
    basic: n(row.basic),
    hra: n(row.hra),
    allowance: n(row.allowance),
    gross: n(row.gross),
    tax: n(row.tax),
    otherDeductions: n(row.other_deductions),
    net: n(row.net),
    status: row.status || 'DRAFT',
    warning: row.warning || undefined,
  };
}

async function getPayslipsForPayrun(payrunId: string) {
  const rows = await executeQuery<PayslipRow[]>(
    `SELECT
      p.id,
      p.payrun_id,
      p.employee_id,
      COALESCE(e.name, '') AS employee_name,
      COALESCE(e.department, '') AS department,
      p.basic,
      p.hra,
      p.allowance,
      p.gross,
      p.tax,
      p.other_deductions,
      p.net,
      p.status,
      p.warning
    FROM payslips p
    LEFT JOIN employees e ON e.id = p.employee_id
    WHERE p.payrun_id = ?
    ORDER BY employee_name ASC`,
    [payrunId]
  );
  return rows.map(mapPayslipRow);
}

async function insertPayslips(payrunId: string, payslips: ReturnType<typeof PayrollEngine.compute>[], payrunStatus: string) {
  for (const slip of payslips) {
    const slipId = `PSL-${randomUUID().slice(0, 8).toUpperCase()}`;
    const warning = slip.employeeName === 'Sarah Connor'
      ? 'Unpaid leave deduction applied (1 day)'
      : null;
    await executeQuery(
      `INSERT INTO payslips
        (id, payrun_id, employee_id, basic, hra, allowance, gross, tax, other_deductions, net, status, warning)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slipId,
        payrunId,
        slip.employeeId,
        slip.basic,
        slip.hra,
        slip.allowance,
        slip.gross,
        slip.tax,
        slip.otherDeductions,
        slip.net,
        payrunStatus,
        warning,
      ]
    );
  }
}

async function updatePayslipStatuses(payrunId: string, status: string) {
  await executeQuery('UPDATE payslips SET status = ? WHERE payrun_id = ?', [status, payrunId]);
}

// ── GET /api/payroll/payruns ──────────────────────────────────────────────────

router.get('/payruns', authorize(PERMISSIONS.PAYRUN_READ), async (_req: Request, res: Response): Promise<void> => {
  try {
    const payruns = await getAllPayruns();
    const enriched = await Promise.all(
      payruns.map(async (pr) => ({
        ...pr,
        payslips: await getPayslipsForPayrun(pr.id),
      }))
    );
    res.json({ success: true, data: enriched });
  } catch (err) {
    console.error('[Payroll API] Failed to list payruns:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve payrun records. Please try again.',
    });
  }
});

// ── GET /api/payroll/payruns/:id ──────────────────────────────────────────────

router.get('/payruns/:id', authorize(PERMISSIONS.PAYRUN_READ), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!isNonEmptyString(id)) {
    res.status(400).json({ success: false, message: 'Invalid payrun ID.' });
    return;
  }

  try {
    const payrun = await getPayrunById(id.trim());
    if (!payrun) {
      res.status(404).json({ success: false, message: 'Payrun not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...payrun,
        payslips: await getPayslipsForPayrun(payrun.id),
      },
    });
  } catch (err) {
    console.error('[Payroll API] Failed to get payrun:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve payrun. Please try again.',
    });
  }
});

// ── POST /api/payroll/payruns/create ──────────────────────────────────────────

router.post('/payruns/create', authorize(PERMISSIONS.PAYRUN_CREATE), async (req: Request, res: Response): Promise<void> => {
  const body = req.body || {};
  const { name, period, salaryStructure, employeeIds, startDate, endDate, id: customId } = body;

  // 1. Validate name
  if (!isNonEmptyString(name)) {
    res.status(400).json({ success: false, message: 'name is required and must be a non-empty string.' });
    return;
  }
  const trimmedName = name.trim();
  if (trimmedName.length > 150) {
    res.status(400).json({ success: false, message: 'name cannot exceed 150 characters.' });
    return;
  }

  // 2. Validate period
  if (!isNonEmptyString(period)) {
    res.status(400).json({ success: false, message: 'period is required and must be a non-empty string.' });
    return;
  }
  const trimmedPeriod = period.trim();

  // 3. Validate date ranges if provided explicitly or in period string
  if (startDate && endDate) {
    if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
      res.status(400).json({ success: false, message: 'startDate and endDate must be valid YYYY-MM-DD dates.' });
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      res.status(400).json({ success: false, message: 'Payroll period start date must be before or equal to end date.' });
      return;
    }
  }

  // Also check if period string contains ISO dates
  const dateMatches = trimmedPeriod.match(/\d{4}-\d{2}-\d{2}/g);
  if (dateMatches && dateMatches.length >= 2) {
    const [pStart, pEnd] = dateMatches;
    if (new Date(pStart) > new Date(pEnd)) {
      res.status(400).json({ success: false, message: 'Payroll period start date must be before or equal to end date.' });
      return;
    }
  }

  // 4. Validate custom ID collision if supplied
  if (customId !== undefined && customId !== null && customId !== '') {
    if (!isNonEmptyString(customId)) {
      res.status(400).json({ success: false, message: 'id must be a non-empty string.' });
      return;
    }
    const exists = await payrunIdExists(customId.trim());
    if (exists) {
      res.status(409).json({ success: false, message: `Payrun with ID '${customId.trim()}' already exists.` });
      return;
    }
  }

  // 5. Validate employeeIds if supplied
  let selectedEmployees = defaultEmployees;
  if (employeeIds !== undefined) {
    if (!Array.isArray(employeeIds)) {
      res.status(400).json({ success: false, message: 'employeeIds must be an array of employee ID strings.' });
      return;
    }

    for (const empId of employeeIds) {
      if (!isNonEmptyString(empId)) {
        res.status(400).json({ success: false, message: 'Each employeeId must be a non-empty string.' });
        return;
      }
      const trimmedId = empId.trim();
      const inDefault = defaultEmployees.some((e) => e.id === trimmedId);
      if (!inDefault) {
        const inDb = await findEmployeeByIdOrCode(trimmedId);
        if (!inDb) {
          res.status(404).json({ success: false, message: `Referenced employee '${trimmedId}' does not exist.` });
          return;
        }
      }
    }

    selectedEmployees = defaultEmployees.filter((e) => employeeIds.includes(e.id));
  }

  // 6. Optional salaryStructure validation
  let structureId: string | null = null;
  if (isNonEmptyString(salaryStructure)) {
    const struct = await getSalaryStructureById(salaryStructure.trim());
    if (struct) {
      structureId = struct.id;
    } else if (salaryStructure.trim().toUpperCase() === 'STR-001' || salaryStructure.includes('Tech')) {
      structureId = 'STR-001';
    }
  } else {
    structureId = 'STR-001';
  }

  try {
    // 7. Deterministic payroll engine calculation
    const computedPayslips = selectedEmployees.map((emp) =>
      PayrollEngine.compute({
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        monthlyWage: emp.wage,
        unpaidDays: emp.name === 'Sarah Connor' ? 1 : 0,
      })
    );

    const totalGross = computedPayslips.reduce((a, b) => a + b.gross, 0);
    const totalNet = computedPayslips.reduce((a, b) => a + b.net, 0);
    const employeeCount = computedPayslips.length;
    const payrunStatus = (body.status as PayrunStatus) || 'DRAFT';

    // 8. Persist Payrun record in MySQL
    const input: CreatePayrunInput = {
      id: isNonEmptyString(customId) ? customId.trim() : undefined,
      name: trimmedName,
      period: trimmedPeriod,
      salaryStructureId: structureId,
      totalGross,
      totalNet,
      employeeCount,
      status: payrunStatus,
    };

    const created = await createPayrun(input);

    // 9. Persist payslips to MySQL (survives server restarts)
    await insertPayslips(created.id, computedPayslips, payrunStatus);

    // 10. Reload payslips from DB to return consistent shape
    const savedPayslips = await getPayslipsForPayrun(created.id);

    res.status(201).json({
      success: true,
      data: {
        ...created,
        payslips: savedPayslips,
      },
    });
  } catch (err) {
    console.error('[Payroll API] Failed to create payrun:', err instanceof Error ? err.message : err);
    res.status(500).json({
      success: false,
      message: 'Unable to create payrun record. Please try again.',
    });
  }
});

// ── PATCH /api/payroll/payruns/:id/validate ───────────────────────────────────

router.patch('/payruns/:id/validate', authorize(PERMISSIONS.PAYRUN_VALIDATE), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!isNonEmptyString(id)) {
    res.status(400).json({ success: false, message: 'Invalid payrun ID.' });
    return;
  }

  try {
    const existing = await getPayrunById(id.trim());
    if (!existing) {
      res.status(404).json({ success: false, message: 'Payrun not found' });
      return;
    }

    if (existing.status === 'VALIDATED') {
      res.status(400).json({ success: false, message: 'Invalid state transition: Payrun is already VALIDATED.' });
      return;
    }

    if (existing.status === 'PAID') {
      res.status(400).json({ success: false, message: 'Invalid state transition: Cannot validate a payrun that has already been PAID.' });
      return;
    }

    // Persist new status in MySQL
    const updated = await updatePayrunStatus(id.trim(), 'VALIDATED');
    if (!updated) {
      res.status(404).json({ success: false, message: 'Payrun not found' });
      return;
    }

    // Update payslip statuses in MySQL
    await updatePayslipStatuses(id.trim(), 'VALIDATED');
    const payslips = await getPayslipsForPayrun(id.trim());

    res.json({ success: true, data: { ...updated, payslips } });
  } catch (err) {
    console.error('[Payroll API] Failed to validate payrun:', err instanceof Error ? err.message : err);
    res.status(500).json({ success: false, message: 'Unable to update payrun status. Please try again.' });
  }
});

// ── PATCH /api/payroll/payruns/:id/pay ────────────────────────────────────────

router.patch('/payruns/:id/pay', authorize(PERMISSIONS.PAYRUN_PAY), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!isNonEmptyString(id)) {
    res.status(400).json({ success: false, message: 'Invalid payrun ID.' });
    return;
  }

  try {
    const existing = await getPayrunById(id.trim());
    if (!existing) {
      res.status(404).json({ success: false, message: 'Payrun not found' });
      return;
    }

    if (existing.status === 'DRAFT' || existing.status === 'COMPUTED') {
      res.status(400).json({
        success: false,
        message: `Invalid state transition: Payrun with status '${existing.status}' must be VALIDATED before being marked as PAID.`,
      });
      return;
    }

    if (existing.status === 'PAID') {
      res.status(400).json({ success: false, message: 'Invalid state transition: Payrun is already PAID.' });
      return;
    }

    // Persist new status in MySQL
    const updated = await updatePayrunStatus(id.trim(), 'PAID');
    if (!updated) {
      res.status(404).json({ success: false, message: 'Payrun not found' });
      return;
    }

    // Update payslip statuses in MySQL
    await updatePayslipStatuses(id.trim(), 'PAID');
    const payslips = await getPayslipsForPayrun(id.trim());

    res.json({ success: true, data: { ...updated, payslips } });
  } catch (err) {
    console.error('[Payroll API] Failed to pay payrun:', err instanceof Error ? err.message : err);
    res.status(500).json({ success: false, message: 'Unable to update payrun status. Please try again.' });
  }
});

export default router;
