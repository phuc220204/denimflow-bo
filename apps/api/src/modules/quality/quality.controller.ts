import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { qcEvaluationInputSchema, recordQcInspectionSchema, Role } from '@denimflow/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthResponse } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { QualityService } from './quality.service.js';

// FR-16: only the QC Inspector evaluates and decides (PRD §4); anyone logged in may read history.
@Controller('steps/:id/qc')
@UseGuards(AuthGuard)
export class QualityController {
  constructor(@Inject(QualityService) private readonly qualityService: QualityService) {}

  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.QC_INSPECTOR)
  evaluate(@Param('id') id: string, @Body() rawBody: unknown) {
    return this.qualityService.evaluate(id, qcEvaluationInputSchema.parse(rawBody));
  }

  @Post('inspections')
  @Roles(Role.QC_INSPECTOR)
  recordInspection(
    @Param('id') id: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    return this.qualityService.recordInspection(id, recordQcInspectionSchema.parse(rawBody), user);
  }

  @Get('inspections')
  listInspections(@Param('id') id: string) {
    return this.qualityService.listInspections(id);
  }
}
