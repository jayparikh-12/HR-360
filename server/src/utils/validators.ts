/**
 * Shared Backend Input Validators & Error Response Formatters
 *
 * Provides strict, reusable type guards, date/email sanitizers,
 * and standard error response formatters adhering to Phase 7.2 API contract.
 */

import { Response } from 'express';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const PERIOD_REGEX = /^\d{4}-\d{2}$/;

/**
 * Validates whether input is a non-empty string and does not exceed maximum length.
 */
export function isNonEmptyString(val: unknown, maxLen = 255): val is string {
  return typeof val === 'string' && val.trim().length > 0 && val.trim().length <= maxLen;
}

/**
 * Validates RFC-5322 compatible email strings.
 */
export function isValidEmail(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return trimmed.length <= 191 && EMAIL_REGEX.test(trimmed);
}

/**
 * Validates ISO-8601 calendar dates formatted as YYYY-MM-DD.
 * Ensures the date is syntactically valid and calendar-consistent.
 */
export function isValidDateString(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!DATE_REGEX.test(trimmed)) return false;

  const [year, month, day] = trimmed.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

/**
 * Validates payroll period string (e.g. '2026-09' or 'ALL' or '2026-09-01_2026-09-30').
 */
export function isValidPeriodString(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.length === 0 || trimmed.length > 50) return false;
  if (trimmed.toUpperCase() === 'ALL') return true;
  if (PERIOD_REGEX.test(trimmed)) {
    const [year, month] = trimmed.split('-').map(Number);
    return month >= 1 && month <= 12 && year >= 2000 && year <= 2100;
  }
  // Also support full ISO date ranges if used in some payruns (e.g. 2026-09-01)
  if (DATE_REGEX.test(trimmed)) return isValidDateString(trimmed);
  return false;
}

/**
 * Validates numeric wages and monetary amounts (non-negative and below DECIMAL(12,2) overflow).
 */
export function isNonNegativeNumber(val: unknown, max = 999999999.99): boolean {
  if (val === undefined || val === null || val === '') return false;
  const num = Number(val);
  return !isNaN(num) && isFinite(num) && num >= 0 && num <= max;
}

/**
 * Validates positive integers (e.g. durationDays >= 1).
 */
export function isPositiveInteger(val: unknown, max = 365): boolean {
  if (val === undefined || val === null || val === '') return false;
  const num = Number(val);
  return !isNaN(num) && isFinite(num) && Number.isInteger(num) && num > 0 && num <= max;
}

/**
 * Validates enum members.
 */
export function isValidEnum<T extends string>(val: unknown, allowedValues: ReadonlySet<T> | readonly T[]): val is T {
  if (typeof val !== 'string') return false;
  const upper = val.trim().toUpperCase();
  if (allowedValues instanceof Set) {
    return allowedValues.has(upper as T);
  }
  return (allowedValues as readonly string[]).includes(upper);
}

/**
 * Standardized predictable validation error response (400 Bad Request).
 */
export function sendValidationError(
  res: Response,
  message: string,
  details?: unknown[],
  code = 'VALIDATION_ERROR'
): void {
  res.status(400).json({
    success: false,
    message,
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
    },
  });
}

/**
 * Standardized predictable conflict error response (409 Conflict).
 */
export function sendConflictError(
  res: Response,
  message: string,
  code = 'CONFLICT'
): void {
  res.status(409).json({
    success: false,
    message,
    error: {
      code,
      message,
    },
  });
}

/**
 * Standardized predictable not found error response (404 Not Found).
 */
export function sendNotFoundError(
  res: Response,
  message: string,
  code = 'NOT_FOUND'
): void {
  res.status(404).json({
    success: false,
    message,
    error: {
      code,
      message,
    },
  });
}
