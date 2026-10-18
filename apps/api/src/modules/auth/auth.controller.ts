import { Body, Controller, Get, Headers, Inject, Post } from '@nestjs/common';
import { loginSchema } from './auth.dto.js';
import { AuthService, type AuthResponse } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: unknown): Promise<AuthResponse> {
    const dto = loginSchema.parse(body);
    return this.authService.login(dto);
  }

  @Get('me')
  async getMe(@Headers('authorization') authHeader?: string): Promise<AuthResponse['user']> {
    return this.authService.getMe(authHeader);
  }
}
