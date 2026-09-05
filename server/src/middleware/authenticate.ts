/**
 * PeoplePay360 — Authentication Middleware
 *
 * Validates the Bearer token from the Authorization header and attaches the
 * decoded user payload to `req.user` for downstream middleware and route handlers.
 *
 * Re-exports the unified authenticateToken implementation from auth.middleware.js
 * ensuring 100% compatibility across both JWT and RBAC subsystems.
 */

export { authenticateToken } from './auth.middleware.js';
