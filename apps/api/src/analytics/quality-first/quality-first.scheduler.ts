/**
 * Daily snapshot cron + on-startup fallback for the quality-first
 * track performance scoring. Runs at 00:00 Asia/Riyadh, computes
 * yesterday's final ranking, and idempotently upserts it onto the
 * existing daily_track_performance row so the live "Top 3" card and
 * its archive stay in sync.
 *
 * Co-exists with `DailyTracksSnapshotService` (which handles the
 * legacy 70/30 fields). Both run on the same cron expression but
 * write disjoint columns, so order doesn't matter and either failing
 * doesn't take the other down.
 */

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { QualityFirstPerformanceService } from './quality-first.service';
import { addDaysRiyadh, riyadhDateString } from '../utils/riyadh-time.util';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class QualityFirstPerformanceScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(QualityFirstPerformanceScheduler.name);

  constructor(
    private readonly performance: QualityFirstPerformanceService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 0 * * *', {
    name: 'qualityFirstTrackPerformance',
    timeZone: 'Asia/Riyadh',
  })
  async cronSnapshotYesterday() {
    const yesterday = addDaysRiyadh(riyadhDateString(new Date()), -1);
    try {
      const r = await this.performance.persistTodaySnapshot(yesterday);
      this.logger.log(`cron ok date=${r.date} written=${r.written}`);
    } catch (e: any) {
      this.logger.error(`cron failed date=${yesterday}: ${e?.message ?? e}`);
    }
  }

  /**
   * Fallback: if the cron didn't run for yesterday (server was down
   * across midnight), run it on bootstrap. Idempotent — re-running for
   * a day that's already snapshotted just refreshes the values.
   */
  async onApplicationBootstrap() {
    try {
      const yesterday = addDaysRiyadh(riyadhDateString(new Date()), -1);
      const existing = await this.prisma.dailyTrackPerformance.findFirst({
        where: { date: { gte: parseDateOnly(yesterday) }, avgReportQualityScore: { not: null } },
        select: { id: true },
      });
      if (existing) return;
      this.logger.warn(`bootstrap fallback: no snapshot for ${yesterday} — running now`);
      await this.performance.persistTodaySnapshot(yesterday);
    } catch (e: any) {
      this.logger.error(`bootstrap fallback failed: ${e?.message ?? e}`);
    }
  }
}

function parseDateOnly(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}
