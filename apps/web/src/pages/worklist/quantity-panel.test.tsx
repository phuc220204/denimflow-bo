import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../lib/api';
import { QuantityPanel } from './quantity-panel';

const cuttingPanel: api.StepQuantityPanelDto = {
  stepId: 'step-cut',
  stepCode: 'CUTTING',
  status: 'IN_PROGRESS',
  mode: 'CUTTING',
  isOutsourced: false,
  qtyIn: 41,
  qtyGood: 40,
  qtyDefect: 1,
  previousGood: null,
  sizes: [{ size: '30', plannedQty: 100, maxQty: 105, cutQty: 41 }],
  bundles: [],
  entries: [
    {
      id: 'entry-1',
      stepInstanceId: 'step-cut',
      bundleId: null,
      bundleCode: null,
      size: '30',
      qtyGood: 40,
      qtyDefect: 1,
      qtySent: null,
      qtyReceived: null,
      mismatchReason: null,
      note: null,
      reversesEntryId: null,
      isReversed: false,
      enteredBy: 'op',
      enteredAt: '2026-10-19T08:00:00.000Z',
    },
  ],
};

const outsourcedPanel: api.StepQuantityPanelDto = {
  ...cuttingPanel,
  stepId: 'step-dye',
  stepCode: 'DYEING',
  mode: 'BUNDLE',
  isOutsourced: true,
  previousGood: 100,
  sizes: [],
  bundles: [{ id: 'b1', bundleCode: 'PO-1-B001', size: '30', availableQty: 50, takenQty: 10 }],
  entries: [],
};

function renderPanel(canEdit = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <QuantityPanel stepId="step-cut" token="operator-token" canEdit={canEdit} />
    </QueryClientProvider>,
  );
}

describe('QuantityPanel (T4.3, FR-13)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the cut per size and sends size, good and defect quantities', async () => {
    vi.spyOn(api, 'fetchQuantityPanelApi').mockResolvedValue(cuttingPanel);
    const recordSpy = vi
      .spyOn(api, 'recordQuantityApi')
      .mockResolvedValue(cuttingPanel.entries[0]!);

    renderPanel();

    await waitFor(() => expect(screen.getByText('105')).toBeDefined());
    fireEvent.change(screen.getByLabelText('Số lượng đạt'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Số lượng lỗi'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('Ghi nhận số lượng'));

    await waitFor(() =>
      expect(recordSpy).toHaveBeenCalledWith(
        'step-cut',
        { size: '30', qtyGood: 10, qtyDefect: 2 },
        'operator-token',
      ),
    );
  });

  it('asks an outsourced station for sent and received quantities (BR-09)', async () => {
    vi.spyOn(api, 'fetchQuantityPanelApi').mockResolvedValue(outsourcedPanel);

    renderPanel();

    await waitFor(() => expect(screen.getByLabelText('Số gửi đi')).toBeDefined());
    expect(screen.getByLabelText('Số nhận về')).toBeDefined();
    expect(screen.getByText('PO-1-B001 (size 30, còn 40)')).toBeDefined();
  });

  it('cancels an entry only with a reason (R-22)', async () => {
    vi.spyOn(api, 'fetchQuantityPanelApi').mockResolvedValue(cuttingPanel);
    const reverseSpy = vi
      .spyOn(api, 'reverseQuantityApi')
      .mockResolvedValue({ ...cuttingPanel.entries[0]!, id: 'entry-2' });

    renderPanel();

    await waitFor(() => expect(screen.getByText('Huỷ dòng')).toBeDefined());
    fireEvent.click(screen.getByText('Huỷ dòng'));
    const confirm = screen.getByText('Xác nhận').closest('button')!;
    expect(confirm.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Lý do huỷ'), { target: { value: 'Gõ nhầm' } });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(reverseSpy).toHaveBeenCalledWith('step-cut', 'entry-1', 'Gõ nhầm', 'operator-token'),
    );
  });

  it('is read-only for someone who does not work the step', async () => {
    vi.spyOn(api, 'fetchQuantityPanelApi').mockResolvedValue(cuttingPanel);

    renderPanel(false);

    await waitFor(() => expect(screen.getByText('105')).toBeDefined());
    expect(screen.queryByText('Ghi nhận số lượng')).toBeNull();
    expect(screen.queryByText('Huỷ dòng')).toBeNull();
  });
});
