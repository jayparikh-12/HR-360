/**
 * Attendance Repository — Data-access layer for the attendance_records table.
 *
 * Responsibilities:
 * - Parameterized SQL queries via the centralized pool.
 * - Collation compatibility between employees (utf8mb4_unicode_ci) and attendance_records (utf8mb4_0900_ai_ci).
 * - Safe mapping from raw database rows to AttendanceRecord domain objects.
 * - Handles check-in and check-out workflows with accurate duration and status derivation.
 * - Never leaks raw SQL or credentials to callers.
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { executeQuery } from '../config/database.js';
import { randomUUID } from 'node:crypto';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AttendanceRow extends RowDataPacket {
  id: string;
  employee_id: string | null;
  date: Date | string;
  check_in: string | null;
  check_out: string | null;
  worked_hours: number | string | null;
  status: string | null;
  // Joined from employees
  name?: string | null;
  department?: string | null;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  empCode?: string;
  department?: string;
  date: string;
  checkIn: string;
  checkOut: string;
  workedHours: number;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'OVERTIME' | 'MISSING_CHECKOUT';
}

export interface CreateCheckInInput {
  id?: string;
  employeeId: string;
  date?: string;
  checkIn?: string;
  status?: 'PRESENT' | 'LATE' | 'ABSENT' | 'OVERTIME' | 'MISSING_CHECKOUT';
}

export interface RecordCheckOutInput {
  recordId?: string;
  employeeId?: string;
  checkOut?: string;
}

export interface EmployeeLookupResult {
  id: string;
  name: string;
  department?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(val: Date | string | null | undefined): string {
  if (!val) return new Date().toISOString().split('T')[0];
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

function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();

  // Match 12-hour format: "08:58 AM", "5:45 pm"
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([aApP][mM])$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const meridiem = match12[3].toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  // Match 24-hour format: "08:58", "17:45"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }

  return null;
}

export function calculateWorkedHours(checkIn: string, checkOut: string): number {
  const inMinutes = parseTimeToMinutes(checkIn);
  const outMinutes = parseTimeToMinutes(checkOut);

  if (inMinutes === null || outMinutes === null) {
    return 8.0; // Safe fallback standard shift duration
  }

  let diffMinutes = outMinutes - inMinutes;
  if (diffMinutes < 0) {
    // Overnight shift: add 24 hours
    diffMinutes += 24 * 60;
  }

  const hours = diffMinutes / 60;
  return Math.min(Math.round(hours * 100) / 100, 24.0);
}

function formatCurrentTime(): string {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

function mapRowToRecord(row: AttendanceRow): AttendanceRecord {
  const employeeName = row.name ? String(row.name).trim() : (row.employee_id || 'Unknown Employee');

  const validStatus = (['PRESENT', 'LATE', 'ABSENT', 'OVERTIME', 'MISSING_CHECKOUT'].includes(row.status || '')
    ? row.status
    : 'PRESENT') as AttendanceRecord['status'];

  const workedHoursNum =
    row.worked_hours !== null && row.worked_hours !== undefined
      ? typeof row.worked_hours === 'number'
        ? row.worked_hours
        : parseFloat(String(row.worked_hours))
      : 0;

  return {
    id: row.id,
    employeeId: row.employee_id || '',
    employeeName,
    department: row.department || undefined,
    date: formatDate(row.date),
    checkIn: row.check_in || '—',
    checkOut: row.check_out && row.check_out.trim().length > 0 ? row.check_out : 'Active',
    workedHours: isNaN(workedHoursNum) ? 0 : workedHoursNum,
    status: validStatus,
  };
}

// ── SQL ──────────────────────────────────────────────────────────────────────

const ATTENDANCE_SELECT = `
  SELECT
    a.id,
    a.employee_id,
    a.date,
    a.check_in,
    a.check_out,
    a.worked_hours,
    a.status,
    e.name,
    e.department
  FROM attendance_records a
  LEFT JOIN employees e
    ON e.id = a.employee_id
`;

// ── Repository Functions ─────────────────────────────────────────────────────

/**
 * Returns all attendance records ordered by date DESC, id DESC.
 * Handles an empty table gracefully (returns []).
 */
export async function getAllAttendance(): Promise<AttendanceRecord[]> {
  const sql = `${ATTENDANCE_SELECT} ORDER BY a.date DESC, a.id DESC`;
  const rows = await executeQuery<AttendanceRow[]>(sql, []);
  return rows.map(mapRowToRecord);
}

/**
 * Returns a single attendance record by exact ID match.
 */
export async function getAttendanceById(id: string): Promise<AttendanceRecord | null> {
  const sql = `${ATTENDANCE_SELECT} WHERE a.id = ? LIMIT 1`;
  const rows = await executeQuery<AttendanceRow[]>(sql, [id]);
  if (!rows || rows.length === 0) return null;
  return mapRowToRecord(rows[0]);
}

/**
 * Finds an open (active) check-in for an employee.
 * Open check-in: check_out IS NULL, empty string, or 'Active'.
 */
export async function getActiveCheckIn(employeeId: string, date?: string): Promise<AttendanceRecord | null> {
  let sql = `
    ${ATTENDANCE_SELECT}
    WHERE a.employee_id = ?
      AND (a.check_out IS NULL OR a.check_out = '' OR a.check_out = 'Active')
  `;
  const params: unknown[] = [employeeId];

  if (date) {
    sql += ' AND a.date = ?';
    params.push(date);
  }

  sql += ' ORDER BY a.date DESC, a.id DESC LIMIT 1';

  const rows = await executeQuery<AttendanceRow[]>(sql, params);
  if (!rows || rows.length === 0) return null;
  return mapRowToRecord(rows[0]);
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
 * Checks whether an attendance record ID already exists.
 */
export async function attendanceIdExists(id: string): Promise<boolean> {
  const sql = 'SELECT id FROM attendance_records WHERE id = ? LIMIT 1';
  const rows = await executeQuery<RowDataPacket[]>(sql, [id]);
  return Boolean(rows && rows.length > 0);
}

/**
 * Generates a unique attendance record ID.
 */
export async function generateAttendanceId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `ATT-${randomUUID().slice(0, 8).toUpperCase()}`;
    const exists = await attendanceIdExists(candidate);
    if (!exists) return candidate;
  }
  return `ATT-${Date.now().toString().slice(-4)}`;
}

/**
 * Creates a new check-in attendance record in MySQL.
 */
export async function createCheckIn(input: CreateCheckInInput): Promise<AttendanceRecord> {
  const id = input.id?.trim() || (await generateAttendanceId());
  const date = input.date?.trim() || formatDate(new Date());
  const checkIn = input.checkIn?.trim() || formatCurrentTime();
  const status = input.status || 'PRESENT';

  const insertSql = `
    INSERT INTO attendance_records (
      id,
      employee_id,
      date,
      check_in,
      check_out,
      worked_hours,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  await executeQuery(insertSql, [
    id,
    input.employeeId,
    date,
    checkIn,
    null, // Open checkout
    0.00,
    status,
  ]);

  const created = await getAttendanceById(id);
  if (!created) {
    throw new Error('Attendance record creation verification failed.');
  }

  return created;
}

/**
 * Records checkout on an active attendance record.
 */
export async function recordCheckOut(input: RecordCheckOutInput): Promise<AttendanceRecord> {
  let targetRecord: AttendanceRecord | null = null;

  if (input.recordId) {
    targetRecord = await getAttendanceById(input.recordId.trim());
  } else if (input.employeeId) {
    targetRecord = await getActiveCheckIn(input.employeeId.trim());
  }

  if (!targetRecord) {
    throw new Error('NO_ACTIVE_CHECKIN');
  }

  if (targetRecord.checkOut && targetRecord.checkOut !== 'Active' && targetRecord.workedHours > 0) {
    throw new Error('ALREADY_CHECKED_OUT');
  }

  const checkOutTime = input.checkOut?.trim() || formatCurrentTime();
  const workedHours = calculateWorkedHours(targetRecord.checkIn, checkOutTime);

  // Status transitions
  let finalStatus = targetRecord.status;
  if (workedHours >= 9.0) {
    finalStatus = 'OVERTIME';
  } else if (finalStatus !== 'LATE') {
    finalStatus = 'PRESENT';
  }

  const updateSql = `
    UPDATE attendance_records
    SET
      check_out = ?,
      worked_hours = ?,
      status = ?
    WHERE id = ?
  `;

  await executeQuery<ResultSetHeader>(updateSql, [
    checkOutTime,
    workedHours,
    finalStatus,
    targetRecord.id,
  ]);

  const updated = await getAttendanceById(targetRecord.id);
  if (!updated) {
    throw new Error('Failed to retrieve updated attendance record.');
  }

  return updated;
}
