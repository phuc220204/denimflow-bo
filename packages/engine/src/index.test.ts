import { describe, expect, it } from 'vitest';
import { ENGINE_NAME } from './index';

describe('engine package', () => {
  it('loads and exposes its name (placeholder until Sprint 2)', () => {
    expect(ENGINE_NAME).toBe('@denimflow/engine');
  });
});
