/**
 * PeoplePay360 — Contract API Module
 *
 * Centralized typed wrappers for /api/contracts endpoints.
 * Uses the shared apiFetch abstraction which automatically attaches
 * the Authorization: Bearer <token> header from localStorage.
 */

import { apiFetch } from './client';
import type { Contract } from '../types';

export interface ContractListResponse {
  success: boolean;
  data: Contract[];
  message?: string;
}

export interface ContractDetailResponse {
  success: boolean;
  data: Contract;
  message?: string;
}

/** Fields accepted by POST /api/contracts */
export interface CreateContractPayload {
  id?: string;
  employeeId: string;
  wage: number;
  startDate: string;
  endDate?: string | null;
  status?: 'ACTIVE' | 'FUTURE' | 'HISTORICAL';
  salaryStructureId?: string;
  workingScheduleId?: string;
}

export const contractsApi = {
  /**
   * Fetch all contracts from MySQL-backed API.
   * Returns an empty array if table is empty.
   */
  async getAll(): Promise<Contract[]> {
    const response = await apiFetch<ContractListResponse>('/api/contracts');
    return response.data ?? [];
  },

  /**
   * Fetch a single contract by ID.
   * Throws ApiError with statusCode 404 if not found.
   */
  async getById(id: string): Promise<Contract> {
    const response = await apiFetch<ContractDetailResponse>(`/api/contracts/${encodeURIComponent(id)}`);
    return response.data;
  },

  /**
   * Create a new contract.
   * Throws ApiError with statusCode 409 for duplicate contract ID or overlapping active contract.
   * Throws ApiError with statusCode 404 if referenced employee does not exist.
   * Throws ApiError with statusCode 400 for validation errors.
   */
  async create(payload: CreateContractPayload): Promise<Contract> {
    const response = await apiFetch<ContractDetailResponse>('/api/contracts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
};
