import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type {
  CreateProductionOrderDto,
  ProductionOrderQueryDto,
  UpdateProductionOrderDto,
} from '@denimflow/shared';

@Injectable()
export class OrderRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listOrders(query?: ProductionOrderQueryDto) {
    const where: Prisma.ProductionOrderWhereInput = {};
    if (query?.status) {
      where.status = query.status;
    }
    if (query?.styleId) {
      where.styleId = query.styleId;
    }

    return this.prisma.productionOrder.findMany({
      where,
      include: {
        style: true,
        fabricType: true,
        color: true,
        washType: true,
        sizeLines: {
          orderBy: { size: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOrderById(id: string) {
    return this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        style: true,
        fabricType: true,
        color: true,
        washType: true,
        qcProfile: true,
        creator: {
          select: { id: true, fullName: true, email: true, role: true },
        },
        sizeLines: {
          orderBy: { size: 'asc' },
        },
        bomLines: {
          include: {
            materialAllocations: {
              include: { fabricLot: true },
            },
            materialRequests: true,
          },
        },
        materialRequests: true,
        customerAcknowledgements: true,
        workflowInstance: {
          include: {
            stepInstances: {
              include: { stepDefinition: true },
              orderBy: { stepDefinition: { seq: 'asc' } },
            },
          },
        },
      },
    });
  }

  async generateOrderNumber(
    tx: Prisma.TransactionClient,
    currentYear: number = new Date().getFullYear(),
  ): Promise<string> {
    const prefix = `PO-${currentYear}-`;
    const latestOrder = await tx.productionOrder.findFirst({
      where: {
        orderNumber: { startsWith: prefix },
      },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });

    let nextSeq = 1;
    if (latestOrder) {
      const parts = latestOrder.orderNumber.split('-');
      const lastSeq = parseInt(parts[2] ?? '0', 10);
      if (!Number.isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  async createDraftOrder(dto: CreateProductionOrderDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.generateOrderNumber(tx);

      const order = await tx.productionOrder.create({
        data: {
          orderNumber,
          styleId: dto.styleId,
          dueDate: new Date(dto.dueDate),
          customerRef: dto.customerRef ?? null,
          notes: dto.notes ?? null,
          washTypeId: dto.washTypeId ?? null,
          dyeRequired: dto.dyeRequired ?? false,
          dyeMode: dto.dyeMode ?? null,
          dyeSource: dto.dyeSource ?? null,
          embroideryRequired: dto.embroideryRequired ?? false,
          fabricInspectRequired: dto.fabricInspectRequired ?? false,
          ppSampleRequired: dto.ppSampleRequired ?? false,
          skipCleanWash: dto.skipCleanWash ?? false,
          isCustom: dto.isCustom ?? false,
          status: 'DRAFT',
          createdBy: actorId,
          sizeLines: {
            create: dto.sizeLines.map((line) => ({
              size: line.size.toUpperCase(),
              plannedQty: line.plannedQty,
            })),
          },
        },
        include: {
          style: true,
          fabricType: true,
          color: true,
          washType: true,
          sizeLines: true,
        },
      });

      // Write AuditLog (BR-16)
      await tx.auditLog.create({
        data: {
          entityType: 'ProductionOrder',
          entityId: order.id,
          action: 'CREATE_DRAFT',
          actorId,
          newValue: {
            orderNumber: order.orderNumber,
            styleId: order.styleId,
            status: order.status,
            dueDate: order.dueDate,
            sizeLines: dto.sizeLines,
          },
        },
      });

      return order;
    });
  }

  async updateDraftOrder(id: string, dto: UpdateProductionOrderDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.productionOrder.findUnique({
        where: { id },
        include: { sizeLines: true },
      });

      if (!existing) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      if (existing.status !== 'DRAFT') {
        throw new BadRequestException('Chỉ có thể chỉnh sửa đơn hàng ở trạng thái DRAFT');
      }

      if (dto.sizeLines) {
        await tx.orderSizeLine.deleteMany({
          where: { orderId: id },
        });
        await tx.orderSizeLine.createMany({
          data: dto.sizeLines.map((line) => ({
            orderId: id,
            size: line.size.toUpperCase(),
            plannedQty: line.plannedQty,
          })),
        });
      }

      const updated = await tx.productionOrder.update({
        where: { id },
        data: {
          styleId: dto.styleId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          customerRef: dto.customerRef,
          notes: dto.notes,
          washTypeId: dto.washTypeId,
          dyeRequired: dto.dyeRequired,
          dyeMode: dto.dyeMode,
          dyeSource: dto.dyeSource,
          embroideryRequired: dto.embroideryRequired,
          fabricInspectRequired: dto.fabricInspectRequired,
          ppSampleRequired: dto.ppSampleRequired,
          skipCleanWash: dto.skipCleanWash,
          isCustom: dto.isCustom,
          version: { increment: 1 },
        },
        include: {
          style: true,
          fabricType: true,
          color: true,
          washType: true,
          sizeLines: true,
        },
      });

      // Write AuditLog (BR-16)
      await tx.auditLog.create({
        data: {
          entityType: 'ProductionOrder',
          entityId: id,
          action: 'UPDATE_DRAFT',
          actorId,
          oldValue: {
            dueDate: existing.dueDate,
            status: existing.status,
            notes: existing.notes,
          },
          newValue: {
            dueDate: updated.dueDate,
            status: updated.status,
            notes: updated.notes,
          },
        },
      });

      return updated;
    });
  }
}
