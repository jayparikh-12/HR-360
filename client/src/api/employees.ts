/**
 * PeoplePay360 — Employee API Module
 *
 * Centralized typed wrappers for /api/employees endpoints.
 * Uses the shared apiFetch abstraction which automatically attaches
 * the Authorization: Bearer <token> header from localStorage.
 */

import { apiFetch } from './client';
import type { Employee, Gender } from '../types';

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

/** Fields accepted by POST /api/employees */
export interface CreateEmployeePayload {
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  jobPosition: string;
  gender?: Gender | null;
  employeeType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';
  status?: 'ACTIVE' | 'INACTIVE';
  phone?: string;
  workingSchedule?: string;
  bankName?: string;
  bankAccountNo?: string;
}

/** Fields accepted by PATCH /api/employees/:id — all optional */
export type UpdateEmployeePayload = Partial<CreateEmployeePayload>;

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

  /**
   * Create a new employee.
   * Throws ApiError with statusCode 409 for duplicate email.
   * Throws ApiError with statusCode 400 for validation errors.
   */
  async create(payload: CreateEmployeePayload): Promise<Employee> {
    const response = await apiFetch<EmployeeDetailResponse>('/api/employees', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  /**
   * Update allowed fields on an existing employee.
   * Throws ApiError with statusCode 404 if not found.
   * Throws ApiError with statusCode 409 for duplicate email.
   */
  async update(id: string, payload: UpdateEmployeePayload): Promise<Employee> {
    const response = await apiFetch<EmployeeDetailResponse>(
      `/api/employees/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
    return response.data;
  },
};
