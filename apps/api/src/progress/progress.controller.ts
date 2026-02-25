import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../websocket/events.gateway';
import { UpdateProgressDto, CreateAchievementDto, UpdateAchievementDto } from './progress.dto';

@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(
    private progressService: ProgressService,
    private audit: AuditService,
    private ws: EventsGateway,
  ) {}

  // ─── GLOBAL STATS (admin, pm only) ───

  @Get('global-stats')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm')
  getGlobalStats() {
    return this.progressService.getGlobalStats();
  }

  // ─── ACHIEVEMENTS (must be before dynamic :entityType routes) ───

  @Post('achievements')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm', 'track_lead')
  async createAchievement(
    @Body() dto: CreateAchievementDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const result = await this.progressService.createAchievement(dto);

    await this.audit.log({
      actorId: user.id,
      actionType: 'create',
      entityType: 'achievement',
      entityId: result.id,
      afterData: result as any,
      ip: req.ip,
    });

    return result;
  }

  @Get('achievements')
  getAchievements(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.progressService.getAchievements({
      entityType,
      entityId,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Patch('achievements/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm')
  async updateAchievement(
    @Param('id') id: string,
    @Body() dto: UpdateAchievementDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const before = await this.progressService.getAchievements({ entityId: id });
    const result = await this.progressService.updateAchievement(id, dto);

    await this.audit.log({
      actorId: user.id,
      actionType: 'update',
      entityType: 'achievement',
      entityId: id,
      beforeData: before as any,
      afterData: result as any,
      ip: req.ip,
    });

    return result;
  }

  @Delete('achievements/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm')
  async deleteAchievement(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const before = await this.progressService.getAchievements({ entityId: id });
    const result = await this.progressService.deleteAchievement(id);

    await this.audit.log({
      actorId: user.id,
      actionType: 'delete',
      entityType: 'achievement',
      entityId: id,
      beforeData: before as any,
      ip: req.ip,
    });

    return result;
  }

  // ─── TRACK PROGRESS ───

  @Get('track/:trackId')
  getTrackProgress(@Param('trackId') trackId: string) {
    return this.progressService.getTrackProgress(trackId);
  }

  // ─── EMPLOYEE PROGRESS ───

  @Get('employee/:employeeId')
  getEmployeeProgress(@Param('employeeId') employeeId: string) {
    return this.progressService.getEmployeeProgress(employeeId);
  }

  // ─── PROGRESS BY TYPE ───

  @Get('by-type/:entityType')
  getProgressByType(@Param('entityType') entityType: string) {
    return this.progressService.getProgressByType(entityType);
  }

  // ─── PROGRESS EVENTS ───

  @Get('events/:entityType/:entityId')
  getProgressEvents(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('limit') limit?: string,
  ) {
    return this.progressService.getProgressEvents(
      entityType,
      entityId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  // ─── GET / UPSERT SINGLE PROGRESS ITEM (dynamic catch-all, must be last) ───

  @Get(':entityType/:entityId')
  getProgressItem(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.progressService.getProgressItem(entityType, entityId);
  }

  @Patch(':entityType/:entityId')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm', 'track_lead')
  async upsertProgress(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body() dto: UpdateProgressDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const before = await this.progressService
      .getProgressItem(entityType, entityId)
      .catch(() => null);

    const result = await this.progressService.upsertProgress(entityType, entityId, dto);

    await this.audit.log({
      actorId: user.id,
      actionType: before ? 'update' : 'create',
      entityType: 'progress',
      entityId: result.id,
      beforeData: before as any,
      afterData: result as any,
      ip: req.ip,
    });

    // Emit real-time event
    this.ws.emitToTrack(entityId, 'progress.updated', {
      entityType,
      entityId,
      progressPercent: result.progressPercent,
      status: result.status,
      updatedBy: user.id,
    });

    return result;
  }
}
