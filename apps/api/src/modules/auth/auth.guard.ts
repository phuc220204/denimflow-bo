import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@denimflow/shared';
import type { Request } from 'express';
import { AuthService, type AuthResponse } from './auth.service.js';
import { ROLES_KEY } from './roles.decorator.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthResponse['user'];
}

// Verifies the bearer token (AuthService.getMe: Supabase check + active profile), stores the
// profile on the request, then enforces @Roles(...) if the route or controller declares it.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.authService.getMe(request.headers.authorization);
    request.user = user;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && !roles.includes(user.role as Role)) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
    return true;
  }
}
