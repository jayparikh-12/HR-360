/**
 * Time Off Repository — Data-access layer for the time_off_requests table.
 *
 * Responsibilities:
 * - Parameterized SQL queries via centralized MySQL pool.
 * - Collation compatibility between employees (utf8mb4_unicode_ci) and time_off_requests (utf8mb4_0900_ai_ci).
 * - Safe mapping from raw database rows to TimeOffRecord domain objects.
 * - Enforces valid state transitions (PENDING -> APPROVED, PENDING -> REFUSED).
 * - Never leaks raw SQL or credentials to callers.
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { executeQuery } from '../config/database.js';
import { randomUUID } from 'node:crypto';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TimeOffRow extends RowDataPacket {
  id: string;
  employee_id: string | null;
  leave_type: string;
  start_date: Date | string;
  end_date: Date | string;
  duration_days: number;
  reason: string | null;
  status: string | null;
  // Joined from employees
  empCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  department?: string | null;
}

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
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REFUSED';
}

export interface CreateTimeOffInput {
  id?: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  durationDays?: number;
  reason?: string | null;
}

export interface EmployeeLookupResult {
  id: string;
  empCode: string;
  firstName: string;
  lastName: string;
  department: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(val: Date | string | null | undefined): string {
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

function mapRowToRecord(row: TimeOffRow): TimeOffRecord {
  const firstName = row.firstName ? String(row.firstName).trim() : '';
  const lastName = row.lastName ? String(row.lastName).trim() : '';
  const fullName = `${firstName} ${lastName}`.trim();
  const employeeName = fullName.length > 0 ? fullName : (row.empCode || 'Unknown Employee');

  const validStatus = (['PENDING', 'APPROVED', 'REFUSED'].includes(row.status || '')
    ? row.status
    : 'PENDING') as TimeOffRecord['status'];

  return {
    id: row.id,
    employeeId: row.employee_id || '',
    employeeName,
    empCode: row.empCode || undefined,
    department: row.department || undefined,
    leaveType: row.leave_type || 'Paid Annual Leave',
    startDate: formatDate(row.start_date),
    endDate: formatDate(row.end_date),
    durationDays: typeof row.duration_days === 'number' ? row.duration_days : parseInt(String(row.duration_days || 1), 10),
    reason: row.reason || '',
    status: validStatus,
  };
}

// ── SQL ──────────────────────────────────────────────────────────────────────

const TIMEOFF_SELECT = `
  SELECT
    t.id,
    t.employee_id,
    t.leave_type,
    t.start_date,
    t.end_date,
    t.duration_days,
    t.reason,
    t.status,
    e.empCode,
    e.firstName,
    e.lastName,
    e.department
  FROM time_off_requests t
  LEFT JOIN employees e
    ON (e.id = t.employee_id COLLATE utf8mb4_unicode_ci OR e.empCode = t.employee_id COLLATE utf8mb4_unicode_ci)
`;

// ── Repository Functions ─────────────────────────────────────────────────────

/**
 * Returns all time-off requests ordered by start_date DESC, id DESC.
 * Gracefully handles an empty table (returns []).
 */
export async function getAllTimeOffRequests(): Promise<TimeOffRecord[]> {
  const sql = `${TIMEOFF_SELECT} ORDER BY t.start_date DESC, t.id DESC`;
  const rows = await executeQuery<TimeOffRow[]>(sql, []);
  return rows.map(mapRowToRecord);
}

/**
 * Returns a single time-off request by exact ID match, or null if not found.
 */
export async function getTimeOffRequestById(id: string): Promise<TimeOffRecord | null> {
  const sql = `${TIMEOFF_SELECT} WHERE t.id = ? LIMIT 1`;
  const rows = await executeQuery<TimeOffRow[]>(sql, [id]);
  if (!rows || rows.length === 0) return null;
  return mapRowToRecord(rows[0]);
}

/**
 * Checks whether an employee exists in MySQL by UUID, empCode, or dashed empCode.
 */
export async function findEmployeeByIdOrCode(identifier: string): Promise<EmployeeLookupResult | null> {
  const trimmed = identifier.trim();
  const stripped = trimmed.replace(/-/g, '');

  const sql = `
    SELECT id, empCode, firstName, lastName, department
    FROM employees
    WHERE id = ? OR empCode = ? OR empCode = ?
    LIMIT 1
  `;
  interface SimpleEmpRow extends RowDataPacket {
    id: string;
    empCode: string;
    firstName: string;
    lastName: string;
    department: string;
  }
  const rows = await executeQuery<SimpleEmpRow[]>(sql, [trimmed, trimmed, stripped]);
  if (!rows || rows.length === 0) return null;
  return {
    id: rows[0].id,
    empCode: rows[0].empCode,
    firstName: rows[0].firstName,
    lastName: rows[0].lastName,
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
 * Creates a new time-off request in MySQL with initial status 'PENDING'.
 */
export async function createTimeOffRequest(input: CreateTimeOffInput): Promise<TimeOffRecord> {
  const id = input.id?.trim() || (await generateTimeOffId());
  const leaveType = input.leaveType.trim();
  const startDate = input.startDate.trim();
  const endDate = input.endDate.trim();
  const reason = input.reason?.trim() || '';

  let duration = input.durationDays;
  if (typeof duration !== 'number' || isNaN(duration) || duration <= 0) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    duration = Math.max(1, diffDays);
  }

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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
  `;

  await executeQuery(insertSql, [
    id,
    input.employeeId,
    leaveType,
    startDate,
    endDate,
    duration,
    reason,
  ]);

  const created = await getTimeOffRequestById(id);
  if (!created) {
    throw new Error('Failed to verify created time-off request.');
  }

  return created;
}

/**
 * Approves a pending time-off request.
 * Only 'PENDING' requests can be transitioned to 'APPROVED'.
 */
export async function approveTimeOffRequest(id: string): Promise<TimeOffRecord> {
  const existing = await getTimeOffRequestById(id);
  if (!existing) {
    throw new Error('REQUEST_NOT_FOUND');
  }

  if (existing.status !== 'PENDING') {
    throw new Error(`INVALID_STATE_TRANSITION:${existing.status}`);
  }

  const updateSql = `
    UPDATE time_off_requests
    SET status = 'APPROVED'
    WHERE id = ? AND status = 'PENDING'
  `;

  await executeQuery<ResultSetHeader>(updateSql, [id]);

  const updated = await getTimeOffRequestById(id);
  if (!updated) {
    throw new Error('Failed to retrieve approved time-off request.');
  }

  return updated;
}

/**
 * Refuses a pending time-off request.
 * Only 'PENDING' requests can be transitioned to 'REFUSED'.
 */
export async function refuseTimeOffRequest(id: string): Promise<TimeOffRecord> {
  const existing = await getTimeOffRequestById(id);
  if (!existing) {
    throw new Error('REQUEST_NOT_FOUND');
  }

  if (existing.status !== 'PENDING') {
    throw new Error(`INVALID_STATE_TRANSITION:${existing.status}`);
  }

  const updateSql = `
    UPDATE time_off_requests
    SET status = 'REFUSED'
    WHERE id = ? AND status = 'PENDING'
  `;

  await executeQuery<ResultSetHeader>(updateSql, [id]);

  const updated = await getTimeOffRequestById(id);
  if (!updated) {
    throw new Error('Failed to retrieve refused time-off request.');
  }

  return updated;
}
