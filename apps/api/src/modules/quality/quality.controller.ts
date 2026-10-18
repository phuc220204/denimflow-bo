import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import { evaluateQcInspectionInputSchema, recordQcInspectionSchema } from '@denimflow/shared';
import { AuthService } from '../auth/auth.service.js';
import { QualityService } from './quality.service.js';

@Controller('quality')
export class QualityController {
  constructor(
    @Inject(QualityService) private readonly qualityService: QualityService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  @Post('evaluate/:stepInstanceId')
  async evaluateInspection(
    @Param('stepInstanceId') stepInstanceId: string,
    @Body() rawBody: unknown,
    @Headers('authorization') authHeader?: string,
  ) {
    await this.authService.getMe(authHeader);
    const body = evaluateQcInspectionInputSchema.parse(rawBody);
    return this.qualityService.evaluateInspection(stepInstanceId, body);
  }

  @Post('inspections')
  async recordInspection(@Body() rawBody: unknown, @Headers('authorization') authHeader?: string) {
    const user = await this.authService.getMe(authHeader);
    const body = recordQcInspectionSchema.parse(rawBody);
    return this.qualityService.recordInspection(body, user.id, user.role);
  }

  @Get('inspections/:stepInstanceId')
  async getInspections(
    @Param('stepInstanceId') stepInstanceId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    await this.authService.getMe(authHeader);
    return this.qualityService.getInspections(stepInstanceId);
  }

  @Get('rework-targets/:stepInstanceId')
  async getReworkTargets(
    @Param('stepInstanceId') stepInstanceId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    await this.authService.getMe(authHeader);
    return this.qualityService.getReworkTargets(stepInstanceId);
  }

  @Get('orders/:orderId/defects')
  async getOrderDefects(
    @Param('orderId') orderId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    await this.authService.getMe(authHeader);
    return this.qualityService.getOrderDefects(orderId);
  }
}
