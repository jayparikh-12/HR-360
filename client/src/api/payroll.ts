/**
 * PeoplePay360 — Payroll / Payrun API Module
 *
 * Centralized typed wrappers for /api/payroll endpoints.
 * Automatically attaches Authorization: Bearer <token> via apiFetch.
 */

import { apiFetch } from './client';
import type { Payrun } from '../types';

export interface PayrunListResponse {
  success: boolean;
  data: Payrun[];
  message?: string;
}

export interface PayrunDetailResponse {
  success: boolean;
  data: Payrun;
  message?: string;
}

export interface CreatePayrunPayload {
  id?: string;
  name: string;
  period: string;
  salaryStructure?: string;
  employeeIds?: string[];
  startDate?: string;
  endDate?: string;
  status?: 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID';
}

export const payrollApi = {
  /**
   * Fetch all payruns from MySQL.
   * Returns an empty array if the table is empty.
   */
  async getAll(): Promise<Payrun[]> {
    const response = await apiFetch<PayrunListResponse>('/api/payroll/payruns');
    return response.data ?? [];
  },

  /**
   * Fetch a single payrun by ID.
   */
  async getById(id: string): Promise<Payrun> {
    const response = await apiFetch<PayrunDetailResponse>(`/api/payroll/payruns/${encodeURIComponent(id)}`);
    return response.data;
  },

  /**
   * Create and persist a new payrun in MySQL.
   */
  async create(payload: CreatePayrunPayload): Promise<Payrun> {
    const response = await apiFetch<PayrunDetailResponse>('/api/payroll/payruns/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  /**
   * Transition payrun status from DRAFT -> VALIDATED.
   */
  async validate(id: string): Promise<Payrun> {
    const response = await apiFetch<PayrunDetailResponse>(`/api/payroll/payruns/${encodeURIComponent(id)}/validate`, {
      method: 'PATCH',
    });
    return response.data;
  },

  /**
   * Transition payrun status from VALIDATED -> PAID.
   */
  async pay(id: string): Promise<Payrun> {
    const response = await apiFetch<PayrunDetailResponse>(`/api/payroll/payruns/${encodeURIComponent(id)}/pay`, {
      method: 'PATCH',
    });
    return response.data;
  },
};
