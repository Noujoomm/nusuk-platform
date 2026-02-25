import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { Request } from 'express';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private reports: ReportsService,
    private audit: AuditService,
  ) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('trackId') trackId?: string,
    @Query('type') type?: string,
    @Query('authorId') authorId?: string,
  ) {
    return this.reports.findAll({
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
      trackId,
      type,
      authorId,
    });
  }

  @Get('stats')
  getStats() {
    return this.reports.getStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reports.findById(id);
  }

  @Post()
  async create(@Body() body: any, @CurrentUser() user: any, @Req() req: Request) {
    const report = await this.reports.create({ ...body, authorId: user.id });
    await this.audit.log({
      actorId: user.id,
      actionType: 'create',
      entityType: 'report',
      entityId: report.id,
      trackId: body.trackId,
      afterData: report as any,
      ip: req.ip,
    });
    return report;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any, @Req() req: Request) {
    const before = await this.reports.findById(id);
    const report = await this.reports.update(id, body);
    await this.audit.log({
      actorId: user.id,
      actionType: 'update',
      entityType: 'report',
      entityId: id,
      beforeData: before as any,
      afterData: report as any,
      ip: req.ip,
    });
    return report;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm')
  async delete(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const before = await this.reports.findById(id);
    const result = await this.reports.delete(id);
    await this.audit.log({
      actorId: user.id,
      actionType: 'delete',
      entityType: 'report',
      entityId: id,
      beforeData: before as any,
      ip: req.ip,
    });
    return result;
  }
}
