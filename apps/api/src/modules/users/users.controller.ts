import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@denimflow/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthResponse } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import {
  createUserSchema,
  updateUserAssignmentSchema,
  updateUserStatusSchema,
} from './users.dto.js';
import { UsersService } from './users.service.js';

// FR-01: only the Admin manages user accounts, roles and station assignments.
@Controller('users')
@UseGuards(AuthGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  getUsers() {
    return this.usersService.getUsers();
  }

  @Post()
  createUser(@Body() body: unknown, @CurrentUser() user: AuthResponse['user']) {
    const dto = createUserSchema.parse(body);
    return this.usersService.createUser(dto, user.id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    const dto = updateUserStatusSchema.parse(body);
    return this.usersService.updateStatus(id, dto, user.id);
  }

  @Patch(':id/assignment')
  updateAssignment(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    const dto = updateUserAssignmentSchema.parse(body);
    return this.usersService.updateAssignment(id, dto, user.id);
  }
}
