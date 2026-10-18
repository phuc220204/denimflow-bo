import { Controller, Get, Inject } from '@nestjs/common';
import type { HealthResponse } from '@denimflow/shared';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  check(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
