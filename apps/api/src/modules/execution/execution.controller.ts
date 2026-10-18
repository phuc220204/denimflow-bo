import { Body, Controller, Get, Headers, Inject, Param, Post, Query } from '@nestjs/common';
import { recordQuantityEntrySchema, worklistQuerySchema } from '@denimflow/shared';
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

  @Post('steps/:id/quantities')
  async recordQuantity(
    @Param('id') id: string,
    @Body() rawBody: unknown,
    @Headers('authorization') authHeader?: string,
  ) {
    const user = await this.authService.getMe(authHeader);
    const body = recordQuantityEntrySchema.parse(rawBody);
    return this.executionService.recordQuantity(id, body, user.id, user.role);
  }

  @Get('steps/:id/quantities')
  async getQuantities(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    await this.authService.getMe(authHeader);
    return this.executionService.getQuantityEntries(id);
  }

  @Post('steps/:id/bundles/generate')
  async generateBundles(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    const user = await this.authService.getMe(authHeader);
    return this.executionService.generateBundles(id, user.id);
  }

  @Get('steps/:id/bundles')
  async getBundles(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    await this.authService.getMe(authHeader);
    return this.executionService.getBundles(id);
  }
}
