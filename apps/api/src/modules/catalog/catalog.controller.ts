import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import {
  createColorOptionSchema,
  createFabricTypeSchema,
  createStationSchema,
  createStyleSchema,
  createWashTypeSchema,
  updateColorOptionSchema,
  updateFabricTypeSchema,
  updateStationSchema,
  updateStyleSchema,
  updateWashTypeSchema,
} from './catalog.dto.js';
import { CatalogService } from './catalog.service.js';

@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly authService: AuthService,
  ) {}

  private async assertAdmin(authHeader?: string): Promise<string> {
    const user = await this.authService.getMe(authHeader);
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa dữ liệu danh mục',
      );
    }
    return user.id;
  }

  // ==========================================
  // STATIONS
  // ==========================================

  @Get('stations')
  async getStations() {
    return this.catalogService.getStations();
  }

  @Post('stations')
  async createStation(@Body() body: unknown, @Headers('authorization') authHeader?: string) {
    const actorId = await this.assertAdmin(authHeader);
    const dto = createStationSchema.parse(body);
    return this.catalogService.createStation(dto, actorId);
  }

  @Put('stations/:id')
  async updateStation(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authHeader?: string,
  ) {
    const actorId = await this.assertAdmin(authHeader);
    const dto = updateStationSchema.parse(body);
    return this.catalogService.updateStation(id, dto, actorId);
  }

  @Delete('stations/:id')
  async deleteStation(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    const actorId = await this.assertAdmin(authHeader);
    return this.catalogService.deleteStation(id, actorId);
  }

  // ==========================================
  // STYLES
  // ==========================================

  @Get('styles')
  async getStyles() {
    return this.catalogService.getStyles();
  }

  @Post('styles')
  async createStyle(@Body() body: unknown, @Headers('authorization') authHeader?: string) {
    const actorId = await this.assertAdmin(authHeader);
    const dto = createStyleSchema.parse(body);
    return this.catalogService.createStyle(dto, actorId);
  }

  @Put('styles/:id')
  async updateStyle(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authHeader?: string,
  ) {
    const actorId = await this.assertAdmin(authHeader);
    const dto = updateStyleSchema.parse(body);
    return this.catalogService.updateStyle(id, dto, actorId);
  }

  @Delete('styles/:id')
  async deleteStyle(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    const actorId = await this.assertAdmin(authHeader);
    return this.catalogService.deleteStyle(id, actorId);
  }

  // ==========================================
  // FABRIC TYPES
  // ==========================================

  @Get('fabric-types')
  async getFabricTypes() {
    return this.catalogService.getFabricTypes();
  }

  @Post('fabric-types')
  async createFabricType(@Body() body: unknown, @Headers('authorization') authHeader?: string) {
    const actorId = await this.assertAdmin(authHeader);
    const dto = createFabricTypeSchema.parse(body);
    return this.catalogService.createFabricType(dto, actorId);
  }

  @Put('fabric-types/:id')
  async updateFabricType(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authHeader?: string,
  ) {
    const actorId = await this.assertAdmin(authHeader);
    const dto = updateFabricTypeSchema.parse(body);
    return this.catalogService.updateFabricType(id, dto, actorId);
  }

  @Delete('fabric-types/:id')
  async deleteFabricType(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    const actorId = await this.assertAdmin(authHeader);
    return this.catalogService.deleteFabricType(id, actorId);
  }

  // ==========================================
  // COLOR OPTIONS
  // ==========================================

  @Get('color-options')
  async getColorOptions() {
    return this.catalogService.getColorOptions();
  }

  @Post('color-options')
  async createColorOption(@Body() body: unknown, @Headers('authorization') authHeader?: string) {
    const actorId = await this.assertAdmin(authHeader);
    const dto = createColorOptionSchema.parse(body);
    return this.catalogService.createColorOption(dto, actorId);
  }

  @Put('color-options/:id')
  async updateColorOption(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authHeader?: string,
  ) {
    const actorId = await this.assertAdmin(authHeader);
    const dto = updateColorOptionSchema.parse(body);
    return this.catalogService.updateColorOption(id, dto, actorId);
  }

  @Delete('color-options/:id')
  async deleteColorOption(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    const actorId = await this.assertAdmin(authHeader);
    return this.catalogService.deleteColorOption(id, actorId);
  }

  // ==========================================
  // WASH TYPES
  // ==========================================

  @Get('wash-types')
  async getWashTypes() {
    return this.catalogService.getWashTypes();
  }

  @Post('wash-types')
  async createWashType(@Body() body: unknown, @Headers('authorization') authHeader?: string) {
    const actorId = await this.assertAdmin(authHeader);
    const dto = createWashTypeSchema.parse(body);
    return this.catalogService.createWashType(dto, actorId);
  }

  @Put('wash-types/:id')
  async updateWashType(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authHeader?: string,
  ) {
    const actorId = await this.assertAdmin(authHeader);
    const dto = updateWashTypeSchema.parse(body);
    return this.catalogService.updateWashType(id, dto, actorId);
  }

  @Delete('wash-types/:id')
  async deleteWashType(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    const actorId = await this.assertAdmin(authHeader);
    return this.catalogService.deleteWashType(id, actorId);
  }
}
