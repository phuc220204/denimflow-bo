import { type HealthResponse, healthResponseSchema, type Role } from '@denimflow/shared';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Health check failed with HTTP ${res.status}`);
  }

  const data = await res.json();
  return healthResponseSchema.parse(data);
}

export async function fetchMe(token?: string | null): Promise<UserProfile> {
  const headers: HeadersInit = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/me`, { headers });

  if (!res.ok) {
    throw new Error(`Fetch /me failed with HTTP ${res.status}`);
  }

  const data = (await res.json()) as UserProfile;
  return data;
}
