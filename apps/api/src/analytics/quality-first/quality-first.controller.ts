/**
 * Quality-first track performance endpoints.
 *
 * Mounted under /api/performance via the global API prefix in main.ts.
 * Auth + roles match the rest of the analytics surface — read paths
 * open to anyone with operational visibility, recalculate restricted
 * to admin.
 */

import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { QualityFirstPerformanceService } from './quality-first.service';

@Controller('performance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QualityFirstPerformanceController {
  constructor(private readonly service: QualityFirstPerformanceService) {}

  @Get('today')
  @Roles('admin', 'system_manager', 'pm', 'track_lead')
  async today() {
    return this.service.getTodayPerformance();
  }

  @Get('today/top-3-tracks')
  @Roles('admin', 'system_manager', 'pm', 'track_lead')
  async topTracks() {
    const t = await this.service.getTodayPerformance();
    return { date: t.date, topTracks: t.topTracks };
  }

  @Get('today/top-3-engaging')
  @Roles('admin', 'system_manager', 'pm', 'track_lead')
  async topEngaging() {
    const t = await this.service.getTodayPerformance();
    return { date: t.date, topEngagingTracks: t.topEngagingTracks };
  }

  @Get('today/best-employees')
  @Roles('admin', 'system_manager', 'pm', 'track_lead')
  async bestEmployees() {
    const t = await this.service.getTodayPerformance();
    return { date: t.date, bestEmployeesPerTrack: t.bestEmployeesPerTrack };
  }

  @Get('track/:id/today')
  @Roles('admin', 'system_manager', 'pm', 'track_lead')
  async trackToday(@Param('id') id: string) {
    return this.service.getTrackBreakdown(id);
  }

  @Get('track/:id/breakdown')
  @Roles('admin', 'system_manager', 'pm', 'track_lead')
  async trackBreakdown(@Param('id') id: string) {
    return this.service.getTrackBreakdown(id);
  }

  @Get('history')
  @Roles('admin', 'system_manager', 'pm', 'track_lead')
  async history(@Query('from') from?: string, @Query('to') to?: string) {
    if (!from || !to) {
      throw new BadRequestException('from and to are required (YYYY-MM-DD)');
    }
    return { from, to, rows: await this.service.getHistory(from, to) };
  }

  @Post('recalculate')
  @Roles('admin')
  async recalculate(@Query('date') date?: string) {
    return this.service.persistTodaySnapshot(date);
  }
}
