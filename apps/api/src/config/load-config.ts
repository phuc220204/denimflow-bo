import { existsSync } from 'node:fs';
import { z } from 'zod';
import { envSchema, type AppConfig } from './env.schema.js';

// Locally the API reads apps/api/.env; on Render and in CI the variables come from the
// environment, so a missing file is normal there.
export function loadConfig(): AppConfig {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Shows variable names and problems only, never the values.
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
