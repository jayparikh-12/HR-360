/**
 * PeoplePay360 — Centralized JWT Configuration
 *
 * Single source of truth for JWT signing and verification options.
 * Prevents algorithm confusion and hardcoded production secret vulnerabilities.
 */

import type jwt from 'jsonwebtoken';

const DEFAULT_DEV_SECRET = 'peoplepay360-hackathon-jwt-secret-2026';

function resolveJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!envSecret || envSecret === DEFAULT_DEV_SECRET)) {
    throw new Error('[Security Error] A strong, unique JWT_SECRET environment variable is required in production.');
  }
  return envSecret || DEFAULT_DEV_SECRET;
}

export const JWT_SECRET = resolveJwtSecret();
export const JWT_ALGORITHM: jwt.Algorithm = 'HS256';
export const JWT_EXPIRES_IN: jwt.SignOptions['expiresIn'] =
  (process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']) || '24h';

export const JWT_VERIFY_OPTIONS: jwt.VerifyOptions = {
  algorithms: [JWT_ALGORITHM],
};

export const JWT_SIGN_OPTIONS: jwt.SignOptions = {
  algorithm: JWT_ALGORITHM,
  expiresIn: JWT_EXPIRES_IN,
};
