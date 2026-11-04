import { Controller, Get, Inject, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { QualityService } from './quality.service.js';

@Controller('quality/orders')
@UseGuards(AuthGuard)
export class OrderDefectsController {
  constructor(@Inject(QualityService) private readonly quality: QualityService) {}
  @Get(':orderId/defects')
  list(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.quality.getOrderDefects(orderId);
  }
}
