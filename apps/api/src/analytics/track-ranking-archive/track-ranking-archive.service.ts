/**
 * Track-ranking archive — persists the executive dashboard's "أفضل ٣
 * مسارات أداءً" card so it can be reviewed historically.
 *
 *   - DAILY  : at 00:00 Asia/Riyadh, snapshot the day that just ended.
 *              The percentages come straight from
 *              QualityFirstPerformanceService (the same source the live
 *              card reads), so the archive always matches what was shown.
 *   - WEEKLY : on Sunday 00:00 Asia/Riyadh, average each track's DAILY
 *              percentages across the week that just ended, re-rank, and
 *              store the result.
 *
 * Both writes are idempotent (upsert on the composite unique key), so a
 * re-run — e.g. the bootstrap catch-up below — never duplicates rows.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { QualityFirstPerformanceService } from '../quality-first/quality-first.service';
import {
  addDaysRiyadh,
  riyadhDateBoundaries,
  riyadhDateString,
  riyadhWeekBounds,
} from '../utils/riyadh-time.util';

export type SnapshotPeriod = 'DAILY' | 'WEEKLY';

/** A daily row as consumed by the weekly aggregator. */
export interface DailyRankingRow {
  trackId: string;
  trackNameAr: string;
  leaderNameAr: string | null;
  qualityPercent: number;
  reportCount: number;
}

export interface WeeklyRankedTrack {
  trackId: string;
  trackNameAr: string;
  leaderNameAr: string | null;
  qualityPercent: number;
  reportCount: number;
}

/**
 * Pure: collapse a week's DAILY rows into a re-ranked weekly list.
 *   - qualityPercent = mean of the track's daily percentages (over the
 *     days it actually appeared), rounded to 1 dp.
 *   - reportCount    = sum of the track's daily report counts.
 *   - leaderNameAr   = last non-null leader seen.
 * Sorted by percentage desc, trackId asc as a deterministic tie-break.
 * Exported so the averaging/ranking can be unit-tested without Prisma.
 */
export function aggregateWeeklyRanking(
  daily: ReadonlyArray<DailyRankingRow>,
): WeeklyRankedTrack[] {
  const agg = new Map<
    string,
    { trackNameAr: string; leaderNameAr: string | null; sum: number; days: number; reports: number }
  >();
  for (const d of daily) {
    const cur = agg.get(d.trackId);
    if (cur) {
      cur.sum += d.qualityPercent;
      cur.days += 1;
      cur.reports += d.reportCount;
      if (d.leaderNameAr) cur.leaderNameAr = d.leaderNameAr;
      cur.trackNameAr = d.trackNameAr;
    } else {
      agg.set(d.trackId, {
        trackNameAr: d.trackNameAr,
        leaderNameAr: d.leaderNameAr,
        sum: d.qualityPercent,
        days: 1,
        reports: d.reportCount,
      });
    }
  }
  return Array.from(agg.entries())
    .map(([trackId, v]) => ({
      trackId,
      trackNameAr: v.trackNameAr,
      leaderNameAr: v.leaderNameAr,
      qualityPercent: Math.round((v.sum / v.days) * 10) / 10,
      reportCount: v.reports,
    }))
    .sort(
      (a, b) =>
        b.qualityPercent - a.qualityPercent || a.trackId.localeCompare(b.trackId),
    );
}

@Injectable()
export class TrackRankingArchiveService {
  private readonly logger = new Logger(TrackRankingArchiveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quality: QualityFirstPerformanceService,
  ) {}

  // ─── DAILY ────────────────────────────────────────────────────────────

  /**
   * Snapshots the top-3 ranking for one Riyadh day (defaults to the day
   * that just ended, i.e. yesterday). Idempotent.
   */
  async snapshotDaily(dateStr?: string): Promise<{ date: string; rows: number }> {
    const date = dateStr ?? addDaysRiyadh(riyadhDateString(new Date()), -1);
    const perf = await this.quality.getPerformanceForDate(date);
    const { date: dateOnly } = riyadhDateBoundaries(date);

    let rows = 0;
    for (const t of perf.topTracks) {
      await this.prisma.trackRankingSnapshot.upsert({
        where: {
          period_snapshotDate_trackId: {
            period: 'DAILY',
            snapshotDate: dateOnly,
            trackId: t.trackId,
          },
        },
        create: {
          period: 'DAILY',
          snapshotDate: dateOnly,
          trackId: t.trackId,
          trackNameAr: t.trackName,
          leaderNameAr: t.trackLead?.name ?? null,
          rank: t.rank,
          qualityPercent: t.finalScore, // == avgReportQuality after the quality-only change
          reportCount: t.metrics.validReportsCount,
        },
        update: {
          trackNameAr: t.trackName,
          leaderNameAr: t.trackLead?.name ?? null,
          rank: t.rank,
          qualityPercent: t.finalScore,
          reportCount: t.metrics.validReportsCount,
        },
      });
      rows += 1;
    }
    this.logger.log(`daily snapshot date=${date} rows=${rows}`);
    return { date, rows };
  }

  // ─── WEEKLY ───────────────────────────────────────────────────────────

  /**
   * Averages each track's DAILY percentages across the week that just
   * ended (Sun→Sat in Riyadh) and stores a re-ranked WEEKLY snapshot
   * keyed on that week's Sunday. Idempotent.
   */
  async snapshotWeekly(now: Date = new Date()): Promise<{ weekStart: string; rows: number }> {
    const currentWeek = riyadhWeekBounds(now);
    const weekStartStr = addDaysRiyadh(currentWeek.startDateStr, -7); // the week that just ended
    const weekEndStr = addDaysRiyadh(weekStartStr, 6);
    const { date: weekStartOnly } = riyadhDateBoundaries(weekStartStr);
    const { date: from } = riyadhDateBoundaries(weekStartStr);
    const { date: to } = riyadhDateBoundaries(weekEndStr);

    const daily = await this.prisma.trackRankingSnapshot.findMany({
      where: { period: 'DAILY', snapshotDate: { gte: from, lte: to } },
      select: {
        trackId: true,
        trackNameAr: true,
        leaderNameAr: true,
        qualityPercent: true,
        reportCount: true,
      },
    });

    const ranked = aggregateWeeklyRanking(daily);

    let rows = 0;
    for (let i = 0; i < ranked.length; i++) {
      const r = ranked[i];
      await this.prisma.trackRankingSnapshot.upsert({
        where: {
          period_snapshotDate_trackId: {
            period: 'WEEKLY',
            snapshotDate: weekStartOnly,
            trackId: r.trackId,
          },
        },
        create: {
          period: 'WEEKLY',
          snapshotDate: weekStartOnly,
          trackId: r.trackId,
          trackNameAr: r.trackNameAr,
          leaderNameAr: r.leaderNameAr,
          rank: i + 1,
          qualityPercent: r.qualityPercent,
          reportCount: r.reportCount,
        },
        update: {
          trackNameAr: r.trackNameAr,
          leaderNameAr: r.leaderNameAr,
          rank: i + 1,
          qualityPercent: r.qualityPercent,
          reportCount: r.reportCount,
        },
      });
      rows += 1;
    }
    this.logger.log(`weekly snapshot weekStart=${weekStartStr} rows=${rows}`);
    return { weekStart: weekStartStr, rows };
  }

  // ─── Read (for the endpoint) ──────────────────────────────────────────

  /**
   * Snapshots grouped by date, newest first. When `date` is given, returns
   * only that date's group; otherwise returns the most recent `limitDates`
   * distinct snapshot dates for the period.
   */
  async list(params: { period: SnapshotPeriod; date?: string; limitDates?: number }) {
    const where: { period: SnapshotPeriod; snapshotDate?: Date } = {
      period: params.period,
    };
    if (params.date) {
      where.snapshotDate = riyadhDateBoundaries(params.date).date;
    }

    const rows = await this.prisma.trackRankingSnapshot.findMany({
      where,
      orderBy: [{ snapshotDate: 'desc' }, { rank: 'asc' }],
    });

    // Group by snapshotDate (YYYY-MM-DD).
    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.snapshotDate.toISOString().slice(0, 10);
      const arr = groups.get(key);
      if (arr) arr.push(r);
      else groups.set(key, [r]);
    }

    let entries = Array.from(groups.entries()).map(([date, snapshots]) => ({
      period: params.period,
      snapshotDate: date,
      // For WEEKLY, the date is the week-start Sunday; expose the end too.
      weekEndDate: params.period === 'WEEKLY' ? addDaysRiyadh(date, 6) : null,
      tracks: snapshots.map((s) => ({
        trackId: s.trackId,
        trackNameAr: s.trackNameAr,
        leaderNameAr: s.leaderNameAr,
        rank: s.rank,
        qualityPercent: s.qualityPercent,
        reportCount: s.reportCount,
      })),
    }));

    if (!params.date && params.limitDates) {
      entries = entries.slice(0, params.limitDates);
    }
    return { period: params.period, snapshots: entries };
  }
}
