/**
 * PeoplePay360 — Authorization Middleware
 *
 * Provides the `authorize(permission)` factory for route-level permission checks.
 *
 * Architecture:
 *   authenticateToken  →  req.user is populated
 *        ↓
 *   authorize(PERMISSION)  →  checks role against ROLE_PERMISSIONS map
 *        ↓
 *   route handler
 *
 * This module owns ONLY authorization (permission checking).
 * Authentication (token validation) is handled separately in authenticate.ts.
 *
 * HTTP status conventions:
 *   401 — Not authenticated (no valid token) — handled by authenticateToken
 *   403 — Authenticated but lacks required permission — handled here
 */

import type { Request, Response, NextFunction } from 'express';
import type { AppPermission } from '../types/rbac.js';
import { roleHasPermission } from '../config/permissions.js';

/**
 * authorize(permission) — Express middleware factory
 *
 * Must be used AFTER `authenticateToken` in the middleware chain.
 * If `req.user` is missing (authenticateToken not applied), fails safely with 401.
 *
 * Usage:
 *   import { authenticateToken } from '../middleware/authenticate.js';
 *   import { authorize } from '../middleware/authorize.js';
 *   import { PERMISSIONS } from '../types/rbac.js';
 *
 *   router.get(
 *     '/employees',
 *     authenticateToken,
 *     authorize(PERMISSIONS.EMPLOYEE_READ),
 *     handler
 *   );
 */
export function authorize(permission: AppPermission) {
  return function (req: Request, res: Response, next: NextFunction): void {
    // Guard: if called without authenticateToken in the chain
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in.',
      });
      return;
    }

    const { role } = req.user;

    // Safely deny unknown or missing roles
    if (!role) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
      return;
    }

    // Check permission against the role's permission set
    if (!roleHasPermission(role, permission)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
      return;
    }

    // Permission granted — proceed to route handler
    next();
  };
}
