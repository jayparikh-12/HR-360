import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  authApi,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  setStoredUser,
  clearStoredUser,
} from '../api/client';
import type { User, AuthContextValue } from '../types/auth';
import type { UserRole, AuthUser } from '../types';
import { toDisplayRole } from '../utils/permissions';

export interface ExtendedAuthContextValue extends AuthContextValue {
  displayRole: UserRole;
  setDisplayRole: (role: UserRole) => void;
}

export type AuthContextType = ExtendedAuthContextValue;

const AuthContext = createContext<ExtendedAuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [overrideDisplayRole, setOverrideDisplayRole] = useState<UserRole | null>(null);

  // Prevent concurrent login requests
  const isLoggingInRef = useRef<boolean>(false);

  // --------------------------------------------------------------------------
  // Application Startup: Validate Token & Restore Session
  // --------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const initializeSession = async () => {
      let storedToken: string | null = null;
      try {
        storedToken = getStoredToken();
      } catch (storageError) {
        console.warn('[AuthContext] Storage read error:', storageError);
      }

      // If no token exists, immediately unauthenticate
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setToken(null);
          setIsAuthenticated(false);
          setIsLoading(false);
        }
        return;
      }

      // Token exists: validate with backend /api/auth/me
      try {
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
          setStoredUser(safeUser);
        } else {
          throw new Error('Session invalid or unauthorized');
        }
      } catch (err) {
        console.warn('[AuthContext] Stored session validation failed:', err);
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

    initializeSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // --------------------------------------------------------------------------
  // Login Implementation
  // --------------------------------------------------------------------------
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    if (isLoggingInRef.current) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!normalizedEmail || !cleanPassword) {
      throw new Error('Please enter both work email and password.');
    }

    isLoggingInRef.current = true;

    try {
      const response = await authApi.login(normalizedEmail, cleanPassword);

      if (!response.success || !response.token || !response.user) {
        throw new Error(response.message || 'Authentication failed. Please verify credentials.');
      }

      const safeUser: AuthUser = {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        role: response.user.role,
        ...(response.user.employeeId ? { employeeId: response.user.employeeId } : {}),
      };

      // Persist token and safe user profile
      setStoredToken(response.token);
      setStoredUser(safeUser);

      // Update centralized auth state
      setToken(response.token);
      setUser(safeUser);
      setOverrideDisplayRole(null);
      setIsAuthenticated(true);
    } finally {
      isLoggingInRef.current = false;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Logout Implementation
  // --------------------------------------------------------------------------
  const logout = useCallback(() => {
    clearStoredToken();
    clearStoredUser();
    setToken(null);
    setUser(null);
    setOverrideDisplayRole(null);
    setIsAuthenticated(false);
  }, []);

  // --------------------------------------------------------------------------
  // Role display integration for UI continuity
  // --------------------------------------------------------------------------
  const displayRole: UserRole = useMemo(() => {
    if (overrideDisplayRole) return overrideDisplayRole;
    if (user?.role) return toDisplayRole(user.role);
    return 'HR Payroll Manager';
  }, [user, overrideDisplayRole]);

  const setDisplayRole = useCallback((role: UserRole) => {
    setOverrideDisplayRole(role);
  }, []);

  const value: ExtendedAuthContextValue = useMemo(
    () => ({
      user,
      token,
      isAuthenticated,
      isLoading,
      login,
      logout,
      displayRole,
      setDisplayRole,
    }),
    [user, token, isAuthenticated, isLoading, login, logout, displayRole, setDisplayRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): ExtendedAuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
