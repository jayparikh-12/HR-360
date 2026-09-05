/**
 * PeoplePay360 Centralized API Client
 *
 * Lightweight, robust fetch abstraction that:
 * - Directs calls to the backend base URL
 * - Automatically attaches Authorization: Bearer <token>
 * - Safely handles non-JSON responses and network failures
 * - Avoids exposing technical stack traces to UI layers
 */

export const TOKEN_STORAGE_KEY = 'peoplepay360_auth_token';
export const USER_STORAGE_KEY = 'peoplepay360_auth_user';

export class ApiError extends Error {
    statusCode: number;
    data?: any;

    constructor(message: string, statusCode: number = 500, data?: any) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.data = data;
    }
}

export interface ApiUser {
    id: string;
    name: string;
    email: string;
    role: string;
    employeeId?: string;
}

export interface LoginResponse {
    success: boolean;
    token: string;
    user: ApiUser;
    message?: string;
}

export interface MeResponse {
    success: boolean;
    user: ApiUser;
    message?: string;
}

// Default base URL is http://localhost:5000 or from environment variable
const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000';

type UnauthorizedCallback = () => void;
const unauthorizedListeners = new Set<UnauthorizedCallback>();

export function onUnauthorized(callback: UnauthorizedCallback): () => void {
    unauthorizedListeners.add(callback);
    return () => {
        unauthorizedListeners.delete(callback);
    };
}

function notifyUnauthorized(): void {
    unauthorizedListeners.forEach((cb) => {
        try {
            cb();
        } catch (err) {
            console.error('[API Client] Unauthorized callback error:', err);
        }
    });
}

export function getStoredToken(): string | null {
    try {
        return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
        return null;
    }
}

export function setStoredToken(token: string): void {
    try {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch (err) {
        console.warn('[API Client] Could not persist auth token to local storage:', err);
    }
}

export function clearStoredToken(): void {
    try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (err) {
        console.warn('[API Client] Could not clear auth token from local storage:', err);
    }
}

export function getStoredUser(): ApiUser | null {
    try {
        const raw = localStorage.getItem(USER_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function setStoredUser(user: ApiUser): void {
    try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch (err) {
        console.warn('[API Client] Could not persist user to local storage:', err);
    }
}

export function clearStoredUser(): void {
    try {
        localStorage.removeItem(USER_STORAGE_KEY);
    } catch (err) {
        console.warn('[API Client] Could not clear user from local storage:', err);
    }
}

/**
 * Generic API request wrapper
 */
export async function apiFetch<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const url = endpoint.startsWith('http')
        ? endpoint
        : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers = new Headers(options.headers || {});

    // Automatically attach Content-Type if body is JSON string and not set
    if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    // Automatically attach Authorization header if not already present
    if (!headers.has('Authorization')) {
        const token = getStoredToken();
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
        // Graceful handling of backend unavailable or network failure
        throw new ApiError(
            'Unable to connect to the PeoplePay360 server. Please verify the backend service is running.',
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
            if (text) {
                data = { message: text };
            }
        } catch {
            data = null;
        }
    }

    if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/auth/login')) {
            notifyUnauthorized();
        }

        const friendlyMessage =
            data?.message ||
            (response.status === 401
                ? 'Invalid or expired session. Please sign in again.'
                : response.status === 403
                    ? 'You do not have permission to perform this action.'
                    : response.status === 404
                        ? 'The requested resource was not found.'
                        : `Request failed with status ${response.status}`);

        throw new ApiError(friendlyMessage, response.status, data);
    }

    return data as T;
}

/**
 * Specialized Authentication API endpoints
 */
export const authApi = {
    async login(email: string, password: string): Promise<LoginResponse> {
        return apiFetch<LoginResponse>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    },

    async getMe(overrideToken?: string): Promise<MeResponse> {
        const headers: Record<string, string> = {};
        if (overrideToken) {
            headers['Authorization'] = `Bearer ${overrideToken}`;
        }
        return apiFetch<MeResponse>('/api/auth/me', {
            method: 'GET',
            headers,
        });
    },
};
