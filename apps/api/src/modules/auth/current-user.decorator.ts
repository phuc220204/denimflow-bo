import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard.js';
import type { AuthResponse } from './auth.service.js';

// The profile AuthGuard verified for this request. Use only on routes behind AuthGuard.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthResponse['user'] => {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) {
      throw new UnauthorizedException('Thiếu thông tin người dùng đã xác thực');
    }
    return user;
  },
);
