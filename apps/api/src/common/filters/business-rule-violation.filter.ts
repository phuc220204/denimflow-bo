import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { BusinessRuleViolation } from '../errors/business-rule-violation.js';

export interface BusinessRuleViolationBody {
  code: 'BUSINESS_RULE_VIOLATION';
  brId: string;
  message: string;
  details?: unknown;
}

// 409 Conflict: the request is well-formed but the current state forbids it. No stack trace.
@Catch(BusinessRuleViolation)
export class BusinessRuleViolationFilter implements ExceptionFilter<BusinessRuleViolation> {
  catch(exception: BusinessRuleViolation, host: ArgumentsHost): void {
    const body: BusinessRuleViolationBody = {
      code: 'BUSINESS_RULE_VIOLATION',
      brId: exception.brId,
      message: exception.message,
      ...(exception.details !== undefined ? { details: exception.details } : {}),
    };
    host.switchToHttp().getResponse<Response>().status(HttpStatus.CONFLICT).json(body);
  }
}
