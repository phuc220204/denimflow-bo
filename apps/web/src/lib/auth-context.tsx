import React, { createContext, useContext, useEffect, useState } from 'react';
import { type UserProfile, fetchMe, loginApi } from './api';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_USER_KEY = 'denimflow_auth_user';
const LOCAL_STORAGE_TOKEN_KEY = 'denimflow_auth_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      try {
        const storedToken = localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
        const storedUser = localStorage.getItem(LOCAL_STORAGE_USER_KEY);

        if (storedToken) {
          try {
            const profile = await fetchMe(storedToken);
            setUser(profile);
            setToken(storedToken);
            setIsLoading(false);
            return;
          } catch {
            if (storedUser) {
              setUser(JSON.parse(storedUser));
              setToken(storedToken);
            }
          }
        }
      } catch (err) {
        console.warn('Could not restore auth session:', err);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = async (email: string, password = '') => {
    setIsLoading(true);
    try {
      const response = await loginApi(email, password);
      setUser(response.user);
      setToken(response.accessToken);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(response.user));
      localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, response.accessToken);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
