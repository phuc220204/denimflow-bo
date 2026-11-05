import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { type INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { seedUsers } from '../src/seed/users.js';

// The seeded Process Engineer profile (src/seed/users.ts); created_by is a FK to profiles.
const PE_ID = '00000000-0000-0000-0000-000000000002';

const fakeAuthService = {
  async getMe(authHeader?: string) {
    if (authHeader !== 'Bearer pe-token') {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }
    return {
      id: PE_ID,
      role: 'PROCESS_ENGINEER',
      email: 'pe@denimflow.test',
      fullName: 'PE',
      isActive: true,
    };
  },
};

describe('Workflow changes record who made them (D3, BR-16)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const http = () => request(app.getHttpServer());
  // audit_logs is append-only (BR-16), so every run uses its own template and style.
  const suffix = randomUUID().slice(0, 8);

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await seedUsers(prisma, null, '');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthService)
      .useValue(fakeAuthService)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  async function createTemplate(): Promise<{ templateId: string; versionId: string }> {
    const res = await http()
      .post('/workflow/templates')
      .set('Authorization', 'Bearer pe-token')
      .send({ name: `D3 audit ${suffix}` })
      .expect(201);
    return { templateId: res.body.template.id, versionId: res.body.version.id };
  }

  async function addStartToEndSteps(versionId: string): Promise<void> {
    const step = (code: string, seq: number, flags: { isStart?: boolean; isEnd?: boolean }) =>
      http()
        .post(`/workflow/versions/${versionId}/steps`)
        .set('Authorization', 'Bearer pe-token')
        .send({
          code,
          name: code,
          stepType: 'PRODUCTION',
          seq,
          responsibleRole: 'STATION_OPERATOR',
          ...flags,
        })
        .expect(201);
    const start = await step('D3_START', 1, { isStart: true });
    const end = await step('D3_END', 2, { isEnd: true });
    await http()
      .post(`/workflow/versions/${versionId}/transitions`)
      .set('Authorization', 'Bearer pe-token')
      .send({ fromStepId: start.body.id, toStepId: end.body.id })
      .expect(201);
  }

  it('BR-16: creating a template stores the creator on its first version', async () => {
    const { versionId } = await createTemplate();

    const version = await prisma.workflowVersion.findUniqueOrThrow({ where: { id: versionId } });
    expect(version.createdBy).toBe(PE_ID);
  });

  it('BR-16: creating a new version stores its creator', async () => {
    const { templateId } = await createTemplate();

    const res = await http()
      .post(`/workflow/templates/${templateId}/versions`)
      .set('Authorization', 'Bearer pe-token')
      .expect(201);

    const version = await prisma.workflowVersion.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(version.createdBy).toBe(PE_ID);
  });

  it('BR-16: publishing a version writes an AuditLog with the actor', async () => {
    const { versionId } = await createTemplate();
    await addStartToEndSteps(versionId);

    await http()
      .post(`/workflow/versions/${versionId}/publish`)
      .set('Authorization', 'Bearer pe-token')
      .expect(201);

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'WorkflowVersion', entityId: versionId, action: 'PUBLISH_VERSION' },
    });
    expect(log.actorId).toBe(PE_ID);
  });

  it('BR-16: assigning a template to a style writes an AuditLog with the actor', async () => {
    const { templateId } = await createTemplate();
    const style = await prisma.style.create({
      data: { styleCode: `D3-${suffix}`, name: `D3 style ${suffix}` },
    });

    await http()
      .post('/workflow/styles/assign-template')
      .set('Authorization', 'Bearer pe-token')
      .send({ styleId: style.id, templateId })
      .expect(201);

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'Style', entityId: style.id, action: 'ASSIGN_WORKFLOW_TEMPLATE' },
    });
    expect(log.actorId).toBe(PE_ID);
  });
});
