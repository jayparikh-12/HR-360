/**
 * Salary Rule Repository — Data-access layer for the salary_rules table.
 *
 * Responsibilities:
 * - All SQL queries for salary rule operations live here, outside route handlers.
 * - Parameterized queries exclusively.
 * - Uses the centralized pool via executeQuery.
 * - Preserves deterministic ordering (sequence ASC, id ASC).
 * - Never leaks SQL statements, stack traces, or credentials to callers.
 */

import { RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '../config/database.js';
import { randomUUID } from 'node:crypto';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SalaryRuleRow extends RowDataPacket {
  id: string;
  structure_id: string | null;
  name: string;
  code: string;
  sequence: number | string;
  category: string;
  calculation_type: string;
  amount: number | string | null;
  percentage: number | string | null;
  formula: string | null;
  structure_name?: string | null;
  structure_code?: string | null;
}

export interface SalaryRuleRecord {
  id: string;
  structureId: string | null;
  name: string;
  code: string;
  sequence: number;
  category: string;
  calculationType: string;
  amount: number | null;
  percentage: number | null;
  formula: string | null;
  structureName?: string | null;
  structureCode?: string | null;
  salaryStructure?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface CreateSalaryRuleInput {
  id?: string;
  structureId: string;
  name: string;
  code: string;
  sequence: number;
  category: string;
  calculationType: string;
  amount?: number | null;
  percentage?: number | null;
  formula?: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapRowToRecord(row: SalaryRuleRow): SalaryRuleRecord {
  const seqNum =
    typeof row.sequence === 'number'
      ? row.sequence
      : parseInt(String(row.sequence), 10);

  const amountNum =
    row.amount !== null && row.amount !== undefined && row.amount !== ''
      ? typeof row.amount === 'number'
        ? row.amount
        : parseFloat(String(row.amount))
      : null;

  const percentageNum =
    row.percentage !== null && row.percentage !== undefined && row.percentage !== ''
      ? typeof row.percentage === 'number'
        ? row.percentage
        : parseFloat(String(row.percentage))
      : null;

  const hasStructure = Boolean(row.structure_id);

  return {
    id: row.id,
    structureId: row.structure_id ?? null,
    name: row.name,
    code: row.code,
    sequence: isNaN(seqNum) ? 0 : seqNum,
    category: row.category,
    calculationType: row.calculation_type,
    amount: amountNum !== null && !isNaN(amountNum) ? amountNum : null,
    percentage: percentageNum !== null && !isNaN(percentageNum) ? percentageNum : null,
    formula: row.formula ?? null,
    structureName: row.structure_name ?? null,
    structureCode: row.structure_code ?? null,
    salaryStructure: hasStructure
      ? {
          id: row.structure_id!,
          name: row.structure_name || '',
          code: row.structure_code || '',
        }
      : null,
  };
}

// ── SQL ──────────────────────────────────────────────────────────────────────

const SALARY_RULE_SELECT = `
  SELECT
    r.id,
    r.structure_id,
    r.name,
    r.code,
    r.sequence,
    r.category,
    r.calculation_type,
    r.amount,
    r.percentage,
    r.formula,
    s.name AS structure_name,
    s.code AS structure_code
  FROM salary_rules r
  LEFT JOIN salary_structures s ON s.id = r.structure_id
`;

// ── Repository Functions ─────────────────────────────────────────────────────

/**
 * Returns all salary rules, optionally filtered by structureId.
 * Ordered deterministically by sequence ASC, id ASC.
 * Handles an empty table gracefully (returns []).
 */
export async function getAllSalaryRules(structureId?: string): Promise<SalaryRuleRecord[]> {
  let sql = SALARY_RULE_SELECT;
  const params: unknown[] = [];

  if (structureId && structureId.trim()) {
    sql += ' WHERE r.structure_id = ?';
    params.push(structureId.trim());
  }

  sql += ' ORDER BY r.sequence ASC, r.id ASC';

  const rows = await executeQuery<SalaryRuleRow[]>(sql, params);
  return rows.map(mapRowToRecord);
}

/**
 * Returns a single salary rule by exact ID match, or null if not found.
 */
export async function getSalaryRuleById(id: string): Promise<SalaryRuleRecord | null> {
  const sql = `${SALARY_RULE_SELECT} WHERE r.id = ? LIMIT 1`;
  const rows = await executeQuery<SalaryRuleRow[]>(sql, [id]);
  if (!rows || rows.length === 0) return null;
  return mapRowToRecord(rows[0]);
}

/**
 * Returns all salary rules belonging to a specific structure ID.
 * Ordered by sequence ASC, id ASC.
 */
export async function getSalaryRulesByStructureId(structureId: string): Promise<SalaryRuleRecord[]> {
  return getAllSalaryRules(structureId);
}

/**
 * Returns all active/applicable salary rules belonging to a specific structure ID.
 * Excludes any rules with explicit active: false or status: 'INACTIVE'.
 * Ordered deterministically by sequence ASC, id ASC.
 */
export async function getActiveSalaryRulesByStructureId(structureId: string): Promise<SalaryRuleRecord[]> {
  if (!structureId || !structureId.trim()) return [];
  const rules = await getAllSalaryRules(structureId.trim());
  return rules.filter(
    (r) => (r as any).active !== false && String((r as any).status || '').toUpperCase() !== 'INACTIVE'
  );
}

/**
 * Checks whether a salary rule ID already exists.
 */
export async function salaryRuleIdExists(id: string): Promise<boolean> {
  const sql = 'SELECT id FROM salary_rules WHERE id = ? LIMIT 1';
  const rows = await executeQuery<RowDataPacket[]>(sql, [id]);
  return Boolean(rows && rows.length > 0);
}

/**
 * Checks whether a salary rule code already exists within a specific structure (or globally).
 */
export async function salaryRuleCodeExists(
  code: string,
  structureId?: string,
  excludeId?: string
): Promise<boolean> {
  let sql = 'SELECT id FROM salary_rules WHERE LOWER(code) = LOWER(?)';
  const params: unknown[] = [code.trim()];

  if (structureId && structureId.trim()) {
    sql += ' AND structure_id = ?';
    params.push(structureId.trim());
  }

  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }

  sql += ' LIMIT 1';
  const rows = await executeQuery<RowDataPacket[]>(sql, params);
  return Boolean(rows && rows.length > 0);
}

/**
 * Generates a unique, collision-resistant salary rule ID.
 * Format: RUL-XXXXXX
 */
export async function generateSalaryRuleId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `RUL-${randomUUID().slice(0, 8).toUpperCase()}`;
    const exists = await salaryRuleIdExists(candidate);
    if (!exists) return candidate;
  }
  return `RUL-${Date.now().toString().slice(-4)}`;
}

/**
 * Creates a new salary rule in MySQL.
 */
export async function createSalaryRule(input: CreateSalaryRuleInput): Promise<SalaryRuleRecord> {
  const id = input.id?.trim() || (await generateSalaryRuleId());
  const structureId = input.structureId.trim();
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  const sequence = Math.floor(input.sequence);
  const category = input.category.trim().toUpperCase();
  const calculationType = input.calculationType.trim().toUpperCase();
  const amount = input.amount !== undefined && input.amount !== null ? input.amount : null;
  const percentage = input.percentage !== undefined && input.percentage !== null ? input.percentage : null;
  const formula = input.formula && input.formula.trim() ? input.formula.trim() : null;

  const insertSql = `
    INSERT INTO salary_rules (
      id,
      structure_id,
      name,
      code,
      sequence,
      category,
      calculation_type,
      amount,
      percentage,
      formula
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  try {
    await executeQuery(insertSql, [
      id,
      structureId,
      name,
      code,
      sequence,
      category,
      calculationType,
      amount,
      percentage,
      formula,
    ]);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      const codeErr = (err as { code: string }).code;
      if (codeErr === 'ER_DUP_ENTRY') {
        throw new Error(`Salary rule with code '${code}' already exists in structure '${structureId}'.`);
      }
      if (codeErr === 'ER_NO_REFERENCED_ROW_2') {
        throw new Error(`Referenced salary structure '${structureId}' does not exist.`);
      }
    }
    throw err;
  }

  const created = await getSalaryRuleById(id);
  if (!created) {
    throw new Error('Salary rule creation verification failed.');
  }

  return created;
}
