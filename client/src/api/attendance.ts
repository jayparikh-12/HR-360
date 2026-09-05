/**
 * PeoplePay360 — Attendance API Module
 *
 * Centralized typed wrappers for /api/attendance endpoints.
 * Automatically attaches Authorization: Bearer <token> via apiFetch.
 */

import { apiFetch } from './client';
import type { AttendanceRecord } from '../types';

export interface AttendanceListResponse {
  success: boolean;
  data: AttendanceRecord[];
  message?: string;
}

export interface AttendanceDetailResponse {
  success: boolean;
  data: AttendanceRecord;
  message?: string;
}

export interface CheckInPayload {
  id?: string;
  employeeId?: string;
  date?: string;
  checkIn?: string;
  status?: 'PRESENT' | 'LATE' | 'ABSENT' | 'OVERTIME' | 'MISSING_CHECKOUT';
}

export interface CheckOutPayload {
  recordId?: string;
  employeeId?: string;
  checkOut?: string;
}

export const attendanceApi = {
  /**
   * Fetch all attendance records from MySQL.
   * Returns an empty array if the table is empty.
   */
  async getAll(): Promise<AttendanceRecord[]> {
    const response = await apiFetch<AttendanceListResponse>('/api/attendance');
    return response.data ?? [];
  },

  /**
   * Fetch a single attendance record by ID.
   */
  async getById(id: string): Promise<AttendanceRecord> {
    const response = await apiFetch<AttendanceDetailResponse>(`/api/attendance/${encodeURIComponent(id)}`);
    return response.data;
  },

  /**
   * Record employee check-in.
   * Throws ApiError with statusCode 409 if employee already has an active check-in for the date.
   * Throws ApiError with statusCode 404 if employee does not exist.
   */
  async checkIn(payload: CheckInPayload = {}): Promise<AttendanceRecord> {
    const response = await apiFetch<AttendanceDetailResponse>('/api/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  /**
   * Record employee check-out.
   * Throws ApiError with statusCode 400 if no active check-in exists or record is already checked out.
   */
  async checkOut(payload: CheckOutPayload = {}): Promise<AttendanceRecord> {
    const response = await apiFetch<AttendanceDetailResponse>('/api/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
};
