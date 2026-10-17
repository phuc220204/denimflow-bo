import { type HealthResponse, healthResponseSchema, type Role } from '@denimflow/shared';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
}

export interface AuthApiResponse {
  accessToken: string;
  user: UserProfile;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Máy chủ không phản hồi (Mã lỗi ${res.status})`);
  }

  const data = await res.json();
  return healthResponseSchema.parse(data);
}

export async function loginApi(email: string, password: string): Promise<AuthApiResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Đăng nhập không thành công');
  }

  return data as AuthApiResponse;
}

export async function registerApi(dto: {
  email: string;
  password: string;
  fullName: string;
  role: Role;
}): Promise<AuthApiResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(dto),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Đăng ký không thành công');
  }

  return data as AuthApiResponse;
}

export async function fetchMe(token?: string | null): Promise<UserProfile> {
  const headers: HeadersInit = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/auth/me`, { headers });

  if (!res.ok) {
    throw new Error(`Phiên đăng nhập không hợp lệ`);
  }

  const data = (await res.json()) as UserProfile;
  return data;
}
