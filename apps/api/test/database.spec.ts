import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

describe('database constraints', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('enables RLS on every table in the public schema', async () => {
    const tablesWithoutRls = await prisma.$queryRaw<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public' and not rowsecurity`;

    expect(tablesWithoutRls).toEqual([]);
  });

  describe('audit_logs is append-only', () => {
    let auditId: bigint;

    beforeEach(async () => {
      const row = await prisma.auditLog.create({
        data: { entityType: 'test', entityId: randomUUID(), action: 'TEST_INSERT' },
      });
      auditId = row.id;
    });

    it('BR-16: allows INSERT', async () => {
      await expect(prisma.auditLog.findUnique({ where: { id: auditId } })).resolves.not.toBeNull();
    });

    it('BR-16: rejects UPDATE', async () => {
      await expect(
        prisma.auditLog.update({ where: { id: auditId }, data: { action: 'CHANGED' } }),
      ).rejects.toThrow(/BR-16/);
    });

    it('BR-16: rejects DELETE', async () => {
      await expect(prisma.auditLog.delete({ where: { id: auditId } })).rejects.toThrow(/BR-16/);
    });

    it('BR-16: rejects TRUNCATE', async () => {
      await expect(prisma.$executeRaw`truncate table audit_logs`).rejects.toThrow(/BR-16/);
    });
  });
});
