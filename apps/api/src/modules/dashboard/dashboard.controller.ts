import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { Role } from '@denimflow/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { DashboardService } from './dashboard.service.js';

// FR-21 / PRD §4: the Manager uses the dashboard; Admin, Process Engineer and Planner may view it.
export const DASHBOARD_VIEWERS = [
  Role.MANAGER,
  Role.ADMIN,
  Role.PROCESS_ENGINEER,
  Role.PRODUCTION_PLANNER,
];

@Controller('dashboard')
@UseGuards(AuthGuard)
@Roles(...DASHBOARD_VIEWERS)
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboardService: DashboardService) {}

  @Get('wip')
  getWipSummary() {
    return this.dashboardService.getWipSummary();
  }
}
