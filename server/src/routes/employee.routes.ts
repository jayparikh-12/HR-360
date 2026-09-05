/**
 * Employee Routes — GET /api/employees and GET /api/employees/:id
 *
 * Design principles:
 * - Route handlers are thin: validate input, call repository, return response.
 * - All database logic lives in employee.repository.ts.
 * - authenticateToken middleware is applied to all employee endpoints.
 * - 500 responses never expose SQL, stack traces, or internal error details.
 * - POST route (employee creation) is preserved as a stub for future phases.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { getAllEmployees, getEmployeeById } from '../repositories/employee.repository.js';

const router = Router();

// All employee endpoints require a valid JWT
router.use(authenticateToken);

// ─── GET /api/employees ───────────────────────────────────────────────────────

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

// ─── GET /api/employees/:id ───────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // Basic validation: ID must be a non-empty string that looks like EMP-xxx
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    res.status(400).json({ success: false, message: 'Invalid employee ID.' });
    return;
  }

  // Sanitize length to prevent oversized queries
  const sanitizedId = id.trim().slice(0, 50);

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

// ─── POST /api/employees (stub — not in Phase 2.2 scope) ─────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  // Not implemented in Phase 2.2 (MySQL persistence vertical slice for GET only)
  res.status(501).json({
    success: false,
    message: 'Employee creation via API is not yet implemented.',
  });
});

export default router;
