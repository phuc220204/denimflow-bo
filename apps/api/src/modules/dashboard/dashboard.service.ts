import { Inject, Injectable } from '@nestjs/common';
import { DashboardWipSummaryDto } from '@denimflow/shared';
import { DashboardRepository } from './dashboard.repository.js';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DashboardRepository) private readonly dashboardRepository: DashboardRepository,
  ) {}

  async getWipSummary(): Promise<DashboardWipSummaryDto> {
    return this.dashboardRepository.getWipSummary();
  }
}
