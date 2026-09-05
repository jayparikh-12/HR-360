/**
 * PeoplePay360 — Salary Structure API Module
 *
 * Centralized typed wrappers for /api/salary-structures endpoints.
 * Automatically attaches Authorization: Bearer <token> via apiFetch.
 */

import { apiFetch } from './client';

export interface SalaryStructure {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  contractCount: number;
}

export interface SalaryStructureListResponse {
  success: boolean;
  data: SalaryStructure[];
  message?: string;
}

export interface SalaryStructureDetailResponse {
  success: boolean;
  data: SalaryStructure;
  message?: string;
}

export interface CreateSalaryStructurePayload {
  id?: string;
  name: string;
  code: string;
  employeeId?: string;
  contractId?: string;
  baseWage?: number;
}

export const salaryStructuresApi = {
  /**
   * Fetch all salary structures from MySQL.
   * Returns an empty array if the table is empty.
   */
  async getAll(): Promise<SalaryStructure[]> {
    const response = await apiFetch<SalaryStructureListResponse>('/api/salary-structures');
    return response.data ?? [];
  },

  /**
   * Fetch a single salary structure by ID.
   */
  async getById(id: string): Promise<SalaryStructure> {
    const response = await apiFetch<SalaryStructureDetailResponse>(`/api/salary-structures/${encodeURIComponent(id)}`);
    return response.data;
  },

  /**
   * Create a new salary structure in MySQL.
   * Throws ApiError with statusCode 409 if code or ID already exists.
   * Throws ApiError with statusCode 400 for validation failures.
   */
  async create(payload: CreateSalaryStructurePayload): Promise<SalaryStructure> {
    const response = await apiFetch<SalaryStructureDetailResponse>('/api/salary-structures', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
};
