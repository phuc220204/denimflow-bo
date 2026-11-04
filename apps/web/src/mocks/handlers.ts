import { type DashboardWipSummaryDto, Role } from '@denimflow/shared';
import { http, HttpResponse } from 'msw';

// Demo numbers for /dashboard/wip (T5.5, FR-21): one order at sewing, one waiting for final QC.
export const mockDashboardWip: DashboardWipSummaryDto = {
  ordersByStatus: {
    DRAFT: 2,
    CONFIRMED: 1,
    IN_PRODUCTION: 2,
    ON_HOLD: 0,
    COMPLETED: 3,
    CANCELLED: 0,
  },
  totals: {
    totalOrders: 8,
    activeOrders: 3,
    completedOrders: 3,
    wipBundleCount: 4,
    wipQty: 187,
    totalQtyDefect: 14,
    totalReworkCount: 1,
    waitingQcOrderCount: 1,
  },
  steps: [
    {
      stepCode: 'CUTTING',
      stepName: 'Spreading and cutting',
      seq: 6,
      stationType: 'CUTTING',
      tracksQuantities: true,
      openOrderCount: 0,
      wipBundleCount: 0,
      wipQty: 0,
      qtyIn: 500,
      qtyGood: 492,
      qtyDefect: 8,
      reworkCount: 0,
    },
    {
      stepCode: 'SEWING',
      stepName: 'Sewing',
      seq: 8,
      stationType: 'SEWING',
      tracksQuantities: true,
      openOrderCount: 1,
      wipBundleCount: 2,
      wipQty: 98,
      qtyIn: 398,
      qtyGood: 392,
      qtyDefect: 6,
      reworkCount: 1,
    },
    {
      stepCode: 'FINAL_QC',
      stepName: 'Final QC',
      seq: 13,
      stationType: 'QC',
      tracksQuantities: false,
      openOrderCount: 1,
      wipBundleCount: 2,
      wipQty: 89,
      qtyIn: 0,
      qtyGood: 0,
      qtyDefect: 0,
      reworkCount: 0,
    },
  ],
  waitingQc: [
    {
      orderId: '6f1c2a8e-0b3d-4c5e-9f7a-1b2c3d4e5f60',
      orderNumber: 'PO-20261019-002',
      styleCode: 'JN-SLIM-01',
      stepInstanceId: '7a2d3b9f-1c4e-4d6f-8a8b-2c3d4e5f6a71',
      stepCode: 'FINAL_QC',
      stepName: 'Final QC',
      stationType: 'QC',
      status: 'READY',
      startedAt: null,
    },
  ],
};

export const handlers = [
  // Mock /health endpoint
  http.get('*/health', () => {
    return HttpResponse.json({
      status: 'ok',
      db: 'up',
    });
  }),

  // Mock /me endpoint
  http.get('*/me', ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new HttpResponse(null, { status: 401 });
    }

    return HttpResponse.json({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@denimflow.local',
      fullName: 'Trần Văn Quản Trị',
      role: Role.ADMIN,
      isActive: true,
    });
  }),

  // Mock /dashboard/wip endpoint (T5.5, FR-21)
  http.get('*/dashboard/wip', () => HttpResponse.json(mockDashboardWip)),
];
