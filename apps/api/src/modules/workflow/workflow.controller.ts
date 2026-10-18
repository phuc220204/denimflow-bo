import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import {
  assignTemplateToStyleSchema,
  createStepDefinitionSchema,
  createStepTransitionSchema,
  createWorkflowTemplateSchema,
  updateStepDefinitionSchema,
} from './dto/index.js';
import { WorkflowService } from './workflow.service.js';

@Controller('workflow')
export class WorkflowController {
  constructor(@Inject(WorkflowService) private readonly workflowService: WorkflowService) {}

  @Get('templates')
  listTemplates() {
    return this.workflowService.listTemplates();
  }

  @Post('templates')
  createTemplate(@Body() rawBody: unknown) {
    const dto = createWorkflowTemplateSchema.parse(rawBody);
    return this.workflowService.createTemplate(dto);
  }

  @Get('templates/:id')
  getTemplate(@Param('id') id: string) {
    return this.workflowService.getTemplate(id);
  }

  @Post('templates/:id/versions')
  createNewVersion(@Param('id') id: string) {
    return this.workflowService.createNewVersion(id);
  }

  @Get('versions/:id')
  getVersion(@Param('id') id: string) {
    return this.workflowService.getVersion(id);
  }

  @Post('versions/:id/steps')
  addStep(@Param('id') id: string, @Body() rawBody: unknown) {
    const dto = createStepDefinitionSchema.parse(rawBody);
    return this.workflowService.addStep(id, dto);
  }

  @Patch('steps/:id')
  updateStep(@Param('id') id: string, @Body() rawBody: unknown) {
    const dto = updateStepDefinitionSchema.parse(rawBody);
    return this.workflowService.updateStep(id, dto);
  }

  @Delete('steps/:id')
  deleteStep(@Param('id') id: string) {
    return this.workflowService.deleteStep(id);
  }

  @Post('versions/:id/transitions')
  addTransition(@Param('id') id: string, @Body() rawBody: unknown) {
    const dto = createStepTransitionSchema.parse(rawBody);
    return this.workflowService.addTransition(id, dto);
  }

  @Delete('transitions/:id')
  deleteTransition(@Param('id') id: string) {
    return this.workflowService.deleteTransition(id);
  }

  @Post('versions/:id/validate')
  validateVersion(@Param('id') id: string) {
    return this.workflowService.validateVersion(id);
  }

  @Post('versions/:id/publish')
  publishVersion(@Param('id') id: string) {
    return this.workflowService.publishVersion(id);
  }

  @Post('styles/assign-template')
  assignTemplateToStyle(@Body() rawBody: unknown) {
    const dto = assignTemplateToStyleSchema.parse(rawBody);
    return this.workflowService.assignTemplateToStyle(dto);
  }
}
