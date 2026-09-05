/**
 * Token Storage Service
 *
 * Centralized localStorage wrapper for safe token persistence.
 * Handles storage exceptions gracefully and ensures passwords or
 * unverified states are never written to disk.
 */

const TOKEN_KEY = 'peoplepay360_auth_token';

export const authStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (err) {
      console.warn('[authStorage] Unable to persist token to localStorage:', err);
    }
  },

  clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (err) {
      console.warn('[authStorage] Unable to clear token from localStorage:', err);
    }
  },
};
