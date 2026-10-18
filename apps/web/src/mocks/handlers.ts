import { Role } from '@denimflow/shared';
import { http, HttpResponse } from 'msw';

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
  http.get('*/dashboard/wip', () => {
    return HttpResponse.json({
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
          stepName: 'Cắt vải',
          activeStepCount: 2,
          totalQtyIn: 200,
          totalQtyGood: 196,
          totalQtyDefect: 4,
          bundleCount: 4,
        },
        {
          stationType: 'SEWING',
          stepCode: 'SEWING',
          stepName: 'May ráp',
          activeStepCount: 3,
          totalQtyIn: 196,
          totalQtyGood: 188,
          totalQtyDefect: 8,
          bundleCount: 4,
        },
      ],
      totals: {
        totalOrders: 19,
        activeOrders: 8,
        completedOrders: 8,
        waitingQcCount: 1,
        totalQtyGood: 384,
        totalQtyDefect: 12,
        totalReworkCount: 2,
      },
      waitingQcOrders: [
        {
          orderId: '00000000-0000-0000-0000-000000000101',
          orderNumber: 'ORD-DEMO-001',
          styleCode: 'JN-SLIM-01',
          stepInstanceId: '00000000-0000-0000-0000-000000000201',
          stepCode: 'SEWING_QC',
          stepName: 'QC May ráp',
          stationType: 'QC',
          startedAt: '2026-10-18T10:00:00.000Z',
        },
      ],
    });
  }),
];
