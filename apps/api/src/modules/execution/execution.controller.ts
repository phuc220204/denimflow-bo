import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role, worklistQuerySchema } from '@denimflow/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthResponse } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { ExecutionService } from './execution.service.js';

// Roles that own steps in a template (responsible_role). The service also checks that the user
// has exactly the step's role and, for operators, the step's station.
const STEP_WORKERS = [Role.STATION_OPERATOR, Role.QC_INSPECTOR, Role.PRODUCTION_PLANNER];

@Controller()
@UseGuards(AuthGuard)
export class ExecutionController {
  constructor(@Inject(ExecutionService) private readonly executionService: ExecutionService) {}

  @Get('worklist')
  getWorklist(@Query() rawQuery: unknown, @CurrentUser() user: AuthResponse['user']) {
    const query = worklistQuerySchema.parse(rawQuery);
    return this.executionService.getWorklist(user, query);
  }

  @Post('steps/:id/start')
  @HttpCode(HttpStatus.OK)
  @Roles(...STEP_WORKERS)
  startStep(@Param('id') id: string, @CurrentUser() user: AuthResponse['user']) {
    return this.executionService.startStep(id, user);
  }

  @Post('steps/:id/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(...STEP_WORKERS)
  completeStep(@Param('id') id: string, @CurrentUser() user: AuthResponse['user']) {
    return this.executionService.completeStep(id, user);
  }
}
