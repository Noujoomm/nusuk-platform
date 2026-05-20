/**
 * Cron driver for the track-ranking archive.
 *
 *   - Daily  @ 00:00 Asia/Riyadh : snapshot the day that just ended
 *     (BEFORE the live card "resets" to the new empty day — the live
 *     ranking is computed on demand from the day's reports, so capturing
 *     at 00:00 for yesterday is exactly "the ranking as last shown").
 *   - Weekly @ Sunday 00:00 Asia/Riyadh : snapshot the week that ended.
 *
 * Bootstrap catch-up: if the process was down across a midnight, snapshot
 * yesterday on boot (idempotent — re-running a present day is a no-op via
 * upsert).
 */

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TrackRankingArchiveService } from './track-ranking-archive.service';
import {
  addDaysRiyadh,
  riyadhDateBoundaries,
  riyadhDateString,
} from '../utils/riyadh-time.util';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class TrackRankingArchiveScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(TrackRankingArchiveScheduler.name);

  constructor(
    private readonly archive: TrackRankingArchiveService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 0 * * *', {
    name: 'trackRankingArchiveDaily',
    timeZone: 'Asia/Riyadh',
  })
  async dailyCron() {
    try {
      const r = await this.archive.snapshotDaily();
      this.logger.log(`daily cron ok date=${r.date} rows=${r.rows}`);
    } catch (e: any) {
      this.logger.error(`daily cron failed: ${e?.message ?? e}`);
    }
  }

  @Cron('0 0 * * 0', {
    name: 'trackRankingArchiveWeekly',
    timeZone: 'Asia/Riyadh',
  })
  async weeklyCron() {
    try {
      const r = await this.archive.snapshotWeekly();
      this.logger.log(`weekly cron ok weekStart=${r.weekStart} rows=${r.rows}`);
    } catch (e: any) {
      this.logger.error(`weekly cron failed: ${e?.message ?? e}`);
    }
  }

  async onApplicationBootstrap() {
    try {
      const yesterday = addDaysRiyadh(riyadhDateString(new Date()), -1);
      const { date: dateOnly } = riyadhDateBoundaries(yesterday);
      const existing = await this.prisma.trackRankingSnapshot.findFirst({
        where: { period: 'DAILY', snapshotDate: dateOnly },
        select: { id: true },
      });
      if (existing) return;
      this.logger.warn(`bootstrap catch-up: no daily snapshot for ${yesterday} — running now`);
      await this.archive.snapshotDaily(yesterday);
    } catch (e: any) {
      this.logger.error(`bootstrap catch-up failed: ${e?.message ?? e}`);
    }
  }
}
