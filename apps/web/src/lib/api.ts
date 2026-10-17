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

// ==========================================
// CATALOG API TYPES & CLIENT FUNCTIONS
// ==========================================

export interface StationItem {
  id: string;
  code: string;
  name: string;
  stationType: string;
  isOutsourced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StyleItem {
  id: string;
  styleCode: string;
  name: string;
  fitType?: string | null;
  hasEmbroidery: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FabricTypeItem {
  id: string;
  code: string;
  name: string;
  weightOz?: number | null;
  composition?: string | null;
  stretchType: string;
  createdAt: string;
  updatedAt: string;
}

export interface ColorOptionItem {
  id: string;
  code: string;
  name: string;
  colorFamily?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WashTypeItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

function getAuthHeaders(token?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

// 1. Stations
export async function fetchStations(): Promise<StationItem[]> {
  const res = await fetch(`${API_BASE}/catalog/stations`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Không thể tải danh sách trạm sản xuất');
  return res.json();
}

export async function createStation(
  dto: Partial<StationItem>,
  token?: string | null,
): Promise<StationItem> {
  const res = await fetch(`${API_BASE}/catalog/stations`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tạo trạm mới');
  return data;
}

export async function updateStation(
  id: string,
  dto: Partial<StationItem>,
  token?: string | null,
): Promise<StationItem> {
  const res = await fetch(`${API_BASE}/catalog/stations/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể cập nhật trạm');
  return data;
}

export async function deleteStation(id: string, token?: string | null): Promise<void> {
  const res = await fetch(`${API_BASE}/catalog/stations/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Không thể xóa trạm');
  }
}

// 2. Styles
export async function fetchStyles(): Promise<StyleItem[]> {
  const res = await fetch(`${API_BASE}/catalog/styles`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Không thể tải danh sách kiểu dáng');
  return res.json();
}

export async function createStyle(
  dto: Partial<StyleItem>,
  token?: string | null,
): Promise<StyleItem> {
  const res = await fetch(`${API_BASE}/catalog/styles`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tạo kiểu dáng mới');
  return data;
}

export async function updateStyle(
  id: string,
  dto: Partial<StyleItem>,
  token?: string | null,
): Promise<StyleItem> {
  const res = await fetch(`${API_BASE}/catalog/styles/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể cập nhật kiểu dáng');
  return data;
}

export async function deleteStyle(id: string, token?: string | null): Promise<void> {
  const res = await fetch(`${API_BASE}/catalog/styles/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Không thể xóa kiểu dáng');
  }
}

// 3. Fabric Types
export async function fetchFabricTypes(): Promise<FabricTypeItem[]> {
  const res = await fetch(`${API_BASE}/catalog/fabric-types`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Không thể tải danh sách loại vải');
  return res.json();
}

export async function createFabricType(
  dto: Partial<FabricTypeItem>,
  token?: string | null,
): Promise<FabricTypeItem> {
  const res = await fetch(`${API_BASE}/catalog/fabric-types`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tạo loại vải mới');
  return data;
}

export async function updateFabricType(
  id: string,
  dto: Partial<FabricTypeItem>,
  token?: string | null,
): Promise<FabricTypeItem> {
  const res = await fetch(`${API_BASE}/catalog/fabric-types/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể cập nhật loại vải');
  return data;
}

export async function deleteFabricType(id: string, token?: string | null): Promise<void> {
  const res = await fetch(`${API_BASE}/catalog/fabric-types/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Không thể xóa loại vải');
  }
}

// 4. Color Options
export async function fetchColorOptions(): Promise<ColorOptionItem[]> {
  const res = await fetch(`${API_BASE}/catalog/color-options`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Không thể tải danh sách màu nhuộm');
  return res.json();
}

export async function createColorOption(
  dto: Partial<ColorOptionItem>,
  token?: string | null,
): Promise<ColorOptionItem> {
  const res = await fetch(`${API_BASE}/catalog/color-options`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tạo màu mới');
  return data;
}

export async function updateColorOption(
  id: string,
  dto: Partial<ColorOptionItem>,
  token?: string | null,
): Promise<ColorOptionItem> {
  const res = await fetch(`${API_BASE}/catalog/color-options/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể cập nhật màu');
  return data;
}

export async function deleteColorOption(id: string, token?: string | null): Promise<void> {
  const res = await fetch(`${API_BASE}/catalog/color-options/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Không thể xóa màu');
  }
}

// 5. Wash Types
export async function fetchWashTypes(): Promise<WashTypeItem[]> {
  const res = await fetch(`${API_BASE}/catalog/wash-types`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Không thể tải danh sách kiểu giặt');
  return res.json();
}

export async function createWashType(
  dto: Partial<WashTypeItem>,
  token?: string | null,
): Promise<WashTypeItem> {
  const res = await fetch(`${API_BASE}/catalog/wash-types`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tạo kiểu giặt mới');
  return data;
}

export async function updateWashType(
  id: string,
  dto: Partial<WashTypeItem>,
  token?: string | null,
): Promise<WashTypeItem> {
  const res = await fetch(`${API_BASE}/catalog/wash-types/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể cập nhật kiểu giặt');
  return data;
}

export async function deleteWashType(id: string, token?: string | null): Promise<void> {
  const res = await fetch(`${API_BASE}/catalog/wash-types/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Không thể xóa kiểu giặt');
  }
}
