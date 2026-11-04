import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
export type HandoverTx = Prisma.TransactionClient;
const include = { order: true, qcProfile: true, handedOverByUser: true } as const;
@Injectable()
export class HandoverRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  transaction<T>(work: (tx: HandoverTx) => Promise<T>) {
    return this.prisma.$transaction(work);
  }
  async lock(tx: HandoverTx, orderId: string) {
    await tx.$queryRaw`SELECT id FROM production_orders WHERE id = ${orderId}::uuid FOR UPDATE`;
  }
  async lockSteps(tx: HandoverTx, instanceId: string) {
    await tx.$queryRaw`SELECT id FROM step_instances WHERE instance_id = ${instanceId}::uuid ORDER BY id FOR UPDATE`;
  }
  findOrder(tx: HandoverTx, id: string) {
    return tx.productionOrder.findUnique({
      where: { id },
      include: {
        qcProfile: true,
        sizeLines: true,
        bundles: true,
        handoverRecord: true,
        workflowInstance: {
          include: { stepInstances: { include: { stepDefinition: true, quantityEntries: true } } },
        },
      },
    });
  }
  find(orderId: string) {
    return this.prisma.handoverRecord.findUnique({ where: { orderId }, include });
  }
  create(tx: HandoverTx, data: Prisma.HandoverRecordUncheckedCreateInput) {
    return tx.handoverRecord.create({ data, include });
  }
  completeStep(tx: HandoverTx, id: string, actorId: string, totalQty: number) {
    return tx.stepInstance.update({
      where: { id },
      data: {
        status: 'DONE',
        completedAt: new Date(),
        performedBy: actorId,
        completedBy: actorId,
        qtyGood: totalQty,
      },
    });
  }
  completeOrder(tx: HandoverTx, id: string) {
    return tx.productionOrder.update({ where: { id }, data: { status: 'COMPLETED' } });
  }
  completeInstance(tx: HandoverTx, id: string) {
    return tx.workflowInstance.update({ where: { id }, data: { status: 'COMPLETED' } });
  }
  audit(tx: HandoverTx, data: Prisma.AuditLogUncheckedCreateInput) {
    return tx.auditLog.create({ data });
  }
}
