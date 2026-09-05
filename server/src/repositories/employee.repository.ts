/**
 * Employee Repository — Data-access layer for the employees table.
 *
 * Responsibilities:
 * - All SQL for employee operations lives here, not in route handlers.
 * - Uses parameterized queries exclusively.
 * - Connects through the centralized MySQL pool via executeQuery.
 * - Joins contracts for wage using COLLATE to bridge the utf8mb4_unicode_ci (employees.id)
 *   vs utf8mb4_0900_ai_ci (contracts.employee_id) collation mismatch in the live DB.
 * - Maps actual MySQL schema columns (name, email, department, position, status, join_date, bank_account)
 *   to the API response shape expected by the frontend Employee interface.
 * - Never leaks SQL statements, stack traces, or credentials to callers.
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { executeQuery } from '../config/database.js';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Raw row shape returned by MySQL JOIN query.
 * Column names match the database schema in db/schema.sql.
 */
export interface EmployeeRow extends RowDataPacket {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  status: string;
  join_date: Date | string | null;
  bank_account: string | null;
  created_at: Date | string | null;
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
  attendanceRate: number;
  leaveBalance: number;
}

/**
 * Input shape for creating a new employee.
 */
export interface CreateEmployeeInput {
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  department: string;
  position?: string;
  jobPosition?: string;
  employeeType?: string;
  status?: string;
  phone?: string | null;
  workingSchedule?: string | null;
  managerId?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankAccount?: string | null;
  ifscRouting?: string | null;
  joinDate?: string | null;
}

/**
 * Input shape for updating an existing employee.
 */
export interface UpdateEmployeeInput {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  department?: string;
  position?: string;
  jobPosition?: string;
  employeeType?: string;
  status?: string;
  phone?: string | null;
  workingSchedule?: string | null;
  managerId?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankAccount?: string | null;
  ifscRouting?: string | null;
  joinDate?: string | null;
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
 * Normalizes a date field from MySQL (may be Date object or string)
 * to a consistent YYYY-MM-DD string.
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
 */
function normalizeStatus(raw: string): EmployeeRecord['status'] {
  switch ((raw || '').toUpperCase()) {
    case 'ACTIVE':
      return 'ACTIVE';
    case 'INACTIVE':
    case 'TERMINATED':
      return 'TERMINATED';
    case 'PROBATION':
      return 'PROBATION';
    default:
      return 'ACTIVE';
  }
}

/**
 * Formats bank account for display.
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
  const fullName = (row.name || '').trim();
  return {
    id: row.id,
    name: fullName,
    email: row.email,
    department: row.department,
    position: row.position,
    status: normalizeStatus(row.status),
    avatarInitials: deriveInitials(fullName),
    joinDate: normalizeDate(row.join_date || row.created_at),
    activeContractId: row.active_contract_id ?? null,
    wage: typeof row.wage === 'number' ? row.wage : Number(row.wage) || 0,
    schedule: 'Standard 40h',
    bankAccount: row.bank_account || '—',
    attendanceRate: 0,
    leaveBalance: 0,
  };
}

// ── SQL ──────────────────────────────────────────────────────────────────────

const EMPLOYEE_SELECT = `
  SELECT
    e.id,
    e.name,
    e.email,
    e.department,
    e.position,
    e.status,
    e.join_date,
    e.bank_account,
    e.created_at,
    c.id        AS active_contract_id,
    c.wage      AS wage
  FROM employees e
  LEFT JOIN contracts c
    ON c.employee_id COLLATE utf8mb4_unicode_ci = e.id
    AND c.status = 'ACTIVE'
`;

// ── Repository functions ─────────────────────────────────────────────────────

/**
 * Returns all employees ordered by id for deterministic listing.
 */
export async function getAllEmployees(): Promise<EmployeeRecord[]> {
  const sql = `${EMPLOYEE_SELECT} ORDER BY e.id ASC`;
  const rows = await executeQuery<EmployeeRow[]>(sql, []);
  return rows.map(mapRowToRecord);
}

/**
 * Returns a single employee by exact ID match, or null if not found.
 */
export async function getEmployeeById(id: string): Promise<EmployeeRecord | null> {
  const sql = `${EMPLOYEE_SELECT} WHERE e.id = ? LIMIT 1`;
  const rows = await executeQuery<EmployeeRow[]>(sql, [id]);
  if (!rows || rows.length === 0) return null;
  return mapRowToRecord(rows[0]);
}

// ── Uniqueness helpers ───────────────────────────────────────────────────────

/**
 * Checks whether a given email already exists in the employees table.
 */
export async function emailExists(email: string, excludeId?: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  let sql = 'SELECT id FROM employees WHERE LOWER(email) = ? LIMIT 1';
  const params: string[] = [normalized];
  if (excludeId) {
    sql = 'SELECT id FROM employees WHERE LOWER(email) = ? AND id != ? LIMIT 1';
    params.push(excludeId);
  }
  const rows = await executeQuery<RowDataPacket[]>(sql, params);
  return rows.length > 0;
}

/**
 * Generates the next employee ID sequentially (EMP-001, EMP-002, ...).
 */
async function generateEmployeeId(): Promise<string> {
  const rows = await executeQuery<RowDataPacket[]>(
    "SELECT id FROM employees WHERE id REGEXP '^EMP-[0-9]+$' ORDER BY id DESC LIMIT 1",
    []
  );
  if (rows.length === 0) return 'EMP-001';
  const last = rows[0].id as string;
  const num = parseInt(last.replace(/^EMP-/, ''), 10) || 0;
  return `EMP-${String(num + 1).padStart(3, '0')}`;
}

// ── Write operations ─────────────────────────────────────────────────────────

/**
 * Inserts a new employee row and returns the full created record.
 */
export async function createEmployee(input: CreateEmployeeInput): Promise<EmployeeRecord> {
  const conflict = await emailExists(input.email);
  if (conflict) {
    throw new Error('DUPLICATE_EMAIL');
  }

  const id = input.id?.trim() || (await generateEmployeeId());
  const fullName = input.name?.trim() || `${input.firstName || ''} ${input.lastName || ''}`.trim() || 'New Employee';
  const position = input.position?.trim() || input.jobPosition?.trim() || 'Staff';
  const department = input.department.trim();
  const status = input.status?.trim() || 'ACTIVE';
  const joinDate = input.joinDate?.trim() || new Date().toISOString().slice(0, 10);
  const bankAccount = input.bankAccount?.trim() || (input.bankAccountNo ? maskBankAccount(input.bankAccountNo) : '•••• 0000');

  await executeQuery<ResultSetHeader>(
    `INSERT INTO employees (id, name, email, department, position, status, join_date, bank_account)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      fullName,
      input.email.trim().toLowerCase(),
      department,
      position,
      status,
      joinDate,
      bankAccount,
    ]
  );

  const created = await getEmployeeById(id);
  if (!created) throw new Error('Database operation failed. Please try again.');
  return created;
}

/**
 * Updates allowed fields on an existing employee row.
 */
export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput
): Promise<EmployeeRecord | null> {
  const existing = await getEmployeeById(id);
  if (!existing) return null;

  if (input.email !== undefined) {
    const conflict = await emailExists(input.email, id);
    if (conflict) {
      throw new Error('DUPLICATE_EMAIL');
    }
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];

  const fullName = input.name?.trim() || (input.firstName || input.lastName ? `${input.firstName || ''} ${input.lastName || ''}`.trim() : undefined);
  if (fullName) {
    setClauses.push('name = ?');
    values.push(fullName);
  }

  if (input.email) {
    setClauses.push('email = ?');
    values.push(input.email.trim().toLowerCase());
  }

  if (input.department) {
    setClauses.push('department = ?');
    values.push(input.department.trim());
  }

  const position = input.position?.trim() || input.jobPosition?.trim();
  if (position) {
    setClauses.push('position = ?');
    values.push(position);
  }

  if (input.status) {
    setClauses.push('status = ?');
    values.push(input.status.trim());
  }

  const bankAccount = input.bankAccount?.trim() || (input.bankAccountNo ? maskBankAccount(input.bankAccountNo) : undefined);
  if (bankAccount) {
    setClauses.push('bank_account = ?');
    values.push(bankAccount);
  }

  if (setClauses.length === 0) {
    return existing;
  }

  values.push(id);

  await executeQuery<ResultSetHeader>(
    `UPDATE employees SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );

  const updated = await getEmployeeById(id);
  return updated;
}
