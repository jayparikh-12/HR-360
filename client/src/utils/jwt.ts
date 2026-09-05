/**
 * PeoplePay360 JWT Security Utilities
 *
 * Lightweight, zero-dependency utilities to safely inspect JWT claims,
 * determine expiration status, and calculate remaining session lifetimes.
 */

export interface DecodedJwtPayload {
  userId?: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
}

/**
 * Safely parses the payload of a JSON Web Token without external libraries.
 * Handles base64url encoding and standard UTF-8 character sequences.
 */
export function parseJwtPayload(token: string | null | undefined): DecodedJwtPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLength);

    const jsonPayload = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (_err) {
    return null;
  }
}

/**
 * Checks whether a given JWT token is expired.
 * If the token cannot be parsed or lacks an `exp` claim, it is treated as expired.
 *
 * @param token JWT token string
 * @param clockToleranceSeconds Optional tolerance in seconds (default: 0)
 */
export function isTokenExpired(token: string | null | undefined, clockToleranceSeconds: number = 0): boolean {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    return true;
  }

  const expirationTimestampMs = (payload.exp - clockToleranceSeconds) * 1000;
  return Date.now() >= expirationTimestampMs;
}

/**
 * Returns the remaining lifetime of a JWT token in milliseconds.
 * Returns 0 if expired or invalid.
 *
 * @param token JWT token string
 */
export function getTokenRemainingMs(token: string | null | undefined): number {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    return 0;
  }

  const remainingMs = payload.exp * 1000 - Date.now();
  return Math.max(0, remainingMs);
}
