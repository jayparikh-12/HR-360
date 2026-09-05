/**
 * Working Schedule Repository — Data-access layer for the working_schedules table.
 *
 * Responsibilities:
 * - All SQL for working schedule operations lives here, not in route handlers.
 * - Uses parameterized queries exclusively.
 * - Uses the centralized pool via executeQuery — never opens a second connection.
 * - Maps live MySQL column names to the API response shape.
 * - Never leaks SQL statements, stack traces, or credentials to callers.
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { executeQuery } from '../config/database.js';
import { randomUUID } from 'node:crypto';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Raw row shape returned by MySQL working_schedules queries.
 */
export interface ScheduleRow extends RowDataPacket {
  id: string;
  name: string;
  weekly_hours: number | string | null;
  created_at: Date | string | null;
}

/**
 * Safe schedule shape returned to route handlers and API clients.
 */
export interface ScheduleRecord {
  id: string;
  name: string;
  weeklyHours: number;
  workingHours: string;
}

/**
 * Input shape for creating a new working schedule.
 */
export interface CreateScheduleInput {
  name: string;
  workingHours?: string | number;
  weeklyHours?: number;
}

// ── SQL ──────────────────────────────────────────────────────────────────────

const SCHEDULE_SELECT = `
  SELECT
    id,
    name,
    weekly_hours,
    created_at
  FROM working_schedules
`;

// ── Repository functions ─────────────────────────────────────────────────────

/**
 * Returns all working schedules ordered by name ASC for deterministic listing.
 * Handles an empty table gracefully (returns []).
 * Throws a sanitized Error on database failure (via executeQuery).
 */
export async function getAllSchedules(): Promise<ScheduleRecord[]> {
  const sql = `${SCHEDULE_SELECT} ORDER BY name ASC`;
  const rows = await executeQuery<ScheduleRow[]>(sql, []);
  return rows.map(mapRowToRecord);
}

/**
 * Returns a single schedule by exact ID match, or null if not found.
 * Uses a parameterized query; never interpolates the caller's id value.
 * Throws a sanitized Error on database failure.
 */
export async function getScheduleById(id: string): Promise<ScheduleRecord | null> {
  const sql = `${SCHEDULE_SELECT} WHERE id = ? LIMIT 1`;
  const rows = await executeQuery<ScheduleRow[]>(sql, [id]);
  if (!rows || rows.length === 0) return null;
  return mapRowToRecord(rows[0]);
}

/**
 * Creates a new working schedule in MySQL.
 * - id is a new UUID v4.
 * - Returns the created record.
 * - Throws Error('DUPLICATE_SCHEDULE') if name already exists.
 * - Throws a sanitized Error on other database failures.
 */
export async function createSchedule(input: CreateScheduleInput): Promise<ScheduleRecord> {
  const normalizedName = input.name.trim();

  // Check for duplicate name before inserting
  const exists = await scheduleNameExists(normalizedName);
  if (exists) {
    throw new Error('DUPLICATE_SCHEDULE');
  }

  const id = `SCH-${randomUUID().slice(0, 8).toUpperCase()}`;
  const weeklyHours = input.weeklyHours || (typeof input.workingHours === 'number' ? input.workingHours : parseFloat(String(input.workingHours || '40'))) || 40.0;

  await executeQuery<ResultSetHeader>(
    `INSERT INTO working_schedules (id, name, weekly_hours) VALUES (?, ?, ?)`,
    [id, normalizedName, weeklyHours]
  );

  const created = await getScheduleById(id);
  if (!created) throw new Error('Database operation failed. Please try again.');
  return created;
}

// ── Uniqueness helpers ───────────────────────────────────────────────────────

/**
 * Checks whether a schedule name already exists in the working_schedules table.
 * Returns true if a conflict exists.
 */
async function scheduleNameExists(name: string): Promise<boolean> {
  const normalized = name.toLowerCase();
  const sql = 'SELECT id FROM working_schedules WHERE LOWER(name) = ? LIMIT 1';
  const rows = await executeQuery<RowDataPacket[]>(sql, [normalized]);
  return rows.length > 0;
}

// ── Row mapping ─────────────────────────────────────────────────────────────

/**
 * Maps a raw MySQL row to the safe ScheduleRecord API shape.
 */
function mapRowToRecord(row: ScheduleRow): ScheduleRecord {
  const weeklyHoursNum = row.weekly_hours !== null ? Number(row.weekly_hours) : 40.0;
  return {
    id: row.id,
    name: row.name,
    weeklyHours: isNaN(weeklyHoursNum) ? 40.0 : weeklyHoursNum,
    workingHours: `${isNaN(weeklyHoursNum) ? 40.0 : weeklyHoursNum}h`,
  };
}