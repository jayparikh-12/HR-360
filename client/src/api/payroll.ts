/**
 * PeoplePay360 — Payroll / Payrun API Module
 *
 * Centralized typed wrappers for /api/payroll endpoints.
 * Automatically attaches Authorization: Bearer <token> via apiFetch.
 */

import { apiFetch, apiFetchBlob } from './client';
import type { Payrun, DetailedPayslip, EmployeePayslipHistoryItem } from '../types';

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

export interface DetailedPayslipResponse {
  success: boolean;
  data: DetailedPayslip;
  message?: string;
}

export interface EmployeePayslipHistoryResponse {
  success: boolean;
  data: EmployeePayslipHistoryItem[];
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
   * Transition payrun status from DRAFT -> COMPUTED.
   * Executes deterministic payroll calculation across eligible employees and stores snapshots.
   */
  async compute(id: string): Promise<Payrun> {
    const response = await apiFetch<PayrunDetailResponse>(`/api/payroll/payruns/${encodeURIComponent(id)}/compute`, {
      method: 'POST',
    });
    return response.data;
  },

  /**
   * Transition payrun status from COMPUTED -> VALIDATED.
   * Confirms employee calculation snapshots are reviewed and approved for payment.
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

  /**
   * Retrieve a detailed payslip by primary ID.
   */
  async getPayslipById(id: string): Promise<DetailedPayslip> {
    const response = await apiFetch<DetailedPayslipResponse>(`/api/payroll/payslips/${encodeURIComponent(id)}`);
    return response.data;
  },

  /**
   * Retrieve a detailed payslip by payrun ID and employee ID.
   */
  async getPayslipByPayrunAndEmployee(payrunId: string, employeeId: string): Promise<DetailedPayslip> {
    const response = await apiFetch<DetailedPayslipResponse>(
      `/api/payroll/payruns/${encodeURIComponent(payrunId)}/employees/${encodeURIComponent(employeeId)}/payslip`
    );
    return response.data;
  },

  /**
   * Retrieve employee payslip history.
   */
  async getEmployeePayslips(employeeId: string): Promise<EmployeePayslipHistoryItem[]> {
    const response = await apiFetch<EmployeePayslipHistoryResponse>(
      `/api/payroll/employees/${encodeURIComponent(employeeId)}/payslips`
    );
    return response.data ?? [];
  },

  /**
   * Download a detailed payslip as an immutable PDF document.
   */
  async downloadPayslipPdf(payslipId: string, customFilename?: string): Promise<void> {
    const { blob, filename } = await apiFetchBlob(`/api/payroll/payslips/${encodeURIComponent(payslipId)}/pdf`);
    const finalName = customFilename || filename || `Payslip_${payslipId}.pdf`;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
