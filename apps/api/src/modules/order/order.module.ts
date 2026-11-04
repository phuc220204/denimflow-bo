import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module.js';
import { ExecutionModule } from '../execution/execution.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { HandoverController } from './handover.controller.js';
import { HandoverRepository } from './handover.repository.js';
import { HandoverService } from './handover.service.js';
import { OrderController } from './order.controller.js';
import { OrderRepository } from './order.repository.js';
import { OrderService } from './order.service.js';

@Module({
  imports: [PrismaModule, AuthModule, ExecutionModule],
  controllers: [OrderController, HandoverController],
  providers: [OrderRepository, OrderService, HandoverRepository, HandoverService],
  exports: [OrderService, OrderRepository],
})
export class OrderModule {}
