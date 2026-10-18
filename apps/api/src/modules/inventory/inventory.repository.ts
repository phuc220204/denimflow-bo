import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { evaluateCuttingGate } from '@denimflow/engine';
import type { AllocateFabricDto, CuttingGateResultDto } from '@denimflow/shared';
import { BusinessRuleViolation } from '../../common/errors/business-rule-violation.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class InventoryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listFabricLots(fabricTypeId?: string, colorId?: string) {
    const where: { fabricTypeId?: string; colorId?: string } = {};
    if (fabricTypeId) where.fabricTypeId = fabricTypeId;
    if (colorId) where.colorId = colorId;

    return this.prisma.fabricLot.findMany({
      where,
      include: {
        fabricType: true,
        colorOption: true,
      },
      orderBy: { lotNo: 'asc' },
    });
  }

  async listMaterialRequests(orderId?: string) {
    return this.prisma.materialRequest.findMany({
      where: orderId ? { orderId } : {},
      include: {
        order: {
          select: { id: true, orderNumber: true, status: true },
        },
        bomLine: true,
        requester: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAllocationsByOrder(orderId: string) {
    return this.prisma.materialAllocation.findMany({
      where: {
        bomLine: { orderId },
      },
      include: {
        fabricLot: {
          include: {
            fabricType: true,
            colorOption: true,
          },
        },
        bomLine: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async allocateFabric(dto: AllocateFabricDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Pessimistic row lock on FabricLot (DATABASE_DESIGN.md §7.2)
      const lockedLots = await tx.$queryRaw<
        Array<{
          id: string;
          fabric_type_id: string;
          color_id: string;
          lot_no: string;
          available_meters: number;
          shrinkage_percent: number | null;
        }>
      >`SELECT id, fabric_type_id, color_id, lot_no, available_meters, shrinkage_percent FROM fabric_lots WHERE id = ${dto.fabricLotId}::uuid FOR UPDATE`;

      const lockedLot = lockedLots[0];
      if (!lockedLot) {
        throw new NotFoundException(`Fabric lot ${dto.fabricLotId} not found`);
      }

      const availableMeters = Number(lockedLot.available_meters);
      if (availableMeters < dto.quantity) {
        throw new BusinessRuleViolation(
          'BR-06',
          `Over-allocation rejected: requested quantity (${dto.quantity}m) exceeds available stock (${availableMeters}m).`,
        );
      }

      // 2. Fetch BOM line with existing allocations and order
      const bomLine = await tx.bomLine.findUnique({
        where: { id: dto.bomLineId },
        include: {
          materialAllocations: true,
          order: true,
        },
      });

      if (!bomLine) {
        throw new NotFoundException(`BOM line ${dto.bomLineId} not found`);
      }

      if (bomLine.orderId !== dto.orderId) {
        throw new BadRequestException(`BOM line does not belong to order ${dto.orderId}`);
      }

      if (bomLine.materialType !== 'FABRIC') {
        throw new BadRequestException(`Material allocation only supports FABRIC lots`);
      }

      // 3. Validate fabric type and color compatibility with order (BR-04)
      if (bomLine.order.fabricTypeId && bomLine.order.fabricTypeId !== lockedLot.fabric_type_id) {
        throw new BusinessRuleViolation(
          'BR-04',
          `Fabric lot type does not match order fabric type.`,
        );
      }

      if (bomLine.order.colorId && bomLine.order.colorId !== lockedLot.color_id) {
        throw new BusinessRuleViolation('BR-04', `Fabric lot color does not match order color.`);
      }

      // 4. Validate that allocation does not exceed required BOM quantity
      const existingAllocated = bomLine.materialAllocations.reduce(
        (sum, a) => sum + Number(a.allocatedQty),
        0,
      );
      const requiredQty = Number(bomLine.requiredQty);

      if (existingAllocated + dto.quantity > requiredQty + 0.001) {
        throw new BusinessRuleViolation(
          'BR-06',
          `Over-allocation rejected: total allocated (${existingAllocated + dto.quantity}m) would exceed required BOM quantity (${requiredQty}m).`,
        );
      }

      // 5. Decrement available meters on FabricLot
      const newAvailable = availableMeters - dto.quantity;
      await tx.fabricLot.update({
        where: { id: lockedLot.id },
        data: { availableMeters: newAvailable },
      });

      // 6. Create MaterialAllocation record
      const allocation = await tx.materialAllocation.create({
        data: {
          bomLineId: bomLine.id,
          fabricLotId: lockedLot.id,
          allocatedQty: dto.quantity,
        },
        include: { fabricLot: true },
      });

      // 7. Manage MaterialRequest for shortage
      const totalAllocated = existingAllocated + dto.quantity;
      const missingQty = Math.max(0, requiredQty - totalAllocated);

      if (missingQty > 0.001) {
        const existingReq = await tx.materialRequest.findFirst({
          where: { bomLineId: bomLine.id, status: 'OPEN' },
        });

        if (existingReq) {
          await tx.materialRequest.update({
            where: { id: existingReq.id },
            data: { missingQty },
          });
        } else {
          await tx.materialRequest.create({
            data: {
              orderId: bomLine.orderId,
              bomLineId: bomLine.id,
              missingQty,
              status: 'OPEN',
              requestedBy: actorId,
            },
          });
        }
      } else {
        // Fully allocated: close any open material request
        await tx.materialRequest.updateMany({
          where: { bomLineId: bomLine.id, status: 'OPEN' },
          data: { status: 'RECEIVED' },
        });
      }

      // 8. Write AuditLog (BR-16)
      await tx.auditLog.create({
        data: {
          entityType: 'material_allocation',
          entityId: allocation.id,
          action: 'ALLOCATE_FABRIC',
          actorId,
          newValue: {
            orderId: bomLine.orderId,
            bomLineId: bomLine.id,
            lotNo: lockedLot.lot_no,
            allocatedQty: dto.quantity,
            remainingMissingQty: missingQty,
          },
        },
      });

      return {
        allocation,
        remainingMissingQty: missingQty,
        isFullyAllocated: missingQty <= 0.001,
      };
    });
  }

  async getCuttingGate(orderId: string): Promise<CuttingGateResultDto> {
    const fabricBomLine = await this.prisma.bomLine.findFirst({
      where: { orderId, materialType: 'FABRIC' },
      include: { materialAllocations: true },
    });

    if (!fabricBomLine) {
      const gate = evaluateCuttingGate({ fabricBomLine: null });
      return {
        passed: gate.passed,
        ruleId: gate.ruleId,
        reason: gate.reason,
      };
    }

    const allocatedQty = fabricBomLine.materialAllocations.reduce(
      (sum, a) => sum + Number(a.allocatedQty),
      0,
    );
    const requiredQty = Number(fabricBomLine.requiredQty);

    const gate = evaluateCuttingGate({
      fabricBomLine: { requiredQty, allocatedQty },
    });

    return {
      passed: gate.passed,
      ruleId: gate.ruleId,
      reason: gate.reason,
      requiredQty,
      allocatedQty,
      missingQty: Math.max(0, requiredQty - allocatedQty),
    };
  }
}
