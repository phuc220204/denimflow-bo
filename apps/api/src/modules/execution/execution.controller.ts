import { Controller, Get, Headers, Inject, Param, Post, Query } from '@nestjs/common';
import { worklistQuerySchema } from '@denimflow/shared';
import { AuthService } from '../auth/auth.service.js';
import { ExecutionService } from './execution.service.js';

@Controller()
export class ExecutionController {
  constructor(
    @Inject(ExecutionService) private readonly executionService: ExecutionService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  @Get('worklist')
  async getWorklist(@Query() rawQuery: unknown, @Headers('authorization') authHeader?: string) {
    const user = await this.authService.getMe(authHeader);
    const query = worklistQuerySchema.parse(rawQuery);
    return this.executionService.getWorklist(user.id, query);
  }

  @Post('steps/:id/start')
  async startStep(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    const user = await this.authService.getMe(authHeader);
    return this.executionService.startStep(id, user.id, user.role);
  }

  @Post('steps/:id/complete')
  async completeStep(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    const user = await this.authService.getMe(authHeader);
    return this.executionService.completeStep(id, user.id, user.role);
  }
}
