/**
 * Contract Repository — Data-access layer for the contracts table.
 *
 * Responsibilities:
 * - All SQL for contract operations lives here, not in route handlers.
 * - Uses parameterized queries exclusively.
 * - Uses the centralized pool via executeQuery — never opens a second connection.
 * - Joins employees using COLLATE to bridge the utf8mb4_unicode_ci (employees.id / empCode)
 *   vs utf8mb4_0900_ai_ci (contracts.employee_id) collation mismatch in the live DB.
 * - Maps live MySQL column names to the API response shape.
 * - Never leaks SQL statements, stack traces, or credentials to callers.
 */

import { RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '../config/database.js';
import { randomUUID } from 'node:crypto';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Raw row shape returned by MySQL contracts queries.
 */
export interface ContractRow extends RowDataPacket {
  id: string;
  employee_id: string | null;
  salary_structure_id: string | null;
  working_schedule_id: string | null;
  wage: number | string;
  start_date: Date | string;
  end_date: Date | string | null;
  status: string;
  // Joined from employees table
  name?: string | null;
  department?: string | null;
  position?: string | null;
  emp_code?: string | null;
  employee_db_id?: string | null;
}

/**
 * Safe contract shape returned to route handlers and API clients.
 * Matches both legacy mock fields and frontend Contract interface.
 */
export interface ContractRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  empCode?: string;
  department?: string;
  position?: string;
  startDate: string;
  endDate?: string | null;
  wage: number;
  structure: string;
  salaryStructure: string;
  salaryStructureId?: string | null;
  schedule: string;
  workingSchedule: string;
  workingScheduleId?: string | null;
  status: 'ACTIVE' | 'FUTURE' | 'HISTORICAL';
}

/**
 * Input shape for creating a new contract.
 */
export interface CreateContractInput {
  id?: string;
  employeeId: string;
  salaryStructureId?: string | null;
  workingScheduleId?: string | null;
  wage: number;
  startDate: string;
  endDate?: string | null;
  status?: 'ACTIVE' | 'FUTURE' | 'HISTORICAL';
}

export interface EmployeeLookupResult {
  id: string;
  name: string;
  empCode?: string;
  firstName?: string;
  lastName?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalizes Date or date string to YYYY-MM-DD.
 */
function formatDate(val: Date | string | null | undefined): string | null {
  if (!val) return null;
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
 * Maps a raw database row to a type-safe ContractRecord.
 */
function mapRowToRecord(row: ContractRow): ContractRecord {
  const employeeName = row.name ? String(row.name).trim() : (row.employee_id || 'Unknown Employee');

  const startDate = formatDate(row.start_date) || '';
  const endDate = formatDate(row.end_date);

  const wageNum = typeof row.wage === 'number' ? row.wage : parseFloat(String(row.wage) || '0');
  const structure = row.salary_structure_id || 'Standard Full-Time';
  const schedule = row.working_schedule_id || 'Standard 40h';

  const validStatus = (['ACTIVE', 'FUTURE', 'HISTORICAL'].includes(row.status)
    ? row.status
    : 'ACTIVE') as 'ACTIVE' | 'FUTURE' | 'HISTORICAL';

  return {
    id: row.id,
    employeeId: row.employee_id || '',
    employeeName,
    empCode: row.emp_code ? String(row.emp_code).trim() : undefined,
    department: row.department || undefined,
    position: row.position || undefined,
    startDate,
    endDate: endDate || null,
    wage: isNaN(wageNum) ? 0 : wageNum,
    structure,
    salaryStructure: structure,
    salaryStructureId: row.salary_structure_id || null,
    schedule,
    workingSchedule: schedule,
    workingScheduleId: row.working_schedule_id || null,
    status: validStatus,
  };
}

// ── SQL ──────────────────────────────────────────────────────────────────────

const CONTRACT_SELECT = `
  SELECT
    c.id,
    c.employee_id,
    c.salary_structure_id,
    c.working_schedule_id,
    c.wage,
    c.start_date,
    c.end_date,
    c.status,
    COALESCE(e.name, '') AS name,
    e.department,
    e.position,
    e.id AS emp_code,
    e.id AS employee_db_id
  FROM contracts c
  LEFT JOIN employees e
    ON e.id = c.employee_id COLLATE utf8mb4_unicode_ci
`;

// ── Repository Functions ─────────────────────────────────────────────────────

/**
 * Returns all contracts ordered by id ASC for deterministic listing.
 * Gracefully handles an empty table (returns []).
 */
export async function getAllContracts(): Promise<ContractRecord[]> {
  const sql = `${CONTRACT_SELECT} ORDER BY c.id ASC`;
  const rows = await executeQuery<ContractRow[]>(sql, []);
  return rows.map(mapRowToRecord);
}

/**
 * Returns a single contract by exact ID match, or null if not found.
 */
export async function getContractById(id: string): Promise<ContractRecord | null> {
  const sql = `${CONTRACT_SELECT} WHERE c.id = ? LIMIT 1`;
  const rows = await executeQuery<ContractRow[]>(sql, [id]);
  if (!rows || rows.length === 0) return null;
  return mapRowToRecord(rows[0]);
}

/**
 * Normalizes an employee identifier to its hyphenated canonical form.
 * Converts 'EMP001' -> 'EMP-001' so that raw numeric codes match stored IDs.
 */
function normalizeEmployeeId(id: string): string {
  const trimmed = id.trim();
  // If already has a hyphen or is a UUID, return as-is
  if (trimmed.includes('-')) return trimmed;
  // Insert hyphen between alpha prefix and numeric suffix: EMP001 -> EMP-001
  const match = trimmed.match(/^([A-Za-z]+)(\d+)$/);
  if (match) return `${match[1].toUpperCase()}-${match[2]}`;
  return trimmed;
}

/**
 * Returns all contracts for a specific employee ID or empCode.
 * Accepts both 'EMP-001' and 'EMP001' formats.
 */
export async function getContractsByEmployeeId(employeeId: string): Promise<ContractRecord[]> {
  const trimmed = normalizeEmployeeId(employeeId);
  const sql = `
    ${CONTRACT_SELECT}
    WHERE c.employee_id = ? OR e.id = ?
    ORDER BY c.id ASC
  `;
  const rows = await executeQuery<ContractRow[]>(sql, [trimmed, trimmed]);
  return rows.map(mapRowToRecord);
}

/**
 * Returns the currently ACTIVE contract for an employee if one exists.
 * Accepts both 'EMP-001' and 'EMP001' formats.
 */
export async function getActiveContractByEmployeeId(employeeId: string): Promise<ContractRecord | null> {
  const trimmed = normalizeEmployeeId(employeeId);
  const sql = `
    ${CONTRACT_SELECT}
    WHERE (c.employee_id = ? OR e.id = ?)
      AND c.status = 'ACTIVE'
    LIMIT 1
  `;
  const rows = await executeQuery<ContractRow[]>(sql, [trimmed, trimmed]);
  if (!rows || rows.length === 0) return null;
  return mapRowToRecord(rows[0]);
}

/**
 * Checks whether an employee exists in MySQL by id.
 * Returns safe employee metadata if found, or null if nonexistent.
 */
export async function findEmployeeByIdOrCode(identifier: string): Promise<EmployeeLookupResult | null> {
  const trimmed = identifier.trim();
  const sql = `
    SELECT id, name
    FROM employees
    WHERE id = ?
    LIMIT 1
  `;
  interface SimpleEmpRow extends RowDataPacket {
    id: string;
    name: string;
  }
  const rows = await executeQuery<SimpleEmpRow[]>(sql, [trimmed]);
  if (!rows || rows.length === 0) return null;
  return {
    id: rows[0].id,
    name: rows[0].name,
    empCode: rows[0].id,
  };
}

/**
 * Checks whether a contract ID already exists in the contracts table.
 */
export async function contractIdExists(id: string): Promise<boolean> {
  const sql = 'SELECT id FROM contracts WHERE id = ? LIMIT 1';
  const rows = await executeQuery<RowDataPacket[]>(sql, [id]);
  return Boolean(rows && rows.length > 0);
}

/**
 * Generates a unique, deterministic-style contract ID if not provided.
 * Format: CON-XXXXXX (alphanumeric, fits varchar(50))
 */
export async function generateContractId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `CON-${randomUUID().slice(0, 8).toUpperCase()}`;
    const exists = await contractIdExists(candidate);
    if (!exists) return candidate;
  }
  return `CON-${Date.now()}`;
}

/**
 * Creates a new contract record in MySQL.
 */
export async function createContract(input: CreateContractInput): Promise<ContractRecord> {
  const id = input.id?.trim() || (await generateContractId());
  const status = input.status || 'ACTIVE';
  const salaryStructureId = input.salaryStructureId || 'STR-001';
  const workingScheduleId = input.workingScheduleId || 'SCH-001';

  const insertSql = `
    INSERT INTO contracts (
      id,
      employee_id,
      salary_structure_id,
      working_schedule_id,
      wage,
      start_date,
      end_date,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  try {
    await executeQuery(insertSql, [
      id,
      input.employeeId,
      salaryStructureId,
      workingScheduleId,
      input.wage,
      input.startDate,
      input.endDate || null,
      status,
    ]);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ER_NO_REFERENCED_ROW_2') {
      throw new Error('Referenced employee, salary structure, or working schedule does not exist.');
    }
    throw err;
  }

  const created = await getContractById(id);
  if (!created) {
    throw new Error('Contract record creation verified failed.');
  }

  return created;
}
