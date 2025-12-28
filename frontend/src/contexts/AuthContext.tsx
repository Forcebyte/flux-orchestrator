import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fluxApi } from '../api';

// Check if we're in demo mode
const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

interface UserInfo {
  id: string;
  email: string;
  name: string;
  username: string;
  provider: string;
}

interface AuthContextType {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authEnabled: boolean;
  login: () => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(false);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      
      // In demo mode, always disable auth
      if (IS_DEMO_MODE) {
        setAuthEnabled(false);
        setUser(null);
        setIsLoading(false);
        return;
      }
      
      // Check if auth is enabled
      const statusResponse = await fluxApi.axios.get<{ enabled: boolean }>('/auth/status');
      setAuthEnabled(statusResponse.data.enabled);
      
      if (!statusResponse.data.enabled) {
        // Auth is disabled, no need to check user
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Auth is enabled, check if user is logged in
      try {
        const response = await fluxApi.axios.get<UserInfo>('/auth/me');
        setUser(response.data);
      } catch (error) {
        // User is not authenticated
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setAuthEnabled(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = () => {
    window.location.href = `${fluxApi.axios.defaults.baseURL}/auth/login`;
  };

  const logout = async () => {
    try {
      await fluxApi.axios.post('/auth/logout');
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    authEnabled,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
