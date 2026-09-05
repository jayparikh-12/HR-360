/**
 * Employee Repository — Data-access layer for the employees table.
 *
 * Normalized to live MySQL schema:
 *   id, name, email, department, position, gender, status, join_date, bank_account, created_at
 *
 * Uses parameterized queries exclusively.
 * Connects through the centralized MySQL pool via executeQuery.
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { executeQuery } from '../config/database.js';
import { randomUUID } from 'node:crypto';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EmployeeRow extends RowDataPacket {
  id: string;
  empCode?: string;
  name: string;
  email: string;
  department: string;
  position: string;
  gender: string | null;
  status: string;
  join_date: Date | string | null;
  bank_account: string | null;
  created_at: Date | string | null;
  active_contract_id: string | null;
  wage: number | string | null;
  working_schedule: string | null;
}

export interface EmployeeRecord {
  id: string;
  empCode?: string;
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
  status?: string;
  joinDate?: string | null;
  bankAccount?: string | null;
  bankAccountNo?: string | null;
  workingSchedule?: string | null;
  phone?: string | null;
  employeeType?: string;
  managerId?: string | null;
  bankName?: string | null;
  ifscRouting?: string | null;
}

export interface UpdateEmployeeInput {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  department?: string;
  position?: string;
  jobPosition?: string;
  gender?: string | null;
  status?: string;
  joinDate?: string | null;
  bankAccount?: string | null;
  bankAccountNo?: string | null;
  workingSchedule?: string | null;
  phone?: string | null;
  employeeType?: string;
  managerId?: string | null;
  bankName?: string | null;
  ifscRouting?: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function deriveInitials(name: string): string {
  if (!name || typeof name !== 'string') return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function normalizeDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value).split('T')[0];
}

function normalizeStatus(raw: string): EmployeeRecord['status'] {
  switch ((raw || '').toUpperCase()) {
    case 'ACTIVE': return 'ACTIVE';
    case 'PROBATION': return 'PROBATION';
    case 'INACTIVE':
    case 'TERMINATED': return 'TERMINATED';
    default: return 'ACTIVE';
  }
}

function mapRowToRecord(row: EmployeeRow): EmployeeRecord {
  const fullName = (row.name || '').trim();
  const wage = row.wage !== null && row.wage !== undefined
    ? (typeof row.wage === 'number' ? row.wage : parseFloat(String(row.wage)) || 0)
    : 0;
  return {
    id: row.id,
    empCode: row.empCode ? String(row.empCode).trim() : row.id,
    name: fullName,
    email: row.email,
    department: row.department,
    position: row.position,
    gender: (row.gender as EmployeeRecord['gender']) ?? null,
    status: normalizeStatus(row.status),
    avatarInitials: deriveInitials(fullName),
    joinDate: normalizeDate(row.join_date || row.created_at),
    activeContractId: row.active_contract_id ?? null,
    wage,
    schedule: row.working_schedule || 'Standard 40h',
    bankAccount: row.bank_account || '—',
    attendanceRate: 0,
    leaveBalance: 0,
  };
}

// ── SQL ──────────────────────────────────────────────────────────────────────

const EMPLOYEE_SELECT = `
  SELECT
    e.id,
    e.id AS empCode,
    e.name,
    e.email,
    e.department,
    e.position,
    e.gender,
    e.status,
    e.join_date,
    e.created_at,
    e.bank_account,
    c.id AS active_contract_id,
    c.wage AS wage,
    ws.name AS working_schedule
  FROM employees e
  LEFT JOIN contracts c
    ON c.employee_id COLLATE utf8mb4_unicode_ci = e.id
    AND c.status = 'ACTIVE'
  LEFT JOIN working_schedules ws
    ON c.working_schedule_id = ws.id
`;

// ── Repository functions ─────────────────────────────────────────────────────

export async function getAllEmployees(): Promise<EmployeeRecord[]> {
  const sql = `${EMPLOYEE_SELECT} ORDER BY e.id ASC`;
  const rows = await executeQuery<EmployeeRow[]>(sql, []);
  return rows.map(mapRowToRecord);
}

export async function getEmployeeById(id: string): Promise<EmployeeRecord | null> {
  const trimmed = id.trim();
  const sql = `${EMPLOYEE_SELECT} WHERE e.id = ? LIMIT 1`;
  const rows = await executeQuery<EmployeeRow[]>(sql, [trimmed]);
  if (!rows || rows.length === 0) return null;
  return mapRowToRecord(rows[0]);
}

export async function findEmployeeByIdOrCode(id: string): Promise<EmployeeRecord | null> {
  return getEmployeeById(id);
}

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

export async function createEmployee(input: CreateEmployeeInput): Promise<EmployeeRecord> {
  const conflict = await emailExists(input.email);
  if (conflict) throw new Error('DUPLICATE_EMAIL');

  const id = input.id?.trim() || randomUUID();

  let fullName = '';
  if (input.firstName || input.lastName) {
    fullName = `${(input.firstName || '').trim()} ${(input.lastName || '').trim()}`.trim();
  } else if (input.name) {
    fullName = input.name.trim();
  }
  if (!fullName) fullName = 'Employee Staff';

  const position = (input.jobPosition || input.position || 'Staff').trim();
  const department = (input.department || 'General').trim();
  const rawStatus = (input.status || 'ACTIVE').trim().toUpperCase();
  const dbStatus = rawStatus === 'TERMINATED' || rawStatus === 'INACTIVE' ? 'INACTIVE' : rawStatus === 'PROBATION' ? 'PROBATION' : 'ACTIVE';
  const bankAccount = input.bankAccountNo || input.bankAccount || null;
  const gender = input.gender ? input.gender.trim().toUpperCase() : null;
  const joinDate = input.joinDate || new Date().toISOString().split('T')[0];

  await executeQuery<ResultSetHeader>(
    `INSERT INTO employees
       (id, name, email, department, position, gender, status, join_date, bank_account)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      fullName,
      input.email.trim().toLowerCase(),
      department,
      position,
      gender,
      dbStatus,
      joinDate,
      bankAccount,
    ]
  );

  const created = await getEmployeeById(id);
  if (!created) {
    throw new Error('Employee creation verification failed.');
  }

  return created;
}

export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput
): Promise<EmployeeRecord | null> {
  const existing = await getEmployeeById(id);
  if (!existing) return null;

  if (input.email && input.email.trim().toLowerCase() !== existing.email.toLowerCase()) {
    const conflict = await emailExists(input.email, id);
    if (conflict) throw new Error('DUPLICATE_EMAIL');
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];

  // Handle name update: support firstName+lastName or combined name
  if (input.name !== undefined && input.firstName === undefined && input.lastName === undefined) {
    setClauses.push('name = ?');
    values.push(input.name.trim());
  } else if (input.firstName !== undefined || input.lastName !== undefined) {
    const first = (input.firstName ?? '').trim();
    const last = (input.lastName ?? '').trim();
    const combined = `${first} ${last}`.trim();
    if (combined) {
      setClauses.push('name = ?');
      values.push(combined);
    }
  }

  if (input.department !== undefined) {
    setClauses.push('department = ?');
    values.push(input.department.trim());
  }

  const pos = input.jobPosition || input.position;
  if (pos !== undefined) {
    setClauses.push('position = ?');
    values.push(pos.trim());
  }

  if (input.gender !== undefined) {
    setClauses.push('gender = ?');
    values.push(input.gender ? input.gender.trim().toUpperCase() : null);
  }

  if (input.status !== undefined) {
    const s = input.status.trim().toUpperCase();
    setClauses.push('status = ?');
    values.push(s === 'TERMINATED' || s === 'INACTIVE' ? 'INACTIVE' : s === 'PROBATION' ? 'PROBATION' : 'ACTIVE');
  }

  const bank = input.bankAccountNo || input.bankAccount;
  if (bank !== undefined) {
    setClauses.push('bank_account = ?');
    values.push(bank ? bank.trim() : null);
  }

  if (input.email !== undefined) {
    setClauses.push('email = ?');
    values.push(input.email.trim().toLowerCase());
  }

  if (setClauses.length === 0) return existing;

  values.push(existing.id);

  await executeQuery<ResultSetHeader>(
    `UPDATE employees SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );

  return getEmployeeById(id);
}

/**
 * Remove an employee by ID.
 * Safely handles removal or soft termination if foreign-key dependencies exist.
 */
export async function deleteEmployee(id: string): Promise<boolean> {
  const existing = await getEmployeeById(id);
  if (!existing) return false;

  try {
    // Attempt physical delete first
    const result = await executeQuery<ResultSetHeader>('DELETE FROM employees WHERE id = ?', [existing.id]);
    return result.affectedRows > 0;
  } catch (_err: unknown) {
    // If foreign-key constraint prevents hard delete, soft-delete by setting status to INACTIVE
    const result = await executeQuery<ResultSetHeader>(
      'UPDATE employees SET status = "INACTIVE" WHERE id = ?',
      [existing.id]
    );
    return result.affectedRows > 0;
  }
}
