import {
  type AssignTemplateToStyleDto,
  type ConditionAst,
  type CreateProductionOrderDto,
  type CreateStepDefinitionDto,
  type CreateStepTransitionDto,
  type CreateWorkflowTemplateDto,
  type DyeMode,
  type DyeSource,
  type HealthResponse,
  healthResponseSchema,
  type MaterialType,
  type OrderStatus,
  type ProductionOrderQueryDto,
  type Role,
  type SelectFabricColorDto,
  type StationType,
  type StepType,
  type TransitionKind,
  type UpdateProductionOrderDto,
  type UpdateStepDefinitionDto,
  type VersionStatus,
  type AllocateFabricDto,
  type AttachAcknowledgementDto,
  type ConfirmOrderResponseDto,
  type CuttingGateResultDto,
  type RequestStatus,
  type CompleteStepResponseDto,
  type RecordQuantityEntryDto,
  type StartStepResponseDto,
  type StepQuantityEntryDto,
  type StepQuantityPanelDto,
  type QcEvaluationDto,
  type QcEvaluationInputDto,
  type QcInspectionDto,
  type RecordQcInspectionDto,
  type RecordQcInspectionResponseDto,
  type StepStatus,
  type WorklistItemDto,
  type AuditLogFilterOptionsDto,
  type AuditLogItemDto,
  type AuditLogListResponseDto,
  type AuditLogQueryDto,
} from '@denimflow/shared';

export type {
  AuditLogFilterOptionsDto,
  AuditLogItemDto,
  AuditLogListResponseDto,
  AuditLogQueryDto,
  CompleteStepResponseDto,
  RecordQuantityEntryDto,
  StartStepResponseDto,
  StepQuantityEntryDto,
  StepQuantityPanelDto,
  QcEvaluationDto,
  QcEvaluationInputDto,
  QcInspectionDto,
  RecordQcInspectionDto,
  RecordQcInspectionResponseDto,
  StepStatus,
  WorklistItemDto,
};

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
  // BR-07: the cut may exceed the plan by this percentage (R-19)
  cutTolerancePercent?: number;
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

// ==========================================
// 6. FABRIC-COLOR MATRIX (BR-04, FR-02)
// ==========================================

export interface FabricColorRuleItem {
  id: string;
  fabricTypeId: string;
  colorId: string;
  isAllowed: boolean;
}

export interface MatrixData {
  fabrics: FabricTypeItem[];
  colors: ColorOptionItem[];
  rules: FabricColorRuleItem[];
}

export async function fetchMatrix(): Promise<MatrixData> {
  const res = await fetch(`${API_BASE}/catalog/matrix`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Không thể tải ma trận vải - màu');
  return res.json();
}

export async function toggleMatrixRuleApi(
  dto: { fabricTypeId: string; colorId: string; isAllowed: boolean },
  token?: string | null,
): Promise<FabricColorRuleItem> {
  const res = await fetch(`${API_BASE}/catalog/matrix/toggle`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể cập nhật quy tắc ma trận');
  return data;
}

export async function fetchAllowedColors(fabricTypeId: string): Promise<ColorOptionItem[]> {
  const res = await fetch(`${API_BASE}/catalog/fabrics/${fabricTypeId}/allowed-colors`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Không thể tải danh sách màu hợp lệ');
  return res.json();
}

// ==========================================
// 7. QC PROFILES (BR-19, FR-28)
// ==========================================

export interface QcProfileItem {
  id: string;
  styleId: string;
  profileType: 'FULL_PROCESS' | 'SKIP_CLEAN_WASH';
  maxShrinkagePercent: number | string;
  maxColorFadingLevel: number;
  isActive: boolean;
}

export async function fetchStyleQcProfiles(styleId: string): Promise<QcProfileItem[]> {
  const res = await fetch(`${API_BASE}/catalog/styles/${styleId}/qc-profiles`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Không thể tải cấu hình QC Profile của kiểu dáng');
  return res.json();
}

export async function updateStyleQcProfileApi(
  styleId: string,
  profileType: 'FULL_PROCESS' | 'SKIP_CLEAN_WASH',
  dto: { maxShrinkagePercent: number; maxColorFadingLevel: number; isActive?: boolean },
  token?: string | null,
): Promise<QcProfileItem> {
  const res = await fetch(`${API_BASE}/catalog/styles/${styleId}/qc-profiles/${profileType}`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể cập nhật thông số QC Profile');
  return data;
}

// ==========================================
// 8. USER MANAGEMENT (T1.1, FR-01)
// ==========================================

export interface UserStaffItem {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  stationId?: string | null;
  stationName?: string | null;
  isActive: boolean;
  createdAt: string;
}

export async function fetchUsersApi(token?: string | null): Promise<UserStaffItem[]> {
  const res = await fetch(`${API_BASE}/users`, {
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Không thể tải danh sách nhân sự');
  }
  return res.json();
}

export async function createUserApi(
  dto: {
    email: string;
    password: string;
    fullName: string;
    role: Role;
    stationId?: string | null;
  },
  token?: string | null,
): Promise<UserStaffItem> {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tạo tài khoản nhân viên');
  return data;
}

export async function updateUserStatusApi(
  id: string,
  isActive: boolean,
  token?: string | null,
): Promise<UserStaffItem> {
  const res = await fetch(`${API_BASE}/users/${id}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ isActive }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể cập nhật trạng thái tài khoản');
  return data;
}

export async function updateUserAssignmentApi(
  id: string,
  dto: { role?: Role; stationId?: string | null },
  token?: string | null,
): Promise<UserStaffItem> {
  const res = await fetch(`${API_BASE}/users/${id}/assignment`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể cập nhật phân quyền và trạm làm việc');
  return data;
}

export interface WorkflowStepItem {
  id: string;
  versionId: string;
  code: string;
  name: string;
  stepType: StepType;
  seq: number;
  responsibleRole: Role;
  stationType: StationType | null;
  isMandatory: boolean;
  requiresEvidence: boolean;
  requiresQc: boolean;
  conditionExpr: ConditionAst | null;
  maxRework: number | null;
  isStart: boolean;
  isEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTransitionItem {
  id: string;
  versionId: string;
  fromStepId: string;
  toStepId: string;
  kind: TransitionKind;
  conditionExpr: ConditionAst | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowVersionDetail {
  id: string;
  templateId: string;
  versionNo: number;
  status: VersionStatus;
  publishedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  template?: {
    id: string;
    name: string;
    isActive: boolean;
    isDedicated: boolean;
  };
  steps: WorkflowStepItem[];
  transitions: WorkflowTransitionItem[];
}

export interface WorkflowVersionSummary {
  id: string;
  versionNo: number;
  status: VersionStatus;
  publishedAt: string | null;
  createdAt: string;
}

export interface WorkflowTemplateItem {
  id: string;
  name: string;
  isActive: boolean;
  isDedicated: boolean;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  versions: WorkflowVersionSummary[];
  styles?: Array<{
    id: string;
    styleCode: string;
    name: string;
  }>;
}

export interface WorkflowValidationViolation {
  code: string;
  message: string;
  stepIds?: string[];
}

export interface WorkflowValidationResponse {
  valid: boolean;
  violations: WorkflowValidationViolation[];
}

export class ApiViolationError extends Error {
  details?: { violations?: WorkflowValidationViolation[] };
  constructor(message: string, details?: { violations?: WorkflowValidationViolation[] }) {
    super(message);
    this.name = 'ApiViolationError';
    this.details = details;
  }
}

export async function fetchWorkflowTemplatesApi(
  token?: string | null,
): Promise<WorkflowTemplateItem[]> {
  const res = await fetch(`${API_BASE}/workflow/templates`, {
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tải danh sách quy trình');
  return data;
}

export async function createWorkflowTemplateApi(
  dto: CreateWorkflowTemplateDto,
  token?: string | null,
): Promise<WorkflowTemplateItem> {
  const res = await fetch(`${API_BASE}/workflow/templates`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tạo quy trình');
  return data;
}

export async function fetchWorkflowVersionApi(
  versionId: string,
  token?: string | null,
): Promise<WorkflowVersionDetail> {
  const res = await fetch(`${API_BASE}/workflow/versions/${versionId}`, {
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tải phiên bản quy trình');
  return data;
}

export async function createWorkflowVersionApi(
  templateId: string,
  token?: string | null,
): Promise<WorkflowVersionDetail> {
  const res = await fetch(`${API_BASE}/workflow/templates/${templateId}/versions`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tạo phiên bản mới');
  return data;
}

export async function addStepApi(
  versionId: string,
  dto: CreateStepDefinitionDto,
  token?: string | null,
): Promise<WorkflowStepItem> {
  const res = await fetch(`${API_BASE}/workflow/versions/${versionId}/steps`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể thêm bước quy trình');
  return data;
}

export async function updateStepApi(
  stepId: string,
  dto: UpdateStepDefinitionDto,
  token?: string | null,
): Promise<WorkflowStepItem> {
  const res = await fetch(`${API_BASE}/workflow/steps/${stepId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể cập nhật bước quy trình');
  return data;
}

export async function deleteStepApi(
  stepId: string,
  token?: string | null,
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/workflow/steps/${stepId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể xoá bước quy trình');
  return data;
}

export async function addTransitionApi(
  versionId: string,
  dto: CreateStepTransitionDto,
  token?: string | null,
): Promise<WorkflowTransitionItem> {
  const res = await fetch(`${API_BASE}/workflow/versions/${versionId}/transitions`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tạo chuyển tiếp');
  return data;
}

export async function deleteTransitionApi(
  transitionId: string,
  token?: string | null,
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/workflow/transitions/${transitionId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể xoá chuyển tiếp');
  return data;
}

export async function validateWorkflowVersionApi(
  versionId: string,
  token?: string | null,
): Promise<WorkflowValidationResponse> {
  const res = await fetch(`${API_BASE}/workflow/versions/${versionId}/validate`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể kiểm tra quy trình');
  return data;
}

export async function publishWorkflowVersionApi(
  versionId: string,
  token?: string | null,
): Promise<{
  success: boolean;
  version: WorkflowVersionDetail;
  violations?: WorkflowValidationViolation[];
}> {
  const res = await fetch(`${API_BASE}/workflow/versions/${versionId}/publish`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiViolationError(data.message || 'Xuất bản thất bại', data.details);
  }
  return data;
}

export async function assignTemplateToStyleApi(
  dto: AssignTemplateToStyleDto,
  token?: string | null,
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/workflow/styles/assign-template`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể gán mẫu cho mã hàng');
  return data;
}

// ==========================================
// ORDERS API TYPES & CLIENT FUNCTIONS
// ==========================================

export interface OrderSizeLineItem {
  id?: string;
  orderId?: string;
  size: string;
  plannedQty: number;
}

export interface BomLineItem {
  id: string;
  orderId: string;
  materialType: MaterialType;
  requiredQty: number | string;
  unit: string;
  materialAllocations?: unknown[];
  materialRequests?: unknown[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductionOrderItem {
  id: string;
  orderNumber: string;
  styleId: string;
  fabricTypeId?: string | null;
  colorId?: string | null;
  washTypeId?: string | null;
  dyeRequired: boolean;
  dyeMode?: DyeMode | null;
  dyeSource?: DyeSource | null;
  embroideryRequired: boolean;
  fabricInspectRequired: boolean;
  ppSampleRequired: boolean;
  skipCleanWash: boolean;
  qcProfileId?: string | null;
  isCustom: boolean;
  status: OrderStatus;
  dueDate: string;
  customerRef?: string | null;
  notes?: string | null;
  createdBy: string;
  confirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  style?: StyleItem;
  fabricType?: FabricTypeItem | null;
  color?: ColorOptionItem | null;
  washType?: WashTypeItem | null;
  qcProfile?: QcProfileItem | null;
  creator?: { id: string; fullName: string; email: string; role: Role };
  sizeLines: OrderSizeLineItem[];
  bomLines?: BomLineItem[];
  materialRequests?: unknown[];
  customerAcknowledgements?: unknown[];
  workflowInstance?: unknown;
}

export async function fetchOrdersApi(
  token?: string | null,
  query?: ProductionOrderQueryDto,
): Promise<ProductionOrderItem[]> {
  const params = new URLSearchParams();
  if (query?.status) params.append('status', query.status);
  if (query?.styleId) params.append('styleId', query.styleId);
  const qs = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(`${API_BASE}/orders${qs}`, {
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Không thể tải danh sách đơn hàng');
  }
  return res.json();
}

export async function fetchOrderDetailApi(
  id: string,
  token?: string | null,
): Promise<ProductionOrderItem> {
  const res = await fetch(`${API_BASE}/orders/${id}`, {
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Không thể tải chi tiết đơn hàng');
  }
  return res.json();
}

export async function createOrderApi(
  dto: CreateProductionOrderDto,
  token?: string | null,
): Promise<ProductionOrderItem> {
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Không thể tạo đơn hàng');
  }
  return data;
}

export async function updateOrderApi(
  id: string,
  dto: UpdateProductionOrderDto,
  token?: string | null,
): Promise<ProductionOrderItem> {
  const res = await fetch(`${API_BASE}/orders/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Không thể cập nhật đơn hàng');
  }
  return data;
}

export async function selectFabricColorApi(
  id: string,
  dto: SelectFabricColorDto,
  token?: string | null,
): Promise<ProductionOrderItem> {
  const res = await fetch(`${API_BASE}/orders/${id}/fabric-color`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Không thể chọn chất liệu và màu sắc cho đơn hàng');
  }
  return data;
}

export async function calculateBomApi(
  orderId: string,
  token?: string | null,
): Promise<BomLineItem[]> {
  const res = await fetch(`${API_BASE}/orders/${orderId}/bom/calculate`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Không thể tính toán BOM cho đơn hàng');
  }
  return data;
}

export async function fetchBomLinesApi(
  orderId: string,
  token?: string | null,
): Promise<BomLineItem[]> {
  const res = await fetch(`${API_BASE}/orders/${orderId}/bom`, {
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Không thể tải danh sách định mức BOM');
  }
  return data;
}

export async function attachAcknowledgementApi(
  orderId: string,
  dto: AttachAcknowledgementDto,
  token?: string | null,
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/orders/${orderId}/acknowledgement`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Không thể đính kèm văn bản xác nhận');
  }
  return data;
}

export async function confirmOrderApi(
  orderId: string,
  token?: string | null,
): Promise<ConfirmOrderResponseDto> {
  const res = await fetch(`${API_BASE}/orders/${orderId}/confirm`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Không thể xác nhận đơn hàng');
  }
  return data;
}

// ==========================================
// 10. INVENTORY & ALLOCATION (T3.4, FR-09, BR-06)
// ==========================================

export interface FabricLotItem {
  id: string;
  fabricTypeId: string;
  colorId: string;
  lotNo: string;
  availableMeters: number;
  shrinkagePercent?: number | null;
  fabricType?: { id: string; code: string; name: string };
  colorOption?: { id: string; code: string; name: string };
}

export interface MaterialRequestItem {
  id: string;
  orderId: string;
  bomLineId: string;
  missingQty: number;
  status: RequestStatus;
  requestedBy: string;
  createdAt: string;
  requester?: { id: string; fullName: string; email: string };
  order?: { id: string; orderNumber: string; status: OrderStatus };
  bomLine?: BomLineItem;
}

export interface OrderAllocationItem {
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    dueDate?: string | null;
    customerRef?: string | null;
    style?: StyleItem;
    fabricType?: FabricTypeItem;
    color?: ColorOptionItem;
  };
  fabricBomLine: {
    id: string;
    requiredQty: number;
    allocatedQty: number;
    missingQty: number;
    unit: string;
    allocations: Array<{
      id: string;
      allocatedQty: number;
      lotNo?: string;
      createdAt: string;
    }>;
    requests: Array<{
      id: string;
      missingQty: number;
      status: RequestStatus;
      createdAt: string;
    }>;
  } | null;
  cuttingGate: {
    passed: boolean;
    ruleId?: string;
    reason?: string;
    requiredQty?: number;
    allocatedQty?: number;
    missingQty?: number;
  };
}

export interface AllocateFabricResponse {
  allocation: {
    id: string;
    bomLineId: string;
    fabricLotId: string;
    allocatedQty: number;
    fabricLot?: { lotNo: string };
  };
  remainingMissingQty: number;
  isFullyAllocated: boolean;
}

export async function fetchFabricLotsApi(
  token?: string | null,
  filters?: { fabricTypeId?: string; colorId?: string },
): Promise<FabricLotItem[]> {
  const query = new URLSearchParams();
  if (filters?.fabricTypeId) query.set('fabricTypeId', filters.fabricTypeId);
  if (filters?.colorId) query.set('colorId', filters.colorId);

  const res = await fetch(`${API_BASE}/inventory/fabric-lots?${query.toString()}`, {
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tải danh sách cuộn vải');
  return data;
}

export async function fetchMaterialRequestsApi(
  token?: string | null,
  orderId?: string,
): Promise<MaterialRequestItem[]> {
  const query = orderId ? `?orderId=${encodeURIComponent(orderId)}` : '';
  const res = await fetch(`${API_BASE}/inventory/requests${query}`, {
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tải danh sách yêu cầu cấp vật tư');
  return data;
}

export async function fetchOrderAllocationsApi(
  token?: string | null,
): Promise<OrderAllocationItem[]> {
  const res = await fetch(`${API_BASE}/inventory/allocations/orders`, {
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tải danh sách đơn hàng cần phân bổ vải');
  return data;
}

export async function allocateFabricApi(
  dto: AllocateFabricDto,
  token?: string | null,
): Promise<AllocateFabricResponse> {
  const res = await fetch(`${API_BASE}/inventory/allocate`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể phân bổ vải từ cuộn');
  return data;
}

export async function fetchCuttingGateApi(
  orderId: string,
  token?: string | null,
): Promise<CuttingGateResultDto> {
  const res = await fetch(`${API_BASE}/inventory/cutting-gate/${orderId}`, {
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể kiểm tra Gate cắt');
  return data;
}

// ==========================================
// WORKLIST / EXECUTION API CLIENT (T4.2, FR-12)
// ==========================================

export async function fetchWorklistApi(
  token?: string | null,
  query?: { stationType?: string; status?: StepStatus },
): Promise<WorklistItemDto[]> {
  const params = new URLSearchParams();
  if (query?.stationType) params.append('stationType', query.stationType);
  if (query?.status) params.append('status', query.status);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/worklist${qs}`, {
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tải danh sách công việc');
  return data;
}

export async function startStepApi(
  stepId: string,
  token?: string | null,
): Promise<StartStepResponseDto> {
  const res = await fetch(`${API_BASE}/steps/${stepId}/start`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể bắt đầu công đoạn');
  return data;
}

export async function completeStepApi(
  stepId: string,
  token?: string | null,
): Promise<CompleteStepResponseDto> {
  const res = await fetch(`${API_BASE}/steps/${stepId}/complete`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể hoàn thành công đoạn');
  return data;
}

// ==========================================
// QUANTITY ENTRY API CLIENT (T4.3, FR-13)
// ==========================================

export async function fetchQuantityPanelApi(
  stepId: string,
  token?: string | null,
): Promise<StepQuantityPanelDto> {
  const res = await fetch(`${API_BASE}/steps/${stepId}/quantities`, {
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tải số lượng của công đoạn');
  return data;
}

export async function recordQuantityApi(
  stepId: string,
  body: RecordQuantityEntryDto,
  token?: string | null,
): Promise<StepQuantityEntryDto> {
  const res = await fetch(`${API_BASE}/steps/${stepId}/quantities`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể ghi nhận số lượng');
  return data;
}

export async function reverseQuantityApi(
  stepId: string,
  entryId: string,
  reason: string,
  token?: string | null,
): Promise<StepQuantityEntryDto> {
  const res = await fetch(`${API_BASE}/steps/${stepId}/quantities/${entryId}/reverse`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể huỷ dòng nhập');
  return data;
}

// ==========================================
// QC INSPECTION API CLIENT (T5.1, FR-16)
// ==========================================

export async function evaluateQcApi(
  stepId: string,
  body: QcEvaluationInputDto,
  token?: string | null,
): Promise<QcEvaluationDto> {
  const res = await fetch(`${API_BASE}/steps/${stepId}/qc/evaluate`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể đánh giá kết quả QC');
  return data;
}

export async function recordQcInspectionApi(
  stepId: string,
  body: RecordQcInspectionDto,
  token?: string | null,
): Promise<RecordQcInspectionResponseDto> {
  const res = await fetch(`${API_BASE}/steps/${stepId}/qc/inspections`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể ghi nhận phiếu kiểm tra QC');
  return data;
}

export async function fetchQcInspectionsApi(
  stepId: string,
  token?: string | null,
): Promise<QcInspectionDto[]> {
  const res = await fetch(`${API_BASE}/steps/${stepId}/qc/inspections`, {
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không thể tải lịch sử kiểm tra QC');
  return data;
}

// ==========================================
// AUDIT LOG VIEWER API CLIENT (T5.6, FR-25)
// ==========================================

export async function fetchAuditLogsApi(
  query: Partial<AuditLogQueryDto>,
  token?: string | null,
): Promise<AuditLogListResponseDto> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.append(key, String(value));
  }

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/audit${qs}`, {
    headers: getAuthHeaders(token),
  });
  // A proxy or crash page may answer without JSON; keep the Vietnamese message then.
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Không thể tải nhật ký kiểm toán');
  return data;
}

export async function fetchAuditFilterOptionsApi(
  token?: string | null,
): Promise<AuditLogFilterOptionsDto> {
  const res = await fetch(`${API_BASE}/audit/filter-options`, {
    headers: getAuthHeaders(token),
  });
  // A proxy or crash page may answer without JSON; keep the Vietnamese message then.
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Không thể tải bộ lọc nhật ký');
  return data;
}
