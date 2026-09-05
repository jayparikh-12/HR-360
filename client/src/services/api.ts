import { authStorage } from './authStorage';
import type { LoginResponse, MeResponse } from '../types/auth';

export class ApiError extends Error {
  statusCode: number;
  data?: unknown;

  constructor(message: string, statusCode: number = 500, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

/**
 * Builds normalized API request URL supporting VITE_API_BASE_URL
 * Default fallback: http://localhost:5000/api
 */
function buildUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  const base = (
    (import.meta.env.VITE_API_BASE_URL as string) ||
    (import.meta.env.VITE_API_URL as string) ||
    'http://localhost:5000/api'
  ).replace(/\/+$/, '');

  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (base.endsWith('/api') && cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.replace(/^\/api/, '');
  }

  return `${base}${cleanEndpoint}`;
}

/**
 * Reusable core API request function
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = buildUrl(endpoint);
  const headers = new Headers(options.headers || {});

  // Default to application/json for request bodies
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Automatically attach Bearer token if not explicitly provided
  if (!headers.has('Authorization')) {
    const token = authStorage.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkError) {
    throw new ApiError(
      'Unable to connect to the authentication server. Please verify the backend service is running.',
      0,
      networkError
    );
  }

  // Safe JSON extraction
  let data: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text = await response.text();
      if (text) data = { message: text };
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      data?.message ||
      (response.status === 401
        ? 'Invalid credentials or session expired.'
        : response.status === 403
        ? 'Access forbidden.'
        : response.status === 404
        ? 'Authentication endpoint not found.'
        : `Request failed with status code ${response.status}`);

    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

/**
 * Lightweight HTTP method helpers
 */
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

/**
 * Dedicated Authentication Endpoints
 */
export const authApi = {
  login(email: string, password: string): Promise<LoginResponse> {
    return api.post<LoginResponse>('/auth/login', { email, password });
  },

  getMe(tokenOverride?: string): Promise<MeResponse> {
    const headers: Record<string, string> = {};
    if (tokenOverride) {
      headers['Authorization'] = `Bearer ${tokenOverride}`;
    }
    return api.get<MeResponse>('/auth/me', { headers });
  },
};
