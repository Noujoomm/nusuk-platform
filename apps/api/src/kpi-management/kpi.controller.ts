import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { KPIService } from './kpi.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { Request } from 'express';

@Controller('kpis')
@UseGuards(JwtAuthGuard)
export class KPIController {
  constructor(
    private kpis: KPIService,
    private audit: AuditService,
  ) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('trackId') trackId?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.kpis.findAll({
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
      trackId,
      status,
      category,
    });
  }

  @Get('stats')
  getStats(@Query('trackId') trackId?: string) {
    return this.kpis.getStats(trackId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.kpis.findById(id);
  }

  @Post()
  async create(@Body() body: any, @CurrentUser() user: any, @Req() req: Request) {
    const kpi = await this.kpis.create(body);
    await this.audit.log({
      actorId: user.id,
      actionType: 'create',
      entityType: 'kpi',
      entityId: kpi.id,
      trackId: body.trackId,
      afterData: kpi as any,
      ip: req.ip,
    });
    return kpi;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any, @Req() req: Request) {
    const before = await this.kpis.findById(id);
    const kpi = await this.kpis.update(id, body);
    await this.audit.log({
      actorId: user.id,
      actionType: 'update',
      entityType: 'kpi',
      entityId: id,
      beforeData: before as any,
      afterData: kpi as any,
      ip: req.ip,
    });
    return kpi;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm')
  async delete(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const result = await this.kpis.delete(id);
    await this.audit.log({
      actorId: user.id,
      actionType: 'delete',
      entityType: 'kpi',
      entityId: id,
      ip: req.ip,
    });
    return result;
  }

  @Post('seed')
  @UseGuards(RolesGuard)
  @Roles('admin')
  seed() {
    return this.kpis.seedFromTrackKPIs();
  }
}
