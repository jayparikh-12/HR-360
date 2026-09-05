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
    statusText?: string;
    data?: any;
    fieldErrors?: Record<string, string>;

    constructor(
        message: string,
        statusCode: number = 500,
        data?: any,
        fieldErrors?: Record<string, string>,
        statusText?: string
    ) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.data = data;
        this.fieldErrors = fieldErrors;
        this.statusText = statusText;
    }
}

/**
 * Technical error pattern detector
 * Flags database errors, SQL syntax dumps, internal stack traces, and unparsed JSON
 */
export function isTechnicalError(message: string): boolean {
    if (!message || typeof message !== 'string') return true;

    // Database error codes & signatures
    const dbSignatures = [
        /\bER_[A-Z0-9_]+\b/i,
        /\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\s+/i,
        /\bFROM\s+[a-zA-Z0-9_`"']+/i,
        /\bWHERE\s+[a-zA-Z0-9_`"']+/i,
        /syntax error/i,
        /sqlstate/i,
        /sequelize/i,
        /mysql/i,
        /postgres/i,
        /sqlite/i,
        /database error/i,
        /table\s+['"`][^'"`]+['"`]/i,
        /column\s+['"`][^'"`]+['"`]/i,
        /foreign key constraint/i,
        /duplicate entry/i,
        /\b(ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH)\b/i,
    ];

    if (dbSignatures.some((re) => re.test(message))) {
        return true;
    }

    // Stack traces & node/bundler paths
    const traceSignatures = [
        /\n\s*at\s+/i,
        /^\s*at\s+[a-zA-Z0-9_.$<>]+\s+\(/m,
        /node:internal/i,
        /node_modules/i,
        /[a-zA-Z]:\\[\w.-]+\\/i,
        /\/home\/[\w.-]+\//i,
        /\/var\/[\w.-]+\//i,
        /\/usr\/[\w.-]+\//i,
    ];

    if (traceSignatures.some((re) => re.test(message))) {
        return true;
    }

    // Raw JSON dumps or object references
    const rawDumpSignatures = [
        /^\{[\s\S]*\}$/,
        /^\[object\s+Object\]$/i,
        /^<[\s\S]*>$/, // Raw HTML dump (e.g. 502 Bad Gateway HTML)
    ];

    if (rawDumpSignatures.some((re) => re.test(message.trim()))) {
        return true;
    }

    return false;
}

/**
 * Standard human-friendly default messages per HTTP status code
 */
export function getDefaultErrorMessage(statusCode: number): string {
    switch (statusCode) {
        case 0:
            return 'Unable to connect to the PeoplePay360 server. Please verify your connection and try again.';
        case 400:
            return 'Invalid request. Please check the entered information and try again.';
        case 401:
            return 'Invalid or expired session. Please sign in again.';
        case 403:
            return 'You do not have permission to perform this action.';
        case 404:
            return 'The requested resource could not be found.';
        case 409:
            return 'A conflict occurred with an existing record. Please review your entries.';
        case 422:
            return 'Validation failed. Please verify that all required fields are correctly formatted.';
        case 500:
        case 502:
        case 503:
        case 504:
            return 'The server encountered an unexpected error. Please try again later.';
        default:
            return `Request failed with status code ${statusCode}.`;
    }
}

/**
 * Sanitizes an error message, preserving clean user-facing validation errors
 * while stripping technical SQL codes, stack traces, and raw JSON.
 */
export function sanitizeErrorMessage(message: string | null | undefined, statusCode: number): string {
    if (!message || typeof message !== 'string' || !message.trim()) {
        return getDefaultErrorMessage(statusCode);
    }

    const trimmed = message.trim();

    // Map bare/generic HTTP status phrases to user-friendly messages
    const genericPhrases = [
        'not found',
        'bad request',
        'unauthorized',
        'forbidden',
        'conflict',
        'internal server error',
        'server error',
        'error',
    ];
    if (genericPhrases.includes(trimmed.toLowerCase())) {
        return getDefaultErrorMessage(statusCode);
    }

    if (isTechnicalError(trimmed)) {
        return getDefaultErrorMessage(statusCode);
    }

    return trimmed;
}

/**
 * Extracts and sanitizes error message and optional field-level validation errors from response data
 */
export function extractErrorDetails(
    data: any,
    statusCode: number
): { message: string; fieldErrors?: Record<string, string> } {
    let fieldErrors: Record<string, string> | undefined = undefined;

    // Parse structured field-level errors if provided by backend validation
    if (data && typeof data === 'object') {
        if (data.errors && typeof data.errors === 'object') {
            if (Array.isArray(data.errors)) {
                fieldErrors = {};
                for (const item of data.errors) {
                    const field = item.field || item.param || item.path || item.name;
                    const msg = item.message || item.msg;
                    if (field && msg && typeof msg === 'string') {
                        fieldErrors[field] = sanitizeErrorMessage(msg, statusCode);
                    }
                }
            } else {
                fieldErrors = {};
                for (const [k, v] of Object.entries(data.errors)) {
                    if (typeof v === 'string') {
                        fieldErrors[k] = sanitizeErrorMessage(v, statusCode);
                    } else if (v && typeof v === 'object' && 'message' in v && typeof (v as any).message === 'string') {
                        fieldErrors[k] = sanitizeErrorMessage((v as any).message, statusCode);
                    }
                }
            }
            if (Object.keys(fieldErrors).length === 0) {
                fieldErrors = undefined;
            }
        }
    }

    // Extract raw message candidate
    let rawMessage: string | null = null;
    if (typeof data === 'string') {
        rawMessage = data;
    } else if (data && typeof data === 'object') {
        if (typeof data.message === 'string') {
            rawMessage = data.message;
        } else if (typeof data.error === 'string') {
            rawMessage = data.error;
        } else if (Array.isArray(data.errors) && data.errors.length > 0 && typeof data.errors[0]?.message === 'string') {
            rawMessage = data.errors[0].message;
        }
    }

    const message = sanitizeErrorMessage(rawMessage, statusCode);
    return { message, fieldErrors };
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
const API_BASE_URL = (import.meta.env?.VITE_API_URL as string) || 'http://localhost:5000';

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
            console.error('[API Client] Unauthorized callback error:', err instanceof Error ? err.message : String(err));
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
        console.warn('[API Client] Could not persist auth token to local storage:', err instanceof Error ? err.message : String(err));
    }
}

export function clearStoredToken(): void {
    try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (err) {
        console.warn('[API Client] Could not clear auth token from local storage:', err instanceof Error ? err.message : String(err));
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
        console.warn('[API Client] Could not persist user to local storage:', err instanceof Error ? err.message : String(err));
    }
}

export function clearStoredUser(): void {
    try {
        localStorage.removeItem(USER_STORAGE_KEY);
    } catch (err) {
        console.warn('[API Client] Could not clear user from local storage:', err instanceof Error ? err.message : String(err));
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
        // Graceful handling of backend unavailable or network failure (HTTP status 0)
        throw new ApiError(
            getDefaultErrorMessage(0),
            0,
            networkError
        );
    }

    // Safe JSON / text extraction
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
        // Auto logout only on 401 when NOT calling login endpoint
        if (response.status === 401 && !endpoint.includes('/auth/login')) {
            notifyUnauthorized();
        }

        const { message, fieldErrors } = extractErrorDetails(data, response.status);
        throw new ApiError(message, response.status, data, fieldErrors, response.statusText);
    }

    return data as T;
}

/**
 * Binary blob download helper
 */
export async function apiFetchBlob(
    endpoint: string,
    options: RequestInit = {}
): Promise<{ blob: Blob; filename: string | null }> {
    const url = endpoint.startsWith('http')
        ? endpoint
        : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers = new Headers(options.headers || {});
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
        throw new ApiError(
            getDefaultErrorMessage(0),
            0,
            networkError
        );
    }

    if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/auth/login')) {
            notifyUnauthorized();
        }

        let errData: any = null;
        try {
            const errJson = await response.json();
            errData = errJson;
        } catch {
            try {
                const text = await response.text();
                if (text) errData = { message: text };
            } catch {
                errData = null;
            }
        }

        const { message, fieldErrors } = extractErrorDetails(errData, response.status);
        throw new ApiError(message, response.status, errData, fieldErrors, response.statusText);
    }

    // Extract filename from Content-Disposition if present
    const disposition = response.headers.get('content-disposition');
    let filename: string | null = null;
    if (disposition) {
        const match = /filename=["']?([^"';]+)["']?/.exec(disposition);
        if (match && match[1]) {
            filename = match[1];
        }
    }

    const blob = await response.blob();
    return { blob, filename };
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
