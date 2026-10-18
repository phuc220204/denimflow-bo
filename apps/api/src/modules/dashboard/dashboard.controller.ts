import { Controller, Get, Headers, Inject } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
export class DashboardController {
  constructor(
    @Inject(DashboardService) private readonly dashboardService: DashboardService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  @Get('wip')
  async getWipSummary(@Headers('authorization') authHeader?: string) {
    await this.authService.getMe(authHeader);
    return this.dashboardService.getWipSummary();
  }
}
