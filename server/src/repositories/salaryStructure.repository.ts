/**
 * Salary Structure Repository — Data-access layer for the salary_structures table.
 *
 * Responsibilities:
 * - All SQL queries for salary structure operations live here, not in route handlers.
 * - Uses parameterized queries exclusively.
 * - Uses the centralized pool via executeQuery.
 * - Never leaks SQL statements, stack traces, or credentials to callers.
 */

import { RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '../config/database.js';
import { randomUUID } from 'node:crypto';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SalaryStructureRow extends RowDataPacket {
  id: string;
  name: string;
  code: string;
  created_at: Date | string | null;
  contract_count?: number | string | null;
}

export interface SalaryStructureRecord {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  contractCount: number;
}

export interface CreateSalaryStructureInput {
  id?: string;
  name: string;
  code: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapRowToRecord(row: SalaryStructureRow): SalaryStructureRecord {
  let createdAtStr = '';
  if (row.created_at instanceof Date) {
    createdAtStr = row.created_at.toISOString();
  } else if (row.created_at) {
    createdAtStr = String(row.created_at);
  } else {
    createdAtStr = new Date().toISOString();
  }

  const countNum =
    row.contract_count !== null && row.contract_count !== undefined
      ? typeof row.contract_count === 'number'
        ? row.contract_count
        : parseInt(String(row.contract_count), 10)
      : 0;

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    createdAt: createdAtStr,
    contractCount: isNaN(countNum) ? 0 : countNum,
  };
}

// ── SQL ──────────────────────────────────────────────────────────────────────

const SALARY_STRUCTURE_SELECT = `
  SELECT
    s.id,
    s.name,
    s.code,
    s.created_at,
    (SELECT COUNT(*) FROM contracts c WHERE c.salary_structure_id = s.id) AS contract_count
  FROM salary_structures s
`;

// ── Repository Functions ─────────────────────────────────────────────────────

/**
 * Returns all salary structures ordered by name ASC for deterministic listing.
 * Handles an empty table gracefully (returns []).
 */
export async function getAllSalaryStructures(): Promise<SalaryStructureRecord[]> {
  const sql = `${SALARY_STRUCTURE_SELECT} ORDER BY s.name ASC`;
  const rows = await executeQuery<SalaryStructureRow[]>(sql, []);
  return rows.map(mapRowToRecord);
}

/**
 * Returns a single salary structure by exact ID match, or null if not found.
 */
export async function getSalaryStructureById(id: string): Promise<SalaryStructureRecord | null> {
  const sql = `${SALARY_STRUCTURE_SELECT} WHERE s.id = ? LIMIT 1`;
  const rows = await executeQuery<SalaryStructureRow[]>(sql, [id]);
  if (!rows || rows.length === 0) return null;
  return mapRowToRecord(rows[0]);
}

/**
 * Returns a single salary structure by exact unique code match, or null if not found.
 */
export async function getSalaryStructureByCode(code: string): Promise<SalaryStructureRecord | null> {
  const sql = `${SALARY_STRUCTURE_SELECT} WHERE LOWER(s.code) = LOWER(?) LIMIT 1`;
  const rows = await executeQuery<SalaryStructureRow[]>(sql, [code.trim()]);
  if (!rows || rows.length === 0) return null;
  return mapRowToRecord(rows[0]);
}

/**
 * Checks whether a salary structure ID already exists.
 */
export async function salaryStructureIdExists(id: string): Promise<boolean> {
  const sql = 'SELECT id FROM salary_structures WHERE id = ? LIMIT 1';
  const rows = await executeQuery<RowDataPacket[]>(sql, [id]);
  return Boolean(rows && rows.length > 0);
}

/**
 * Checks whether a salary structure code already exists.
 */
export async function salaryStructureCodeExists(code: string, excludeId?: string): Promise<boolean> {
  let sql = 'SELECT id FROM salary_structures WHERE LOWER(code) = LOWER(?)';
  const params: unknown[] = [code.trim()];

  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }

  sql += ' LIMIT 1';
  const rows = await executeQuery<RowDataPacket[]>(sql, params);
  return Boolean(rows && rows.length > 0);
}

/**
 * Generates a unique, collision-resistant salary structure ID.
 * Format: STR-XXXXXX
 */
export async function generateSalaryStructureId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `STR-${randomUUID().slice(0, 8).toUpperCase()}`;
    const exists = await salaryStructureIdExists(candidate);
    if (!exists) return candidate;
  }
  return `STR-${Date.now().toString().slice(-4)}`;
}

/**
 * Creates a new salary structure in MySQL.
 */
export async function createSalaryStructure(input: CreateSalaryStructureInput): Promise<SalaryStructureRecord> {
  const id = input.id?.trim() || (await generateSalaryStructureId());
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();

  const insertSql = `
    INSERT INTO salary_structures (
      id,
      name,
      code
    ) VALUES (?, ?, ?)
  `;

  await executeQuery(insertSql, [id, name, code]);

  const created = await getSalaryStructureById(id);
  if (!created) {
    throw new Error('Salary structure creation verification failed.');
  }

  return created;
}
