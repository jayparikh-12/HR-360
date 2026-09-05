/**
 * Global Error Handlers & Database Error Wrapper
 *
 * Implements Phase 7.2 requirement to prevent information leakage
 * (raw SQL, stack traces, credentials, paths) and standardize HTTP status codes.
 */

import { Request, Response, NextFunction } from 'express';

interface MysqlError extends Error {
  code?: string;
  errno?: number;
  sqlState?: string;
  sqlMessage?: string;
}

/**
 * 404 Handler for unmatched API routes.
 * Ensures clients receive JSON rather than default Express HTML.
 */
export function apiNotFoundError(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
    error: {
      code: 'NOT_FOUND',
      message: `Resource not found: ${req.method} ${req.originalUrl}`,
    },
  });
}

/**
 * Global Express error handling middleware.
 * Intercepts uncaught exceptions and rejected promises,
 * logs technical telemetry on server-side only, and sends safe client responses.
 */
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(`[Global Error Handler] Error on ${req.method} ${req.originalUrl}:`, err);

  if (res.headersSent) {
    return;
  }

  // Check for malformed JSON body parsed by express.json()
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400 && 'body' in err) {
    res.status(400).json({
      success: false,
      message: 'Malformed JSON payload in request body.',
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON payload in request body.',
      },
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: 'An unexpected internal server error occurred. Please try again later.',
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred. Please try again later.',
    },
  });
}

/**
 * Safe database error mapper.
 * Converts raw MySQL exceptions into safe, clean HTTP status codes and messages
 * without leaking query strings, passwords, or schema details.
 */
export function handleDatabaseError(
  err: unknown,
  res: Response,
  contextMessage = 'Database operation failed.'
): void {
  const dbErr = err as MysqlError;
  const code = dbErr?.code || '';

  console.error(`[Database Error] Code: ${code}, Context: ${contextMessage}`, {
    code: dbErr?.code,
    errno: dbErr?.errno,
    message: dbErr?.message,
  });

  // Duplicate key error
  if (code === 'ER_DUP_ENTRY') {
    res.status(409).json({
      success: false,
      message: 'A duplicate record with conflicting unique fields already exists.',
      error: {
        code: 'DUPLICATE_RESOURCE',
        message: 'A duplicate record with conflicting unique fields already exists.',
      },
    });
    return;
  }

  // Foreign key reference does not exist
  if (code === 'ER_NO_REFERENCED_ROW_2' || code === 'ER_NO_REFERENCED_ROW') {
    res.status(400).json({
      success: false,
      message: 'The requested operation references an entity that does not exist.',
      error: {
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'The requested operation references an entity that does not exist.',
      },
    });
    return;
  }

  // Foreign key constraint prevents delete/update
  if (code === 'ER_ROW_IS_REFERENCED_2' || code === 'ER_ROW_IS_REFERENCED') {
    res.status(409).json({
      success: false,
      message: 'Cannot modify or delete this resource because related dependent records exist.',
      error: {
        code: 'RESOURCE_CONFLICT',
        message: 'Cannot modify or delete this resource because related dependent records exist.',
      },
    });
    return;
  }

  // Data too long for column
  if (code === 'ER_DATA_TOO_LONG') {
    res.status(400).json({
      success: false,
      message: 'One or more input fields exceed the maximum allowable length.',
      error: {
        code: 'DATA_TOO_LONG',
        message: 'One or more input fields exceed the maximum allowable length.',
      },
    });
    return;
  }

  // Fallback safe 500 error
  res.status(500).json({
    success: false,
    message: 'An unexpected database error occurred. Please try again.',
    error: {
      code: 'DATABASE_ERROR',
      message: 'An unexpected database error occurred. Please try again.',
    },
  });
}
