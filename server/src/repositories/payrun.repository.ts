/**
 * Payrun Repository — Data-access layer for the payruns table in MySQL.
 *
 * Responsibilities:
 * - Centralizes all SQL queries for payrun record persistence.
 * - Uses parameterized queries exclusively.
 * - Connects through the centralized MySQL pool via executeQuery.
 * - Handles deterministic ordering by created_at DESC, id DESC.
 * - Never leaks SQL statements, stack traces, or credentials to callers.
 */

import { RowDataPacket } from 'mysql2/promise';
import { executeQuery } from '../config/database.js';
import { randomUUID } from 'node:crypto';

// ── Types ────────────────────────────────────────────────────────────────────

export type PayrunStatus = 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID';

export interface PayrunRow extends RowDataPacket {
  id: string;
  name: string;
  period: string;
  salary_structure_id: string | null;
  total_gross: number | string | null;
  total_net: number | string | null;
  employee_count: number | string | null;
  status: string;
  created_at: Date | string | null;
  structure_name?: string | null;
  structure_code?: string | null;
}

export interface PayrunRecord {
  id: string;
  name: string;
  period: string;
  salaryStructureId: string | null;
  salaryStructure: string;
  totalGross: number;
  totalNet: number;
  employeeCount: number;
  status: PayrunStatus;
  createdAt: string;
  payslips?: any[];
}

export interface CreatePayrunInput {
  id?: string;
  name: string;
  period: string;
  salaryStructureId?: string | null;
  salaryStructureName?: string | null;
  totalGross?: number;
  totalNet?: number;
  employeeCount?: number;
  status?: PayrunStatus;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapRowToRecord(row: PayrunRow): PayrunRecord {
  let createdAtStr = '';
  if (row.created_at instanceof Date) {
    createdAtStr = row.created_at.toISOString();
  } else if (row.created_at) {
    createdAtStr = String(row.created_at);
  } else {
    createdAtStr = new Date().toISOString();
  }

  const grossNum =
    row.total_gross !== null && row.total_gross !== undefined
      ? typeof row.total_gross === 'number'
        ? row.total_gross
        : parseFloat(String(row.total_gross))
      : 0;

  const netNum =
    row.total_net !== null && row.total_net !== undefined
      ? typeof row.total_net === 'number'
        ? row.total_net
        : parseFloat(String(row.total_net))
      : 0;

  const countNum =
    row.employee_count !== null && row.employee_count !== undefined
      ? typeof row.employee_count === 'number'
        ? row.employee_count
        : parseInt(String(row.employee_count), 10)
      : 0;

  return {
    id: row.id,
    name: row.name,
    period: row.period,
    salaryStructureId: row.salary_structure_id ?? null,
    salaryStructure: row.structure_name || row.salary_structure_id || 'Standard Full-Time Tech',
    totalGross: isNaN(grossNum) ? 0 : grossNum,
    totalNet: isNaN(netNum) ? 0 : netNum,
    employeeCount: isNaN(countNum) ? 0 : countNum,
    status: (row.status || 'DRAFT') as PayrunStatus,
    createdAt: createdAtStr,
  };
}

// ── SQL Queries ──────────────────────────────────────────────────────────────

const PAYRUN_SELECT = `
  SELECT
    p.id,
    p.name,
    p.period,
    p.salary_structure_id,
    p.total_gross,
    p.total_net,
    p.employee_count,
    p.status,
    p.created_at,
    s.name AS structure_name,
    s.code AS structure_code
  FROM payruns p
  LEFT JOIN salary_structures s ON s.id = p.salary_structure_id
`;

// ── Repository Functions ─────────────────────────────────────────────────────

/**
 * Returns all payruns from MySQL, ordered deterministically by created_at DESC, id DESC.
 * Handles an empty table gracefully (returns []).
 */
export async function getAllPayruns(): Promise<PayrunRecord[]> {
  const sql = `${PAYRUN_SELECT} ORDER BY p.created_at DESC, p.id DESC`;
  const rows = await executeQuery<PayrunRow[]>(sql, []);
  return rows.map(mapRowToRecord);
}

/**
 * Returns a single payrun by exact ID match, or null if not found.
 */
export async function getPayrunById(id: string): Promise<PayrunRecord | null> {
  const sql = `${PAYRUN_SELECT} WHERE p.id = ? LIMIT 1`;
  const rows = await executeQuery<PayrunRow[]>(sql, [id]);
  if (!rows || rows.length === 0) return null;
  return mapRowToRecord(rows[0]);
}

/**
 * Checks whether a payrun ID already exists.
 */
export async function payrunIdExists(id: string): Promise<boolean> {
  const sql = 'SELECT id FROM payruns WHERE id = ? LIMIT 1';
  const rows = await executeQuery<RowDataPacket[]>(sql, [id]);
  return Boolean(rows && rows.length > 0);
}

/**
 * Generates a unique collision-resistant payrun ID.
 * Format: PR-YYYYMM-XXXX
 */
export async function generatePayrunId(): Promise<string> {
  const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `PR-${datePrefix}-${randomUUID().slice(0, 4).toUpperCase()}`;
    const exists = await payrunIdExists(candidate);
    if (!exists) return candidate;
  }
  return `PR-${Date.now().toString().slice(-6)}`;
}

/**
 * Persists a new payrun record in MySQL.
 */
export async function createPayrun(input: CreatePayrunInput): Promise<PayrunRecord> {
  const id = input.id?.trim() || (await generatePayrunId());
  const name = input.name.trim();
  const period = input.period.trim();
  const salaryStructureId = input.salaryStructureId?.trim() || null;
  const totalGross = input.totalGross !== undefined && !isNaN(input.totalGross) ? input.totalGross : 0;
  const totalNet = input.totalNet !== undefined && !isNaN(input.totalNet) ? input.totalNet : 0;
  const employeeCount = input.employeeCount !== undefined && !isNaN(input.employeeCount) ? input.employeeCount : 0;
  const status = input.status || 'DRAFT';

  const insertSql = `
    INSERT INTO payruns (
      id,
      name,
      period,
      salary_structure_id,
      total_gross,
      total_net,
      employee_count,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await executeQuery(insertSql, [
    id,
    name,
    period,
    salaryStructureId,
    totalGross,
    totalNet,
    employeeCount,
    status,
  ]);

  const created = await getPayrunById(id);
  if (!created) {
    throw new Error('Payrun record creation verification failed.');
  }

  return created;
}

/**
 * Updates the status of an existing payrun record in MySQL.
 */
export async function updatePayrunStatus(id: string, status: PayrunStatus): Promise<PayrunRecord | null> {
  const updateSql = 'UPDATE payruns SET status = ? WHERE id = ?';
  await executeQuery(updateSql, [status, id]);
  return getPayrunById(id);
}
