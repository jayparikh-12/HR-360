/**
 * Employee Repository — Data-access layer for the employees table.
 *
 * Responsibilities:
 * - All SQL for employee operations lives here, not in route handlers.
 * - Uses parameterized queries exclusively (no string interpolation with user values).
 * - Uses the centralized pool via executeQuery — never opens a second connection.
 * - Joins contracts for wage using COLLATE to bridge the utf8mb4_unicode_ci (employees.id)
 *   vs utf8mb4_0900_ai_ci (contracts.employee_id) collation mismatch in the live DB.
 * - workingSchedule is a denormalized string column on employees (no JOIN needed).
 * - Maps actual live column names (firstName, lastName, jobPosition, empCode, etc.)
 *   to the API response shape expected by the frontend Employee interface.
 * - Never leaks SQL statements, stack traces, or credentials to callers.
 */

import { RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '../config/database.js';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Raw row shape returned by MySQL JOIN query.
 * Column names match the ACTUAL live database schema (Prisma-managed).
 */
export interface EmployeeRow extends RowDataPacket {
  id: string;
  empCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: string;
  jobPosition: string;
  employeeType: string;
  status: string;
  workingSchedule: string | null;
  managerId: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  createdAt: Date | string;
  // From contracts LEFT JOIN (may be null if no active contract)
  active_contract_id: string | null;
  wage: number | null;
}

/**
 * Safe employee shape returned to route handlers and API clients.
 * Matches the frontend Employee interface in client/src/types.ts exactly.
 */
export interface EmployeeRecord {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  status: 'ACTIVE' | 'PROBATION' | 'TERMINATED';
  avatarInitials: string;
  joinDate: string;
  activeContractId: string | null;
  wage: number;
  schedule: string;
  bankAccount: string;
  // Computed fields — Phase 2.3 will replace these defaults with real queries
  attendanceRate: number;
  leaveBalance: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives avatar initials from a full name.
 * "John Doe" → "JD", "Elena Rostova" → "ER", single word → first two chars.
 */
function deriveInitials(name: string): string {
  if (!name || typeof name !== 'string') return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Normalizes a createdAt field from MySQL (may be Date object or string)
 * to a consistent YYYY-MM-DD string for the joinDate field.
 */
function normalizeDate(value: Date | string | null): string {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return String(value).split('T')[0];
}

/**
 * Maps live DB status values to the frontend status enum.
 * Live DB uses ACTIVE / INACTIVE; frontend expects ACTIVE / PROBATION / TERMINATED.
 */
function normalizeStatus(raw: string): EmployeeRecord['status'] {
  switch ((raw || '').toUpperCase()) {
    case 'ACTIVE':
      return 'ACTIVE';
    case 'INACTIVE':
      return 'TERMINATED';
    case 'PROBATION':
      return 'PROBATION';
    default:
      return 'ACTIVE';
  }
}

/**
 * Formats bank account for display.
 * Live DB stores full account number — mask it like the frontend expects: •••• NNNN
 */
function maskBankAccount(bankAccountNo: string | null): string {
  if (!bankAccountNo) return '—';
  const trimmed = bankAccountNo.replace(/\s/g, '');
  if (trimmed.length <= 4) return `•••• ${trimmed}`;
  return `•••• ${trimmed.slice(-4)}`;
}

/**
 * Maps a raw MySQL row to the safe EmployeeRecord API shape.
 */
function mapRowToRecord(row: EmployeeRow): EmployeeRecord {
  const fullName = `${row.firstName || ''} ${row.lastName || ''}`.trim();
  return {
    id: row.id,
    name: fullName,
    email: row.email,
    department: row.department,
    position: row.jobPosition,
    status: normalizeStatus(row.status),
    avatarInitials: deriveInitials(fullName),
    // Use createdAt as joinDate; a proper hire_date column can be added in Phase 2.3
    joinDate: normalizeDate(row.createdAt),
    activeContractId: row.active_contract_id ?? null,
    wage: typeof row.wage === 'number' ? row.wage : Number(row.wage) || 0,
    schedule: row.workingSchedule ?? 'Standard 40h',
    bankAccount: maskBankAccount(row.bankAccountNo),
    // Phase 2.3 will replace these with real attendance/time-off queries
    attendanceRate: 0,
    leaveBalance: 0,
  };
}

// ── SQL ──────────────────────────────────────────────────────────────────────

/**
 * Core query: SELECT employees with LEFT JOIN to contracts (ACTIVE only).
 *
 * COLLATE utf8mb4_unicode_ci on the JOIN condition bridges the collation mismatch
 * between employees.id (utf8mb4_unicode_ci) and contracts.employee_id (utf8mb4_0900_ai_ci).
 * workingSchedule is a denormalized column on employees — no working_schedules JOIN needed.
 */
const EMPLOYEE_SELECT = `
  SELECT
    e.id,
    e.empCode,
    e.firstName,
    e.lastName,
    e.email,
    e.phone,
    e.department,
    e.jobPosition,
    e.employeeType,
    e.status,
    e.workingSchedule,
    e.managerId,
    e.bankName,
    e.bankAccountNo,
    e.createdAt,
    c.id        AS active_contract_id,
    c.wage      AS wage
  FROM employees e
  LEFT JOIN contracts c
    ON c.employee_id COLLATE utf8mb4_unicode_ci = e.id
    AND c.status = 'ACTIVE'
`;

// ── Repository functions ─────────────────────────────────────────────────────

/**
 * Returns all employees ordered by empCode for deterministic listing.
 * Handles an empty table gracefully (returns []).
 * Throws a sanitized Error on database failure (via executeQuery).
 */
export async function getAllEmployees(): Promise<EmployeeRecord[]> {
  const sql = `${EMPLOYEE_SELECT} ORDER BY e.empCode ASC`;
  const rows = await executeQuery<EmployeeRow[]>(sql, []);
  return rows.map(mapRowToRecord);
}

/**
 * Returns a single employee by exact ID match, or null if not found.
 * Uses a parameterized query; never interpolates the caller's id value.
 * Throws a sanitized Error on database failure.
 */
export async function getEmployeeById(id: string): Promise<EmployeeRecord | null> {
  const sql = `${EMPLOYEE_SELECT} WHERE e.id = ? LIMIT 1`;
  const rows = await executeQuery<EmployeeRow[]>(sql, [id]);
  if (!rows || rows.length === 0) return null;
  return mapRowToRecord(rows[0]);
}
