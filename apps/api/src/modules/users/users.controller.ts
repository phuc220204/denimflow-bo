import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import {
  createUserSchema,
  updateUserAssignmentSchema,
  updateUserStatusSchema,
} from './users.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  private async assertAdmin(authHeader?: string): Promise<string> {
    const user = await this.authService.getMe(authHeader);
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Chỉ Quản trị viên (Admin) mới có quyền quản lý người dùng và tài khoản',
      );
    }
    return user.id;
  }

  @Get()
  async getUsers(@Headers('authorization') authHeader?: string) {
    await this.assertAdmin(authHeader);
    return this.usersService.getUsers();
  }

  @Post()
  async createUser(@Body() body: unknown, @Headers('authorization') authHeader?: string) {
    const actorId = await this.assertAdmin(authHeader);
    const dto = createUserSchema.parse(body);
    return this.usersService.createUser(dto, actorId);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authHeader?: string,
  ) {
    const actorId = await this.assertAdmin(authHeader);
    const dto = updateUserStatusSchema.parse(body);
    return this.usersService.updateStatus(id, dto, actorId);
  }

  @Patch(':id/assignment')
  async updateAssignment(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authHeader?: string,
  ) {
    const actorId = await this.assertAdmin(authHeader);
    const dto = updateUserAssignmentSchema.parse(body);
    return this.usersService.updateAssignment(id, dto, actorId);
  }
}
