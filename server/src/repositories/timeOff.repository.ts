/**
 * Time Off Repository — Data-access layer for the time_off_requests table.
 *
 * Responsibilities:
 * - All SQL for Time Off / Leave Management operations lives here, not in route handlers.
 * - Uses parameterized queries exclusively via the centralized database pool (executeQuery).
 * - Collation compatibility between employees (utf8mb4_unicode_ci) and time_off_requests.
 * - Safe mapping from raw database rows to TimeOffRecord domain objects.
 * - Provides robust date validation and safe inclusive calendar duration calculation.
 * - Enforces strict state machine workflow: PENDING -> APPROVED or PENDING -> REFUSED.
 * - Rejects invalid transitions (APPROVED->APPROVED, REFUSED->APPROVED, etc.) with typed workflow errors.
 * - Never leaks raw SQL statements, stack traces, or credentials to callers.
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { executeQuery } from '../config/database.js';
import { randomUUID } from 'node:crypto';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Raw row shape returned by MySQL query with LEFT JOIN on employees.
 */
export interface TimeOffRow extends RowDataPacket {
  id: string;
  employee_id: string | null;
  leave_type: string;
  start_date: Date | string;
  end_date: Date | string;
  duration_days: number | string;
  reason: string | null;
  status: string | null;
  // Joined from employees
  name?: string | null;
  department?: string | null;
}

/**
 * Safe Time Off record returned to route handlers and API clients.
 * Matches frontend TimeOffRequest model in client/src/types.ts with full metadata.
 */
export interface TimeOffRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  empCode?: string;
  department?: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  numberOfDays?: number; // Alias for backward compatibility
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REFUSED';
  approvedBy?: string | null;
  refusedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTimeOffInput {
  id?: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  durationDays?: number;
  reason?: string | null;
  status?: string;
}

export interface TimeOffFilterOptions {
  employeeId?: string;
  status?: string;
}

export interface EmployeeLookupResult {
  id: string;
  name: string;
  department?: string;
}

// ── Custom Error Classes ─────────────────────────────────────────────────────

export class TimeOffWorkflowError extends Error {
  public readonly code: 'NOT_FOUND' | 'INVALID_TRANSITION';
  public readonly currentStatus?: string;

  constructor(code: 'NOT_FOUND' | 'INVALID_TRANSITION', message: string, currentStatus?: string) {
    super(message);
    this.name = 'TimeOffWorkflowError';
    this.code = code;
    this.currentStatus = currentStatus;
  }
}

export class TimeOffValidationError extends Error {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'TimeOffValidationError';
    this.field = field;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats a Date object or date string into a standard YYYY-MM-DD string.
 */
export function formatDate(val: Date | string | null | undefined): string {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (str.includes('T')) {
    return str.split('T')[0];
  }
  return str;
}

/**
 * Parses a YYYY-MM-DD string into a valid Date object, or null if invalid.
 */
export function parseYMD(val: string): Date | null {
  if (!val || typeof val !== 'string') return null;
  const parts = val.trim().split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(dt.getTime())) return null;
  return dt;
}

/**
 * Calculates calendar duration in whole days (inclusive of start and end date).
 */
export function calculateLeaveDays(startDateStr: string, endDateStr: string): number {
  const start = parseYMD(startDateStr);
  const end = parseYMD(endDateStr);
  if (!start || !end) return 0;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 0; // endDate is before startDate
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Normalizes status strings to strict PENDING, APPROVED, or REFUSED values.
 */
export function normalizeTimeOffStatus(rawStatus?: string | null): 'PENDING' | 'APPROVED' | 'REFUSED' {
  if (!rawStatus) return 'PENDING';
  const upper = rawStatus.trim().toUpperCase();
  if (upper === 'APPROVED') return 'APPROVED';
  if (upper === 'REFUSED') return 'REFUSED';
  return 'PENDING';
}

/**
 * Maps a raw MySQL database row to a clean, strongly typed TimeOffRecord.
 */
export function mapRowToRecord(row: TimeOffRow): TimeOffRecord {
  const employeeName = row.name ? String(row.name).trim() : (row.employee_id || 'Unknown Employee');

  const durationNum = typeof row.duration_days === 'number'
    ? row.duration_days
    : parseInt(String(row.duration_days || 1), 10);
  const safeDuration = isNaN(durationNum) || durationNum <= 0 ? 1 : durationNum;

  return {
    id: row.id,
    employeeId: row.employee_id || '',
    employeeName,
    department: row.department || undefined,
    leaveType: row.leave_type || 'Paid Annual Leave',
    startDate: formatDate(row.start_date),
    endDate: formatDate(row.end_date),
    durationDays: safeDuration,
    numberOfDays: safeDuration,
    reason: row.reason || '',
    status: normalizeTimeOffStatus(row.status),
  };
}

// ── SQL ──────────────────────────────────────────────────────────────────────

const TIME_OFF_SELECT = `
  SELECT
    tor.id,
    tor.employee_id,
    tor.leave_type,
    tor.start_date,
    tor.end_date,
    tor.duration_days,
    tor.reason,
    tor.status,
    COALESCE(e.name, '') AS name,
    e.department
  FROM time_off_requests tor
  LEFT JOIN employees e
    ON e.id = tor.employee_id COLLATE utf8mb4_unicode_ci
`;

// ── Repository Functions ─────────────────────────────────────────────────────

/**
 * Returns all time off requests ordered by start date descending, ID descending.
 * Gracefully returns an empty array [] if the table is empty.
 */
export async function getAllTimeOffRequests(): Promise<TimeOffRecord[]> {
  const sql = `${TIME_OFF_SELECT} ORDER BY tor.start_date DESC, tor.id DESC`;
  const rows = await executeQuery<TimeOffRow[]>(sql, []);
  return rows.map(mapRowToRecord);
}

/**
 * Returns a single time off request by unique ID match, or null if not found.
 */
export async function getTimeOffRequestById(id: string): Promise<TimeOffRecord | null> {
  const sql = `${TIME_OFF_SELECT} WHERE tor.id = ? LIMIT 1`;
  const rows = await executeQuery<TimeOffRow[]>(sql, [id]);
  if (!rows || rows.length === 0) return null;
  return mapRowToRecord(rows[0]);
}

/**
 * Returns all time off requests for a specific employee ID.
 */
export async function getTimeOffRequestsByEmployeeId(employeeId: string): Promise<TimeOffRecord[]> {
  const sql = `${TIME_OFF_SELECT} WHERE tor.employee_id = ? ORDER BY tor.start_date DESC, tor.id DESC`;
  const rows = await executeQuery<TimeOffRow[]>(sql, [employeeId]);
  return rows.map(mapRowToRecord);
}

/**
 * Returns all time off requests matching a specific status ('PENDING', 'APPROVED', 'REFUSED').
 */
export async function getTimeOffRequestsByStatus(status: string): Promise<TimeOffRecord[]> {
  const normalized = normalizeTimeOffStatus(status);
  const sql = `${TIME_OFF_SELECT} WHERE tor.status = ? ORDER BY tor.start_date DESC, tor.id DESC`;
  const rows = await executeQuery<TimeOffRow[]>(sql, [normalized]);
  return rows.map(mapRowToRecord);
}

/**
 * Queries time off requests with optional employeeId and/or status filters.
 */
export async function getTimeOffRequests(options: TimeOffFilterOptions = {}): Promise<TimeOffRecord[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.employeeId && typeof options.employeeId === 'string' && options.employeeId.trim().length > 0) {
    const empId = options.employeeId.trim();
    conditions.push('tor.employee_id = ?');
    params.push(empId);
  }

  if (options.status && typeof options.status === 'string' && options.status.trim().length > 0) {
    conditions.push('tor.status = ?');
    params.push(normalizeTimeOffStatus(options.status));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `${TIME_OFF_SELECT} ${whereClause} ORDER BY tor.start_date DESC, tor.id DESC`;

  const rows = await executeQuery<TimeOffRow[]>(sql, params);
  return rows.map(mapRowToRecord);
}

/**
 * Retrieves approved time-off records for a specific employee that overlap with a date range.
 * Parameterized query; ordered deterministically by start_date ASC, id ASC.
 */
export async function getTimeOffByEmployeeAndPeriod(
  employeeId: string,
  startDate?: string,
  endDate?: string,
  status: string = 'APPROVED'
): Promise<TimeOffRecord[]> {
  if (!employeeId || typeof employeeId !== 'string') return [];
  const conditions: string[] = ['tor.employee_id = ?'];
  const params: unknown[] = [employeeId.trim()];

  if (status) {
    conditions.push('tor.status = ?');
    params.push(normalizeTimeOffStatus(status));
  }

  // Range overlap: request starts before period ends AND ends after period starts
  if (startDate) {
    conditions.push('tor.end_date >= ?');
    params.push(startDate.trim());
  }

  if (endDate) {
    conditions.push('tor.start_date <= ?');
    params.push(endDate.trim());
  }

  const sql = `
    ${TIME_OFF_SELECT}
    WHERE ${conditions.join(' AND ')}
    ORDER BY tor.start_date ASC, tor.id ASC
  `;

  const rows = await executeQuery<TimeOffRow[]>(sql, params);
  return rows.map(mapRowToRecord);
}

/**
 * Checks whether an employee exists in MySQL by ID.
 */
export async function findEmployeeByIdOrCode(identifier: string): Promise<EmployeeLookupResult | null> {
  const trimmed = identifier.trim();

  const sql = `
    SELECT id, name, department
    FROM employees
    WHERE id = ?
    LIMIT 1
  `;
  interface SimpleEmpRow extends RowDataPacket {
    id: string;
    name: string;
    department?: string;
  }
  const rows = await executeQuery<SimpleEmpRow[]>(sql, [trimmed]);
  if (!rows || rows.length === 0) return null;
  return {
    id: rows[0].id,
    name: rows[0].name,
    department: rows[0].department,
  };
}

/**
 * Checks whether a time-off request ID already exists.
 */
export async function timeOffIdExists(id: string): Promise<boolean> {
  const sql = 'SELECT id FROM time_off_requests WHERE id = ? LIMIT 1';
  const rows = await executeQuery<RowDataPacket[]>(sql, [id]);
  return Boolean(rows && rows.length > 0);
}

/**
 * Generates a unique, collision-resistant time-off request ID.
 */
export async function generateTimeOffId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `TO-${randomUUID().slice(0, 8).toUpperCase()}`;
    const exists = await timeOffIdExists(candidate);
    if (!exists) return candidate;
  }
  return `TO-${Date.now().toString().slice(-4)}`;
}

/**
 * Creates a new Time Off request in MySQL with calculated duration and validation.
 */
export async function createTimeOffRequest(input: CreateTimeOffInput): Promise<TimeOffRecord> {
  const id = input.id && input.id.trim().length > 0
    ? input.id.trim()
    : await generateTimeOffId();

  const calculatedDays = calculateLeaveDays(input.startDate, input.endDate);
  if (calculatedDays <= 0) {
    throw new TimeOffValidationError('Invalid date range: start date must be on or before end date.', 'dates');
  }

  const durationDays = input.durationDays && input.durationDays > 0 && input.durationDays <= calculatedDays
    ? input.durationDays
    : calculatedDays;

  const status = normalizeTimeOffStatus(input.status);

  const insertSql = `
    INSERT INTO time_off_requests (
      id,
      employee_id,
      leave_type,
      start_date,
      end_date,
      duration_days,
      reason,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await executeQuery<ResultSetHeader>(insertSql, [
    id,
    input.employeeId.trim(),
    input.leaveType.trim(),
    input.startDate.trim(),
    input.endDate.trim(),
    durationDays,
    input.reason?.trim() || null,
    status,
  ]);

  const created = await getTimeOffRequestById(id);
  if (!created) {
    throw new Error('Failed to retrieve time off request after insertion.');
  }

  return created;
}

/**
 * Approves a PENDING time off request.
 *
 * State transition rules:
 * - PENDING → APPROVED: Allowed
 * - APPROVED → APPROVED: 409 Conflict
 * - REFUSED → APPROVED: 409 Conflict
 */
export async function approveTimeOffRequest(id: string, _approvedBy: string = 'HR Manager'): Promise<TimeOffRecord> {
  const existing = await getTimeOffRequestById(id);
  if (!existing) {
    throw new TimeOffWorkflowError('NOT_FOUND', 'Time off request not found.');
  }

  if (existing.status === 'APPROVED') {
    throw new TimeOffWorkflowError('INVALID_TRANSITION', 'Time off request is already approved.', existing.status);
  }

  if (existing.status === 'REFUSED') {
    throw new TimeOffWorkflowError('INVALID_TRANSITION', 'Cannot approve a request that has already been refused.', existing.status);
  }

  if (existing.status !== 'PENDING') {
    throw new TimeOffWorkflowError('INVALID_TRANSITION', `Cannot approve request with status '${existing.status}'. Only PENDING requests may be approved.`, existing.status);
  }

  // Atomic state transition
  const updateSql = `
    UPDATE time_off_requests
    SET status = 'APPROVED'
    WHERE id = ? AND status = 'PENDING'
  `;

  const result = await executeQuery<ResultSetHeader>(updateSql, [id]);
  if (result.affectedRows === 0) {
    // Concurrent update conflict check
    const recheck = await getTimeOffRequestById(id);
    throw new TimeOffWorkflowError(
      'INVALID_TRANSITION',
      `State conflict: request has already transitioned to '${recheck?.status || 'UNKNOWN'}'.`,
      recheck?.status
    );
  }

  const updated = await getTimeOffRequestById(id);
  if (!updated) {
    throw new Error('Failed to retrieve time off request after approval.');
  }

  return updated;
}

/**
 * Refuses a PENDING time off request.
 *
 * State transition rules:
 * - PENDING → REFUSED: Allowed
 * - REFUSED → REFUSED: 409 Conflict
 * - APPROVED → REFUSED: 409 Conflict
 */
export async function refuseTimeOffRequest(id: string, _refusedBy: string = 'HR Manager'): Promise<TimeOffRecord> {
  const existing = await getTimeOffRequestById(id);
  if (!existing) {
    throw new TimeOffWorkflowError('NOT_FOUND', 'Time off request not found.');
  }

  if (existing.status === 'REFUSED') {
    throw new TimeOffWorkflowError('INVALID_TRANSITION', 'Time off request is already refused.', existing.status);
  }

  if (existing.status === 'APPROVED') {
    throw new TimeOffWorkflowError('INVALID_TRANSITION', 'Cannot refuse a request that has already been approved.', existing.status);
  }

  if (existing.status !== 'PENDING') {
    throw new TimeOffWorkflowError('INVALID_TRANSITION', `Cannot refuse request with status '${existing.status}'. Only PENDING requests may be refused.`, existing.status);
  }

  // Atomic state transition
  const updateSql = `
    UPDATE time_off_requests
    SET status = 'REFUSED'
    WHERE id = ? AND status = 'PENDING'
  `;

  const result = await executeQuery<ResultSetHeader>(updateSql, [id]);
  if (result.affectedRows === 0) {
    const recheck = await getTimeOffRequestById(id);
    throw new TimeOffWorkflowError(
      'INVALID_TRANSITION',
      `State conflict: request has already transitioned to '${recheck?.status || 'UNKNOWN'}'.`,
      recheck?.status
    );
  }

  const updated = await getTimeOffRequestById(id);
  if (!updated) {
    throw new Error('Failed to retrieve time off request after refusal.');
  }

  return updated;
}
