import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessRuleViolation } from '../../common/errors/business-rule-violation.js';
import type { ExecutionRepository } from './execution.repository.js';
import { QuantityService } from './quantity.service.js';

const operator = {
  id: 'user-op',
  email: 'op@denimflow.test',
  fullName: 'Operator',
  role: 'STATION_OPERATOR',
  isActive: true,
};

const definition = (code: string, seq: number, stationType: string | null) => ({
  code,
  name: code,
  seq,
  stepType: 'PRODUCTION',
  responsibleRole: 'STATION_OPERATOR',
  stationType,
});

const steps = [
  {
    id: 'step-CUTTING',
    status: 'DONE',
    qtyGood: 100,
    stepDefinition: definition('CUTTING', 6, 'CUTTING'),
  },
  {
    id: 'step-EMBROIDERY',
    status: 'SKIPPED',
    qtyGood: null,
    stepDefinition: definition('EMBROIDERY', 7, 'EMBROIDERY'),
  },
  {
    id: 'step-SEWING',
    status: 'IN_PROGRESS',
    qtyGood: null,
    stepDefinition: definition('SEWING', 8, 'SEWING'),
  },
];

const quantityStep = (code: string, status = 'IN_PROGRESS') => ({
  ...steps.find((s) => s.stepDefinition.code === code)!,
  status,
  qtyIn: 0,
  qtyDefect: 0,
  instance: {
    order: {
      id: 'order-1',
      orderNumber: 'PO-1',
      style: { cutTolerancePercent: 5 },
      sizeLines: [{ size: '30', plannedQty: 100 }],
    },
    stepInstances: steps,
  },
});

const entry = (overrides: Record<string, unknown> = {}) => ({
  id: 'entry-1',
  stepInstanceId: 'step-SEWING',
  bundleId: 'bundle-1',
  size: null,
  qtyGood: 10,
  qtyDefect: 0,
  qtySent: null,
  qtyReceived: null,
  mismatchReason: null,
  note: null,
  reversesEntryId: null,
  reversedBy: null,
  bundle: { bundleCode: 'PO-1-B001' },
  enteredBy: 'user-op',
  enteredAt: new Date('2026-10-19T08:00:00Z'),
  ...overrides,
});

const createRepo = () => ({
  runInTransaction: vi.fn((work: (tx: unknown) => unknown) => work({})),
  findStepForQuantity: vi.fn(),
  findProfileWithStation: vi.fn(),
  lockSteps: vi.fn().mockResolvedValue(undefined),
  findStepsByIds: vi.fn(),
  findEntries: vi.fn().mockResolvedValue([]),
  findEntry: vi.fn(),
  createEntry: vi.fn((_tx: unknown, data: Record<string, unknown>) =>
    Promise.resolve(entry({ id: 'new-entry', ...data, bundle: null })),
  ),
  setStepQuantities: vi.fn().mockResolvedValue(undefined),
  findBundle: vi.fn(),
  findBundles: vi.fn().mockResolvedValue([]),
  createBundles: vi.fn().mockResolvedValue(undefined),
  recordAudit: vi.fn().mockResolvedValue(undefined),
});

describe('QuantityService', () => {
  let repo: ReturnType<typeof createRepo>;
  let service: QuantityService;

  const atStation = (stationType: string, isOutsourced = false) =>
    repo.findProfileWithStation.mockResolvedValue({
      id: 'user-op',
      role: 'STATION_OPERATOR',
      station: { stationType, isOutsourced },
    });

  // Values read after the lock: [current, previous].
  const lockedTotals = (current: Record<string, unknown>, previous?: Record<string, unknown>) =>
    repo.findStepsByIds.mockResolvedValue([
      { status: 'IN_PROGRESS', qtyIn: 0, qtyGood: 0, qtyDefect: 0, ...current },
      ...(previous ? [previous] : []),
    ]);

  beforeEach(() => {
    repo = createRepo();
    service = new QuantityService(repo as unknown as ExecutionRepository);
  });

  describe('recordQuantity at cutting (BR-07)', () => {
    beforeEach(() => {
      repo.findStepForQuantity.mockResolvedValue(quantityStep('CUTTING', 'IN_PROGRESS'));
      atStation('CUTTING');
    });

    it('re-reads the status after locking and rejects a step that is no longer IN_PROGRESS', async () => {
      lockedTotals({ id: 'step-CUTTING', status: 'DONE' });
      await expect(
        service.recordQuantity('step-CUTTING', { size: '30', qtyGood: 10, qtyDefect: 0 }, operator),
      ).rejects.toThrow(ConflictException);
      expect(repo.lockSteps.mock.invocationCallOrder[0]).toBeLessThan(
        repo.findStepsByIds.mock.invocationCallOrder[0]!,
      );
    });

    it('rejects an operator from another station', async () => {
      atStation('SEWING');
      await expect(
        service.recordQuantity('step-CUTTING', { size: '30', qtyGood: 10, qtyDefect: 0 }, operator),
      ).rejects.toThrow(ForbiddenException);
    });

    it('needs a size of the order, not a bundle', async () => {
      lockedTotals({ id: 'step-CUTTING' });
      await expect(
        service.recordQuantity(
          'step-CUTTING',
          { bundleId: 'b', qtyGood: 1, qtyDefect: 0 },
          operator,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.recordQuantity('step-CUTTING', { size: '99', qtyGood: 1, qtyDefect: 0 }, operator),
      ).rejects.toThrow(BadRequestException);
    });

    it('BR-07 rejects a cut above plan + style tolerance', async () => {
      lockedTotals({ id: 'step-CUTTING', qtyIn: 100 });
      repo.findEntries.mockResolvedValue([
        entry({
          stepInstanceId: 'step-CUTTING',
          bundleId: null,
          size: '30',
          qtyGood: 98,
          qtyDefect: 2,
        }),
      ]);
      await expect(
        service.recordQuantity('step-CUTTING', { size: '30', qtyGood: 6, qtyDefect: 0 }, operator),
      ).rejects.toThrow(/BR-07/);
      expect(repo.createEntry).not.toHaveBeenCalled();
    });

    it('records the entry, updates the step totals and writes the audit (BR-16)', async () => {
      lockedTotals({ id: 'step-CUTTING', qtyIn: 20, qtyGood: 19, qtyDefect: 1 });
      await service.recordQuantity(
        'step-CUTTING',
        { size: '30', qtyGood: 9, qtyDefect: 1 },
        operator,
      );

      expect(repo.createEntry).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ size: '30', bundleId: null, qtyGood: 9, enteredBy: 'user-op' }),
      );
      expect(repo.setStepQuantities).toHaveBeenCalledWith({}, 'step-CUTTING', {
        qtyIn: 30,
        qtyGood: 28,
        qtyDefect: 2,
      });
      expect(repo.recordAudit.mock.calls[0]![1].action).toBe('RECORD_QUANTITY');
    });
  });

  describe('recordQuantity after cutting (BR-08, BR-09)', () => {
    beforeEach(() => {
      repo.findStepForQuantity.mockResolvedValue(quantityStep('SEWING'));
      atStation('SEWING');
      repo.findBundle.mockResolvedValue({
        id: 'bundle-1',
        orderId: 'order-1',
        bundleCode: 'PO-1-B001',
        qty: 50,
      });
    });

    it('locks the step and the previous quantity step, looking through a skipped step', async () => {
      lockedTotals({ id: 'step-SEWING' }, { id: 'step-CUTTING', qtyGood: 100 });
      await service.recordQuantity(
        'step-SEWING',
        { bundleId: 'bundle-1', qtyGood: 5, qtyDefect: 0 },
        operator,
      );
      expect(repo.lockSteps).toHaveBeenCalledWith({}, ['step-SEWING', 'step-CUTTING']);
    });

    it('rejects a bundle of another order', async () => {
      lockedTotals({ id: 'step-SEWING' }, { id: 'step-CUTTING', qtyGood: 100 });
      repo.findBundle.mockResolvedValue({
        id: 'bundle-x',
        orderId: 'order-2',
        bundleCode: 'X',
        qty: 50,
      });
      await expect(
        service.recordQuantity(
          'step-SEWING',
          { bundleId: 'bundle-x', qtyGood: 1, qtyDefect: 0 },
          operator,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('BR-08 rejects taking more from a bundle than cutting put in it (defects count too)', async () => {
      lockedTotals({ id: 'step-SEWING', qtyIn: 50 }, { id: 'step-CUTTING', qtyGood: 100 });
      repo.findEntries.mockResolvedValue([entry({ qtyGood: 40, qtyDefect: 10 })]);
      await expect(
        service.recordQuantity(
          'step-SEWING',
          { bundleId: 'bundle-1', qtyGood: 1, qtyDefect: 0 },
          operator,
        ),
      ).rejects.toThrow(/BR-08: Bó PO-1-B001 chỉ còn 0/);
    });

    it('BR-09 requires sent and received at an outsourced station', async () => {
      atStation('SEWING', true);
      lockedTotals({ id: 'step-SEWING' }, { id: 'step-CUTTING', qtyGood: 100 });
      await expect(
        service.recordQuantity(
          'step-SEWING',
          { bundleId: 'bundle-1', qtyGood: 5, qtyDefect: 0 },
          operator,
        ),
      ).rejects.toThrow(/BR-09/);
    });
  });

  describe('reverseEntry (R-22)', () => {
    beforeEach(() => {
      repo.findStepForQuantity.mockResolvedValue(quantityStep('SEWING'));
      atStation('SEWING');
      lockedTotals({ id: 'step-SEWING', qtyIn: 30, qtyGood: 25, qtyDefect: 5 });
    });

    it('adds a row with negated values and subtracts it from the totals', async () => {
      repo.findEntry.mockResolvedValue(entry({ qtyGood: 8, qtyDefect: 2 }));
      await service.reverseEntry('step-SEWING', 'entry-1', { reason: 'Gõ nhầm' }, operator);

      expect(repo.createEntry).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          qtyGood: -8,
          qtyDefect: -2,
          note: 'Gõ nhầm',
          reversesEntryId: 'entry-1',
          bundleId: 'bundle-1',
        }),
      );
      expect(repo.setStepQuantities).toHaveBeenCalledWith({}, 'step-SEWING', {
        qtyIn: 20,
        qtyGood: 17,
        qtyDefect: 3,
      });
    });

    it('cannot reverse the same entry twice or reverse a reversal', async () => {
      repo.findEntry.mockResolvedValue(entry({ reversedBy: { id: 'r1' } }));
      await expect(
        service.reverseEntry('step-SEWING', 'entry-1', { reason: 'x' }, operator),
      ).rejects.toThrow(ConflictException);

      repo.findEntry.mockResolvedValue(entry({ reversesEntryId: 'entry-0' }));
      await expect(
        service.reverseEntry('step-SEWING', 'entry-1', { reason: 'x' }, operator),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('closeOnComplete', () => {
    it('does nothing for a step without quantities', async () => {
      repo.findStepForQuantity.mockResolvedValue({
        ...quantityStep('SEWING'),
        stepDefinition: {
          ...definition('BOM_ALLOCATE', 3, null),
          responsibleRole: 'PRODUCTION_PLANNER',
        },
      });
      await service.closeOnComplete({} as never, 'step-x', 'user-op');
      expect(repo.lockSteps).not.toHaveBeenCalled();
    });

    it('rejects completing cutting with nothing counted', async () => {
      repo.findStepForQuantity.mockResolvedValue(quantityStep('CUTTING'));
      lockedTotals({ id: 'step-CUTTING', qtyIn: 0 });
      await expect(service.closeOnComplete({} as never, 'step-CUTTING', 'user-op')).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates bundles of 50 from the good pieces cut per size (FR-15)', async () => {
      repo.findStepForQuantity.mockResolvedValue(quantityStep('CUTTING'));
      lockedTotals({ id: 'step-CUTTING', qtyIn: 125 });
      repo.findEntries.mockResolvedValue([
        entry({
          stepInstanceId: 'step-CUTTING',
          bundleId: null,
          size: '30',
          qtyGood: 120,
          qtyDefect: 5,
        }),
      ]);

      await service.closeOnComplete({} as never, 'step-CUTTING', 'user-op');

      expect(repo.createBundles).toHaveBeenCalledWith({}, 'order-1', [
        { bundleCode: 'PO-1-B001', size: '30', qty: 50 },
        { bundleCode: 'PO-1-B002', size: '30', qty: 50 },
        { bundleCode: 'PO-1-B003', size: '30', qty: 20 },
      ]);
      expect(repo.recordAudit.mock.calls[0]![1].action).toBe('GENERATE_BUNDLES');
    });

    it('BR-08 rejects completing a step that has not accounted for everything handed over', async () => {
      repo.findStepForQuantity.mockResolvedValue(quantityStep('SEWING'));
      lockedTotals({ id: 'step-SEWING', qtyIn: 80 }, { id: 'step-CUTTING', qtyGood: 100 });
      await expect(service.closeOnComplete({} as never, 'step-SEWING', 'user-op')).rejects.toThrow(
        BusinessRuleViolation,
      );
    });
  });
});
