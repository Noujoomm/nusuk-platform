import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { RecordsService } from './records.service';
import { TracksService } from '../tracks/tracks.service';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../websocket/events.gateway';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateRecordDto, UpdateRecordDto } from './records.dto';

@Controller('records')
@UseGuards(JwtAuthGuard)
export class RecordsController {
  constructor(
    private records: RecordsService,
    private tracks: TracksService,
    private audit: AuditService,
    private events: EventsGateway,
  ) {}

  @Get('track/:trackId')
  async findByTrack(
    @Param('trackId') trackId: string,
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    await this.tracks.checkPermission(user.id, trackId, 'view', user.role);
    return this.records.findByTrack(trackId, { page, pageSize, status, priority, search, sortBy, sortOrder });
  }

  @Get('track/:trackId/stats')
  async getStats(@Param('trackId') trackId: string, @CurrentUser() user: any) {
    await this.tracks.checkPermission(user.id, trackId, 'view', user.role);
    return this.records.getTrackStats(trackId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.records.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateRecordDto, @CurrentUser() user: any, @Req() req: Request) {
    await this.tracks.checkPermission(user.id, dto.trackId, 'create', user.role);
    const record = await this.records.create(dto, user.id);

    await this.audit.log({
      actorId: user.id,
      actionType: 'create',
      entityType: 'record',
      entityId: record.id,
      trackId: dto.trackId,
      afterData: record as any,
      ip: req.ip,
    });

    this.events.emitToTrack(dto.trackId, 'track.record.created', record);
    return record;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateRecordDto, @CurrentUser() user: any, @Req() req: Request) {
    const before = await this.records.findById(id);
    await this.tracks.checkPermission(user.id, before.trackId, 'edit', user.role);

    const record = await this.records.update(id, dto);

    await this.audit.log({
      actorId: user.id,
      actionType: 'update',
      entityType: 'record',
      entityId: id,
      trackId: before.trackId,
      beforeData: before as any,
      afterData: record as any,
      ip: req.ip,
    });

    this.events.emitToTrack(before.trackId, 'track.record.updated', record);
    return record;
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const record = await this.records.findById(id);
    await this.tracks.checkPermission(user.id, record.trackId, 'delete', user.role);

    await this.records.delete(id);

    await this.audit.log({
      actorId: user.id,
      actionType: 'delete',
      entityType: 'record',
      entityId: id,
      trackId: record.trackId,
      beforeData: record as any,
      ip: req.ip,
    });

    this.events.emitToTrack(record.trackId, 'track.record.deleted', { id });
    return { message: 'تم حذف السجل' };
  }
}
