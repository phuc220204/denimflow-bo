import { Body, Controller, Delete, Get, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@denimflow/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthResponse } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { QcProfileType } from '../../generated/prisma/enums.js';
import {
  createColorOptionSchema,
  createFabricTypeSchema,
  createStationSchema,
  createStyleSchema,
  createWashTypeSchema,
  toggleFabricColorRuleSchema,
  updateColorOptionSchema,
  updateFabricTypeSchema,
  updateQcProfileSchema,
  updateStationSchema,
  updateStyleSchema,
  updateWashTypeSchema,
} from './catalog.dto.js';
import { CatalogService } from './catalog.service.js';

// FR-02: any active user may read master data; only the Admin writes it.
// FR-28: QC Profile thresholds may also be edited by the Process Engineer.
@Controller('catalog')
@UseGuards(AuthGuard)
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalogService: CatalogService) {}

  // ==========================================
  // STATIONS
  // ==========================================

  @Get('stations')
  async getStations() {
    return this.catalogService.getStations();
  }

  @Post('stations')
  @Roles(Role.ADMIN)
  async createStation(@Body() body: unknown, @CurrentUser() user: AuthResponse['user']) {
    const dto = createStationSchema.parse(body);
    return this.catalogService.createStation(dto, user.id);
  }

  @Put('stations/:id')
  @Roles(Role.ADMIN)
  async updateStation(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    const dto = updateStationSchema.parse(body);
    return this.catalogService.updateStation(id, dto, user.id);
  }

  @Delete('stations/:id')
  @Roles(Role.ADMIN)
  async deleteStation(@Param('id') id: string, @CurrentUser() user: AuthResponse['user']) {
    return this.catalogService.deleteStation(id, user.id);
  }

  // ==========================================
  // STYLES
  // ==========================================

  @Get('styles')
  async getStyles() {
    return this.catalogService.getStyles();
  }

  @Post('styles')
  @Roles(Role.ADMIN)
  async createStyle(@Body() body: unknown, @CurrentUser() user: AuthResponse['user']) {
    const dto = createStyleSchema.parse(body);
    return this.catalogService.createStyle(dto, user.id);
  }

  @Put('styles/:id')
  @Roles(Role.ADMIN)
  async updateStyle(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    const dto = updateStyleSchema.parse(body);
    return this.catalogService.updateStyle(id, dto, user.id);
  }

  @Delete('styles/:id')
  @Roles(Role.ADMIN)
  async deleteStyle(@Param('id') id: string, @CurrentUser() user: AuthResponse['user']) {
    return this.catalogService.deleteStyle(id, user.id);
  }

  // ==========================================
  // FABRIC TYPES
  // ==========================================

  @Get('fabric-types')
  async getFabricTypes() {
    return this.catalogService.getFabricTypes();
  }

  @Post('fabric-types')
  @Roles(Role.ADMIN)
  async createFabricType(@Body() body: unknown, @CurrentUser() user: AuthResponse['user']) {
    const dto = createFabricTypeSchema.parse(body);
    return this.catalogService.createFabricType(dto, user.id);
  }

  @Put('fabric-types/:id')
  @Roles(Role.ADMIN)
  async updateFabricType(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    const dto = updateFabricTypeSchema.parse(body);
    return this.catalogService.updateFabricType(id, dto, user.id);
  }

  @Delete('fabric-types/:id')
  @Roles(Role.ADMIN)
  async deleteFabricType(@Param('id') id: string, @CurrentUser() user: AuthResponse['user']) {
    return this.catalogService.deleteFabricType(id, user.id);
  }

  // ==========================================
  // COLOR OPTIONS
  // ==========================================

  @Get('color-options')
  async getColorOptions() {
    return this.catalogService.getColorOptions();
  }

  @Post('color-options')
  @Roles(Role.ADMIN)
  async createColorOption(@Body() body: unknown, @CurrentUser() user: AuthResponse['user']) {
    const dto = createColorOptionSchema.parse(body);
    return this.catalogService.createColorOption(dto, user.id);
  }

  @Put('color-options/:id')
  @Roles(Role.ADMIN)
  async updateColorOption(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    const dto = updateColorOptionSchema.parse(body);
    return this.catalogService.updateColorOption(id, dto, user.id);
  }

  @Delete('color-options/:id')
  @Roles(Role.ADMIN)
  async deleteColorOption(@Param('id') id: string, @CurrentUser() user: AuthResponse['user']) {
    return this.catalogService.deleteColorOption(id, user.id);
  }

  // ==========================================
  // WASH TYPES
  // ==========================================

  @Get('wash-types')
  async getWashTypes() {
    return this.catalogService.getWashTypes();
  }

  @Post('wash-types')
  @Roles(Role.ADMIN)
  async createWashType(@Body() body: unknown, @CurrentUser() user: AuthResponse['user']) {
    const dto = createWashTypeSchema.parse(body);
    return this.catalogService.createWashType(dto, user.id);
  }

  @Put('wash-types/:id')
  @Roles(Role.ADMIN)
  async updateWashType(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    const dto = updateWashTypeSchema.parse(body);
    return this.catalogService.updateWashType(id, dto, user.id);
  }

  @Delete('wash-types/:id')
  @Roles(Role.ADMIN)
  async deleteWashType(@Param('id') id: string, @CurrentUser() user: AuthResponse['user']) {
    return this.catalogService.deleteWashType(id, user.id);
  }

  // ==========================================
  // FABRIC-COLOR MATRIX (BR-04, FR-02)
  // ==========================================

  @Get('matrix')
  async getMatrix() {
    return this.catalogService.getMatrix();
  }

  @Post('matrix/toggle')
  @Roles(Role.ADMIN)
  async toggleMatrixRule(@Body() body: unknown, @CurrentUser() user: AuthResponse['user']) {
    const dto = toggleFabricColorRuleSchema.parse(body);
    return this.catalogService.toggleMatrixRule(dto, user.id);
  }

  @Get('fabrics/:id/allowed-colors')
  async getAllowedColors(@Param('id') id: string) {
    return this.catalogService.getAllowedColors(id);
  }

  @Get('fabric-types/:id/allowed-colors')
  async getAllowedColorsAlias(@Param('id') id: string) {
    return this.catalogService.getAllowedColors(id);
  }

  // ==========================================
  // QC PROFILES (BR-19, FR-28)
  // ==========================================

  @Get('styles/:id/qc-profiles')
  async getQcProfiles(@Param('id') id: string) {
    return this.catalogService.getQcProfiles(id);
  }

  @Put('styles/:id/qc-profiles/:profileType')
  @Roles(Role.ADMIN, Role.PROCESS_ENGINEER)
  async updateQcProfile(
    @Param('id') id: string,
    @Param('profileType') profileType: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    const dto = updateQcProfileSchema.parse(body);
    return this.catalogService.updateQcProfile(id, profileType as QcProfileType, dto, user.id);
  }
}
