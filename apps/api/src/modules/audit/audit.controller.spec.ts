import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { Role } from '@denimflow/shared';
import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { ROLES_KEY } from '../auth/roles.decorator.js';
import { AuditController } from './audit.controller.js';
import type { AuditService } from './audit.service.js';

describe('AuditController (FR-25)', () => {
  const service = {
    findAuditLogs: vi.fn().mockResolvedValue({ items: [] }),
    getFilterOptions: vi.fn().mockResolvedValue({ entityTypes: [], actors: [] }),
  };
  const controller = new AuditController(service as unknown as AuditService);

  it('FR-25: is guarded and limited to Admin and Manager', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AuditController)).toEqual([AuthGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, AuditController)).toEqual([Role.ADMIN, Role.MANAGER]);
  });

  it('FR-25: parses the query string before calling the service', async () => {
    await controller.getAuditLogs({ entityType: 'ProductionOrder', page: '2', limit: '50' });

    expect(service.findAuditLogs).toHaveBeenCalledWith({
      entityType: 'ProductionOrder',
      page: 2,
      limit: 50,
    });
  });

  it('FR-25: rejects an invalid query with a ZodError (422 through ZodValidationFilter)', () => {
    expect(() => controller.getAuditLogs({ limit: '1000' })).toThrow(ZodError);
    expect(() => controller.getAuditLogs({ actorId: 'not-an-id' })).toThrow(ZodError);
  });

  it('FR-25: returns the filter options from the service', async () => {
    await expect(controller.getFilterOptions()).resolves.toEqual({ entityTypes: [], actors: [] });
  });
});
