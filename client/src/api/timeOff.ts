/**
 * PeoplePay360 — Time Off API Module
 *
 * Centralized typed wrappers for /api/time-off endpoints.
 * Automatically attaches Authorization: Bearer <token> via apiFetch.
 */

import { apiFetch } from './client';
import type { TimeOffRequest } from '../types';

export interface TimeOffListResponse {
  success: boolean;
  data: TimeOffRequest[];
  message?: string;
}

export interface TimeOffDetailResponse {
  success: boolean;
  data: TimeOffRequest;
  message?: string;
}

export interface CreateTimeOffPayload {
  id?: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  durationDays?: number;
  reason?: string;
}

export const timeOffApi = {
  /**
   * Fetch all time-off requests from MySQL.
   * Returns an empty array if the table is empty.
   */
  async getAll(): Promise<TimeOffRequest[]> {
    const response = await apiFetch<TimeOffListResponse>('/api/time-off');
    return response.data ?? [];
  },

  /**
   * Fetch a single time-off request by ID.
   */
  async getById(id: string): Promise<TimeOffRequest> {
    const response = await apiFetch<TimeOffDetailResponse>(`/api/time-off/${encodeURIComponent(id)}`);
    return response.data;
  },

  /**
   * Submit a new time-off request.
   * Throws ApiError with statusCode 404 if employee does not exist.
   * Throws ApiError with statusCode 400 for validation errors.
   */
  async create(payload: CreateTimeOffPayload): Promise<TimeOffRequest> {
    const response = await apiFetch<TimeOffDetailResponse>('/api/time-off', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  /**
   * Approve a pending time-off request.
   * Throws ApiError with statusCode 400 if not in PENDING status.
   */
  async approve(id: string): Promise<TimeOffRequest> {
    const response = await apiFetch<TimeOffDetailResponse>(`/api/time-off/${encodeURIComponent(id)}/approve`, {
      method: 'PATCH',
    });
    return response.data;
  },

  /**
   * Refuse a pending time-off request.
   * Throws ApiError with statusCode 400 if not in PENDING status.
   */
  async refuse(id: string): Promise<TimeOffRequest> {
    const response = await apiFetch<TimeOffDetailResponse>(`/api/time-off/${encodeURIComponent(id)}/refuse`, {
      method: 'PATCH',
    });
    return response.data;
  },
};
