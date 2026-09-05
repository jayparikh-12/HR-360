import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  authApi, 
  getStoredToken, 
  setStoredToken, 
  clearStoredToken, 
  type ApiUser 
} from '../api/client';
import { normalizeRole, toDisplayRole, type CanonicalRole } from '../utils/permissions';
import type { UserRole } from '../types';

export interface AuthUser extends ApiUser {}

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

  // Initialize and validate session on mount
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const storedToken = getStoredToken();
      if (!storedToken) {
        if (isMounted) {
          setIsLoading(false);
          setIsAuthenticated(false);
          setUser(null);
          setToken(null);
        }
        return;
      }

      try {
        // Validate with backend /api/auth/me
        const response = await authApi.getMe(storedToken);
        if (isMounted && response.success && response.user) {
          setUser(response.user);
          setToken(storedToken);
          setIsAuthenticated(true);
        } else {
          throw new Error('Session invalid or expired');
        }
      } catch (error) {
        console.warn('[AuthContext] Stored session invalid or expired. Resetting auth state.');
        clearStoredToken();
        if (isMounted) {
          setUser(null);
          setToken(null);
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

  // Centralized Login
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const response = await authApi.login(email, password);
    if (!response.success || !response.token || !response.user) {
      throw new Error(response.message || 'Authentication failed');
    }

    setStoredToken(response.token);
    setToken(response.token);
    setUser(response.user);
    setOverrideDisplayRole(null); // Reset any previous preview override
    setIsAuthenticated(true);
  }, []);

  // Centralized Logout
  const logout = useCallback(() => {
    clearStoredToken();
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
