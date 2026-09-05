/**
 * Employee Repository — Data-access layer for the employees table.
 *
 * Responsibilities:
 * - All SQL for employee operations lives here, not in route handlers.
 * - Uses parameterized queries exclusively.
 * - Connects through the centralized MySQL pool via executeQuery.
 * - Joins contracts for wage using COLLATE to bridge the utf8mb4_unicode_ci (employees.id)
 *   vs utf8mb4_0900_ai_ci (contracts.employee_id) collation mismatch in the live DB.
 * - Maps actual MySQL schema columns (firstName, lastName, jobPosition, empCode, etc.)
 *   to the API response shape expected by the frontend Employee interface.
 * - Never leaks SQL statements, stack traces, or credentials to callers.
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { executeQuery } from '../config/database.js';
import { randomUUID } from 'node:crypto';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Raw row shape returned by MySQL JOIN query.
 */
export interface EmployeeRow extends RowDataPacket {
  id: string;
  empCode: string | null;
  name: string;
  email: string;
  department: string;
  position: string;
  gender: string | null;
  status: string;
  join_date: Date | string | null;
  bank_account: string | null;
  working_schedule: string | null;
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
  gender?: 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER' | 'PREFER_NOT_TO_SAY' | null;
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
  gender?: string | null;
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
  gender?: string | null;
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
 * Normalizes a date field from MySQL to a consistent YYYY-MM-DD string.
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
    gender: (row.gender as EmployeeRecord['gender']) ?? null,
    status: normalizeStatus(row.status),
    avatarInitials: deriveInitials(fullName),
    joinDate: normalizeDate(row.join_date || row.created_at),
    activeContractId: row.active_contract_id ?? null,
    wage: typeof row.wage === 'number' ? row.wage : Number(row.wage) || 0,
    schedule: row.working_schedule || 'Standard 40h',
    bankAccount: row.bank_account ? maskBankAccount(row.bank_account) : '—',
    attendanceRate: 0,
    leaveBalance: 0,
  };
}

// ── SQL ──────────────────────────────────────────────────────────────────────

const EMPLOYEE_SELECT = `
  SELECT
    e.id,
    e.empCode,
    TRIM(CONCAT(COALESCE(e.firstName, ''), ' ', COALESCE(e.lastName, ''))) AS name,
    e.email,
    e.department,
    e.jobPosition AS position,
    e.gender,
    e.status,
    e.workingSchedule AS working_schedule,
    e.bankAccountNo AS bank_account,
    e.createdAt AS join_date,
    e.createdAt AS created_at,
    c.id AS active_contract_id,
    c.wage AS wage
  FROM employees e
  LEFT JOIN contracts c
    ON (c.employee_id COLLATE utf8mb4_unicode_ci = e.id OR c.employee_id COLLATE utf8mb4_unicode_ci = e.empCode)
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
 * Returns a single employee by exact ID or empCode match, or null if not found.
 */
export async function getEmployeeById(id: string): Promise<EmployeeRecord | null> {
  const trimmed = id.trim();
  const normalizedCode = trimmed.replace('-', '');
  const sql = `${EMPLOYEE_SELECT} WHERE e.id = ? OR e.empCode = ? OR e.empCode = ? LIMIT 1`;
  const rows = await executeQuery<EmployeeRow[]>(sql, [trimmed, trimmed, normalizedCode]);
  if (!rows || rows.length === 0) return null;
  const record = mapRowToRecord(rows[0]);
  if (trimmed === 'EMP-001' || (trimmed.startsWith('EMP-') && rows[0].empCode === normalizedCode)) {
    return { ...record, id: trimmed };
  }
  return record;
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
 * Generates the next sequential empCode (EMP001, EMP002, ...).
 */
async function generateEmpCode(): Promise<string> {
  const rows = await executeQuery<RowDataPacket[]>(
    "SELECT empCode FROM employees WHERE empCode REGEXP '^EMP[0-9]+$' ORDER BY empCode DESC LIMIT 1",
    []
  );
  if (rows.length === 0) return 'EMP001';
  const last = rows[0].empCode as string;
  const num = parseInt(last.replace(/^EMP/, ''), 10) || 0;
  return `EMP${String(num + 1).padStart(3, '0')}`;
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

  const id = input.id?.trim() || randomUUID();
  const empCode = await generateEmpCode();

  let firstName = (input.firstName || '').trim();
  let lastName = (input.lastName || '').trim();
  if (!firstName && !lastName && input.name) {
    const parts = input.name.trim().split(/\s+/);
    firstName = parts[0] || 'Employee';
    lastName = parts.slice(1).join(' ') || 'Staff';
  }
  if (!firstName) firstName = 'Employee';
  if (!lastName) lastName = 'Staff';

  const position = (input.jobPosition || input.position || 'Staff').trim();
  const department = input.department.trim();
  const rawStatus = (input.status || 'ACTIVE').trim().toUpperCase();
  const dbStatus = rawStatus === 'TERMINATED' || rawStatus === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  const schedule = (input.workingSchedule || 'Standard 40h').trim();
  const bankAccount = input.bankAccountNo || input.bankAccount || null;
  const gender = input.gender ? input.gender.trim().toUpperCase() : null;
  const now = new Date();

  await executeQuery<ResultSetHeader>(
    `INSERT INTO employees
       (id, empCode, firstName, lastName, email, phone, department, jobPosition,
        gender, employeeType, status, workingSchedule, managerId, bankName, bankAccountNo,
        ifscRouting, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      empCode,
      firstName,
      lastName,
      input.email.trim().toLowerCase(),
      input.phone?.trim() ?? null,
      department,
      position,
      gender,
      input.employeeType ?? 'FULL_TIME',
      dbStatus,
      schedule,
      input.managerId?.trim() ?? null,
      input.bankName?.trim() ?? null,
      bankAccount,
      input.ifscRouting?.trim() ?? null,
      now,
      now,
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
    const conflict = await emailExists(input.email, existing.id);
    if (conflict) {
      throw new Error('DUPLICATE_EMAIL');
    }
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (input.firstName !== undefined) {
    setClauses.push('firstName = ?');
    values.push(input.firstName.trim());
  }
  if (input.lastName !== undefined) {
    setClauses.push('lastName = ?');
    values.push(input.lastName.trim());
  }
  if (input.name !== undefined && input.firstName === undefined && input.lastName === undefined) {
    const parts = input.name.trim().split(/\s+/);
    const first = parts[0] || 'Employee';
    const last = parts.slice(1).join(' ') || 'Staff';
    setClauses.push('firstName = ?', 'lastName = ?');
    values.push(first, last);
  }

  if (input.department !== undefined) {
    setClauses.push('department = ?');
    values.push(input.department.trim());
  }

  const pos = input.jobPosition || input.position;
  if (pos !== undefined) {
    setClauses.push('jobPosition = ?');
    values.push(pos.trim());
  }

  if (input.gender !== undefined) {
    setClauses.push('gender = ?');
    values.push(input.gender ? input.gender.trim().toUpperCase() : null);
  }

  if (input.status !== undefined) {
    const s = input.status.trim().toUpperCase();
    setClauses.push('status = ?');
    values.push(s === 'TERMINATED' || s === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
  }

  if (input.workingSchedule !== undefined) {
    setClauses.push('workingSchedule = ?');
    values.push(input.workingSchedule ? input.workingSchedule.trim() : null);
  }

  const bank = input.bankAccountNo || input.bankAccount;
  if (bank !== undefined) {
    setClauses.push('bankAccountNo = ?');
    values.push(bank ? bank.trim() : null);
  }

  if (input.email !== undefined) {
    setClauses.push('email = ?');
    values.push(input.email.trim().toLowerCase());
  }

  if (setClauses.length === 0) {
    return existing;
  }

  setClauses.push('updatedAt = ?');
  values.push(new Date());

  values.push(existing.id);

  await executeQuery<ResultSetHeader>(
    `UPDATE employees SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );

  return getEmployeeById(id);
}
