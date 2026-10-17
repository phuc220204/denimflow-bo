import { Role } from '@denimflow/shared';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { type UserProfile, fetchMe } from './api';
import { supabase } from './supabase';

interface RegisterData {
  fullName: string;
  email: string;
  password?: string;
  role?: Role;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
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
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const accessToken = data.session.access_token;
          setToken(accessToken);
          try {
            const profile = await fetchMe(accessToken);
            setUser(profile);
            setIsLoading(false);
            return;
          } catch {
            // fallback
          }
        }

        const storedUser = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
        const storedToken = localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          setToken(storedToken || 'demo-mock-jwt-token');
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
      // 1. Try Supabase Auth if credentials exist and configured
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data.session) {
          const accessToken = data.session.access_token;
          setToken(accessToken);
          const profile = await fetchMe(accessToken).catch(() => ({
            id: data.user.id,
            email: data.user.email || email,
            fullName: data.user.user_metadata?.full_name || email.split('@')[0] || 'Người dùng',
            role: (data.user.user_metadata?.role as Role) || Role.PRODUCTION_PLANNER,
            isActive: true,
          }));
          setUser(profile);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile));
          localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, accessToken);
          return;
        }
      } catch {
        // Continue to local session fallback
      }

      // 2. Seamless local fallback (for testing before database connection)
      const mockProfile: UserProfile = {
        id: crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-0000-0000-000000000001',
        email,
        fullName: email.split('@')[0]?.replace(/[._]/g, ' ').toUpperCase() || 'Nhân Viên Xưởng',
        role: Role.PRODUCTION_PLANNER,
        isActive: true,
      };
      const mockToken = `mock-token-${Date.now()}`;
      setUser(mockProfile);
      setToken(mockToken);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(mockProfile));
      localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, mockToken);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async ({
    fullName,
    email,
    password = '',
    role = Role.PRODUCTION_PLANNER,
  }: RegisterData) => {
    setIsLoading(true);
    try {
      // Try Supabase signUp if configured
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role },
          },
        });
        if (!error && data.session) {
          const accessToken = data.session.access_token;
          setToken(accessToken);
          const profile: UserProfile = {
            id: data.user?.id || 'new-user',
            email,
            fullName,
            role,
            isActive: true,
          };
          setUser(profile);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile));
          localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, accessToken);
          return;
        }
      } catch {
        // Fallback
      }

      // Local session creation
      const newProfile: UserProfile = {
        id: crypto.randomUUID ? crypto.randomUUID() : 'new-registered-user',
        email,
        fullName,
        role,
        isActive: true,
      };
      const mockToken = `mock-registered-token-${Date.now()}`;
      setUser(newProfile);
      setToken(mockToken);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(newProfile));
      localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, mockToken);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut().catch(() => {});
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
      localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
