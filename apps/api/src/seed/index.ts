import { PrismaPg } from '@prisma/adapter-pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PrismaClient } from '../generated/prisma/client.js';
import { seedBomAndLots } from './bom-and-lots.js';
import { seedCatalog } from './catalog.js';
import { seedUsers } from './users.js';
import { seedWorkflow } from './workflow.js';

// Demo data for DenimFlow BO (DATABASE_DESIGN.md §9). Idempotent: every row is upserted by its
// business code, so running it twice leaves the same data. Run with `pnpm db:seed`.

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DIRECT_URL or DATABASE_URL is required to seed.');
  process.exit(1);
}

let supabase: SupabaseClient | null = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// The demo accounts' password comes only from the environment: the repository is public, so a
// committed fallback would give everyone the ADMIN login (rule 04).
const password = process.env.SEED_DEFAULT_PASSWORD ?? '';
if (supabase && password.length < 12) {
  console.error('SEED_DEFAULT_PASSWORD (at least 12 characters) is required to create Auth users.');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main(): Promise<void> {
  await seedCatalog(prisma);
  await seedUsers(prisma, supabase, password);
  await seedWorkflow(prisma);
  await seedBomAndLots(prisma);
  console.log('Seed completed.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
