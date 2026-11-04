import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@denimflow/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import {
  assignTemplateToStyleSchema,
  createStepDefinitionSchema,
  createStepTransitionSchema,
  createWorkflowTemplateSchema,
  updateStepDefinitionSchema,
} from './dto/index.js';
import { WorkflowService } from './workflow.service.js';

// Every route needs a logged-in, active user; designing and publishing templates is the
// Process Engineer's job (PRD §4 capability matrix).
@Controller('workflow')
@UseGuards(AuthGuard)
export class WorkflowController {
  constructor(@Inject(WorkflowService) private readonly workflowService: WorkflowService) {}

  @Get('templates')
  listTemplates() {
    return this.workflowService.listTemplates();
  }

  @Post('templates')
  @Roles(Role.PROCESS_ENGINEER)
  createTemplate(@Body() rawBody: unknown) {
    const dto = createWorkflowTemplateSchema.parse(rawBody);
    return this.workflowService.createTemplate(dto);
  }

  @Get('templates/:id')
  getTemplate(@Param('id') id: string) {
    return this.workflowService.getTemplate(id);
  }

  @Post('templates/:id/versions')
  @Roles(Role.PROCESS_ENGINEER)
  createNewVersion(@Param('id') id: string) {
    return this.workflowService.createNewVersion(id);
  }

  @Get('versions/:id')
  getVersion(@Param('id') id: string) {
    return this.workflowService.getVersion(id);
  }

  @Post('versions/:id/steps')
  @Roles(Role.PROCESS_ENGINEER)
  addStep(@Param('id') id: string, @Body() rawBody: unknown) {
    const dto = createStepDefinitionSchema.parse(rawBody);
    return this.workflowService.addStep(id, dto);
  }

  @Patch('steps/:id')
  @Roles(Role.PROCESS_ENGINEER)
  updateStep(@Param('id') id: string, @Body() rawBody: unknown) {
    const dto = updateStepDefinitionSchema.parse(rawBody);
    return this.workflowService.updateStep(id, dto);
  }

  @Delete('steps/:id')
  @Roles(Role.PROCESS_ENGINEER)
  deleteStep(@Param('id') id: string) {
    return this.workflowService.deleteStep(id);
  }

  @Post('versions/:id/transitions')
  @Roles(Role.PROCESS_ENGINEER)
  addTransition(@Param('id') id: string, @Body() rawBody: unknown) {
    const dto = createStepTransitionSchema.parse(rawBody);
    return this.workflowService.addTransition(id, dto);
  }

  @Delete('transitions/:id')
  @Roles(Role.PROCESS_ENGINEER)
  deleteTransition(@Param('id') id: string) {
    return this.workflowService.deleteTransition(id);
  }

  @Post('versions/:id/validate')
  @Roles(Role.PROCESS_ENGINEER)
  validateVersion(@Param('id') id: string) {
    return this.workflowService.validateVersion(id);
  }

  @Post('versions/:id/publish')
  @Roles(Role.PROCESS_ENGINEER)
  publishVersion(@Param('id') id: string) {
    return this.workflowService.publishVersion(id);
  }

  @Post('styles/assign-template')
  @Roles(Role.PROCESS_ENGINEER)
  assignTemplateToStyle(@Body() rawBody: unknown) {
    const dto = assignTemplateToStyleSchema.parse(rawBody);
    return this.workflowService.assignTemplateToStyle(dto);
  }
}
