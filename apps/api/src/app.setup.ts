import type { INestApplication } from '@nestjs/common';
import { BusinessRuleViolationFilter } from './common/filters/business-rule-violation.filter.js';
import { ZodValidationFilter } from './common/filters/zod-validation.filter.js';
import { APP_CONFIG, type AppConfig } from './config/env.schema.js';

// Shared by main.ts and the HTTP tests, so tests run with the same filters and CORS policy.
export function setupApp(app: INestApplication): AppConfig {
  const config = app.get<AppConfig>(APP_CONFIG);
  app.enableCors({ origin: config.CORS_ORIGINS });
  app.useGlobalFilters(new BusinessRuleViolationFilter(), new ZodValidationFilter());
  app.enableShutdownHooks();
  return config;
}
