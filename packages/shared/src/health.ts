import { z } from 'zod';

// Response of GET /health (T0.4). `status` says the API process is up; `db` reports the
// result of a `select 1` against the database.
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  db: z.enum(['up', 'down']),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
