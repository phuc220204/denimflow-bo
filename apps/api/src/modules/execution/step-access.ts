import { ForbiddenException } from '@nestjs/common';
import { BusinessRuleViolation } from '../../common/errors/business-rule-violation.js';
import type { StepDefinition } from '../../generated/prisma/client.js';
import type { AuthResponse } from '../auth/auth.service.js';
import type { ExecutionRepository, Tx } from './execution.repository.js';

type StepDefinitionAccess = Pick<
  StepDefinition,
  'code' | 'stepType' | 'responsibleRole' | 'stationType'
>;

// Only the role the template assigns to the step may work it; an operator only at a station of
// the step's type. BR-11: the Process Engineer never executes production steps.
// Returns the operator's profile (with station) so callers can read e.g. `isOutsourced`.
export async function assertMayWork(
  repository: ExecutionRepository,
  tx: Tx,
  definition: StepDefinitionAccess,
  user: AuthResponse['user'],
) {
  if (user.role === 'PROCESS_ENGINEER' && definition.stepType === 'PRODUCTION') {
    throw new BusinessRuleViolation(
      'BR-11',
      'BR-11: Kỹ sư quy trình không được thực hiện bước sản xuất',
    );
  }
  if (user.role !== definition.responsibleRole) {
    throw new ForbiddenException(
      `Bước ${definition.code} do vai trò ${definition.responsibleRole} thực hiện`,
    );
  }
  if (user.role === 'STATION_OPERATOR' && definition.stationType) {
    const profile = await repository.findProfileWithStation(user.id, tx);
    if (profile?.station?.stationType !== definition.stationType) {
      throw new ForbiddenException(
        `Bước ${definition.code} thuộc trạm ${definition.stationType}, không phải trạm của bạn`,
      );
    }
    return profile;
  }
  return null;
}

export interface StepPerformers {
  performedBy: string | null;
  completedBy: string | null;
  quantityEnteredBy: string[];
}

// BR-11: whoever worked a step (started it, completed it or entered its quantities, R-23) may not
// approve its QC. The QC decision (T5.1) calls this before recording a result.
export function assertNotPerformer(
  stepCode: string,
  performers: StepPerformers,
  user: AuthResponse['user'],
): void {
  const workedOnIt =
    performers.performedBy === user.id ||
    performers.completedBy === user.id ||
    performers.quantityEnteredBy.includes(user.id);
  if (workedOnIt) {
    throw new BusinessRuleViolation(
      'BR-11',
      `BR-11: Bạn đã thực hiện bước ${stepCode} nên không được duyệt QC cho bước này`,
    );
  }
}
