import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WeeklyCumulativeService } from './weekly-cumulative.service';

/**
 * GET /api/dashboard/weekly-cumulative/top-three
 *
 * Reads the persisted leaderboard for the current Riyadh week. The row
 * is kept fresh by `WeeklyCumulativeScheduler` — this endpoint never
 * triggers a recompute, so its latency is one indexed Postgres lookup
 * plus a Track join.
 *
 * RBAC mirrors the daily quality-first endpoints.
 */
@Controller('dashboard/weekly-cumulative')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WeeklyCumulativeController {
  constructor(private readonly service: WeeklyCumulativeService) {}

  @Get('top-three')
  @Roles('admin', 'system_manager', 'pm', 'track_lead')
  topThree() {
    return this.service.getCurrentWeekTopThree();
  }
}
