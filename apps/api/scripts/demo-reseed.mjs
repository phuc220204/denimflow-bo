// Script to reseed demo data for live presentation (T5.7)
// Resets test orders, allocations, workflow execution, inspections, and reapplies master seed.
// Run: node --env-file-if-exists=.env scripts/demo-reseed.mjs
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL or DIRECT_URL required.');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function resetDemoData() {
  console.log('--- Resetting DenimFlow BO demo orders & execution data ---');

  // Delete in reverse foreign-key order
  await prisma.handoverRecord.deleteMany({});
  await prisma.packingList.deleteMany({});
  await prisma.defectRecord.deleteMany({});
  await prisma.qcInspection.deleteMany({});
  await prisma.stepEvidence.deleteMany({});
  await prisma.stepQuantity.deleteMany({});
  await prisma.stepInstance.deleteMany({});
  await prisma.workflowInstance.deleteMany({});
  await prisma.materialAllocation.deleteMany({});
  await prisma.orderLine.deleteMany({});
  await prisma.order.deleteMany({});

  console.log('Cleared existing execution instances, allocations, and orders.');
  console.log('AuditLog remains intact as an append-only compliance record (BR-16).');
  console.log(
    'Now run `pnpm db:seed` to ensure master catalog, users, lots, and workflow templates are pristine.',
  );
}

resetDemoData()
  .catch((err) => {
    console.error('Error during demo reseed reset:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
