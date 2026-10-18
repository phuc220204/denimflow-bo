import { describe, expect, it } from 'vitest';
import { assertNotPerformer } from './step-access.js';

const inspector = {
  id: 'user-qc',
  email: 'qc@denimflow.test',
  fullName: 'QC',
  role: 'QC_INSPECTOR',
  isActive: true,
};

const performers = (overrides: Partial<Parameters<typeof assertNotPerformer>[1]> = {}) => ({
  performedBy: 'user-op-a',
  completedBy: 'user-op-a',
  quantityEnteredBy: ['user-op-a', 'user-op-b'],
  ...overrides,
});

describe('assertNotPerformer (BR-11)', () => {
  it('BR-11 refuses QC approval by whoever started the step', () => {
    expect(() =>
      assertNotPerformer('SEWING', performers({ performedBy: 'user-qc' }), inspector),
    ).toThrow(/BR-11/);
  });

  it('BR-11 refuses QC approval by whoever completed the step', () => {
    expect(() =>
      assertNotPerformer('SEWING', performers({ completedBy: 'user-qc' }), inspector),
    ).toThrow(/BR-11/);
  });

  it('BR-11 refuses QC approval by anyone who entered quantities for the step', () => {
    expect(() =>
      assertNotPerformer(
        'SEWING',
        performers({ quantityEnteredBy: ['user-op-a', 'user-qc'] }),
        inspector,
      ),
    ).toThrow(/BR-11/);
  });

  it('lets someone who did not work the step approve it', () => {
    expect(() => assertNotPerformer('SEWING', performers(), inspector)).not.toThrow();
  });
});
