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
import { createHandoverSchema, Role } from '@denimflow/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthResponse } from '../auth/auth.service.js';
import { HandoverService } from './handover.service.js';
@Controller('orders/:id/handover')
@UseGuards(AuthGuard)
export class HandoverController {
  constructor(@Inject(HandoverService) private readonly service: HandoverService) {}
  @Get()
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }
  @Post()
  @Roles(Role.PRODUCTION_PLANNER)
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    return this.service.create(id, createHandoverSchema.parse(body ?? {}), user.id);
  }
}
