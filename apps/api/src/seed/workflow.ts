import { validateTemplate } from '@denimflow/engine';
import type { PrismaClient } from '../generated/prisma/client.js';

export const DEMO_STYLE_CODE = 'JN-SLIM-01';

// "Jean Standard": the 14 steps of BUSINESS_RECONCILIATION.md §3, version 1 PUBLISHED, checked
// with the engine's BR-01 validator and assigned to the demo style (DATABASE_DESIGN.md §9).
export async function seedWorkflow(prisma: PrismaClient): Promise<void> {
  const demoStyle = await prisma.style.findUniqueOrThrow({ where: { styleCode: DEMO_STYLE_CODE } });

  // Check if template already exists
  const existingTemplate = await prisma.workflowTemplate.findFirst({
    where: { name: 'Jean Standard' },
    include: { versions: true },
  });

  let templateId: string;

  if (existingTemplate) {
    templateId = existingTemplate.id;
    console.log(`Workflow template "Jean Standard" already exists (${templateId}).`);
  } else {
    // Created as DRAFT, filled, validated (BR-01), then published, all in one transaction:
    // the BR-02 trigger rejects steps on a PUBLISHED version, and a failure must not leave a
    // half-built template behind that would make the next run skip it.
    templateId = await prisma.$transaction(
      async (tx) => {
        const template = await tx.workflowTemplate.create({
          data: {
            name: 'Jean Standard',
            isActive: true,
            isDedicated: false,
          },
        });

        const version = await tx.workflowVersion.create({
          data: {
            templateId: template.id,
            versionNo: 1,
            status: 'DRAFT',
          },
        });

        // Create 14 Steps (BUSINESS_RECONCILIATION.md §3)
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
          const created = await tx.stepDefinition.create({
            data: {
              ...stepData,
              versionId: version.id,
            },
          });
          stepMap.set(stepData.code, created.id);
        }

        // Create Sequential Transitions (1 -> 2 -> ... -> 14)
        for (let i = 0; i < stepDefinitionsData.length - 1; i++) {
          const fromCode = stepDefinitionsData[i]?.code;
          const toCode = stepDefinitionsData[i + 1]?.code;
          if (fromCode && toCode) {
            await tx.stepTransition.create({
              data: {
                versionId: version.id,
                fromStepId: stepMap.get(fromCode)!,
                toStepId: stepMap.get(toCode)!,
                kind: 'NORMAL',
              },
            });
          }
        }

        // Create REWORK Transitions from FINAL_QC back to SEWING, CLEAN_WASH, FINISHING
        const finalQcId = stepMap.get('FINAL_QC')!;
        const reworkTargets = ['SEWING', 'CLEAN_WASH', 'FINISHING'];
        for (const targetCode of reworkTargets) {
          await tx.stepTransition.create({
            data: {
              versionId: version.id,
              fromStepId: finalQcId,
              toStepId: stepMap.get(targetCode)!,
              kind: 'REWORK',
            },
          });
        }

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

        await tx.workflowVersion.update({
          where: { id: version.id },
          data: { status: 'PUBLISHED', publishedAt: new Date() },
        });
        await tx.workflowTemplate.update({
          where: { id: template.id },
          data: { currentVersionId: version.id },
        });
        return template.id;
      },
      { timeout: 30_000 },
    );
    console.log('Seeded "Jean Standard" version 1 as PUBLISHED (BR-01 verified).');
  }

  // Assign "Jean Standard" to the demo style
  await prisma.style.update({
    where: { id: demoStyle.id },
    data: { defaultTemplateId: templateId },
  });

  console.log(`Assigned "Jean Standard" template to Style ${demoStyle.styleCode}.`);
}
