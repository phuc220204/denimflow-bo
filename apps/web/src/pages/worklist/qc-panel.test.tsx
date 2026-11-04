import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../lib/api';
import { QcPanel } from './qc-panel';

const evaluation = (proposedResult: 'PASS' | 'REWORK'): api.QcEvaluationDto => ({
  qcProfileId: '11111111-1111-4111-8111-111111111111',
  profileType: 'FULL_PROCESS',
  proposedResult,
  criteria: [
    {
      criterion: 'SHRINKAGE',
      measured: proposedResult === 'PASS' ? 2 : 4,
      limit: 3,
      passed: proposedResult === 'PASS',
      reason:
        proposedResult === 'PASS'
          ? 'Độ co 2% trong ngưỡng FULL_PROCESS (tối đa 3%)'
          : 'Độ co 4% vượt ngưỡng FULL_PROCESS (tối đa 3%)',
    },
  ],
  totalDefectQty: 0,
  defectRatePercent: 0,
});

function renderPanel(onPassed = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <QcPanel stepId="step-sew" token="qc-token" withBundles={false} onPassed={onPassed} />
    </QueryClientProvider>,
  );
  return onPassed;
}

describe('QcPanel (T5.1, FR-16)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'fetchQcInspectionsApi').mockResolvedValue([]);
    vi.spyOn(api, 'fetchReworkTargetsApi').mockResolvedValue([
      {
        id: 'target-1',
        code: 'FINISHING',
        name: 'Hoàn thiện',
        seq: 12,
        reworkCount: 0,
        maxRework: 2,
      },
    ]);
  });

  it('previews the proposal and only lets the inspector confirm a PASS (BR-19)', async () => {
    const evaluateSpy = vi.spyOn(api, 'evaluateQcApi').mockResolvedValue(evaluation('REWORK'));
    renderPanel();

    fireEvent.change(screen.getByLabelText('Cỡ mẫu'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Độ co (%)'), { target: { value: '4' } });
    fireEvent.click(screen.getByText('Xem đề xuất'));

    await waitFor(() => expect(screen.getByText(/vượt ngưỡng FULL_PROCESS/)).toBeDefined());
    expect(evaluateSpy).toHaveBeenCalledWith(
      'step-sew',
      { sampleSize: 20, measuredShrinkagePercent: 4, measuredColorFadingLevel: null, defects: [] },
      'qc-token',
    );
    // The proposal badge plus the (disabled) REWORK button.
    expect(screen.getAllByText('Làm lại')).toHaveLength(2);
    expect(screen.getByText('Xác nhận Đạt').closest('button')!.disabled).toBe(true);
  });

  it('records a PASS with the defects entered and reports the next step', async () => {
    vi.spyOn(api, 'evaluateQcApi').mockResolvedValue(evaluation('PASS'));
    const recordSpy = vi.spyOn(api, 'recordQcInspectionApi').mockResolvedValue({
      inspection: {} as api.QcInspectionDto,
      stepStatus: 'DONE',
      newlyReadyStepCodes: ['CLEAN_WASH'],
      newlySkippedStepCodes: [],
    });
    const onPassed = renderPanel();

    fireEvent.change(screen.getByLabelText('Cỡ mẫu'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Loại lỗi'), { target: { value: 'Đường may lỗi' } });
    fireEvent.change(screen.getByLabelText('Số lượng lỗi'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('Thêm lỗi'));
    fireEvent.click(screen.getByText('Xem đề xuất'));
    await waitFor(() =>
      expect(screen.getByText('Xác nhận Đạt').closest('button')!.disabled).toBe(false),
    );
    fireEvent.click(screen.getByText('Xác nhận Đạt'));

    await waitFor(() =>
      expect(recordSpy).toHaveBeenCalledWith(
        'step-sew',
        {
          sampleSize: 20,
          measuredShrinkagePercent: null,
          measuredColorFadingLevel: null,
          defects: [{ defectType: 'Đường may lỗi', qty: 2 }],
          result: 'PASS',
        },
        'qc-token',
      ),
    );
    expect(onPassed).toHaveBeenCalledWith(expect.stringContaining('CLEAN_WASH'));
  });

  it('BR-10 sends the selected target and reason for REWORK', async () => {
    vi.spyOn(api, 'evaluateQcApi').mockResolvedValue(evaluation('REWORK'));
    const recordSpy = vi.spyOn(api, 'recordQcInspectionApi').mockResolvedValue({
      inspection: { result: 'REWORK' } as never,
      stepStatus: 'PENDING',
      newlyReadyStepCodes: [],
      newlySkippedStepCodes: [],
    });
    renderPanel();
    fireEvent.change(screen.getByLabelText('Cỡ mẫu'), { target: { value: '20' } });
    fireEvent.click(screen.getByText('Xem đề xuất'));
    await screen.findByText(/vượt ngưỡng FULL_PROCESS/);
    fireEvent.change(screen.getByLabelText('Bước quay lại'), { target: { value: 'target-1' } });
    fireEvent.change(screen.getByLabelText('Lý do làm lại / loại'), {
      target: { value: 'Sửa độ co' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Làm lại' }));
    await waitFor(() =>
      expect(recordSpy).toHaveBeenCalledWith(
        'step-sew',
        expect.objectContaining({
          result: 'REWORK',
          reworkTargetStepId: 'target-1',
          reason: 'Sửa độ co',
        }),
        'qc-token',
      ),
    );
  });

  it('drops the preview when an input changes', async () => {
    vi.spyOn(api, 'evaluateQcApi').mockResolvedValue(evaluation('PASS'));
    renderPanel();

    fireEvent.change(screen.getByLabelText('Cỡ mẫu'), { target: { value: '20' } });
    fireEvent.click(screen.getByText('Xem đề xuất'));
    await waitFor(() =>
      expect(screen.getByText('Xác nhận Đạt').closest('button')!.disabled).toBe(false),
    );

    fireEvent.change(screen.getByLabelText('Độ co (%)'), { target: { value: '9' } });
    expect(screen.getByText('Xác nhận Đạt').closest('button')!.disabled).toBe(true);
  });
});
