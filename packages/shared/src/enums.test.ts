import { describe, expect, it } from 'vitest';
import { OrderStatus, Role, StepStatus, orderStatusSchema, roleSchema } from './enums';
import { healthResponseSchema } from './health';

describe('enums (DATABASE_DESIGN.md §5)', () => {
  it('Role has the 7 documented roles', () => {
    expect(Object.values(Role)).toEqual([
      'ADMIN',
      'PROCESS_ENGINEER',
      'PRODUCTION_PLANNER',
      'WAREHOUSE_KEEPER',
      'STATION_OPERATOR',
      'QC_INSPECTOR',
      'MANAGER',
    ]);
  });

  it('OrderStatus has the 6 documented states', () => {
    expect(Object.values(OrderStatus)).toHaveLength(6);
  });

  it('StepStatus has the 7 documented states', () => {
    expect(Object.values(StepStatus)).toHaveLength(7);
  });

  it('every enum key equals its value', () => {
    for (const [key, value] of Object.entries({ ...Role, ...OrderStatus, ...StepStatus })) {
      expect(value).toBe(key);
    }
  });

  it('Zod schemas accept documented values and reject others', () => {
    expect(roleSchema.parse('QC_INSPECTOR')).toBe('QC_INSPECTOR');
    expect(roleSchema.safeParse('SUPER_ADMIN').success).toBe(false);
    expect(orderStatusSchema.safeParse('draft').success).toBe(false);
  });
});

describe('healthResponseSchema', () => {
  it('accepts a healthy response', () => {
    expect(healthResponseSchema.parse({ status: 'ok', db: 'up' })).toEqual({
      status: 'ok',
      db: 'up',
    });
  });

  it('rejects an unknown db state', () => {
    expect(healthResponseSchema.safeParse({ status: 'ok', db: 'unknown' }).success).toBe(false);
  });
});
