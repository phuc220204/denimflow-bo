// Test-only host; never imported by main.ts or used by Render's start command.
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const url = new URL(
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:54329/denimflow_e2e',
);
if (
  !['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
  !/^denimflow_(test|e2e)$/.test(url.pathname.slice(1))
)
  throw new Error('E2E requires a disposable loopback test database');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = url.href;
process.env.DIRECT_URL = url.href;
process.env.CORS_ORIGINS = 'http://127.0.0.1:5174';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const root = fileURLToPath(new URL('../../../', import.meta.url));
execSync('pnpm --filter @denimflow/api db:migrate:deploy', {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});
const { PrismaClient } = await import('../dist/generated/prisma/client.js');
const { PrismaPg } = await import('@prisma/adapter-pg');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });
const { seedCatalog } = await import('../dist/seed/catalog.js');
const { seedUsers } = await import('../dist/seed/users.js');
const { seedWorkflow } = await import('../dist/seed/workflow.js');
const { seedBomAndLots } = await import('../dist/seed/bom-and-lots.js');
await seedCatalog(prisma);
await seedUsers(prisma, null, '');
await seedWorkflow(prisma);
await seedBomAndLots(prisma);
const operators = {};
for (const station of await prisma.station.findMany()) {
  const profile = await prisma.profile.upsert({
    where: { email: `e2e-${station.stationType.toLowerCase()}@denimflow.test` },
    update: { stationId: station.id },
    create: {
      id: randomUUID(),
      email: `e2e-${station.stationType.toLowerCase()}@denimflow.test`,
      fullName: `E2E ${station.stationType}`,
      role: 'STATION_OPERATOR',
      stationId: station.id,
    },
  });
  operators[station.stationType] = `e2e-${profile.id}`;
}
const profiles = await prisma.profile.findMany({
  where: { email: { endsWith: '@denimflow.internal' } },
});
const tokens = Object.fromEntries(profiles.map((p) => [p.role, `e2e-${p.id}`]));
const { UnauthorizedException } = await import('@nestjs/common');
// Supabase authentication is replaced only in this local fixture. Roles come from profiles.
const auth = {
  async getMe(header) {
    if (!header?.startsWith('Bearer e2e-')) throw new UnauthorizedException();
    const user = await prisma.profile.findUnique({
      where: { id: header.slice('Bearer e2e-'.length) },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();
    return {
      id: user.id,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
    };
  },
  async login(input) {
    const user = await prisma.profile.findUnique({ where: { email: input.email } });
    if (!user || input.password !== 'e2e-only-password') throw new UnauthorizedException();
    const accessToken = `e2e-${user.id}`;
    return { accessToken, user: await this.getMe(`Bearer ${accessToken}`) };
  },
};
const { Test } = await import('@nestjs/testing');
const { AppModule } = await import('../dist/app.module.js');
const { AuthService } = await import('../dist/modules/auth/auth.service.js');
const { setupApp } = await import('../dist/app.setup.js');
let builder = Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(AuthService)
  .useValue(auth);
// Full E2E requires the evidence feature; missing prerequisites fail startup.
const { EvidenceStorage } = await import('../dist/modules/execution/evidence-storage.js');
builder = builder.overrideProvider(EvidenceStorage).useValue({
  sign: async () => ({ signedUrl: 'http://127.0.0.1:3101/test-storage' }),
  info: async () => ({ mimeType: 'application/pdf', sizeBytes: 100 }),
});
const moduleRef = await builder.compile();
const app = moduleRef.createNestApplication();
setupApp(app);
const [style, fabric, color, wash, lot] = await Promise.all([
  prisma.style.findUniqueOrThrow({ where: { styleCode: 'JN-SLIM-01' } }),
  prisma.fabricType.findUniqueOrThrow({ where: { code: 'DN-12-RIGID' } }),
  prisma.colorOption.findUniqueOrThrow({ where: { code: 'CLR-INDIGO' } }),
  prisma.washType.findUniqueOrThrow({ where: { code: 'WSH-STONE' } }),
  prisma.fabricLot.findFirstOrThrow({ where: { availableMeters: { gt: 500 } } }),
]);
app.getHttpAdapter().get('/__fixtures', (_req, res) =>
  res.json({
    tokens,
    operators,
    styleId: style.id,
    fabricTypeId: fabric.id,
    colorId: color.id,
    washTypeId: wash.id,
    fabricLotId: lot.id,
  }),
);
await app.listen(3101, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
