import { Role } from '@denimflow/shared';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { type UserProfile, fetchMe } from './api';
import { supabase } from './supabase';

export const DEMO_USERS: Record<string, UserProfile> = {
  'admin@denimflow.local': {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@denimflow.local',
    fullName: 'Trần Văn Quản Trị',
    role: Role.ADMIN,
    isActive: true,
  },
  'engineer@denimflow.local': {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'engineer@denimflow.local',
    fullName: 'Lê Kỹ Sư',
    role: Role.PROCESS_ENGINEER,
    isActive: true,
  },
  'planner@denimflow.local': {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'planner@denimflow.local',
    fullName: 'Nguyễn Điều Độ',
    role: Role.PRODUCTION_PLANNER,
    isActive: true,
  },
  'warehouse@denimflow.local': {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'warehouse@denimflow.local',
    fullName: 'Phạm Thủ Kho',
    role: Role.WAREHOUSE_KEEPER,
    isActive: true,
  },
  'operator@denimflow.local': {
    id: '00000000-0000-0000-0000-000000000005',
    email: 'operator@denimflow.local',
    fullName: 'Đặng Công Nhân',
    role: Role.STATION_OPERATOR,
    isActive: true,
  },
  'qc@denimflow.local': {
    id: '00000000-0000-0000-0000-000000000006',
    email: 'qc@denimflow.local',
    fullName: 'Hoàng Kiểm Phẩm',
    role: Role.QC_INSPECTOR,
    isActive: true,
  },
  'manager@denimflow.local': {
    id: '00000000-0000-0000-0000-000000000007',
    email: 'manager@denimflow.local',
    fullName: 'Vũ Quản Lý',
    role: Role.MANAGER,
    isActive: true,
  },
};

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
        // 1. Try Supabase Auth session first
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
            // fallback if /me not reachable yet
          }
        }

        // 2. Fallback to persisted local session
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

  const login = async (email: string, password = 'password123') => {
    setIsLoading(true);
    try {
      // Check if this is a demo user email
      const demoUser = DEMO_USERS[email];
      if (demoUser) {
        const mockToken = `mock-token-for-${demoUser.role.toLowerCase()}`;
        setUser(demoUser);
        setToken(mockToken);
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(demoUser));
        localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, mockToken);
        return;
      }

      // Try Supabase auth if not demo
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }

      if (data.session) {
        const accessToken = data.session.access_token;
        setToken(accessToken);
        try {
          const profile = await fetchMe(accessToken);
          setUser(profile);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile));
          localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, accessToken);
        } catch {
          // If profile endpoint fails, create placeholder from auth
          const fallbackProfile: UserProfile = {
            id: data.user.id,
            email: data.user.email || email,
            fullName: data.user.user_metadata?.full_name || 'Người dùng',
            role: (data.user.user_metadata?.role as Role) || Role.STATION_OPERATOR,
            isActive: true,
          };
          setUser(fallbackProfile);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(fallbackProfile));
        }
      }
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
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
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
