/**
 * Time Off Repository — Data-access layer for the time_off_requests table.
 *
 * Responsibilities:
 * - All SQL for Time Off / Leave Management operations lives here, not in route handlers.
 * - Uses parameterized queries exclusively (no string interpolation with user values).
 * - Uses the centralized database pool via executeQuery — never opens a secondary connection.
 * - Joins employees to resolve employee name using COLLATE to bridge the
 *   utf8mb4_unicode_ci (employees.id) vs utf8mb4_unicode_ci / utf8mb4_0900_ai_ci collation mismatch.
 * - Gracefully handles missing employee relationships (LEFT JOIN + fallback name).
 * - Provides robust date validation and safe inclusive calendar duration calculation.
 * - Enforces strict state machine workflow: PENDING -> APPROVED or PENDING -> REFUSED.
 * - Rejects invalid transitions (APPROVED->APPROVED, REFUSED->APPROVED, etc.) with typed workflow errors.
 * - Never leaks SQL statements, stack traces, or credentials to callers.
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { executeQuery } from '../config/database.js';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Raw row shape returned by MySQL query with LEFT JOIN on employees.
 */
export interface TimeOffRow extends RowDataPacket {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: Date | string;
  end_date: Date | string;
  duration_days: number | string;
  reason: string | null;
  status: string;
  approved_by: string | null;
  refused_by: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  // From employees LEFT JOIN (may be null if employee record is missing)
  firstName: string | null;
  lastName: string | null;
}

/**
 * Safe Time Off record returned to route handlers and API clients.
 * Matches frontend TimeOffRequest model in client/src/types.ts with full metadata.
 */
export interface TimeOffRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  numberOfDays: number; // Convenient alias for frontend consumers
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REFUSED';
  approvedBy: string | null;
  refusedBy: string | null;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Input shape for creating a new Time Off request.
 */
export interface CreateTimeOffInput {
  id?: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  durationDays?: number;
  reason?: string;
  status?: 'PENDING' | 'APPROVED' | 'REFUSED';
}

/**
 * Filter options for querying time off requests.
 */
export interface TimeOffFilterOptions {
  employeeId?: string;
  status?: string;
}

// ── Custom Errors ────────────────────────────────────────────────────────────

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

// ── Date & Duration Helpers ──────────────────────────────────────────────────

/**
 * Parses a YYYY-MM-DD string into year, month (1-12), and day components.
 * Validates calendar validity (leap years, days per month).
 */
export function parseYMD(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }

  return { year, month, day };
}

/**
 * Calculates the inclusive calendar days between two YYYY-MM-DD dates.
 * Returns:
 *   > 0: valid duration (e.g. 2026-09-02 to 2026-09-02 = 1 day)
 *   -1: invalid range (endDate is before startDate)
 *    0: invalid date format
 */
export function calculateLeaveDays(startDateStr: string, endDateStr: string): number {
  const start = parseYMD(startDateStr);
  const end = parseYMD(endDateStr);
  if (!start || !end) return 0;

  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);

  if (endUtc < startUtc) return -1;
  return Math.round((endUtc - startUtc) / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * Normalizes a Date object or string from MySQL to a consistent YYYY-MM-DD string.
 * Uses local calendar components to prevent timezone offsets from shifting dates.
 */
function normalizeDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') {
    return value.split('T')[0].split(' ')[0];
  }
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).split('T')[0];
}

/**
 * Normalizes timestamps to a standard ISO string or formatted date string.
 */
function normalizeTimestamp(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

/**
 * Normalizes time off status strings to the expected union type.
 */
function normalizeTimeOffStatus(raw: string | null | undefined): TimeOffRecord['status'] {
  switch ((raw || '').toUpperCase()) {
    case 'APPROVED':
      return 'APPROVED';
    case 'REFUSED':
    case 'REJECTED':
      return 'REFUSED';
    case 'PENDING':
    default:
      return 'PENDING';
  }
}

/**
 * Maps a raw MySQL row to the safe TimeOffRecord API shape.
 * Robust against null employee records, null dates, or decimal duration strings.
 */
function mapRowToRecord(row: TimeOffRow): TimeOffRecord {
  const fullName = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
  const startDateStr = normalizeDate(row.start_date);
  const endDateStr = normalizeDate(row.end_date);
  const duration = typeof row.duration_days === 'number'
    ? row.duration_days
    : parseInt(String(row.duration_days), 10) || 1;

  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: fullName || 'Unknown Employee',
    leaveType: row.leave_type,
    startDate: startDateStr,
    endDate: endDateStr,
    durationDays: duration,
    numberOfDays: duration,
    reason: row.reason || '',
    status: normalizeTimeOffStatus(row.status),
    approvedBy: row.approved_by ?? null,
    refusedBy: row.refused_by ?? null,
    createdAt: normalizeTimestamp(row.createdAt),
    updatedAt: row.updatedAt ? normalizeTimestamp(row.updatedAt) : undefined,
  };
}

// ── SQL Queries ──────────────────────────────────────────────────────────────

/**
 * Base query: SELECT time_off_requests with LEFT JOIN to employees.
 *
 * COLLATE utf8mb4_unicode_ci bridges collation variations between
 * time_off_requests.employee_id and employees.id.
 */
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
    tor.approved_by,
    tor.refused_by,
    tor.createdAt,
    tor.updatedAt,
    e.firstName,
    e.lastName
  FROM time_off_requests tor
  LEFT JOIN employees e
    ON tor.employee_id COLLATE utf8mb4_unicode_ci = e.id
`;

// ── Repository Functions ─────────────────────────────────────────────────────

/**
 * Returns all time off requests ordered by creation timestamp descending.
 * Gracefully returns an empty array [] if the table is empty.
 */
export async function getAllTimeOffRequests(): Promise<TimeOffRecord[]> {
  const sql = `${TIME_OFF_SELECT} ORDER BY tor.createdAt DESC, tor.id DESC`;
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
  const sql = `${TIME_OFF_SELECT} WHERE tor.employee_id = ? ORDER BY tor.start_date DESC, tor.createdAt DESC`;
  const rows = await executeQuery<TimeOffRow[]>(sql, [employeeId]);
  return rows.map(mapRowToRecord);
}

/**
 * Returns all time off requests matching a specific status ('PENDING', 'APPROVED', 'REFUSED').
 */
export async function getTimeOffRequestsByStatus(status: string): Promise<TimeOffRecord[]> {
  const normalized = normalizeTimeOffStatus(status);
  const sql = `${TIME_OFF_SELECT} WHERE tor.status = ? ORDER BY tor.start_date DESC, tor.createdAt DESC`;
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
    conditions.push('tor.employee_id = ?');
    params.push(options.employeeId.trim());
  }

  if (options.status && typeof options.status === 'string' && options.status.trim().length > 0) {
    conditions.push('tor.status = ?');
    params.push(normalizeTimeOffStatus(options.status));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `${TIME_OFF_SELECT} ${whereClause} ORDER BY tor.createdAt DESC, tor.id DESC`;

  const rows = await executeQuery<TimeOffRow[]>(sql, params);
  return rows.map(mapRowToRecord);
}

/**
 * Creates a new Time Off request in MySQL with calculated duration and validation.
 */
export async function createTimeOffRequest(input: CreateTimeOffInput): Promise<TimeOffRecord> {
  const id = input.id && input.id.trim().length > 0
    ? input.id.trim()
    : `TO-${Date.now().toString().slice(-4)}`;

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
      status,
      approved_by,
      refused_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
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
export async function approveTimeOffRequest(id: string, approvedBy: string = 'HR Manager'): Promise<TimeOffRecord> {
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
    SET
      status = 'APPROVED',
      approved_by = ?,
      updatedAt = NOW()
    WHERE id = ? AND status = 'PENDING'
  `;

  const result = await executeQuery<ResultSetHeader>(updateSql, [approvedBy.trim(), id]);
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
export async function refuseTimeOffRequest(id: string, refusedBy: string = 'HR Manager'): Promise<TimeOffRecord> {
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
    SET
      status = 'REFUSED',
      refused_by = ?,
      updatedAt = NOW()
    WHERE id = ? AND status = 'PENDING'
  `;

  const result = await executeQuery<ResultSetHeader>(updateSql, [refusedBy.trim(), id]);
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
