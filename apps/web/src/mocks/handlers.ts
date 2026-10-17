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
];
