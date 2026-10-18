import { z } from 'zod';

// Every environment variable the API reads, validated once at startup (rule 02).
// Variables used only by later tasks are added to this schema when they are used.
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url(),
    DIRECT_URL: z.url(),
    CORS_ORIGINS: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
      ),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production') {
        return !!data.SUPABASE_URL && !!data.SUPABASE_SERVICE_ROLE_KEY;
      }
      return true;
    },
    {
      message:
        'SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY bắt buộc phải được cấu hình trong môi trường production',
      path: ['SUPABASE_URL'],
    },
  );

export type AppConfig = z.infer<typeof envSchema>;

export const APP_CONFIG = Symbol('APP_CONFIG');
