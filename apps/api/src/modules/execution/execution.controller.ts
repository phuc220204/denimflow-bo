import {
  Body,
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
import {
  recordQuantityEntrySchema,
  reverseQuantityEntrySchema,
  Role,
  worklistQuerySchema,
} from '@denimflow/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthResponse } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { ExecutionService } from './execution.service.js';
import { QuantityService } from './quantity.service.js';

// Roles that own steps in a template (responsible_role). The service also checks that the user
// has exactly the step's role and, for operators, the step's station. The Process Engineer owns
// no step but is let through so the service answers with BR-11 instead of a generic 403.
const STEP_WORKERS = [
  Role.STATION_OPERATOR,
  Role.QC_INSPECTOR,
  Role.PRODUCTION_PLANNER,
  Role.PROCESS_ENGINEER,
];

@Controller()
@UseGuards(AuthGuard)
export class ExecutionController {
  constructor(
    @Inject(ExecutionService) private readonly executionService: ExecutionService,
    @Inject(QuantityService) private readonly quantityService: QuantityService,
  ) {}

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

  @Get('steps/:id/quantities')
  getQuantityPanel(@Param('id') id: string, @CurrentUser() user: AuthResponse['user']) {
    return this.quantityService.getQuantityPanel(id, user);
  }

  // FR-13: only station operators enter quantities (PRD §4); the service checks the station.
  @Post('steps/:id/quantities')
  @Roles(Role.STATION_OPERATOR)
  recordQuantity(
    @Param('id') id: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    return this.quantityService.recordQuantity(id, recordQuantityEntrySchema.parse(rawBody), user);
  }

  @Post('steps/:id/quantities/:entryId/reverse')
  @Roles(Role.STATION_OPERATOR)
  reverseQuantity(
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    const body = reverseQuantityEntrySchema.parse(rawBody);
    return this.quantityService.reverseEntry(id, entryId, body, user);
  }
}
