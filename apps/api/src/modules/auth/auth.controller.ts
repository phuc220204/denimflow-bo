import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { loginSchema, registerSchema } from './auth.dto.js';
import { AuthService, type AuthResponse } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown): Promise<AuthResponse> {
    const dto = registerSchema.parse(body);
    return this.authService.register(dto);
  }

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
