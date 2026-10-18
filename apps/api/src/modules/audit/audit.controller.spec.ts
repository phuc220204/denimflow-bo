import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { AuditLogListResponseDto, Role } from '@denimflow/shared';

describe('AuditController (T5.6, FR-25)', () => {
  const mockResponse: AuditLogListResponseDto = {
    items: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  it('allows ADMIN to query audit logs', async () => {
    const mockAuditService = {
      findAuditLogs: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as AuditService;

    const mockAuthService = {
      getMe: vi.fn().mockResolvedValue({ id: 'admin-1', role: Role.ADMIN }),
    } as unknown as AuthService;

    const controller = new AuditController(mockAuditService, mockAuthService);
    const result = await controller.getAuditLogs({ page: '1', limit: '20' }, 'Bearer token');

    expect(mockAuthService.getMe).toHaveBeenCalledWith('Bearer token');
    expect(mockAuditService.findAuditLogs).toHaveBeenCalled();
    expect(result).toEqual(mockResponse);
  });

  it('allows MANAGER to query audit logs', async () => {
    const mockAuditService = {
      findAuditLogs: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as AuditService;

    const mockAuthService = {
      getMe: vi.fn().mockResolvedValue({ id: 'manager-1', role: Role.MANAGER }),
    } as unknown as AuthService;

    const controller = new AuditController(mockAuditService, mockAuthService);
    const result = await controller.getAuditLogs({}, 'Bearer token');

    expect(result).toEqual(mockResponse);
  });

  it('rejects STATION_OPERATOR with ForbiddenException', async () => {
    const mockAuditService = {
      findAuditLogs: vi.fn(),
    } as unknown as AuditService;

    const mockAuthService = {
      getMe: vi.fn().mockResolvedValue({ id: 'op-1', role: Role.STATION_OPERATOR }),
    } as unknown as AuthService;

    const controller = new AuditController(mockAuditService, mockAuthService);

    await expect(controller.getAuditLogs({}, 'Bearer token')).rejects.toThrow(ForbiddenException);
  });
});
