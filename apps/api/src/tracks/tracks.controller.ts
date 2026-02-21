import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { TracksService } from './tracks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { CreateTrackDto, UpdateTrackDto } from './tracks.dto';

@Controller('tracks')
@UseGuards(JwtAuthGuard)
export class TracksController {
  constructor(
    private tracks: TracksService,
    private audit: AuditService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.tracks.findAll(user.id, user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tracks.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm')
  async create(@Body() dto: CreateTrackDto, @CurrentUser() user: any, @Req() req: Request) {
    const track = await this.tracks.create(dto);
    await this.audit.log({
      actorId: user.id,
      actionType: 'create',
      entityType: 'track',
      entityId: track.id,
      afterData: track as any,
      ip: req.ip,
    });
    return track;
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'pm')
  async update(@Param('id') id: string, @Body() dto: UpdateTrackDto, @CurrentUser() user: any, @Req() req: Request) {
    const before = await this.tracks.findById(id);
    const track = await this.tracks.update(id, dto);
    await this.audit.log({
      actorId: user.id,
      actionType: 'update',
      entityType: 'track',
      entityId: id,
      trackId: id,
      beforeData: before as any,
      afterData: track as any,
      ip: req.ip,
    });
    return track;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async delete(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const before = await this.tracks.findById(id);
    const result = await this.tracks.delete(id);
    await this.audit.log({
      actorId: user.id,
      actionType: 'delete',
      entityType: 'track',
      entityId: id,
      beforeData: before as any,
      ip: req.ip,
    });
    return result;
  }
}
