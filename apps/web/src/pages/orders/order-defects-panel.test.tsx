import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { it, expect, vi } from 'vitest';
import * as api from '../../lib/api';
import { OrderDefectsPanel } from './order-defects-panel';
it('FR-18 shows the defect, its bundle, step and inspector', async () => {
  vi.spyOn(api, 'fetchOrderDefectsApi').mockResolvedValue([
    {
      id: 'd1',
      inspectionId: 'i1',
      stepCode: 'SEWING',
      stepName: 'May',
      bundleCode: 'DEMO-B001',
      defectType: 'Đường may lỗi',
      qty: 2,
      inspectorName: 'QC Demo',
      createdAt: '2026-11-05',
    },
  ]);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <OrderDefectsPanel orderId="order1" onClose={() => {}} />
    </QueryClientProvider>,
  );
  expect(await screen.findByText('Đường may lỗi')).toBeInTheDocument();
  expect(screen.getByText('DEMO-B001')).toBeInTheDocument();
  expect(screen.getByText('QC Demo')).toBeInTheDocument();
});
