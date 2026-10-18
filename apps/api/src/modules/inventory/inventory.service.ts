import { Inject, Injectable } from '@nestjs/common';
import type { AllocateFabricDto, CuttingGateResultDto } from '@denimflow/shared';
import { InventoryRepository } from './inventory.repository.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class InventoryService {
  constructor(
    @Inject(InventoryRepository) private readonly repository: InventoryRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listFabricLots(fabricTypeId?: string, colorId?: string) {
    return this.repository.listFabricLots(fabricTypeId, colorId);
  }

  async listMaterialRequests(orderId?: string) {
    return this.repository.listMaterialRequests(orderId);
  }

  async listAllocationsByOrder(orderId: string) {
    return this.repository.listAllocationsByOrder(orderId);
  }

  async allocateFabric(dto: AllocateFabricDto, actorId: string) {
    return this.repository.allocateFabric(dto, actorId);
  }

  async getCuttingGate(orderId: string): Promise<CuttingGateResultDto> {
    return this.repository.getCuttingGate(orderId);
  }

  async listOrdersForAllocation() {
    const orders = await this.prisma.productionOrder.findMany({
      where: {
        status: { in: ['DRAFT', 'CONFIRMED', 'IN_PRODUCTION'] },
      },
      include: {
        style: true,
        fabricType: true,
        color: true,
        bomLines: {
          where: { materialType: 'FABRIC' },
          include: {
            materialAllocations: {
              include: { fabricLot: true },
            },
            materialRequests: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      orders.map(async (order) => {
        const fabricBomLine = order.bomLines[0] || null;
        let allocatedQty = 0;
        let requiredQty = 0;
        let missingQty = 0;

        if (fabricBomLine) {
          requiredQty = Number(fabricBomLine.requiredQty);
          allocatedQty = fabricBomLine.materialAllocations.reduce(
            (s, a) => s + Number(a.allocatedQty),
            0,
          );
          missingQty = Math.max(0, requiredQty - allocatedQty);
        }

        const cuttingGate = await this.repository.getCuttingGate(order.id);

        return {
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            dueDate: order.dueDate,
            customerRef: order.customerRef,
            style: order.style,
            fabricType: order.fabricType,
            color: order.color,
          },
          fabricBomLine: fabricBomLine
            ? {
                id: fabricBomLine.id,
                requiredQty,
                allocatedQty,
                missingQty,
                unit: fabricBomLine.unit,
                allocations: fabricBomLine.materialAllocations.map((a) => ({
                  id: a.id,
                  allocatedQty: Number(a.allocatedQty),
                  lotNo: a.fabricLot?.lotNo,
                  createdAt: a.createdAt,
                })),
                requests: fabricBomLine.materialRequests.map((r) => ({
                  id: r.id,
                  missingQty: Number(r.missingQty),
                  status: r.status,
                  createdAt: r.createdAt,
                })),
              }
            : null,
          cuttingGate,
        };
      }),
    );
  }
}
