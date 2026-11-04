import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { attachEvidenceSchema, evidenceUploadSchema, Role } from '@denimflow/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { AuthResponse } from '../auth/auth.service.js';
import { EvidenceService } from './evidence.service.js';
@Controller('steps/:id/evidence')
@UseGuards(AuthGuard)
export class EvidenceController {
  constructor(@Inject(EvidenceService) private readonly service: EvidenceService) {}
  @Get() list(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.list(id);
  }
  @Get(':evidenceId/url') read(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    return this.service.read(id, evidenceId);
  }
  @Post('upload-url')
  @Roles(Role.STATION_OPERATOR, Role.PRODUCTION_PLANNER, Role.QC_INSPECTOR)
  sign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    return this.service.sign(id, evidenceUploadSchema.parse(body), user);
  }
  @Post()
  @Roles(Role.STATION_OPERATOR, Role.PRODUCTION_PLANNER, Role.QC_INSPECTOR)
  attach(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    return this.service.attach(id, attachEvidenceSchema.parse(body), user);
  }
}
