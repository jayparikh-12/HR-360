/**
 * PeoplePay360 — Salary Rule API Module
 *
 * Centralized typed wrappers for /api/salary-rules endpoints.
 * Automatically attaches Authorization: Bearer <token> via apiFetch.
 */

import { apiFetch } from './client';

export interface SalaryRule {
  id: string;
  structureId: string | null;
  name: string;
  code: string;
  sequence: number;
  category: 'BASIC' | 'ALLOWANCE' | 'GROSS' | 'DEDUCTION' | 'NET' | string;
  calculationType: 'FIXED' | 'PERCENTAGE' | 'FORMULA' | string;
  amount: number | null;
  percentage: number | null;
  formula: string | null;
  structureName?: string | null;
  structureCode?: string | null;
  salaryStructure?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface SalaryRuleListResponse {
  success: boolean;
  data: SalaryRule[];
  message?: string;
}

export interface SalaryRuleDetailResponse {
  success: boolean;
  data: SalaryRule;
  message?: string;
}

export interface CreateSalaryRulePayload {
  id?: string;
  structureId: string;
  name: string;
  code: string;
  sequence: number;
  category: 'BASIC' | 'ALLOWANCE' | 'GROSS' | 'DEDUCTION' | 'NET' | string;
  calculationType: 'FIXED' | 'PERCENTAGE' | 'FORMULA' | string;
  amount?: number | null;
  percentage?: number | null;
  formula?: string | null;
}

export const salaryRulesApi = {
  /**
   * Fetch all salary rules from MySQL.
   * Optionally filtered by structureId.
   * Returns an empty array if the table is empty.
   */
  async getAll(structureId?: string): Promise<SalaryRule[]> {
    const query = structureId ? `?structureId=${encodeURIComponent(structureId)}` : '';
    const response = await apiFetch<SalaryRuleListResponse>(`/api/salary-rules${query}`);
    return response.data ?? [];
  },

  /**
   * Fetch a single salary rule by ID.
   */
  async getById(id: string): Promise<SalaryRule> {
    const response = await apiFetch<SalaryRuleDetailResponse>(`/api/salary-rules/${encodeURIComponent(id)}`);
    return response.data;
  },

  /**
   * Create a new salary rule in MySQL.
   * Throws ApiError with statusCode 409 if code or ID already exists in the structure.
   * Throws ApiError with statusCode 404 if salary structure doesn't exist.
   * Throws ApiError with statusCode 400 for validation failures.
   */
  async create(payload: CreateSalaryRulePayload): Promise<SalaryRule> {
    const response = await apiFetch<SalaryRuleDetailResponse>('/api/salary-rules', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
};
