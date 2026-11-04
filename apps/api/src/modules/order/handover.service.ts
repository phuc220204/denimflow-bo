import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateHandoverDto,
  HandoverRecordResponseDto,
  PackingListItemDto,
} from '@denimflow/shared';
import { BusinessRuleViolation } from '../../common/errors/business-rule-violation.js';
import { EvidenceService } from '../execution/evidence.service.js';
import { HandoverRepository } from './handover.repository.js';

type RecordRow = NonNullable<Awaited<ReturnType<HandoverRepository['find']>>>;
function toDto(row: RecordRow): HandoverRecordResponseDto {
  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.order.orderNumber,
    qcProfileId: row.qcProfileId,
    qcProfileType: row.qcProfile.profileType,
    packingList: row.packingList as unknown as PackingListItemDto[],
    totalQty: row.totalQty,
    handedOverBy: row.handedOverBy,
    handedOverByName: row.handedOverByUser.fullName,
    handedOverAt: row.handedOverAt.toISOString(),
    notes: row.notes,
    orderStatus: row.order.status,
  };
}
@Injectable()
export class HandoverService {
  constructor(
    @Inject(HandoverRepository) private readonly repository: HandoverRepository,
    @Inject(EvidenceService) private readonly evidence: EvidenceService,
  ) {}
  async get(orderId: string) {
    const record = await this.repository.find(orderId);
    return record ? toDto(record) : null;
  }
  async create(orderId: string, input: CreateHandoverDto, actorId: string) {
    return this.repository.transaction(async (tx) => {
      const initial = await this.repository.findOrder(tx, orderId);
      if (!initial) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (!initial.workflowInstance) throw new ConflictException('Đơn hàng chưa có quy trình');
      // Same lock direction as cutting start: steps first, then the order (avoid deadlocks).
      await this.repository.lockSteps(tx, initial.workflowInstance.id);
      await this.repository.lock(tx, orderId);
      const order = await this.repository.findOrder(tx, orderId);
      if (!order?.workflowInstance)
        throw new ConflictException('Đơn hàng vừa thay đổi, vui lòng tải lại');
      if (order.handoverRecord) throw new ConflictException('Đơn hàng đã có biên bản bàn giao');
      const instance = order.workflowInstance!;
      if (instance.requiresPlannerReview)
        throw new ConflictException('Đơn hàng đang chờ Điều độ sản xuất xử lý ngoại lệ QC');
      if (instance.status !== 'RUNNING' || !['CONFIRMED', 'IN_PRODUCTION'].includes(order.status))
        throw new ConflictException('Đơn hàng không ở trạng thái bàn giao');
      const finalQc = instance.stepInstances.find((s) => s.stepDefinition.code === 'FINAL_QC');
      const pack = instance.stepInstances.find((s) => s.stepDefinition.code === 'PACK_HANDOVER');
      if (
        !finalQc ||
        finalQc.status !== 'DONE' ||
        !pack ||
        !['READY', 'IN_PROGRESS'].includes(pack.status) ||
        instance.stepInstances.some(
          (s) => s.id !== pack.id && s.status !== 'DONE' && s.status !== 'SKIPPED',
        )
      )
        throw new BusinessRuleViolation(
          'FR-26',
          'Chỉ bàn giao khi FINAL_QC và tất cả công đoạn trước đã hoàn thành',
        );
      if (!order.qcProfile) throw new ConflictException('Đơn hàng chưa có QC Profile đã chốt');
      await this.evidence.assertCompletionAllowed(
        tx,
        pack.id,
        pack.stepDefinition.requiresEvidence,
      );

      // FR-26 / BR-08: pack final good quantities, never planned quantities or initial cut totals.
      const lastProduction = instance.stepInstances
        .filter(
          (s) =>
            s.stepDefinition.responsibleRole === 'STATION_OPERATOR' &&
            s.stepDefinition.seq < finalQc.stepDefinition.seq &&
            s.status === 'DONE',
        )
        .sort((a, b) => b.stepDefinition.seq - a.stepDefinition.seq)[0];
      if (!lastProduction) throw new ConflictException('Thiếu số lượng đạt của công đoạn cuối');
      const packingList = order.sizeLines.map((line) => ({
        size: line.size,
        plannedQty: line.plannedQty,
        actualQty: lastProduction.quantityEntries
          .filter(
            (e) =>
              e.bundleId && order.bundles.some((b) => b.id === e.bundleId && b.size === line.size),
          )
          .reduce((sum, e) => sum + e.qtyGood, 0),
      }));
      const totalQty = packingList.reduce((sum, line) => sum + line.actualQty, 0);
      const record = await this.repository.create(tx, {
        orderId,
        qcProfileId: order.qcProfile.id,
        packingList,
        totalQty,
        handedOverBy: actorId,
        notes: input.notes ?? null,
      });
      await this.repository.completeStep(tx, pack.id, actorId, totalQty);
      await this.repository.completeInstance(tx, instance.id);
      await this.repository.completeOrder(tx, orderId);
      for (const [entityType, entityId, action, oldValue, newValue] of [
        [
          'StepInstance',
          pack.id,
          'COMPLETE_STEP',
          { status: pack.status },
          { status: 'DONE', totalQty },
        ],
        [
          'WorkflowInstance',
          instance.id,
          'COMPLETE_INSTANCE',
          { status: instance.status },
          { status: 'COMPLETED' },
        ],
        [
          'ProductionOrder',
          orderId,
          'HANDOVER_CREATED',
          { status: order.status },
          { status: 'COMPLETED', handoverId: record.id, qcProfileId: record.qcProfileId, totalQty },
        ],
      ] as const)
        await this.repository.audit(tx, {
          entityType,
          entityId,
          action,
          actorId,
          oldValue,
          newValue,
        });
      return { ...toDto(record), orderStatus: 'COMPLETED' };
    });
  }
}
