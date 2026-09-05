/**
 * Payroll Snapshot Repository — Data-access layer for calculation snapshots & payslip records.
 *
 * Responsibilities:
 * - Persisting immutable historical calculation snapshots into MySQL `payslips`.
 * - Parameterized queries exclusively via centralized executeQuery pool.
 * - Enforcing application-level immutability: Finalized snapshots ('VALIDATED', 'PAID') cannot be updated.
 * - Idempotency: Supports versioned recalculation updates in 'DRAFT' and 'COMPUTED' states.
 * - Parsing JSON breakdowns and calculation snapshots reliably.
 */

import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import { executeQuery } from '../config/database.js';
import { randomUUID } from 'node:crypto';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BreakdownItem {
  ruleCode: string;
  ruleName: string;
  category: string;
  amount: number;
}

export interface PayrollSnapshotRecord {
  id: string;
  payrunId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  periodStart: string | null;
  periodEnd: string | null;
  contractWage: number;
  basic: number;
  hra: number;
  allowance: number;
  gross: number;
  tax: number;
  otherDeductions: number;
  net: number;
  earningsBreakdown: BreakdownItem[];
  deductionsBreakdown: BreakdownItem[];
  calculationSnapshot: Record<string, unknown> | null;
  calculationTimestamp: string;
  calculationVersion: number;
  status: string;
  warning?: string | null;
}

export interface CreateSnapshotRowInput {
  id?: string;
  payrunId: string;
  employeeId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  contractWage: number;
  basic: number;
  hra: number;
  allowance: number;
  gross: number;
  tax: number;
  otherDeductions: number;
  net: number;
  earningsBreakdown: BreakdownItem[];
  deductionsBreakdown: BreakdownItem[];
  calculationSnapshot: Record<string, unknown>;
  calculationVersion?: number;
  status?: string;
  warning?: string | null;
}

interface RawPayslipSnapshotRow extends RowDataPacket {
  id: string;
  payrun_id: string;
  employee_id: string;
  employee_name?: string | null;
  department?: string | null;
  period_start: Date | string | null;
  period_end: Date | string | null;
  contract_wage: number | string | null;
  basic: number | string;
  hra: number | string;
  allowance: number | string;
  gross: number | string;
  tax: number | string;
  other_deductions: number | string;
  net: number | string;
  earnings_breakdown: unknown;
  deductions_breakdown: unknown;
  calculation_snapshot: unknown;
  calculation_timestamp: Date | string | null;
  calculation_version: number | string | null;
  status: string;
  warning: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseSafeJson<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function formatDate(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (str.includes('T')) return str.split('T')[0];
  return str;
}

function formatTimestamp(val: Date | string | null | undefined): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : parseFloat(String(v)) || 0;
}

function mapRowToSnapshot(row: RawPayslipSnapshotRow): PayrollSnapshotRecord {
  const calcSnapshot = parseSafeJson<Record<string, unknown> | null>(row.calculation_snapshot, null);
  const snapshotEmp = (calcSnapshot as any)?.employee;

  return {
    id: row.id,
    payrunId: row.payrun_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name && String(row.employee_name).trim().length > 0
      ? String(row.employee_name).trim()
      : (snapshotEmp?.name ? String(snapshotEmp.name).trim() : row.employee_id),
    department: row.department && String(row.department).trim().length > 0
      ? String(row.department).trim()
      : (snapshotEmp?.department ? String(snapshotEmp.department).trim() : 'General'),
    periodStart: formatDate(row.period_start),
    periodEnd: formatDate(row.period_end),
    contractWage: num(row.contract_wage),
    basic: num(row.basic),
    hra: num(row.hra),
    allowance: num(row.allowance),
    gross: num(row.gross),
    tax: num(row.tax),
    otherDeductions: num(row.other_deductions),
    net: num(row.net),
    earningsBreakdown: parseSafeJson<BreakdownItem[]>(row.earnings_breakdown, []),
    deductionsBreakdown: parseSafeJson<BreakdownItem[]>(row.deductions_breakdown, []),
    calculationSnapshot: parseSafeJson<Record<string, unknown> | null>(row.calculation_snapshot, null),
    calculationTimestamp: formatTimestamp(row.calculation_timestamp),
    calculationVersion: Number(row.calculation_version) || 1,
    status: row.status || 'DRAFT',
    warning: row.warning || null,
  };
}

const SNAPSHOT_SELECT = `
  SELECT
    p.id,
    p.payrun_id,
    p.employee_id,
    COALESCE(e.name, '') AS employee_name,
    COALESCE(e.department, '') AS department,
    p.period_start,
    p.period_end,
    p.contract_wage,
    p.basic,
    p.hra,
    p.allowance,
    p.gross,
    p.tax,
    p.other_deductions,
    p.net,
    p.earnings_breakdown,
    p.deductions_breakdown,
    p.calculation_snapshot,
    p.calculation_timestamp,
    p.calculation_version,
    p.status,
    p.warning
  FROM payslips p
  LEFT JOIN employees e ON e.id = p.employee_id
`;

// ── Repository API ───────────────────────────────────────────────────────────

async function runQuery<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params: unknown[] = [],
  connection?: PoolConnection
): Promise<T> {
  if (connection) {
    const [results] = await connection.query<T>(sql, params);
    return results;
  }
  return executeQuery<T>(sql, params);
}

/**
 * Finds an existing payslip snapshot for a specific payrun and employee.
 */
export async function findExistingSnapshot(
  payrunId: string,
  employeeId: string,
  connection?: PoolConnection
): Promise<PayrollSnapshotRecord | null> {
  const sql = `${SNAPSHOT_SELECT} WHERE p.payrun_id = ? AND p.employee_id = ? LIMIT 1`;
  const rows = await runQuery<RawPayslipSnapshotRow[]>(sql, [payrunId, employeeId], connection);
  if (!rows || rows.length === 0) return null;
  return mapRowToSnapshot(rows[0]);
}

/**
 * Persists a calculation snapshot.
 *
 * Immutability:
 * - If an existing record is finalized ('VALIDATED' or 'PAID'), throws IMMUTABLE_SNAPSHOT_FINALIZED.
 *
 * Idempotency:
 * - If an existing record is in 'DRAFT' or 'COMPUTED', updates the record and increments calculation_version.
 * - If no record exists, inserts a new record with calculation_version = 1.
 */
export async function createOrUpdatePayrollSnapshot(
  input: CreateSnapshotRowInput,
  connection?: PoolConnection
): Promise<PayrollSnapshotRecord> {
  const existing = await findExistingSnapshot(input.payrunId, input.employeeId, connection);

  if (existing) {
    if (existing.status === 'VALIDATED' || existing.status === 'PAID') {
      throw new Error(
        `IMMUTABLE_SNAPSHOT_FINALIZED: Cannot modify or recalculate snapshot for employee '${input.employeeId}' in payrun '${input.payrunId}' because it has been finalized (status: ${existing.status}).`
      );
    }

    const nextVersion = (existing.calculationVersion || 1) + 1;
    const now = new Date();

    const updateSql = `
      UPDATE payslips
      SET
        period_start = ?,
        period_end = ?,
        contract_wage = ?,
        basic = ?,
        hra = ?,
        allowance = ?,
        gross = ?,
        tax = ?,
        other_deductions = ?,
        net = ?,
        earnings_breakdown = ?,
        deductions_breakdown = ?,
        calculation_snapshot = ?,
        calculation_timestamp = ?,
        calculation_version = ?,
        status = ?,
        warning = ?
      WHERE id = ?
    `;

    await runQuery(
      updateSql,
      [
        input.periodStart || null,
        input.periodEnd || null,
        input.contractWage,
        input.basic,
        input.hra,
        input.allowance,
        input.gross,
        input.tax,
        input.otherDeductions,
        input.net,
        JSON.stringify(input.earningsBreakdown || []),
        JSON.stringify(input.deductionsBreakdown || []),
        JSON.stringify(input.calculationSnapshot || {}),
        now,
        nextVersion,
        input.status || existing.status || 'DRAFT',
        input.warning !== undefined ? input.warning : existing.warning || null,
        existing.id,
      ],
      connection
    );

    const updated = await getPayrollSnapshotById(existing.id, connection);
    if (!updated) throw new Error('Failed to retrieve updated snapshot record.');
    return updated;
  }

  // Insert fresh snapshot
  const id = input.id?.trim() || `PSL-${randomUUID().slice(0, 8).toUpperCase()}`;
  const version = input.calculationVersion || 1;
  const now = new Date();

  const insertSql = `
    INSERT INTO payslips (
      id,
      payrun_id,
      employee_id,
      period_start,
      period_end,
      contract_wage,
      basic,
      hra,
      allowance,
      gross,
      tax,
      other_deductions,
      net,
      earnings_breakdown,
      deductions_breakdown,
      calculation_snapshot,
      calculation_timestamp,
      calculation_version,
      status,
      warning
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await runQuery(
    insertSql,
    [
      id,
      input.payrunId,
      input.employeeId,
      input.periodStart || null,
      input.periodEnd || null,
      input.contractWage,
      input.basic,
      input.hra,
      input.allowance,
      input.gross,
      input.tax,
      input.otherDeductions,
      input.net,
      JSON.stringify(input.earningsBreakdown || []),
      JSON.stringify(input.deductionsBreakdown || []),
      JSON.stringify(input.calculationSnapshot || {}),
      now,
      version,
      input.status || 'DRAFT',
      input.warning || null,
    ],
    connection
  );

  const created = await getPayrollSnapshotById(id, connection);
  if (!created) throw new Error('Failed to retrieve newly created snapshot record.');
  return created;
}

/**
 * Retrieves a single payroll calculation snapshot by primary key.
 */
export async function getPayrollSnapshotById(
  id: string,
  connection?: PoolConnection
): Promise<PayrollSnapshotRecord | null> {
  const sql = `${SNAPSHOT_SELECT} WHERE p.id = ? LIMIT 1`;
  const rows = await runQuery<RawPayslipSnapshotRow[]>(sql, [id], connection);
  if (!rows || rows.length === 0) return null;
  return mapRowToSnapshot(rows[0]);
}

/**
 * Retrieves all snapshots belonging to a payrun batch.
 */
export async function getPayrollSnapshotsByPayrun(payrunId: string): Promise<PayrollSnapshotRecord[]> {
  const sql = `${SNAPSHOT_SELECT} WHERE p.payrun_id = ? ORDER BY COALESCE(e.name, p.employee_id) ASC`;
  const rows = await executeQuery<RawPayslipSnapshotRow[]>(sql, [payrunId]);
  return rows.map(mapRowToSnapshot);
}

/**
 * Retrieves historical payroll snapshots for an employee in reverse chronological order.
 */
export async function getPayrollHistoryByEmployee(employeeId: string): Promise<PayrollSnapshotRecord[]> {
  const sql = `${SNAPSHOT_SELECT} WHERE p.employee_id = ? ORDER BY p.period_start DESC, p.calculation_timestamp DESC, p.id DESC`;
  const rows = await executeQuery<RawPayslipSnapshotRow[]>(sql, [employeeId]);
  return rows.map(mapRowToSnapshot);
}

// ── Detailed Payslip Types & Queries (Phase 5.5) ─────────────────────────────

export interface DetailedPayslipRecord {
  payslipId: string;
  payrunId: string;
  payrunName: string;
  payrunPeriod: string;
  employee: {
    id: string;
    employeeId: string;
    name: string;
    department: string;
    position: string;
  };
  payrollPeriod: {
    start: string | null;
    end: string | null;
  };
  status: string;
  payrunStatus: string;
  baseSalary: number;
  earnings: BreakdownItem[];
  deductions: BreakdownItem[];
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  calculatedAt: string;
  validatedAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  warning?: string | null;
  calculationSnapshot?: Record<string, unknown> | null;
}

interface RawDetailedPayslipRow extends RowDataPacket {
  payslip_id: string;
  payrun_id: string;
  payrun_name: string | null;
  payrun_period: string | null;
  payrun_status: string | null;
  validated_at: Date | string | null;
  validated_by: string | null;
  paid_at: Date | string | null;
  paid_by: string | null;
  payment_reference: string | null;
  employee_id: string;
  emp_id: string;
  employee_name: string | null;
  department: string | null;
  position: string | null;
  period_start: Date | string | null;
  period_end: Date | string | null;
  contract_wage: number | string | null;
  basic: number | string;
  hra: number | string;
  allowance: number | string;
  gross: number | string;
  tax: number | string;
  other_deductions: number | string;
  net: number | string;
  earnings_breakdown: unknown;
  deductions_breakdown: unknown;
  calculation_snapshot: unknown;
  calculation_timestamp: Date | string | null;
  calculation_version: number | string | null;
  payslip_status: string;
  warning: string | null;
}

const DETAILED_PAYSLIP_SELECT = `
  SELECT
    p.id AS payslip_id,
    p.payrun_id,
    COALESCE(pr.name, '') AS payrun_name,
    COALESCE(pr.period, '') AS payrun_period,
    COALESCE(pr.status, p.status) AS payrun_status,
    pr.validated_at,
    pr.validated_by,
    pr.paid_at,
    pr.paid_by,
    pr.payment_reference,
    p.employee_id,
    COALESCE(e.id, p.employee_id) AS emp_id,
    COALESCE(e.name, '') AS employee_name,
    COALESCE(e.department, '') AS department,
    COALESCE(e.position, '') AS position,
    p.period_start,
    p.period_end,
    p.contract_wage,
    p.basic,
    p.hra,
    p.allowance,
    p.gross,
    p.tax,
    p.other_deductions,
    p.net,
    p.earnings_breakdown,
    p.deductions_breakdown,
    p.calculation_snapshot,
    p.calculation_timestamp,
    p.calculation_version,
    p.status AS payslip_status,
    p.warning
  FROM payslips p
  LEFT JOIN employees e ON e.id = p.employee_id
  LEFT JOIN payruns pr ON pr.id = p.payrun_id
`;

function mapRowToDetailedPayslip(row: RawDetailedPayslipRow): DetailedPayslipRecord {
  const calcSnap = parseSafeJson<Record<string, any> | null>(row.calculation_snapshot, null);
  const snapEmployee = calcSnap?.employee || {};

  const resolvedName =
    row.employee_name && row.employee_name.trim()
      ? row.employee_name.trim()
      : snapEmployee.name || row.employee_id;

  const resolvedDept =
    row.department && row.department.trim()
      ? row.department.trim()
      : snapEmployee.department || 'General';

  const resolvedPosition =
    row.position && row.position.trim()
      ? row.position.trim()
      : snapEmployee.jobPosition || snapEmployee.position || 'Staff';

  const tax = num(row.tax);
  const otherDed = num(row.other_deductions);
  const totalDeductions = tax + otherDed;
  const resolvedStatus = row.payrun_status || row.payslip_status || 'DRAFT';

  return {
    payslipId: row.payslip_id,
    payrunId: row.payrun_id,
    payrunName: row.payrun_name || `Payrun ${row.payrun_id}`,
    payrunPeriod: row.payrun_period || '',
    employee: {
      id: row.emp_id || row.employee_id,
      employeeId: row.employee_id,
      name: resolvedName,
      department: resolvedDept,
      position: resolvedPosition,
    },
    payrollPeriod: {
      start: formatDate(row.period_start),
      end: formatDate(row.period_end),
    },
    status: resolvedStatus,
    payrunStatus: row.payrun_status || resolvedStatus,
    baseSalary: num(row.contract_wage),
    earnings: parseSafeJson<BreakdownItem[]>(row.earnings_breakdown, []),
    deductions: parseSafeJson<BreakdownItem[]>(row.deductions_breakdown, []),
    grossSalary: num(row.gross),
    totalDeductions,
    netSalary: num(row.net),
    calculatedAt: formatTimestamp(row.calculation_timestamp),
    validatedAt: row.validated_at ? formatTimestamp(row.validated_at) : null,
    paidAt: row.paid_at ? formatTimestamp(row.paid_at) : null,
    paymentReference: row.payment_reference || null,
    warning: row.warning || null,
    calculationSnapshot: calcSnap,
  };
}

/**
 * Retrieves a detailed payslip by its primary key.
 */
export async function getDetailedPayslipById(
  id: string,
  connection?: PoolConnection
): Promise<DetailedPayslipRecord | null> {
  const sql = `${DETAILED_PAYSLIP_SELECT} WHERE p.id = ? LIMIT 1`;
  const rows = await runQuery<RawDetailedPayslipRow[]>(sql, [id], connection);
  if (!rows || rows.length === 0) return null;
  return mapRowToDetailedPayslip(rows[0]);
}

/**
 * Retrieves a detailed payslip by payrun ID and employee ID.
 */
export async function getDetailedPayslipByPayrunAndEmployee(
  payrunId: string,
  employeeId: string,
  connection?: PoolConnection
): Promise<DetailedPayslipRecord | null> {
  const sql = `${DETAILED_PAYSLIP_SELECT} WHERE p.payrun_id = ? AND p.employee_id = ? LIMIT 1`;
  const rows = await runQuery<RawDetailedPayslipRow[]>(sql, [payrunId, employeeId], connection);
  if (!rows || rows.length === 0) return null;
  return mapRowToDetailedPayslip(rows[0]);
}

/**
 * Retrieves all detailed payslips for an employee, sorted newest period first.
 */
export async function getDetailedHistoryByEmployee(
  employeeId: string,
  connection?: PoolConnection
): Promise<DetailedPayslipRecord[]> {
  const sql = `${DETAILED_PAYSLIP_SELECT} WHERE p.employee_id = ? ORDER BY p.period_start DESC, p.calculation_timestamp DESC, p.id DESC`;
  const rows = await runQuery<RawDetailedPayslipRow[]>(sql, [employeeId], connection);
  return rows.map(mapRowToDetailedPayslip);
}
