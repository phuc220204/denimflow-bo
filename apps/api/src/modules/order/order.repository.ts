import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BomCalculator,
  buildWorkflowInstancePlan,
  type BomNormInput,
  type OrderSizeLineInput,
} from '@denimflow/engine';
import type {
  AttachAcknowledgementDto,
  ConfirmOrderResponseDto,
  CreateProductionOrderDto,
  MaterialType,
  OrderConditionContext,
  ProductionOrderQueryDto,
  SelectFabricColorDto,
  UpdateProductionOrderDto,
} from '@denimflow/shared';
import { BusinessRuleViolation } from '../../common/errors/business-rule-violation.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

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
          fabricTypeId: dto.fabricTypeId ?? null,
          colorId: dto.colorId ?? null,
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
        include: {
          sizeLines: true,
          workflowInstance: {
            include: {
              stepInstances: {
                include: { stepDefinition: true },
              },
            },
          },
        },
      });

      if (!existing) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      if (existing.status !== 'DRAFT') {
        throw new BadRequestException('Chỉ có thể chỉnh sửa đơn hàng ở trạng thái DRAFT');
      }

      // BR-05: If cutting started, fabric, color and wash are locked
      if (
        dto.fabricTypeId !== undefined ||
        dto.colorId !== undefined ||
        dto.washTypeId !== undefined
      ) {
        const cuttingStep = existing.workflowInstance?.stepInstances.find(
          (s) => s.stepDefinition.code === 'CUTTING',
        );
        const cuttingStarted = Boolean(
          cuttingStep && cuttingStep.status !== 'PENDING' && cuttingStep.status !== 'READY',
        );

        if (cuttingStarted) {
          throw new BusinessRuleViolation(
            'BR-05',
            'BR-05: Fabric, color and wash are locked once CUTTING has started',
          );
        }
      }

      // BR-04: Validate fabric-color compatibility matrix if both are specified
      const finalFabric = dto.fabricTypeId !== undefined ? dto.fabricTypeId : existing.fabricTypeId;
      const finalColor = dto.colorId !== undefined ? dto.colorId : existing.colorId;
      if (finalFabric && finalColor) {
        const rule = await tx.fabricColorRule.findUnique({
          where: {
            fabricTypeId_colorId: {
              fabricTypeId: finalFabric,
              colorId: finalColor,
            },
          },
        });
        if (!rule || !rule.isAllowed) {
          throw new BusinessRuleViolation(
            'BR-04',
            'BR-04: Selected fabric and color pair is not allowed per compatibility matrix',
          );
        }
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
          fabricTypeId: dto.fabricTypeId,
          colorId: dto.colorId,
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
            fabricTypeId: existing.fabricTypeId,
            colorId: existing.colorId,
          },
          newValue: {
            dueDate: updated.dueDate,
            status: updated.status,
            notes: updated.notes,
            fabricTypeId: updated.fabricTypeId,
            colorId: updated.colorId,
          },
        },
      });

      return updated;
    });
  }

  async selectFabricColor(id: string, dto: SelectFabricColorDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.productionOrder.findUnique({
        where: { id },
        include: {
          workflowInstance: {
            include: {
              stepInstances: {
                include: { stepDefinition: true },
              },
            },
          },
        },
      });

      if (!existing) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      // BR-05: Once CUTTING starts, fabric–color–wash is locked
      const cuttingStep = existing.workflowInstance?.stepInstances.find(
        (s) => s.stepDefinition.code === 'CUTTING',
      );
      const cuttingStarted =
        existing.status === 'IN_PRODUCTION' ||
        Boolean(cuttingStep && cuttingStep.status !== 'PENDING' && cuttingStep.status !== 'READY');

      if (cuttingStarted) {
        throw new BusinessRuleViolation(
          'BR-05',
          'BR-05: Fabric, color and wash are locked once CUTTING has started',
        );
      }

      // BR-04: Only colors listed in the Fabric–Color Matrix for the selected fabric type may be chosen
      const rule = await tx.fabricColorRule.findUnique({
        where: {
          fabricTypeId_colorId: {
            fabricTypeId: dto.fabricTypeId,
            colorId: dto.colorId,
          },
        },
      });

      if (!rule || !rule.isAllowed) {
        throw new BusinessRuleViolation(
          'BR-04',
          'BR-04: Selected fabric and color pair is not allowed per compatibility matrix',
        );
      }

      const updated = await tx.productionOrder.update({
        where: { id },
        data: {
          fabricTypeId: dto.fabricTypeId,
          colorId: dto.colorId,
          washTypeId: dto.washTypeId !== undefined ? dto.washTypeId : existing.washTypeId,
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
          action: 'SELECT_FABRIC_COLOR',
          actorId,
          oldValue: {
            fabricTypeId: existing.fabricTypeId,
            colorId: existing.colorId,
            washTypeId: existing.washTypeId,
          },
          newValue: {
            fabricTypeId: updated.fabricTypeId,
            colorId: updated.colorId,
            washTypeId: updated.washTypeId,
          },
        },
      });

      return updated;
    });
  }

  async calculateAndPersistBom(orderId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findUnique({
        where: { id: orderId },
        include: {
          sizeLines: true,
          style: {
            include: {
              bomNorms: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      if (order.sizeLines.length === 0) {
        throw new BadRequestException('Đơn hàng chưa có dải cỡ (size lines) để tính BOM');
      }

      if (!order.style.bomNorms || order.style.bomNorms.length === 0) {
        throw new BadRequestException(
          `Kiểu dáng ${order.style.styleCode} chưa được cấu hình định mức BOM (BOM norms)`,
        );
      }

      const norms: BomNormInput[] = order.style.bomNorms.map((n) => ({
        size: n.size,
        materialType: n.materialType as MaterialType,
        qtyPerPiece: Number(n.qtyPerPiece),
        unit: n.unit,
        wastagePercent: Number(n.wastagePercent),
      }));

      const sizeLines: OrderSizeLineInput[] = order.sizeLines.map((l) => ({
        size: l.size,
        plannedQty: l.plannedQty,
      }));

      const calculator = new BomCalculator();
      const calculatedLines = calculator.calculate({ sizeLines, norms });

      // Delete existing bom_lines for this order
      await tx.bomLine.deleteMany({
        where: { orderId },
      });

      // Insert new bom_lines
      await tx.bomLine.createMany({
        data: calculatedLines.map((line) => ({
          orderId,
          materialType: line.materialType,
          requiredQty: line.requiredQty,
          unit: line.unit,
        })),
      });

      const updatedBomLines = await tx.bomLine.findMany({
        where: { orderId },
        orderBy: { materialType: 'asc' },
      });

      // Write AuditLog (BR-16)
      await tx.auditLog.create({
        data: {
          entityType: 'ProductionOrder',
          entityId: orderId,
          action: 'CALCULATE_BOM',
          actorId,
          newValue: updatedBomLines.map((b) => ({
            materialType: b.materialType,
            requiredQty: Number(b.requiredQty),
            unit: b.unit,
          })),
        },
      });

      return updatedBomLines;
    });
  }

  async getBomLines(orderId: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    return this.prisma.bomLine.findMany({
      where: { orderId },
      orderBy: { materialType: 'asc' },
    });
  }

  async attachCustomerAcknowledgement(
    orderId: string,
    dto: AttachAcknowledgementDto,
    actorId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findUnique({
        where: { id: orderId },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      // Find SKIP_CLEAN_WASH profile for Style
      let qcProfile = await tx.qcProfile.findUnique({
        where: {
          styleId_profileType: {
            styleId: order.styleId,
            profileType: 'SKIP_CLEAN_WASH',
          },
        },
      });

      if (!qcProfile) {
        // Create demo SKIP_CLEAN_WASH profile if missing
        qcProfile = await tx.qcProfile.create({
          data: {
            styleId: order.styleId,
            profileType: 'SKIP_CLEAN_WASH',
            maxShrinkagePercent: 5.0,
            maxColorFadingLevel: 2,
            isActive: true,
          },
        });
      }

      const ack = await tx.customerAcknowledgement.create({
        data: {
          orderId,
          ackType: 'SKIP_CLEAN_WASH',
          qcProfileId: qcProfile.id,
          filePath: dto.filePath,
          acknowledgedByName: dto.acknowledgedByName,
          acknowledgedAt: dto.acknowledgedAt ? new Date(dto.acknowledgedAt) : new Date(),
          recordedBy: actorId,
        },
      });

      // Write AuditLog (BR-16)
      await tx.auditLog.create({
        data: {
          entityType: 'customer_acknowledgement',
          entityId: ack.id,
          action: 'ATTACH_CUSTOMER_ACKNOWLEDGEMENT',
          actorId,
          newValue: {
            orderId,
            ackType: 'SKIP_CLEAN_WASH',
            filePath: dto.filePath,
            acknowledgedByName: dto.acknowledgedByName,
          },
        },
      });

      return ack;
    });
  }

  async confirmOrder(orderId: string, actorId: string): Promise<ConfirmOrderResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      // 1. SELECT order FOR UPDATE (DATABASE_DESIGN.md §7.1)
      const lockedOrders = await tx.$queryRaw<
        Array<{
          id: string;
          order_number: string;
          status: string;
          style_id: string;
          fabric_type_id: string | null;
          color_id: string | null;
          wash_type_id: string | null;
          is_custom: boolean;
          skip_clean_wash: boolean;
          pp_sample_required: boolean;
          dye_required: boolean;
          dye_mode: string | null;
          dye_source: string | null;
          embroidery_required: boolean;
          fabric_inspect_required: boolean;
        }>
      >`SELECT id, order_number, status, style_id, fabric_type_id, color_id, wash_type_id, is_custom, skip_clean_wash, pp_sample_required, dye_required, dye_mode, dye_source, embroidery_required, fabric_inspect_required FROM production_orders WHERE id = ${orderId}::uuid FOR UPDATE`;

      const orderRow = lockedOrders[0];
      if (!orderRow) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      if (orderRow.status !== 'DRAFT') {
        throw new ConflictException(
          `Đơn hàng ${orderRow.order_number} đang ở trạng thái ${orderRow.status}, không thể xác nhận (chỉ áp dụng cho DRAFT).`,
        );
      }

      // 2. Reject custom order (R-04 post-MVP notice)
      if (orderRow.is_custom) {
        throw new BusinessRuleViolation(
          'BR-17',
          'BR-17: Đơn hàng gia công tuỳ chỉnh (isCustom = true) thuộc nhánh CUSTOM_REVIEW sau MVP (R-04). Không thể xác nhận trong phạm vi MVP.',
        );
      }

      // 3. Completeness: size lines, fabric, color
      const sizeLines = await tx.orderSizeLine.findMany({
        where: { orderId: orderRow.id },
      });
      if (sizeLines.length === 0) {
        throw new BadRequestException('Đơn hàng phải có ít nhất 1 cỡ (Size) trước khi xác nhận');
      }

      if (!orderRow.fabric_type_id || !orderRow.color_id) {
        throw new BadRequestException(
          'Đơn hàng chưa chọn loại vải và màu sắc hợp lệ theo ma trận (BR-04)',
        );
      }

      // 4. Style -> default template -> PUBLISHED version (BR-03)
      const style = await tx.style.findUnique({
        where: { id: orderRow.style_id },
      });
      if (!style || !style.defaultTemplateId) {
        throw new BusinessRuleViolation(
          'BR-03',
          `BR-03: Kiểu dáng của đơn hàng chưa được gán quy trình sản xuất mặc định.`,
        );
      }

      const publishedVersion = await tx.workflowVersion.findFirst({
        where: {
          templateId: style.defaultTemplateId,
          status: 'PUBLISHED',
        },
        include: {
          steps: {
            orderBy: { seq: 'asc' },
          },
        },
      });

      if (!publishedVersion) {
        throw new BusinessRuleViolation(
          'BR-03',
          `BR-03: Kiểu dáng ${style.styleCode} chưa có phiên bản quy trình nào được xuất bản (PUBLISHED). Không thể xác nhận đơn hàng (BR-03).`,
        );
      }

      // 5. If skipCleanWash, require CustomerAcknowledgement (BR-19)
      const targetProfileType = orderRow.skip_clean_wash ? 'SKIP_CLEAN_WASH' : 'FULL_PROCESS';

      if (orderRow.skip_clean_wash) {
        const acknowledgement = await tx.customerAcknowledgement.findFirst({
          where: { orderId: orderRow.id, ackType: 'SKIP_CLEAN_WASH' },
        });

        if (!acknowledgement) {
          throw new BusinessRuleViolation(
            'BR-19',
            'BR-19: Đơn hàng bỏ qua giặt sạch (skipCleanWash = true) bắt buộc phải có văn bản xác nhận của khách hàng (Customer Acknowledgement) được đính kèm trước khi xác nhận đơn hàng.',
          );
        }
      }

      // Pick QC profile
      let qcProfile = await tx.qcProfile.findUnique({
        where: {
          styleId_profileType: {
            styleId: orderRow.style_id,
            profileType: targetProfileType,
          },
        },
      });

      if (!qcProfile) {
        // Auto-provision standard profile if not yet seeded
        qcProfile = await tx.qcProfile.create({
          data: {
            styleId: orderRow.style_id,
            profileType: targetProfileType,
            maxShrinkagePercent: orderRow.skip_clean_wash ? 5.0 : 3.0,
            maxColorFadingLevel: orderRow.skip_clean_wash ? 2 : 1,
            isActive: true,
          },
        });
      }

      // 6. Engine: build workflow instance plan (initial status per step)
      const context: OrderConditionContext = {
        order: {
          dyeRequired: orderRow.dye_required,
          dyeMode: (orderRow.dye_mode as 'TOTAL' | 'PARTIAL') || null,
          dyeSource: (orderRow.dye_source as 'INTERNAL' | 'OUTSOURCED') || null,
          embroideryRequired: orderRow.embroidery_required,
          fabricInspectRequired: orderRow.fabric_inspect_required,
          ppSampleRequired: orderRow.pp_sample_required,
          skipCleanWash: orderRow.skip_clean_wash,
          washTypeId: orderRow.wash_type_id,
          isCustom: orderRow.is_custom,
        },
      };

      const planOutput = buildWorkflowInstancePlan(
        publishedVersion.steps.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          seq: s.seq,
          isStart: s.isStart,
          isEnd: s.isEnd,
          isMandatory: s.isMandatory,
          conditionExpr: s.conditionExpr,
        })),
        context,
      );

      // 7. INSERT workflow_instances and step_instances (snapshot)
      const workflowInstance = await tx.workflowInstance.create({
        data: {
          orderId: orderRow.id,
          versionId: publishedVersion.id,
          status: 'RUNNING',
        },
      });

      for (const item of planOutput.plan) {
        await tx.stepInstance.create({
          data: {
            instanceId: workflowInstance.id,
            stepDefinitionId: item.stepDefinitionId,
            status: item.status,
            completedAt: item.status === 'DONE' ? new Date() : null,
            startedAt: item.status === 'DONE' || item.status === 'READY' ? new Date() : null,
          },
        });
      }

      // 8. UPDATE order status = CONFIRMED
      await tx.productionOrder.update({
        where: { id: orderRow.id },
        data: {
          status: 'CONFIRMED',
          qcProfileId: qcProfile.id,
        },
      });

      // 9. INSERT audit_logs (order, skipped steps, BR-16, BR-18)
      await tx.auditLog.create({
        data: {
          entityType: 'production_order',
          entityId: orderRow.id,
          action: 'CONFIRM_ORDER',
          actorId,
          oldValue: { status: 'DRAFT' },
          newValue: {
            status: 'CONFIRMED',
            versionId: publishedVersion.id,
            versionNo: publishedVersion.versionNo,
            qcProfileType: targetProfileType,
            firstReadyStep: planOutput.firstReadyStepCode,
          },
        },
      });

      if (orderRow.skip_clean_wash) {
        await tx.auditLog.create({
          data: {
            entityType: 'workflow_instance',
            entityId: workflowInstance.id,
            action: 'SKIP_CLEAN_WASH',
            actorId,
            newValue: {
              rule: 'BR-18',
              reason: 'Bỏ giặt sạch theo yêu cầu giảm chi phí của khách hàng',
            },
          },
        });
      }

      for (const code of planOutput.skippedStepCodes) {
        if (code !== 'CLEAN_WASH') {
          await tx.auditLog.create({
            data: {
              entityType: 'workflow_instance',
              entityId: workflowInstance.id,
              action: 'STEP_SKIPPED_BY_CONDITION',
              actorId,
              newValue: { stepCode: code },
            },
          });
        }
      }

      return {
        success: true,
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
        status: 'CONFIRMED',
        workflowInstanceId: workflowInstance.id,
        versionNo: publishedVersion.versionNo,
        qcProfileType: targetProfileType,
        stepInstancesCount: planOutput.plan.length,
        firstReadyStepCode: planOutput.firstReadyStepCode,
        skippedStepCodes: planOutput.skippedStepCodes,
      };
    });
  }
}
