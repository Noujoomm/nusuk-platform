import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { TasksService } from './tasks.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTaskDto, UpdateTaskDto, UpdateTaskStatusDto, AssignTaskDto } from './tasks.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(
    private tasks: TasksService,
    private audit: AuditService,
  ) {}

  /**
   * GET /tasks - Returns tasks visible to the current user.
   * Admin/PM sees all. Others see filtered by assignment rules.
   * Supports tab query: my, track, hr, all
   */
  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('trackId') trackId?: string,
    @Query('assigneeType') assigneeType?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('search') search?: string,
    @Query('overdue') overdue?: string,
    @Query('dueDateFrom') dueDateFrom?: string,
    @Query('dueDateTo') dueDateTo?: string,
    @Query('tab') tab?: string,
  ) {
    return this.tasks.findVisible(user, {
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
      status,
      priority,
      trackId,
      assigneeType,
      assigneeId,
      search,
      overdue: overdue === 'true',
      dueDateFrom,
      dueDateTo,
      tab,
    });
  }

  @Get('my')
  findMyTasks(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.tasks.findByUser(user.id, {
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
      status,
    });
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm')
  getStats(@Query('trackId') trackId?: string) {
    return this.tasks.getStats(trackId);
  }

  @Get('track/:trackId')
  findByTrack(
    @Param('trackId') trackId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.tasks.findByTrack(trackId, {
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
      status,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasks.findById(id);
  }

  @Get(':id/audit')
  getTaskAudit(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.tasks.getTaskAuditLog(id, {
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm')
  async create(@Body() dto: CreateTaskDto, @CurrentUser() user: any, @Req() req: Request) {
    const task = await this.tasks.create(dto, user.id);

    await this.audit.log({
      actorId: user.id,
      actionType: 'create',
      entityType: 'task',
      entityId: task.id,
      trackId: dto.trackId,
      afterData: task as any,
      ip: req.ip,
    });

    return task;
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm')
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: any, @Req() req: Request) {
    const task = await this.tasks.update(id, dto, user.id);
    return task;
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.tasks.updateStatus(id, dto.status, user.id);
  }

  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm')
  async assign(@Param('id') id: string, @Body() dto: AssignTaskDto, @CurrentUser() user: any, @Req() req: Request) {
    const task = await this.tasks.assign(id, dto.userIds, user.id);

    await this.audit.log({
      actorId: user.id,
      actionType: 'update',
      entityType: 'task',
      entityId: id,
      trackId: task.trackId || undefined,
      afterData: { assignedUserIds: dto.userIds } as any,
      ip: req.ip,
    });

    return task;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm')
  async delete(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const result = await this.tasks.delete(id, user.id);
    return result;
  }
}
