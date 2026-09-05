/**
 * Employee Repository — Data-access layer for the employees table.
 *
 * Schema (actual MySQL columns):
 *   id, name, email, department, position, gender, status,
 *   join_date, bank_account, created_at
 *
 * Uses parameterized queries exclusively.
 * Connects through the centralized MySQL pool via executeQuery.
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { executeQuery } from '../config/database.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EmployeeRow extends RowDataPacket {
  id: string;
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
  name: string;
  email: string;
  department: string;
  position?: string;
  gender?: string | null;
  status?: string;
  joinDate?: string | null;
  bankAccount?: string | null;
}

export interface UpdateEmployeeInput {
  name?: string;
  email?: string;
  department?: string;
  position?: string;
  gender?: string | null;
  status?: string;
  joinDate?: string | null;
  bankAccount?: string | null;
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
    case 'ACTIVE':   return 'ACTIVE';
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
    e.name,
    e.email,
    e.department,
    e.position,
    e.gender,
    e.status,
    e.join_date,
    e.bank_account,
    e.created_at,
    c.id   AS active_contract_id,
    c.wage AS wage,
    ws.name AS working_schedule
  FROM employees e
  LEFT JOIN contracts c
    ON c.employee_id = e.id AND c.status = 'ACTIVE'
  LEFT JOIN working_schedules ws
    ON ws.id = c.working_schedule_id
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

/**
 * Used by payroll route to verify an employee exists.
 */
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

/**
 * Generates the next sequential EMP-XXX ID.
 */
async function generateEmployeeId(): Promise<string> {
  const rows = await executeQuery<RowDataPacket[]>(
    "SELECT id FROM employees WHERE id REGEXP '^EMP-[0-9]+$' ORDER BY id DESC LIMIT 1",
    []
  );
  if (rows.length === 0) return 'EMP-007';
  const last = rows[0].id as string;
  const num = parseInt(last.replace('EMP-', ''), 10) || 6;
  return `EMP-${String(num + 1).padStart(3, '0')}`;
}

export async function createEmployee(input: CreateEmployeeInput): Promise<EmployeeRecord> {
  const conflict = await emailExists(input.email);
  if (conflict) throw new Error('DUPLICATE_EMAIL');

  const id = input.id?.trim() || (await generateEmployeeId());
  const name = (input.name || 'New Employee').trim();
  const email = input.email.trim().toLowerCase();
  const department = (input.department || 'General').trim();
  const position = (input.position || 'Staff').trim();
  const gender = input.gender ? input.gender.trim().toUpperCase() : null;
  const status = (input.status || 'ACTIVE').trim().toUpperCase();
  const joinDate = input.joinDate || new Date().toISOString().split('T')[0];
  const bankAccount = input.bankAccount || null;

  await executeQuery<ResultSetHeader>(
    `INSERT INTO employees (id, name, email, department, position, gender, status, join_date, bank_account)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, email, department, position, gender, status, joinDate, bankAccount]
  );

  const created = await getEmployeeById(id);
  if (!created) throw new Error('Database operation failed. Please try again.');
  return created;
}

export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput
): Promise<EmployeeRecord | null> {
  const existing = await getEmployeeById(id);
  if (!existing) return null;

  if (input.email !== undefined) {
    const conflict = await emailExists(input.email, existing.id);
    if (conflict) throw new Error('DUPLICATE_EMAIL');
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined)       { setClauses.push('name = ?');         values.push(input.name.trim()); }
  if (input.email !== undefined)      { setClauses.push('email = ?');        values.push(input.email.trim().toLowerCase()); }
  if (input.department !== undefined) { setClauses.push('department = ?');   values.push(input.department.trim()); }
  if (input.position !== undefined)   { setClauses.push('position = ?');     values.push(input.position.trim()); }
  if (input.gender !== undefined)     { setClauses.push('gender = ?');       values.push(input.gender ? input.gender.trim().toUpperCase() : null); }
  if (input.status !== undefined)     { setClauses.push('status = ?');       values.push(input.status.trim().toUpperCase()); }
  if (input.joinDate !== undefined)   { setClauses.push('join_date = ?');    values.push(input.joinDate); }
  if (input.bankAccount !== undefined){ setClauses.push('bank_account = ?'); values.push(input.bankAccount); }

  if (setClauses.length === 0) return existing;

  values.push(existing.id);
  await executeQuery<ResultSetHeader>(
    `UPDATE employees SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );

  return getEmployeeById(id);
}
