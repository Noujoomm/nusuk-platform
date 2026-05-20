import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  SnapshotPeriod,
  TrackRankingArchiveService,
} from './track-ranking-archive.service';

/**
 * GET /api/analytics/track-ranking-archive?period=DAILY|WEEKLY&date=YYYY-MM-DD
 *
 * Returns archived dashboard rankings grouped by snapshot date (newest
 * first). `date` narrows to a single snapshot; otherwise the most recent
 * 30 dates are returned. Same RBAC as the live performance endpoints.
 */
@Controller('analytics/track-ranking-archive')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrackRankingArchiveController {
  constructor(private readonly service: TrackRankingArchiveService) {}

  @Get()
  @Roles('admin', 'system_manager', 'pm', 'track_lead')
  list(@Query('period') period?: string, @Query('date') date?: string) {
    const p: SnapshotPeriod = period === 'WEEKLY' ? 'WEEKLY' : 'DAILY';
    return this.service.list({
      period: p,
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
      limitDates: 30,
    });
  }
}
