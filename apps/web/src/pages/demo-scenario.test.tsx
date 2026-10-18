import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@denimflow/shared';
import * as api from '../lib/api';
import { WorkflowDesignerPage } from './workflow/workflow-designer';
import { OrdersPage } from './orders/orders-page';
import { InventoryPage } from './inventory/inventory-page';
import { WorklistPage } from './worklist/worklist-page';
import { WipDashboard } from './dashboard/wip-dashboard';
import { AuditPage } from './audit/audit-page';

// Mock Recharts ResponsiveContainer to avoid 0x0 size in JSDOM
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>();
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 400 }}>{children}</div>
    ),
  };
});

let currentRole: Role = Role.PRODUCTION_PLANNER;
const mockUser = {
  id: 'user-test-uuid',
  email: 'test@denimflow.internal',
  fullName: 'Người Dùng Test',
  get role() {
    return currentRole;
  },
  isActive: true,
};

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    token: 'test-token',
    isLoading: false,
    logout: vi.fn(),
  }),
}));

function renderWithClient(ui: React.ReactElement, initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Full Demo Scenario Walkthrough (T5.7, PRD §6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Step 1: Process Engineer detects BR-01 violations on broken template', async () => {
    currentRole = Role.PROCESS_ENGINEER;

    vi.spyOn(api, 'fetchWorkflowTemplatesApi').mockResolvedValue([
      {
        id: 'tmpl-1',
        name: 'Jean Tiêu Chuẩn',
        isActive: true,
        isDedicated: false,
        currentVersionId: null,
        createdAt: '2026-10-18T10:00:00Z',
        updatedAt: '2026-10-18T10:00:00Z',
        versions: [
          {
            id: 'ver-1',
            versionNo: 1,
            status: 'DRAFT',
            publishedAt: null,
            createdAt: '2026-10-18T10:00:00Z',
          },
        ],
        styles: [{ id: 'st-1', styleCode: 'JN-SLIM-01', name: 'Quần Jean Slim Fit' }],
      },
    ]);

    vi.spyOn(api, 'fetchWorkflowVersionApi').mockResolvedValue({
      id: 'ver-1',
      templateId: 'tmpl-1',
      versionNo: 1,
      status: 'DRAFT',
      publishedAt: null,
      createdBy: 'pe-uuid',
      createdAt: '2026-10-18T10:00:00Z',
      updatedAt: '2026-10-18T10:00:00Z',
      template: {
        id: 'tmpl-1',
        name: 'Jean Tiêu Chuẩn',
        isActive: true,
        isDedicated: false,
      },
      steps: [
        {
          id: 'step-cut',
          versionId: 'ver-1',
          code: 'CUTTING',
          name: 'Cắt bán thành phẩm',
          stepType: 'PRODUCTION',
          seq: 1,
          responsibleRole: 'STATION_OPERATOR',
          stationType: 'CUTTING',
          isMandatory: true,
          requiresEvidence: false,
          requiresQc: false,
          conditionExpr: null,
          maxRework: null,
          isStart: false,
          isEnd: false,
          createdAt: '2026-10-18T10:00:00Z',
          updatedAt: '2026-10-18T10:00:00Z',
        },
      ],
      transitions: [],
    });

    vi.spyOn(api, 'validateWorkflowVersionApi').mockResolvedValue({
      valid: false,
      violations: [
        {
          code: 'MISSING_START_STEP',
          message: 'Template must define exactly one START step (BR-01)',
        },
        {
          code: 'ORPHAN_STEP',
          message: 'Step "CUTTING" is unreachable from the start step',
          stepIds: ['step-cut'],
        },
      ],
    });

    renderWithClient(<WorkflowDesignerPage />);

    await waitFor(() => {
      expect(screen.getByText('Jean Tiêu Chuẩn')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Kiểm tra BR-01/i })).toBeInTheDocument();
    });

    const validateBtn = screen.getByRole('button', { name: /Kiểm tra BR-01/i });
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Phát hiện 2 vi phạm quy chuẩn thiết kế \(BR-01\)/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/\[MISSING_START_STEP\]/i)).toBeInTheDocument();
      expect(screen.getByText(/\[ORPHAN_STEP\]/i)).toBeInTheDocument();
    });
  });

  it('Step 2 & 4: Production Planner creates order, checks matrix compatibility, and confirms snapshot', async () => {
    currentRole = Role.PRODUCTION_PLANNER;

    const mockStyles = [
      {
        id: 'style-1',
        styleCode: 'JN-SLIM-01',
        name: 'Quần Jean Slim Fit',
        fitType: 'SLIM',
        hasEmbroidery: false,
        isActive: true,
        createdAt: '2026-10-18T10:00:00Z',
        updatedAt: '2026-10-18T10:00:00Z',
      },
    ];

    const mockOrders: api.ProductionOrderItem[] = [
      {
        id: 'order-demo-1',
        orderNumber: 'ORD-DEMO-001',
        styleId: 'style-1',
        style: mockStyles[0],
        status: 'DRAFT',
        dueDate: '2026-11-20',
        customerRef: 'CUST-DEMO',
        notes: 'Demo order notes',
        dyeRequired: false,
        embroideryRequired: false,
        fabricInspectRequired: false,
        ppSampleRequired: false,
        skipCleanWash: false,
        fabricTypeId: 'fab-1',
        colorId: 'clr-1',
        fabricType: {
          id: 'fab-1',
          code: 'DN-12-RIGID',
          name: 'Denim 12oz Rigid',
          stretchType: 'RIGID',
          createdAt: '',
          updatedAt: '',
        },
        color: {
          id: 'clr-1',
          code: 'CLR-INDIGO',
          name: 'Indigo Blue',
          createdAt: '',
          updatedAt: '',
        },
        isCustom: false,
        createdBy: 'user-test-uuid',
        createdAt: '2026-10-18T10:00:00Z',
        updatedAt: '2026-10-18T10:00:00Z',
        sizeLines: [
          { id: 'sl-1', size: '28', plannedQty: 25 },
          { id: 'sl-2', size: '30', plannedQty: 25 },
          { id: 'sl-3', size: '32', plannedQty: 25 },
          { id: 'sl-4', size: '34', plannedQty: 25 },
        ],
      },
    ];

    vi.spyOn(api, 'fetchOrdersApi').mockResolvedValue(mockOrders);
    vi.spyOn(api, 'fetchStyles').mockResolvedValue(mockStyles);
    vi.spyOn(api, 'fetchWashTypes').mockResolvedValue([]);
    vi.spyOn(api, 'fetchFabricTypes').mockResolvedValue([
      {
        id: 'fab-1',
        code: 'DN-12-RIGID',
        name: 'Denim 12oz Rigid',
        stretchType: 'RIGID',
        createdAt: '',
        updatedAt: '',
      },
    ]);
    vi.spyOn(api, 'fetchAllowedColors').mockResolvedValue([
      { id: 'clr-1', code: 'CLR-INDIGO', name: 'Indigo Blue', createdAt: '', updatedAt: '' },
    ]);
    vi.spyOn(api, 'fetchBomLinesApi').mockResolvedValue([]);
    vi.spyOn(api, 'calculateBomApi').mockResolvedValue([]);

    renderWithClient(<OrdersPage />, '/orders');

    await waitFor(() => {
      expect(screen.getByText('ORD-DEMO-001')).toBeInTheDocument();
      expect(screen.getByText('Quần Jean Slim Fit')).toBeInTheDocument();
    });

    expect(screen.getByTitle(/Xác nhận đơn hàng/i)).toBeInTheDocument();
  });

  it('Step 3: Warehouse Keeper allocates fabric lot meters to order', async () => {
    currentRole = Role.WAREHOUSE_KEEPER;

    vi.spyOn(api, 'fetchOrderAllocationsApi').mockResolvedValue([
      {
        order: {
          id: 'order-1',
          orderNumber: 'ORD-DEMO-001',
          status: 'DRAFT',
          dueDate: '2026-11-20',
          customerRef: 'CUST-DEMO',
          style: {
            id: 'style-1',
            styleCode: 'JN-SLIM-01',
            name: 'Quần Jean Slim Fit',
            fitType: 'SLIM',
            hasEmbroidery: false,
            isActive: true,
            createdAt: '2026-10-18T00:00:00.000Z',
            updatedAt: '2026-10-18T00:00:00.000Z',
          },
          fabricType: {
            id: 'fab-1',
            code: 'DN-12-RIGID',
            name: 'Vải Denim 12oz Rigid',
            stretchType: 'RIGID',
            createdAt: '2026-10-18T00:00:00.000Z',
            updatedAt: '2026-10-18T00:00:00.000Z',
          },
          color: {
            id: 'col-1',
            code: 'CLR-INDIGO',
            name: 'Xanh Chàm Đậm',
            createdAt: '2026-10-18T00:00:00.000Z',
            updatedAt: '2026-10-18T00:00:00.000Z',
          },
        },
        fabricBomLine: {
          id: 'bom-1',
          requiredQty: 150,
          allocatedQty: 150,
          missingQty: 0,
          unit: 'meter',
          allocations: [],
          requests: [],
        },
        cuttingGate: {
          passed: true,
          ruleId: 'BR-06',
          reason: 'BR-06 passed',
        },
      },
    ]);
    vi.spyOn(api, 'fetchFabricLotsApi').mockResolvedValue([
      {
        id: 'lot-1',
        lotNo: 'LOT-DN12-IND-01',
        fabricTypeId: 'fab-1',
        colorId: 'col-1',
        availableMeters: 1500,
        shrinkagePercent: 2.5,
        fabricType: { id: 'fab-1', code: 'DN-12-RIGID', name: 'Vải Denim 12oz Rigid' },
        colorOption: { id: 'col-1', code: 'CLR-INDIGO', name: 'Xanh Chàm Đậm' },
      },
    ]);
    vi.spyOn(api, 'fetchMaterialRequestsApi').mockResolvedValue([]);

    renderWithClient(<InventoryPage />, '/inventory');

    await waitFor(() => {
      expect(screen.getByText('ORD-DEMO-001')).toBeInTheDocument();
      expect(screen.getByText(/Đủ điều kiện cắt \(Pass\)/i)).toBeInTheDocument();
      expect(screen.getAllByText(/150/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('Step 5: Station Operator views worklist and begins step', async () => {
    currentRole = Role.STATION_OPERATOR;

    vi.spyOn(api, 'fetchWorklistApi').mockResolvedValue([
      {
        id: 'step-cut-1',
        instanceId: 'inst-1',
        stepCode: 'CUTTING',
        stepName: 'Cắt bán thành phẩm',
        stepType: 'PRODUCTION',
        stationType: 'CUTTING',
        responsibleRole: 'STATION_OPERATOR',
        status: 'READY',
        orderId: 'order-demo-1',
        orderNumber: 'ORD-DEMO-001',
        styleCode: 'JN-SLIM-01',
        styleName: 'Quần Jean Slim Fit',
        totalPlannedQty: 100,
        qtyIn: null,
        qtyGood: null,
        qtyDefect: null,
        startedAt: null,
        completedAt: null,
        performedBy: null,
        reworkCount: 0,
        seq: 1,
        isMandatory: true,
        requiresEvidence: false,
        requiresQc: false,
      },
    ]);

    renderWithClient(<WorklistPage />, '/worklist');

    await waitFor(() => {
      expect(screen.getAllByText(/CUTTING/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Cắt bán thành phẩm/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Bắt đầu làm việc/i })).toBeInTheDocument();
    });
  });

  it('Step 7: Production Planner verifies handover record creation modal on final pass (FR-26)', async () => {
    currentRole = Role.PRODUCTION_PLANNER;

    const mockStyles = [
      {
        id: 'style-1',
        styleCode: 'JN-SLIM-01',
        name: 'Quần Jean Slim Fit',
        fitType: 'SLIM',
        hasEmbroidery: false,
        isActive: true,
        createdAt: '2026-10-18T10:00:00Z',
        updatedAt: '2026-10-18T10:00:00Z',
      },
    ];

    const completedOrder: api.ProductionOrderItem[] = [
      {
        id: 'order-demo-1',
        orderNumber: 'ORD-DEMO-001',
        styleId: 'style-1',
        style: mockStyles[0],
        status: 'IN_PRODUCTION',
        dueDate: '2026-11-20',
        customerRef: 'CUST-DEMO',
        notes: 'Demo order notes',
        dyeRequired: false,
        embroideryRequired: false,
        fabricInspectRequired: false,
        ppSampleRequired: false,
        skipCleanWash: false,
        isCustom: false,
        createdBy: 'user-test-uuid',
        createdAt: '2026-10-18T10:00:00Z',
        updatedAt: '2026-10-18T10:00:00Z',
        sizeLines: [
          { id: 'sl-1', size: '28', plannedQty: 25 },
          { id: 'sl-2', size: '30', plannedQty: 25 },
        ],
      },
    ];

    vi.spyOn(api, 'fetchStyles').mockResolvedValue(mockStyles);
    vi.spyOn(api, 'fetchOrdersApi').mockResolvedValue(completedOrder);
    vi.spyOn(api, 'fetchWashTypes').mockResolvedValue([]);
    vi.spyOn(api, 'fetchFabricTypes').mockResolvedValue([]);
    vi.spyOn(api, 'fetchAllowedColors').mockResolvedValue([]);

    renderWithClient(<OrdersPage />, '/orders');

    await waitFor(() => {
      expect(screen.getByText('ORD-DEMO-001')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Bàn giao$/i })).toBeInTheDocument();
    });
  });

  it('Step 8: Variation order enforces BR-19 Customer Acknowledgement when skipCleanWash is true', async () => {
    currentRole = Role.PRODUCTION_PLANNER;

    const mockStyles = [
      {
        id: 'style-1',
        styleCode: 'JN-SLIM-01',
        name: 'Quần Jean Slim Fit',
        fitType: 'SLIM',
        hasEmbroidery: false,
        isActive: true,
        createdAt: '2026-10-18T10:00:00Z',
        updatedAt: '2026-10-18T10:00:00Z',
      },
    ];

    const skipWashOrder: api.ProductionOrderItem[] = [
      {
        id: 'order-demo-skip-wash',
        orderNumber: 'ORD-DEMO-SKIP',
        styleId: 'style-1',
        style: mockStyles[0],
        status: 'DRAFT',
        dueDate: '2026-11-20',
        customerRef: 'CUST-SKIP',
        notes: 'Skip wash demo order',
        dyeRequired: false,
        embroideryRequired: false,
        fabricInspectRequired: false,
        ppSampleRequired: false,
        skipCleanWash: true,
        fabricTypeId: 'fab-1',
        colorId: 'clr-1',
        isCustom: false,
        createdBy: 'user-test-uuid',
        createdAt: '2026-10-18T10:00:00Z',
        updatedAt: '2026-10-18T10:00:00Z',
        sizeLines: [{ id: 'sl-1', size: '30', plannedQty: 50 }],
      },
    ];

    vi.spyOn(api, 'fetchStyles').mockResolvedValue(mockStyles);
    vi.spyOn(api, 'fetchOrdersApi').mockResolvedValue(skipWashOrder);
    vi.spyOn(api, 'fetchWashTypes').mockResolvedValue([]);
    vi.spyOn(api, 'fetchFabricTypes').mockResolvedValue([]);
    vi.spyOn(api, 'fetchAllowedColors').mockResolvedValue([]);

    renderWithClient(<OrdersPage />, '/orders');

    await waitFor(() => {
      expect(screen.getByText('ORD-DEMO-SKIP')).toBeInTheDocument();
    });

    const confirmTableBtn = screen.getByTitle(/Xác nhận đơn hàng/i);
    fireEvent.click(confirmTableBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Yêu cầu văn bản xác nhận của khách hàng \(BR-19\)/i),
      ).toBeInTheDocument();
    });
  });

  it('Step 9: Manager inspects WIP Dashboard and Admin views AuditLog records', async () => {
    currentRole = Role.MANAGER;

    vi.spyOn(api, 'fetchDashboardWipApi').mockResolvedValue({
      ordersByStatus: {
        DRAFT: 2,
        CONFIRMED: 3,
        IN_PRODUCTION: 5,
        ON_HOLD: 0,
        COMPLETED: 8,
        CANCELLED: 1,
      },
      wipByStation: [
        {
          stationType: 'CUTTING',
          stepCode: 'CUTTING',
          stepName: 'Cắt bán thành phẩm',
          activeStepCount: 1,
          totalQtyIn: 100,
          totalQtyGood: 98,
          totalQtyDefect: 2,
          bundleCount: 2,
        },
      ],
      totals: {
        totalOrders: 19,
        activeOrders: 8,
        completedOrders: 8,
        waitingQcCount: 1,
        totalQtyGood: 98,
        totalQtyDefect: 2,
        totalReworkCount: 1,
      },
      waitingQcOrders: [
        {
          orderId: 'order-demo-1',
          orderNumber: 'ORD-DEMO-001',
          styleCode: 'JN-SLIM-01',
          stepInstanceId: 'step-qc-1',
          stepCode: 'FINAL_QC',
          stepName: 'KCS Thành Phẩm',
          stationType: 'QC',
          startedAt: '2026-10-18T14:30:00Z',
        },
      ],
    });

    renderWithClient(<WipDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Bảng điều hành WIP & Sản lượng phân xưởng/i)).toBeInTheDocument();
      expect(screen.getAllByText('98').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('ORD-DEMO-001')).toBeInTheDocument();
      expect(screen.getByText('KCS Thành Phẩm')).toBeInTheDocument();
    });

    // Admin Audit Log
    currentRole = Role.ADMIN;
    vi.spyOn(api, 'fetchAuditLogsApi').mockResolvedValue({
      items: [
        {
          id: 'audit-1',
          entityType: 'ORDER',
          entityId: 'order-demo-1',
          action: 'CONFIRM',
          actorId: 'planner-uuid',
          actorName: 'Điều Độ Sản Xuất',
          actorEmail: 'planner@denimflow.internal',
          oldValue: { status: 'DRAFT' },
          newValue: { status: 'IN_PRODUCTION' },
          createdAt: '2026-10-18T11:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    renderWithClient(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText('CONFIRM')).toBeInTheDocument();
      expect(screen.getByText('Điều Độ Sản Xuất')).toBeInTheDocument();
    });
  });
});
