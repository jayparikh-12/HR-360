/**
 * PeoplePay360 — Services API Wrapper
 *
 * Delegates directly to the centralized client in src/api/client.ts.
 * Guarantees a single API client architecture across the application.
 */

import { apiFetch, ApiError, authApi as clientAuthApi } from '../api/client';
import type { LoginResponse, MeResponse } from '../types/auth';

export { ApiError };

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/api/')
    ? endpoint
    : endpoint.startsWith('/')
    ? `/api${endpoint}`
    : `/api/${endpoint}`;

  return apiFetch<T>(cleanEndpoint, options);
}

export const api = {
  get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return apiRequest<T>(endpoint, { ...options, method: 'GET' });
  },

  post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },
};

export const authApi = {
  login(email: string, password: string): Promise<LoginResponse> {
    return clientAuthApi.login(email, password) as Promise<LoginResponse>;
  },

  getMe(tokenOverride?: string): Promise<MeResponse> {
    return clientAuthApi.getMe(tokenOverride) as Promise<MeResponse>;
  },
};

