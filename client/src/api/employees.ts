/**
 * PeoplePay360 — Employee API Module
 *
 * Centralized typed wrappers for /api/employees endpoints.
 * Uses the shared apiFetch abstraction which automatically attaches
 * the Authorization: Bearer <token> header from localStorage.
 *
 * Only GET operations are exposed — Phase 2.2 scope.
 */

import { apiFetch } from './client';
import type { Employee } from '../types';

export interface EmployeeListResponse {
  success: boolean;
  data: Employee[];
  message?: string;
}

export interface EmployeeDetailResponse {
  success: boolean;
  data: Employee;
  message?: string;
}

export const employeesApi = {
  /**
   * Fetch all employees from MySQL-backed API.
   * Returns an empty array on an empty table.
   */
  async getAll(): Promise<Employee[]> {
    const response = await apiFetch<EmployeeListResponse>('/api/employees');
    return response.data ?? [];
  },

  /**
   * Fetch a single employee by ID.
   * Throws ApiError with statusCode 404 if not found.
   */
  async getById(id: string): Promise<Employee> {
    const response = await apiFetch<EmployeeDetailResponse>(`/api/employees/${encodeURIComponent(id)}`);
    return response.data;
  },
};
