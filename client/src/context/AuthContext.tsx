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
  onUnauthorized,
  TOKEN_STORAGE_KEY,
} from '../api/client';
import { isTokenExpired, getTokenRemainingMs } from '../utils/jwt';
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

  // Session timeout timer ref
  const sessionTimeoutTimerRef = useRef<any>(null);

  // --------------------------------------------------------------------------
  // Timer Cleanup Helper
  // --------------------------------------------------------------------------
  const clearSessionTimer = useCallback(() => {
    if (sessionTimeoutTimerRef.current) {
      clearTimeout(sessionTimeoutTimerRef.current);
      sessionTimeoutTimerRef.current = null;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Logout Implementation
  // --------------------------------------------------------------------------
  const logout = useCallback(() => {
    clearSessionTimer();
    clearStoredToken();
    clearStoredUser();
    setToken(null);
    setUser(null);
    setOverrideDisplayRole(null);
    setIsAuthenticated(false);
  }, [clearSessionTimer]);

  // --------------------------------------------------------------------------
  // Session Timeout Scheduler
  // --------------------------------------------------------------------------
  const scheduleSessionTimeout = useCallback((tokenString: string) => {
    clearSessionTimer();
    const remainingMs = getTokenRemainingMs(tokenString);

    if (remainingMs <= 0) {
      console.info('[AuthContext] Token already expired. Logging out.');
      logout();
      return;
    }

    sessionTimeoutTimerRef.current = setTimeout(() => {
      console.info('[AuthContext] 20-minute authenticated session lifetime expired. Logging out automatically.');
      logout();
    }, remainingMs);
  }, [clearSessionTimer, logout]);

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

      // Pre-flight check: Determine whether stored token is already expired
      if (isTokenExpired(storedToken)) {
        console.info('[AuthContext] Stored token has expired. Clearing session.');
        clearStoredToken();
        clearStoredUser();
        if (isMounted) {
          setUser(null);
          setToken(null);
          setIsAuthenticated(false);
          setIsLoading(false);
        }
        return;
      }

      // Token exists and is not expired: validate with backend /api/auth/me
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

          // Schedule automatic logout based on the remaining JWT lifetime
          scheduleSessionTimeout(storedToken);
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
  }, [scheduleSessionTimeout]);

  // --------------------------------------------------------------------------
  // Cleanup Timer on Component Unmount
  // --------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      clearSessionTimer();
    };
  }, [clearSessionTimer]);

  // --------------------------------------------------------------------------
  // API 401 Interception: Auto logout on protected unauthorized responses
  // --------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      console.info('[AuthContext] Received unauthorized (401) signal from API. Logging out.');
      logout();
    });

    return () => {
      unsubscribe();
    };
  }, [logout]);

  // --------------------------------------------------------------------------
  // Multi-Tab Synchronization via Storage Events
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TOKEN_STORAGE_KEY) {
        if (!e.newValue) {
          // Token removed in another tab (logout)
          logout();
        } else if (e.newValue !== token) {
          // Token changed in another tab
          if (isTokenExpired(e.newValue)) {
            logout();
          } else {
            setToken(e.newValue);
            scheduleSessionTimeout(e.newValue);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [token, logout, scheduleSessionTimeout]);

  // --------------------------------------------------------------------------
  // Visibility & Focus Check (handling device sleep or background tab throttle)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && token) {
        if (isTokenExpired(token)) {
          console.info('[AuthContext] Session expired during background inactivity. Logging out.');
          logout();
        }
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [token, logout]);

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

      // Persist token and user
      setStoredToken(response.token);
      setStoredUser(safeUser);

      // Update centralized auth state
      setToken(response.token);
      setUser(safeUser);
      setOverrideDisplayRole(null);
      setIsAuthenticated(true);

      // Schedule automatic logout based on the token expiration claim (~20 minutes)
      scheduleSessionTimeout(response.token);
    } finally {
      isLoggingInRef.current = false;
    }
  }, [scheduleSessionTimeout]);

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
