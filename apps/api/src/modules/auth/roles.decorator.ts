import { SetMetadata } from '@nestjs/common';
import type { Role } from '@denimflow/shared';

export const ROLES_KEY = 'roles';

// Restricts a route (or a whole controller) to the listed roles. Checked by AuthGuard after the
// token is verified; without @Roles, any active logged-in user is allowed.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
