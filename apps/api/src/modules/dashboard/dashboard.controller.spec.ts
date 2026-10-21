import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../auth/auth.guard.js';
import { ROLES_KEY } from '../auth/roles.decorator.js';
import { DashboardController } from './dashboard.controller.js';
import type { DashboardService } from './dashboard.service.js';

describe('DashboardController', () => {
  it('returns the WIP summary from the service', async () => {
    const summary = { steps: [], waitingQc: [] };
    const service = { getWipSummary: vi.fn().mockResolvedValue(summary) };
    const controller = new DashboardController(service as unknown as DashboardService);

    await expect(controller.getWipSummary()).resolves.toBe(summary);
  });

  it('FR-21: requires login and lets only Manager, Admin, Process Engineer and Planner in', () => {
    const roles = new Reflector().get<string[]>(ROLES_KEY, DashboardController);
    expect([...roles].sort()).toEqual(
      ['ADMIN', 'MANAGER', 'PROCESS_ENGINEER', 'PRODUCTION_PLANNER'].sort(),
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, DashboardController)).toEqual([AuthGuard]);
  });
});
