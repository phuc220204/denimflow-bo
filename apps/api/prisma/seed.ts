import { PrismaPg } from '@prisma/adapter-pg';
import { validateTemplate } from '@denimflow/engine';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:54329/denimflow_test';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  console.log('Seeding database with "Jean Standard" workflow template...');

  // 1. Create or ensure demo Style exists
  const demoStyle = await prisma.style.upsert({
    where: { styleCode: 'JS-01' },
    update: {},
    create: {
      styleCode: 'JS-01',
      name: 'Jean Slim Fit Standard',
      fitType: 'Slim Fit',
      hasEmbroidery: false,
      isActive: true,
    },
  });

  // 2. Check if template already exists
  const existingTemplate = await prisma.workflowTemplate.findFirst({
    where: { name: 'Jean Standard' },
    include: { versions: true },
  });

  let templateId: string;

  if (existingTemplate) {
    templateId = existingTemplate.id;
    console.log(`Workflow template "Jean Standard" already exists (${templateId}).`);
  } else {
    // 3. Create Template
    const template = await prisma.workflowTemplate.create({
      data: {
        name: 'Jean Standard',
        isActive: true,
        isDedicated: false,
      },
    });
    templateId = template.id;

    // 4. Create PUBLISHED Version 1
    const version = await prisma.workflowVersion.create({
      data: {
        templateId: template.id,
        versionNo: 1,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    // 5. Create 14 Steps (BUSINESS_RECONCILIATION.md §3)
    const stepDefinitionsData = [
      {
        code: 'ORDER_CONFIRM',
        name: 'Order intake and confirmation',
        stepType: 'APPROVAL' as const,
        seq: 1,
        responsibleRole: 'PRODUCTION_PLANNER' as const,
        isStart: true,
        isEnd: false,
        isMandatory: true,
      },
      {
        code: 'FABRIC_COLOR_SELECT',
        name: 'Fabric and color selection',
        stepType: 'SELECTION' as const,
        seq: 2,
        responsibleRole: 'PRODUCTION_PLANNER' as const,
        isStart: false,
        isEnd: false,
        isMandatory: true,
      },
      {
        code: 'BOM_ALLOCATE',
        name: 'BOM and material allocation',
        stepType: 'MATERIAL' as const,
        seq: 3,
        responsibleRole: 'PRODUCTION_PLANNER' as const,
        isStart: false,
        isEnd: false,
        isMandatory: true,
      },
      {
        code: 'FABRIC_INSPECT',
        name: 'Incoming fabric inspection / shrinkage test',
        stepType: 'QC' as const,
        seq: 4,
        responsibleRole: 'QC_INSPECTOR' as const,
        isStart: false,
        isEnd: false,
        isMandatory: false,
        conditionExpr: { op: 'eq', field: 'order.fabricInspectRequired', value: true },
      },
      {
        code: 'PP_SAMPLE',
        name: 'Pre-production sample approval',
        stepType: 'APPROVAL' as const,
        seq: 5,
        responsibleRole: 'PRODUCTION_PLANNER' as const,
        isStart: false,
        isEnd: false,
        isMandatory: false,
        conditionExpr: { op: 'eq', field: 'order.ppSampleRequired', value: true },
      },
      {
        code: 'CUTTING',
        name: 'Spreading and cutting',
        stepType: 'PRODUCTION' as const,
        seq: 6,
        responsibleRole: 'STATION_OPERATOR' as const,
        stationType: 'CUTTING' as const,
        isStart: false,
        isEnd: false,
        isMandatory: true,
      },
      {
        code: 'EMBROIDERY',
        name: 'Embroidery / print',
        stepType: 'PRODUCTION' as const,
        seq: 7,
        responsibleRole: 'STATION_OPERATOR' as const,
        stationType: 'EMBROIDERY' as const,
        isStart: false,
        isEnd: false,
        isMandatory: false,
        conditionExpr: { op: 'eq', field: 'order.embroideryRequired', value: true },
      },
      {
        code: 'SEWING',
        name: 'Sewing',
        stepType: 'PRODUCTION' as const,
        seq: 8,
        responsibleRole: 'STATION_OPERATOR' as const,
        stationType: 'SEWING' as const,
        isStart: false,
        isEnd: false,
        isMandatory: true,
        requiresQc: true,
        maxRework: 2,
      },
      {
        code: 'DYEING',
        name: 'Dyeing',
        stepType: 'PRODUCTION' as const,
        seq: 9,
        responsibleRole: 'STATION_OPERATOR' as const,
        stationType: 'DYEING' as const,
        isStart: false,
        isEnd: false,
        isMandatory: false,
        conditionExpr: { op: 'eq', field: 'order.dyeRequired', value: true },
      },
      {
        code: 'EFFECT_WASH',
        name: 'Effect (distressing) wash',
        stepType: 'PRODUCTION' as const,
        seq: 10,
        responsibleRole: 'STATION_OPERATOR' as const,
        stationType: 'WASH' as const,
        isStart: false,
        isEnd: false,
        isMandatory: false,
        conditionExpr: { op: 'neq', field: 'order.washTypeId', value: null },
      },
      {
        code: 'CLEAN_WASH',
        name: 'Clean wash',
        stepType: 'PRODUCTION' as const,
        seq: 11,
        responsibleRole: 'STATION_OPERATOR' as const,
        stationType: 'WASH' as const,
        isStart: false,
        isEnd: false,
        isMandatory: false,
        maxRework: 2,
        conditionExpr: {
          op: 'not',
          arg: { op: 'eq', field: 'order.skipCleanWash', value: true },
        },
      },
      {
        code: 'FINISHING',
        name: 'Finishing (trim, press, labels, buttons)',
        stepType: 'PRODUCTION' as const,
        seq: 12,
        responsibleRole: 'STATION_OPERATOR' as const,
        stationType: 'FINISHING' as const,
        isStart: false,
        isEnd: false,
        isMandatory: true,
        maxRework: 2,
      },
      {
        code: 'FINAL_QC',
        name: 'Final QC',
        stepType: 'QC' as const,
        seq: 13,
        responsibleRole: 'QC_INSPECTOR' as const,
        stationType: 'QC' as const,
        isStart: false,
        isEnd: false,
        isMandatory: true,
      },
      {
        code: 'PACK_HANDOVER',
        name: 'Packing and handover',
        stepType: 'PRODUCTION' as const,
        seq: 14,
        responsibleRole: 'PRODUCTION_PLANNER' as const,
        stationType: 'PACKING' as const,
        isStart: false,
        isEnd: true,
        isMandatory: true,
      },
    ];

    const stepMap = new Map<string, string>();
    for (const stepData of stepDefinitionsData) {
      const created = await prisma.stepDefinition.create({
        data: {
          ...stepData,
          versionId: version.id,
        },
      });
      stepMap.set(stepData.code, created.id);
    }

    // 6. Create Sequential Transitions (1 -> 2 -> ... -> 14)
    for (let i = 0; i < stepDefinitionsData.length - 1; i++) {
      const fromCode = stepDefinitionsData[i]?.code;
      const toCode = stepDefinitionsData[i + 1]?.code;
      if (fromCode && toCode) {
        await prisma.stepTransition.create({
          data: {
            versionId: version.id,
            fromStepId: stepMap.get(fromCode)!,
            toStepId: stepMap.get(toCode)!,
            kind: 'NORMAL',
          },
        });
      }
    }

    // 7. Create REWORK Transitions from FINAL_QC back to SEWING, CLEAN_WASH, FINISHING
    const finalQcId = stepMap.get('FINAL_QC')!;
    const reworkTargets = ['SEWING', 'CLEAN_WASH', 'FINISHING'];
    for (const targetCode of reworkTargets) {
      await prisma.stepTransition.create({
        data: {
          versionId: version.id,
          fromStepId: finalQcId,
          toStepId: stepMap.get(targetCode)!,
          kind: 'REWORK',
        },
      });
    }

    // Update currentVersionId on template
    await prisma.workflowTemplate.update({
      where: { id: template.id },
      data: { currentVersionId: version.id },
    });

    // Validate the seeded template with BR-01 engine validator
    const validationResult = validateTemplate({
      steps: stepDefinitionsData.map((s) => ({
        id: stepMap.get(s.code)!,
        code: s.code,
        name: s.name,
        seq: s.seq,
        isStart: s.isStart,
        isEnd: s.isEnd,
        maxRework: 'maxRework' in s && typeof s.maxRework === 'number' ? s.maxRework : null,
      })),
      transitions: [
        ...stepDefinitionsData.slice(0, -1).map((s, idx) => ({
          fromStepId: stepMap.get(s.code)!,
          toStepId: stepMap.get(stepDefinitionsData[idx + 1]!.code)!,
          kind: 'NORMAL' as const,
        })),
        ...reworkTargets.map((code) => ({
          fromStepId: finalQcId,
          toStepId: stepMap.get(code)!,
          kind: 'REWORK' as const,
        })),
      ],
    });

    if (!validationResult.valid) {
      throw new Error(
        `Seeded template failed BR-01 validation: ${JSON.stringify(validationResult.violations)}`,
      );
    }

    console.log('Seeded "Jean Standard" version 1 as PUBLISHED (BR-01 verified).');
  }

  // 8. Assign "Jean Standard" to Style JS-01
  await prisma.style.update({
    where: { id: demoStyle.id },
    data: { defaultTemplateId: templateId },
  });

  console.log(`Assigned "Jean Standard" template to Style ${demoStyle.styleCode}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
