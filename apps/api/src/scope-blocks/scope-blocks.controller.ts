import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ScopeBlocksService } from './scope-blocks.service';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../websocket/events.gateway';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateScopeBlockDto,
  UpdateScopeBlockDto,
  ImportScopeTextDto,
  UpdateScopeBlockProgressDto,
  ReorderBlocksDto,
} from './scope-blocks.dto';

@Controller('scope-blocks')
@UseGuards(JwtAuthGuard)
export class ScopeBlocksController {
  constructor(
    private scopeBlocks: ScopeBlocksService,
    private audit: AuditService,
    private ws: EventsGateway,
  ) {}

  @Get('track/:trackId')
  findByTrack(@Param('trackId') trackId: string) {
    return this.scopeBlocks.findByTrack(trackId);
  }

  @Get('track/:trackId/stats')
  getStats(@Param('trackId') trackId: string) {
    return this.scopeBlocks.getStats(trackId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.scopeBlocks.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm')
  async create(@Body() dto: CreateScopeBlockDto, @CurrentUser() user: any, @Req() req: Request) {
    const result = await this.scopeBlocks.create(dto);
    await this.audit.log({
      actorId: user.id,
      actionType: 'create',
      entityType: 'scope_block',
      entityId: result.id,
      trackId: dto.trackId,
      afterData: result as any,
      ip: req.ip,
    });
    return result;
  }

  @Patch('reorder')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm')
  async reorder(@Body() dto: ReorderBlocksDto, @CurrentUser() user: any, @Req() req: Request) {
    const result = await this.scopeBlocks.reorderBlocks(dto.blocks);
    await this.audit.log({
      actorId: user.id,
      actionType: 'reorder',
      entityType: 'scope_block',
      afterData: dto.blocks as any,
      ip: req.ip,
    });
    return result;
  }

  @Patch(':id/progress')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm', 'track_lead')
  async updateProgress(
    @Param('id') id: string,
    @Body() dto: UpdateScopeBlockProgressDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const before = await this.scopeBlocks.findById(id);
    const result = await this.scopeBlocks.updateProgress(id, dto);
    await this.audit.log({
      actorId: user.id,
      actionType: 'update_progress',
      entityType: 'scope_block',
      entityId: id,
      trackId: result.trackId,
      beforeData: before as any,
      afterData: result as any,
      ip: req.ip,
    });
    this.ws.emitToTrack(result.trackId, 'scopeBlock.progress', result);
    return result;
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm', 'track_lead')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateScopeBlockDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const before = await this.scopeBlocks.findById(id);
    const result = await this.scopeBlocks.update(id, dto);
    await this.audit.log({
      actorId: user.id,
      actionType: 'update',
      entityType: 'scope_block',
      entityId: id,
      trackId: result.trackId,
      beforeData: before as any,
      afterData: result as any,
      ip: req.ip,
    });
    this.ws.emitToTrack(result.trackId, 'scopeBlock.updated', result);
    return result;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm')
  async delete(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const before = await this.scopeBlocks.findById(id);
    const result = await this.scopeBlocks.delete(id);
    await this.audit.log({
      actorId: user.id,
      actionType: 'delete',
      entityType: 'scope_block',
      entityId: id,
      trackId: before?.trackId || undefined,
      beforeData: before as any,
      ip: req.ip,
    });
    return result;
  }

  @Post('import')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm')
  async importFromText(@Body() dto: ImportScopeTextDto, @CurrentUser() user: any, @Req() req: Request) {
    const result = await this.scopeBlocks.importFromText(dto.trackId, dto.text);
    await this.audit.log({
      actorId: user.id,
      actionType: 'import',
      entityType: 'scope_block',
      trackId: dto.trackId,
      afterData: { count: result.count } as any,
      ip: req.ip,
    });
    return result;
  }
}
