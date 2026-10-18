import { Inject, Injectable, Logger } from '@nestjs/common';
import type { HealthResponse } from '@denimflow/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`select 1`;
      return { status: 'ok', db: 'up' };
    } catch (error) {
      // The API process is up, so answer 200 with db 'down': a 5xx would make Render
      // restart the service, which cannot fix a paused database.
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Database check failed: ${reason}`);
      return { status: 'ok', db: 'down' };
    }
  }
}
