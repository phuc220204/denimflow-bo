import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedLayout } from '../../layouts/protected-layout';
import * as api from '../../lib/api';
import { WorkflowDesignerPage } from './workflow-designer';

import { Role } from '@denimflow/shared';

let mockUser: {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
} = {
  id: 'pe-uuid',
  email: 'pe@denimflow.internal',
  fullName: 'Kỹ Sư Quy Trình',
  role: Role.PROCESS_ENGINEER,
  isActive: true,
};

vi.mock('../../lib/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    token: 'pe-token',
    isLoading: false,
    logout: vi.fn(),
  }),
}));

const mockTemplates: api.WorkflowTemplateItem[] = [
  {
    id: 'tpl-1',
    name: 'Jean Tiêu Chuẩn',
    isActive: true,
    isDedicated: false,
    currentVersionId: 'ver-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    versions: [
      {
        id: 'ver-1',
        versionNo: 1,
        status: 'PUBLISHED',
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ver-2',
        versionNo: 2,
        status: 'DRAFT',
        publishedAt: null,
        createdAt: new Date().toISOString(),
      },
    ],
    styles: [{ id: 'st-1', styleCode: 'JS-01', name: 'Slim Jeans' }],
  },
];

const mockVersion1Published: api.WorkflowVersionDetail = {
  id: 'ver-1',
  templateId: 'tpl-1',
  versionNo: 1,
  status: 'PUBLISHED',
  publishedAt: new Date().toISOString(),
  createdBy: 'pe-uuid',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  template: {
    id: 'tpl-1',
    name: 'Jean Tiêu Chuẩn',
    isActive: true,
    isDedicated: false,
  },
  steps: [
    {
      id: 'step-1',
      versionId: 'ver-1',
      code: 'START_STEP',
      name: 'Kiểm tra nguyên liệu',
      stepType: 'MATERIAL' as const,
      seq: 1,
      responsibleRole: 'WAREHOUSE_KEEPER' as const,
      stationType: null,
      isMandatory: true,
      requiresEvidence: false,
      requiresQc: false,
      conditionExpr: null,
      maxRework: null,
      isStart: true,
      isEnd: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'step-2',
      versionId: 'ver-1',
      code: 'END_STEP',
      name: 'Đóng gói thành phẩm',
      stepType: 'PRODUCTION' as const,
      seq: 2,
      responsibleRole: 'STATION_OPERATOR' as const,
      stationType: 'PACKING' as const,
      isMandatory: true,
      requiresEvidence: false,
      requiresQc: false,
      conditionExpr: null,
      maxRework: null,
      isStart: false,
      isEnd: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  transitions: [
    {
      id: 'trans-1',
      versionId: 'ver-1',
      fromStepId: 'step-1',
      toStepId: 'step-2',
      kind: 'NORMAL' as const,
      conditionExpr: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

const mockVersion2Draft: api.WorkflowVersionDetail = {
  ...mockVersion1Published,
  id: 'ver-2',
  versionNo: 2,
  status: 'DRAFT',
  publishedAt: null,
};

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    fetchWorkflowTemplatesApi: vi.fn(),
    fetchWorkflowVersionApi: vi.fn(),
    createWorkflowTemplateApi: vi.fn(),
    createWorkflowVersionApi: vi.fn(),
    validateWorkflowVersionApi: vi.fn(),
    publishWorkflowVersionApi: vi.fn(),
    addStepApi: vi.fn(),
    updateStepApi: vi.fn(),
    deleteStepApi: vi.fn(),
    addTransitionApi: vi.fn(),
    deleteTransitionApi: vi.fn(),
    assignTemplateToStyleApi: vi.fn(),
    fetchStyles: vi
      .fn()
      .mockResolvedValue([{ id: 'st-1', styleCode: 'JS-01', name: 'Slim Jeans' }]),
  };
});

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>,
  );
}

describe('WorkflowDesignerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: 'pe-uuid',
      email: 'pe@denimflow.internal',
      fullName: 'Kỹ Sư Quy Trình',
      role: 'PROCESS_ENGINEER',
      isActive: true,
    };
    vi.mocked(api.fetchWorkflowTemplatesApi).mockResolvedValue(mockTemplates);
    vi.mocked(api.fetchWorkflowVersionApi).mockResolvedValue(mockVersion2Draft);
  });

  it('renders workflow templates and versions correctly for Process Engineer', async () => {
    renderWithClient(<WorkflowDesignerPage />);

    expect(screen.getByText('Thiết kế quy trình sản xuất')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Jean Tiêu Chuẩn')).toBeInTheDocument();
      expect(screen.getByText('Phiên bản v2 (Nháp)')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Kiểm tra BR-01/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xuất bản \(Publish\)/i })).toBeInTheDocument();
  });

  it('switches to step list tab and displays steps', async () => {
    renderWithClient(<WorkflowDesignerPage />);

    await waitFor(() => {
      expect(screen.getByText('Jean Tiêu Chuẩn')).toBeInTheDocument();
    });

    const stepsTabBtn = screen.getByRole('button', { name: /Danh sách bước/i });
    fireEvent.click(stepsTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Kiểm tra nguyên liệu')).toBeInTheDocument();
      expect(screen.getByText('Đóng gói thành phẩm')).toBeInTheDocument();
    });

    expect(screen.getByText('START_STEP')).toBeInTheDocument();
    expect(screen.getByText('END_STEP')).toBeInTheDocument();
  });

  it('validates template graph and displays success banner on valid result', async () => {
    vi.mocked(api.validateWorkflowVersionApi).mockResolvedValueOnce({
      valid: true,
      violations: [],
    });

    renderWithClient(<WorkflowDesignerPage />);

    await waitFor(() => {
      expect(screen.getByText('Jean Tiêu Chuẩn')).toBeInTheDocument();
    });

    const validateBtn = screen.getByRole('button', { name: /Kiểm tra BR-01/i });
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Quy trình hoàn toàn hợp lệ \(Tuân thủ BR-01\)/i),
      ).toBeInTheDocument();
    });
  });

  it('validates template graph and displays violation alerts on invalid result', async () => {
    vi.mocked(api.validateWorkflowVersionApi).mockResolvedValueOnce({
      valid: false,
      violations: [
        {
          code: 'ORPHAN_STEP',
          message: 'Step "CUTTING" is unreachable from the start step',
          stepIds: ['step-orphan'],
        },
      ],
    });

    renderWithClient(<WorkflowDesignerPage />);

    await waitFor(() => {
      expect(screen.getByText('Jean Tiêu Chuẩn')).toBeInTheDocument();
    });

    const validateBtn = screen.getByRole('button', { name: /Kiểm tra BR-01/i });
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Phát hiện 1 vi phạm quy chuẩn thiết kế \(BR-01\)/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/\[ORPHAN_STEP\]/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Step "CUTTING" is unreachable from the start step/i),
      ).toBeInTheDocument();
    });
  });

  it('displays immutability alert and disables edit controls on PUBLISHED version', async () => {
    vi.mocked(api.fetchWorkflowVersionApi).mockResolvedValueOnce(mockVersion1Published);

    renderWithClient(<WorkflowDesignerPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Phiên bản đã xuất bản \/ đóng băng \(Bất biến theo quy tắc BR-02\)/i),
      ).toBeInTheDocument();
    });

    const publishBtn = screen.getByRole('button', { name: /Xuất bản \(Publish\)/i });
    expect(publishBtn).toBeDisabled();
  });

  it('blocks unauthorized roles from reaching the workflow designer (RBAC)', async () => {
    mockUser = {
      id: 'op-uuid',
      email: 'operator@denimflow.internal',
      fullName: 'Công Nhân Trạm',
      role: Role.STATION_OPERATOR,
      isActive: true,
    };

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workflow']}>
          <Routes>
            <Route path="/" element={<ProtectedLayout />}>
              <Route path="workflow" element={<WorkflowDesignerPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Khu vực giới hạn quyền hạn')).toBeInTheDocument();
      expect(screen.queryByText('Thiết kế quy trình sản xuất')).not.toBeInTheDocument();
    });
  });
});
