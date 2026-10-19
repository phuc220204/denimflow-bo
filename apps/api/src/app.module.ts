import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WorkflowModule } from './modules/workflow/workflow.module.js';
import { OrderModule } from './modules/order/order.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { ExecutionModule } from './modules/execution/execution.module.js';
import { QualityModule } from './modules/quality/quality.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    CatalogModule,
    UsersModule,
    WorkflowModule,
    OrderModule,
    InventoryModule,
    ExecutionModule,
    QualityModule,
  ],
})
export class AppModule {}
