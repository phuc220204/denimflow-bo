import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';

export interface ValidationErrorBody {
  code: 'VALIDATION_ERROR';
  message: string;
  issues: { path: string; message: string }[];
}

// Controllers validate input with `schema.parse(body)`. Without this filter a ZodError becomes an
// HTTP 500; here it becomes 422 with one entry per invalid field, so forms can show the error.
@Catch(ZodError)
export class ZodValidationFilter implements ExceptionFilter<ZodError> {
  catch(exception: ZodError, host: ArgumentsHost): void {
    const body: ValidationErrorBody = {
      code: 'VALIDATION_ERROR',
      message: 'Dữ liệu gửi lên không hợp lệ',
      issues: exception.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
    host.switchToHttp().getResponse<Response>().status(HttpStatus.UNPROCESSABLE_ENTITY).json(body);
  }
}
