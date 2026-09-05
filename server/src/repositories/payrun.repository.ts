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

import { RowDataPacket, PoolConnection } from 'mysql2/promise';
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
  validated_at?: Date | string | null;
  validated_by?: string | null;
  paid_at?: Date | string | null;
  paid_by?: string | null;
  payment_reference?: string | null;
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
  validatedAt?: string | null;
  validatedBy?: string | null;
  validated_at?: string | null;
  validated_by?: string | null;
  paidAt?: string | null;
  paidBy?: string | null;
  paid_at?: string | null;
  paid_by?: string | null;
  paymentReference?: string | null;
  payment_reference?: string | null;
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

  let validatedAtStr: string | null = null;
  if (row.validated_at instanceof Date) {
    validatedAtStr = row.validated_at.toISOString();
  } else if (row.validated_at) {
    validatedAtStr = String(row.validated_at);
  }

  let paidAtStr: string | null = null;
  if (row.paid_at instanceof Date) {
    paidAtStr = row.paid_at.toISOString();
  } else if (row.paid_at) {
    paidAtStr = String(row.paid_at);
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
    validatedAt: validatedAtStr,
    validatedBy: row.validated_by || null,
    validated_at: validatedAtStr,
    validated_by: row.validated_by || null,
    paidAt: paidAtStr,
    paidBy: row.paid_by || null,
    paid_at: paidAtStr,
    paid_by: row.paid_by || null,
    paymentReference: row.payment_reference || null,
    payment_reference: row.payment_reference || null,
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
    p.validated_at,
    p.validated_by,
    p.paid_at,
    p.paid_by,
    p.payment_reference,
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

export interface EligibleEmployeeRow {
  employeeId: string;
  employeeName: string;
  department: string;
  employeeStatus: string;
  contractId: string;
  contractWage: number;
  salaryStructureId: string | null;
  workingScheduleId: string | null;
  contractStartDate: string;
  contractEndDate: string | null;
  contractStatus: string;
}

/**
 * Retrieves all employees eligible for payroll in a specified period.
 * 
 * Eligibility Criteria:
 * 1. Employee active status: status IN ('ACTIVE', 'PROBATION')
 * 2. Active contract: contracts.status = 'ACTIVE'
 * 3. Contract period relevance:
 *    - start_date <= periodEnd
 *    - (end_date IS NULL OR end_date >= periodStart)
 * 
 * Ordered deterministically by employee_id ASC.
 */
export async function getEligibleEmployeesForPeriod(
  startDate: string,
  endDate: string
): Promise<EligibleEmployeeRow[]> {
  const sql = `
    SELECT
      e.id AS employee_id,
      e.name AS employee_name,
      e.department,
      e.status AS employee_status,
      c.id AS contract_id,
      c.wage AS contract_wage,
      c.salary_structure_id,
      c.working_schedule_id,
      c.start_date AS contract_start_date,
      c.end_date AS contract_end_date,
      c.status AS contract_status
    FROM employees e
    JOIN contracts c ON c.employee_id = e.id
    WHERE e.status IN ('ACTIVE', 'PROBATION')
      AND c.status = 'ACTIVE'
      AND c.start_date <= ?
      AND (c.end_date IS NULL OR c.end_date >= ?)
    ORDER BY e.id ASC
  `;

  interface RawEligibleRow extends RowDataPacket {
    employee_id: string;
    employee_name: string;
    department: string;
    employee_status: string;
    contract_id: string;
    contract_wage: number | string;
    salary_structure_id: string | null;
    working_schedule_id: string | null;
    contract_start_date: Date | string;
    contract_end_date: Date | string | null;
    contract_status: string;
  }

  const rows = await executeQuery<RawEligibleRow[]>(sql, [endDate, startDate]);
  return rows.map((r) => {
    const wageNum =
      typeof r.contract_wage === 'number' ? r.contract_wage : parseFloat(String(r.contract_wage)) || 0;
    const sDate =
      r.contract_start_date instanceof Date
        ? r.contract_start_date.toISOString().split('T')[0]
        : String(r.contract_start_date).split('T')[0];
    const eDate = r.contract_end_date
      ? r.contract_end_date instanceof Date
        ? r.contract_end_date.toISOString().split('T')[0]
        : String(r.contract_end_date).split('T')[0]
      : null;

    return {
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      department: r.department,
      employeeStatus: r.employee_status,
      contractId: r.contract_id,
      contractWage: wageNum,
      salaryStructureId: r.salary_structure_id,
      workingScheduleId: r.working_schedule_id,
      contractStartDate: sDate,
      contractEndDate: eDate,
      contractStatus: r.contract_status,
    };
  });
}

/**
 * Updates calculated totals and status for a computed payrun.
 */
export async function updatePayrunCalculatedTotals(
  id: string,
  totalGross: number,
  totalNet: number,
  employeeCount: number,
  status: PayrunStatus = 'COMPUTED',
  connection?: PoolConnection
): Promise<PayrunRecord | null> {
  const updateSql = `
    UPDATE payruns
    SET
      total_gross = ?,
      total_net = ?,
      employee_count = ?,
      status = ?
    WHERE id = ?
  `;

  if (connection) {
    await connection.query(updateSql, [totalGross, totalNet, employeeCount, status, id]);
    const [rows] = await connection.query<PayrunRow[]>(`${PAYRUN_SELECT} WHERE p.id = ? LIMIT 1`, [id]);
    if (!rows || rows.length === 0) return null;
    return mapRowToRecord(rows[0]);
  } else {
    await executeQuery(updateSql, [totalGross, totalNet, employeeCount, status, id]);
    return getPayrunById(id);
  }
}

/**
 * Validates a payrun record in MySQL with audit metadata (status = 'VALIDATED', validated_at, validated_by).
 */
export async function validatePayrunRecord(
  id: string,
  validatedBy: string,
  connection?: PoolConnection
): Promise<PayrunRecord | null> {
  const updateSql = `
    UPDATE payruns
    SET
      status = 'VALIDATED',
      validated_at = CURRENT_TIMESTAMP,
      validated_by = ?
    WHERE id = ?
  `;

  if (connection) {
    await connection.query(updateSql, [validatedBy, id]);
    const [rows] = await connection.query<PayrunRow[]>(`${PAYRUN_SELECT} WHERE p.id = ? LIMIT 1`, [id]);
    if (!rows || rows.length === 0) return null;
    return mapRowToRecord(rows[0]);
  } else {
    await executeQuery(updateSql, [validatedBy, id]);
    return getPayrunById(id);
  }
}

/**
 * Marks a payrun as PAID in MySQL with payment audit metadata (status = 'PAID', paid_at, paid_by, payment_reference).
 */
export async function payPayrunRecord(
  id: string,
  paidBy: string,
  paymentReference?: string | null,
  connection?: PoolConnection
): Promise<PayrunRecord | null> {
  const updateSql = `
    UPDATE payruns
    SET
      status = 'PAID',
      paid_at = CURRENT_TIMESTAMP,
      paid_by = ?,
      payment_reference = ?
    WHERE id = ?
  `;

  const ref = paymentReference || null;
  if (connection) {
    await connection.query(updateSql, [paidBy, ref, id]);
    const [rows] = await connection.query<PayrunRow[]>(`${PAYRUN_SELECT} WHERE p.id = ? LIMIT 1`, [id]);
    if (!rows || rows.length === 0) return null;
    return mapRowToRecord(rows[0]);
  } else {
    await executeQuery(updateSql, [paidBy, ref, id]);
    return getPayrunById(id);
  }
}



