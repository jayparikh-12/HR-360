import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  authApi, 
  getStoredToken, 
  setStoredToken, 
  clearStoredToken, 
  setStoredUser, 
  clearStoredUser 
} from '../api/client';
import { normalizeRole, toDisplayRole, type CanonicalRole } from '../utils/permissions';
import type { UserRole, AuthUser } from '../types';

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  role: CanonicalRole | null;
  displayRole: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setDisplayRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [overrideDisplayRole, setOverrideDisplayRole] = useState<UserRole | null>(null);

  // Guard against duplicate concurrent login submissions
  const isLoggingInRef = useRef<boolean>(false);

  /**
   * Application Startup Lifecycle:
   * 1. Read stored token from storage.
   * 2. If no token exists, finish loading and show Login.
   * 3. If token exists, call GET /api/auth/me with Bearer token.
   * 4. If valid, restore the authenticated user profile.
   * 5. If 401 / expired / invalid / network failure, clear session and return to Login.
   * 6. Never reveal protected UI while authentication is still initializing.
   */
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      let storedToken: string | null = null;
      try {
        storedToken = getStoredToken();
      } catch (storageError) {
        console.warn('[AuthContext] Storage read error:', storageError);
      }

      if (!storedToken) {
        if (isMounted) {
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
          setIsLoading(false);
        }
        return;
      }

      try {
        // Verify token against backend GET /api/auth/me
        const response = await authApi.getMe(storedToken);

        if (isMounted && response.success && response.user) {
          const safeUser: AuthUser = {
            id: response.user.id,
            name: response.user.name,
            email: response.user.email,
            role: response.user.role,
            ...(response.user.employeeId ? { employeeId: response.user.employeeId } : {}),
          };

          setToken(storedToken);
          setUser(safeUser);
          setIsAuthenticated(true);
          // Persist safe user info (never passwords)
          setStoredUser(safeUser);
        } else {
          throw new Error('Invalid or expired authentication response');
        }
      } catch (error) {
        // Token expired, malformed, or backend returned 401
        console.warn('[AuthContext] Stored session invalid or expired. Resetting session state.');
        clearStoredToken();
        clearStoredUser();

        if (isMounted) {
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Login Lifecycle:
   * 1. Check if already authenticating (duplicate submission guard).
   * 2. Call POST /api/auth/login.
   * 3. Persist received token and safe user profile (never store passwords).
   * 4. Update state to reveal authenticated application.
   */
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    if (isLoggingInRef.current) {
      return;
    }
    isLoggingInRef.current = true;

    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();

      if (!trimmedEmail || !trimmedPassword) {
        throw new Error('Please enter both work email and password.');
      }

      const response = await authApi.login(trimmedEmail, trimmedPassword);

      if (!response.success || !response.token || !response.user) {
        throw new Error(response.message || 'Invalid email or password');
      }

      const safeUser: AuthUser = {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        role: response.user.role,
        ...(response.user.employeeId ? { employeeId: response.user.employeeId } : {}),
      };

      // Persist token and safe user profile only
      setStoredToken(response.token);
      setStoredUser(safeUser);

      setToken(response.token);
      setUser(safeUser);
      setOverrideDisplayRole(null);
      setIsAuthenticated(true);
    } finally {
      isLoggingInRef.current = false;
    }
  }, []);

  /**
   * Logout Lifecycle:
   * 1. Clear stored token.
   * 2. Clear stored user profile.
   * 3. Reset React state to unauthenticated.
   * 4. Return user to Login screen.
   */
  const logout = useCallback(() => {
    clearStoredToken();
    clearStoredUser();
    setToken(null);
    setUser(null);
    setOverrideDisplayRole(null);
    setIsAuthenticated(false);
  }, []);

  // Derived role values
  const role: CanonicalRole | null = useMemo(() => {
    return user ? normalizeRole(user.role) : null;
  }, [user]);

  const displayRole: UserRole = useMemo(() => {
    if (overrideDisplayRole) return overrideDisplayRole;
    if (user?.role) return toDisplayRole(user.role);
    return 'HR Payroll Manager';
  }, [user, overrideDisplayRole]);

  const setDisplayRole = useCallback((newRole: UserRole) => {
    setOverrideDisplayRole(newRole);
  }, []);

  const contextValue = useMemo(
    () => ({
      user,
      token,
      role,
      displayRole,
      isAuthenticated,
      isLoading,
      login,
      logout,
      setDisplayRole,
    }),
    [user, token, role, displayRole, isAuthenticated, isLoading, login, logout, setDisplayRole]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
