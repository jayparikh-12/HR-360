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
  getStoredUser,
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
  const [token, setToken] = useState<string | null>(() => {
    const t = getStoredToken();
    return t && !isTokenExpired(t) ? t : null;
  });
  const [user, setUser] = useState<User | null>(() => {
    const t = getStoredToken();
    if (t && !isTokenExpired(t)) {
      return getStoredUser();
    }
    return null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const t = getStoredToken();
    return !!t && !isTokenExpired(t);
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const t = getStoredToken();
    return !!t && !isTokenExpired(t);
  });

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

    const MAX_SESSION_MS = 20 * 60 * 1000;
    const effectiveTimeoutMs = Math.min(remainingMs, MAX_SESSION_MS);

    sessionTimeoutTimerRef.current = setTimeout(() => {
      console.info('[AuthContext] Authenticated session lifetime expired. Logging out automatically.');
      logout();
    }, effectiveTimeoutMs);
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

      // If no token exists or is expired, immediately unauthenticate
      if (!storedToken || isTokenExpired(storedToken)) {
        if (storedToken) {
          clearStoredToken();
          clearStoredUser();
        }
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

          setStoredUser(safeUser);
          setToken(storedToken);
          setUser(safeUser);
          setIsAuthenticated(true);

          // Schedule automatic logout based on remaining JWT lifetime
          scheduleSessionTimeout(storedToken);
        } else {
          throw new Error('Session invalid or unauthorized');
        }
      } catch (err: any) {
        console.warn('[AuthContext] Stored session validation failed:', err);
        // Only invalidate session if the token was explicitly rejected as unauthorized
        if (err?.statusCode === 401 || err?.statusCode === 403 || isTokenExpired(storedToken)) {
          clearStoredToken();
          clearStoredUser();
          if (isMounted) {
            setToken(null);
            setUser(null);
            setIsAuthenticated(false);
          }
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
      setIsAuthenticated(true);

      // Schedule automatic logout based on the token expiration claim (~20 minutes)
      scheduleSessionTimeout(response.token);
    } finally {
      isLoggingInRef.current = false;
    }
  }, [scheduleSessionTimeout]);

  // --------------------------------------------------------------------------
  // Role display integration strictly derived from authenticated session token
  // --------------------------------------------------------------------------
  const displayRole: UserRole = useMemo(() => {
    if (user?.role) return toDisplayRole(user.role);
    return 'Employee';
  }, [user]);

  const setDisplayRole = useCallback((_role: UserRole) => {
    // No-op: Role switching from the frontend is disabled for security.
    console.warn('[Security] Frontend role switching is disabled. Roles are verified by backend authentication.');
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
