/**
 * Cron driver for the weekly-cumulative leaderboard.
 *
 *   - Every minute @ Asia/Riyadh:  refresh `weekly_cumulative_scores`
 *     for the current week, so the API endpoint can read straight from
 *     the table (no recompute on the request path).
 *
 *   - Sunday 00:00 @ Asia/Riyadh: archive the week that just closed.
 *     Runs ONCE/week, after the daily-snapshot cron (also at 00:00) has
 *     written Saturday's row. The two crons are independent — order
 *     within that minute doesn't matter because:
 *       * `archive()` reads from `daily_track_performance` (Sat row is
 *         either there or it isn't — if not, archive is run again on
 *         the next process boot via the bootstrap fallback)
 *       * the per-minute recompute will skip the just-archived week.
 */

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WeeklyCumulativeService } from './weekly-cumulative.service';
import { PrismaService } from '../../common/prisma.service';
import {
  addDaysRiyadh,
  riyadhDateBoundaries,
  riyadhDateString,
  riyadhWeekBounds,
} from '../utils/riyadh-time.util';

@Injectable()
export class WeeklyCumulativeScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(WeeklyCumulativeScheduler.name);

  /** Guards against minute-cron overlap if a recompute ever takes >60s. */
  private recomputing = false;

  constructor(
    private readonly service: WeeklyCumulativeService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'weeklyCumulativeRefresh',
    timeZone: 'Asia/Riyadh',
  })
  async refresh(): Promise<void> {
    if (this.recomputing) return;
    this.recomputing = true;
    try {
      await this.service.recomputeCurrentWeek();
    } catch (e: any) {
      this.logger.error(`refresh failed: ${e?.message ?? e}`);
    } finally {
      this.recomputing = false;
    }
  }

  @Cron('0 0 * * 0', {
    name: 'weeklyCumulativeArchive',
    timeZone: 'Asia/Riyadh',
  })
  async archive(): Promise<void> {
    try {
      const r = await this.service.archive();
      this.logger.log(`archive ok weekStart=${r.weekStart} archived=${r.archived}`);
    } catch (e: any) {
      this.logger.error(`archive failed: ${e?.message ?? e}`);
    }
  }

  /**
   * On boot:
   *   - Always recompute current week immediately so the dashboard has
   *     fresh data without waiting up to 60s for the first cron tick.
   *   - If the most recent fully-elapsed week was never archived (server
   *     was down on Sunday 00:00), archive it now. Idempotent.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.service.recomputeCurrentWeek();
    } catch (e: any) {
      this.logger.error(`bootstrap recompute failed: ${e?.message ?? e}`);
    }

    try {
      const currentWeek = riyadhWeekBounds(new Date());
      const lastWeekStartStr = addDaysRiyadh(currentWeek.startDateStr, -7);
      const { date: lastWeekDateOnly } = riyadhDateBoundaries(lastWeekStartStr);
      const existing = await this.prisma.weeklyCumulativeScore.findFirst({
        where: { weekStartDate: lastWeekDateOnly, isArchived: true },
        select: { id: true },
      });
      if (existing) return;
      this.logger.warn(
        `bootstrap fallback: week ${lastWeekStartStr} not archived — running now`,
      );
      await this.service.archive();
    } catch (e: any) {
      this.logger.error(`bootstrap archive fallback failed: ${e?.message ?? e}`);
    }
  }
}
