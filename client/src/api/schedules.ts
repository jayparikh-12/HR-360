/**
 * PeoplePay360 — Working Schedule API Module
 *
 * Centralized typed wrappers for /api/schedules endpoints.
 * Automatically attaches Authorization: Bearer <token> via apiFetch.
 */

import { apiFetch } from './client';

export interface ScheduleRecord {
  id: string;
  name: string;
  weeklyHours: number;
  workingHours: string;
}

export interface ScheduleListResponse {
  success: boolean;
  data: ScheduleRecord[];
  message?: string;
}

export interface ScheduleDetailResponse {
  success: boolean;
  data: ScheduleRecord;
  message?: string;
}

export interface CreateSchedulePayload {
  name: string;
  workingHours: string;
  weeklyHours?: number;
}

export const schedulesApi = {
  /**
   * Fetch all working schedules from MySQL.
   * Returns an empty array if the table is empty.
   */
  async getAll(): Promise<ScheduleRecord[]> {
    const response = await apiFetch<ScheduleListResponse>('/api/schedules');
    return response.data ?? [];
  },

  /**
   * Fetch a single working schedule by ID.
   * Throws ApiError with statusCode 404 if not found.
   */
  async getById(id: string): Promise<ScheduleRecord> {
    const response = await apiFetch<ScheduleDetailResponse>(`/api/schedules/${encodeURIComponent(id)}`);
    return response.data;
  },

  /**
   * Create a new working schedule.
   * Throws ApiError with statusCode 409 if schedule with same name exists.
   * Throws ApiError with statusCode 400 for validation errors.
   */
  async create(payload: CreateSchedulePayload): Promise<ScheduleRecord> {
    const response = await apiFetch<ScheduleDetailResponse>('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
};
