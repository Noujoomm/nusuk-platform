/**
 * Weekly cumulative track ranking — Sun→Sat in Asia/Riyadh.
 *
 * For each track, the cumulative score is the SUM over the week of
 *   (avgReportQualityScore + trackLeadEngagement)
 * — the same two components that drive the daily widget. Each completed
 * day in the week takes its values from the existing
 * `daily_track_performance` snapshot (written by the 00:00 KSA cron),
 * and TODAY is read live from QualityFirstPerformanceService.
 *
 * The leaderboard table (`weekly_cumulative_scores`) is essentially a
 * denormalized cache of this sum, kept fresh by `WeeklyCumulativeScheduler`
 * (every minute) and frozen on Sunday 00:00 KSA via `archive`. The API
 * endpoint reads from this table directly so requests don't trigger any
 * heavy aggregation work.
 *
 * Tie-break order on the leaderboard is:
 *   cumulativeScore DESC, daysContributed DESC, trackId ASC
 *   ─────────────────────  ─────────────────────  ─────────────
 *   primary: total score   tie-break: spread of    deterministic
 *                          contribution across     final key
 *                          the week
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  QualityFirstPerformanceService,
  TodayPerformance,
} from '../quality-first/quality-first.service';
import {
  addDaysRiyadh,
  riyadhDateBoundaries,
  riyadhDateString,
  riyadhWeekBounds,
} from '../utils/riyadh-time.util';

const RIYADH_WEEKDAY_LABELS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const;

export interface WeeklyTopTrack {
  rank: number;
  trackId: string;
  trackName: string;
  leaderName: string | null;
  cumulativeScore: number;
  reportQualityScore: number;
  leaderEngagementScore: number;
  daysContributed: number;
}

export interface WeeklyCumulativeResponse {
  weekStartDate: string;       // ISO date (Riyadh)
  weekEndDate: string;         // ISO date (Riyadh)
  currentDayInWeek: string;    // Arabic weekday name
  daysElapsedInWeek: number;   // 1..7
  lastUpdatedAt: string | null;
  topTracks: WeeklyTopTrack[];
}

interface DailySnapshotRow {
  trackId: string;
  date: Date;
  avgReportQualityScore: number | null;
  trackLeadEngagement: number | null;
  trackLeadId: string | null;
  trackLeadName: string | null;
}

interface AggregatedTrack {
  trackId: string;
  trackName: string;
  reportQualityScore: number;
  leaderEngagementScore: number;
  cumulativeScore: number;
  daysContributed: number;
  trackLeadId: string | null;
  trackLeadName: string | null;
}

@Injectable()
export class WeeklyCumulativeService {
  private readonly logger = new Logger(WeeklyCumulativeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly qualityFirst: QualityFirstPerformanceService,
  ) {}

  /**
   * Recomputes and upserts the WeeklyCumulativeScore rows for the week
   * containing `now`. Called by the per-minute cron.
   *
   * Idempotent: re-running with the same week produces the same row
   * contents (modulo `lastUpdatedAt`).
   */
  async recomputeCurrentWeek(now: Date = new Date()): Promise<{
    weekStart: string;
    rowsWritten: number;
  }> {
    const week = riyadhWeekBounds(now);
    const todayStr = riyadhDateString(now);

    const tracks = await this.prisma.track.findMany({
      where: { isActive: true },
      select: { id: true, nameAr: true },
      orderBy: { sortOrder: 'asc' },
    });

    const aggregated = await this.aggregate(tracks, week.startDateStr, todayStr);

    for (const a of aggregated) {
      await this.prisma.weeklyCumulativeScore.upsert({
        where: {
          trackId_weekStartDate: {
            trackId: a.trackId,
            weekStartDate: week.dateOnly,
          },
        },
        create: {
          trackId: a.trackId,
          weekStartDate: week.dateOnly,
          cumulativeScore: a.cumulativeScore,
          reportQualityScore: a.reportQualityScore,
          leaderEngagementScore: a.leaderEngagementScore,
          daysContributed: a.daysContributed,
          trackLeadId: a.trackLeadId,
          trackLeadName: a.trackLeadName,
          isArchived: false,
        },
        update: {
          cumulativeScore: a.cumulativeScore,
          reportQualityScore: a.reportQualityScore,
          leaderEngagementScore: a.leaderEngagementScore,
          daysContributed: a.daysContributed,
          trackLeadId: a.trackLeadId,
          trackLeadName: a.trackLeadName,
          // Don't touch isArchived here — current week is never archived
          // by this path; archival is owned by `archive()`.
        },
      });
    }

    return { weekStart: week.startDateStr, rowsWritten: aggregated.length };
  }

  /**
   * Finalizes and freezes the week that just ended. Run by the Sunday
   * 00:00 KSA cron, after the daily snapshot for Saturday has been
   * written. Idempotent.
   */
  async archive(now: Date = new Date()): Promise<{ weekStart: string; archived: number }> {
    // The week to archive is the one whose Sunday is 7 days before this
    // tick's "current week" Sunday.
    const currentWeek = riyadhWeekBounds(now);
    const lastWeekStartStr = addDaysRiyadh(currentWeek.startDateStr, -7);
    const { date: lastWeekDateOnly } = riyadhDateBoundaries(lastWeekStartStr);

    // Recompute so the archive holds the *final* numbers, including the
    // last-day snapshot the daily cron just wrote.
    const lastDayStr = addDaysRiyadh(lastWeekStartStr, 6);
    const tracks = await this.prisma.track.findMany({
      where: { isActive: true },
      select: { id: true, nameAr: true },
      orderBy: { sortOrder: 'asc' },
    });
    const aggregated = await this.aggregate(tracks, lastWeekStartStr, lastDayStr, {
      includeTodayLive: false,
    });

    let archived = 0;
    for (const a of aggregated) {
      await this.prisma.weeklyCumulativeScore.upsert({
        where: {
          trackId_weekStartDate: {
            trackId: a.trackId,
            weekStartDate: lastWeekDateOnly,
          },
        },
        create: {
          trackId: a.trackId,
          weekStartDate: lastWeekDateOnly,
          cumulativeScore: a.cumulativeScore,
          reportQualityScore: a.reportQualityScore,
          leaderEngagementScore: a.leaderEngagementScore,
          daysContributed: a.daysContributed,
          trackLeadId: a.trackLeadId,
          trackLeadName: a.trackLeadName,
          isArchived: true,
        },
        update: {
          cumulativeScore: a.cumulativeScore,
          reportQualityScore: a.reportQualityScore,
          leaderEngagementScore: a.leaderEngagementScore,
          daysContributed: a.daysContributed,
          trackLeadId: a.trackLeadId,
          trackLeadName: a.trackLeadName,
          isArchived: true,
        },
      });
      archived += 1;
    }
    this.logger.log(`archived weekStart=${lastWeekStartStr} rows=${archived}`);
    return { weekStart: lastWeekStartStr, archived };
  }

  /**
   * Read-only entry for the API. Returns the persisted leaderboard for
   * the week containing `now` (the row is kept fresh by the cron — this
   * method does not recompute on read).
   */
  async getCurrentWeekTopThree(now: Date = new Date()): Promise<WeeklyCumulativeResponse> {
    const week = riyadhWeekBounds(now);

    const rows = await this.prisma.weeklyCumulativeScore.findMany({
      where: { weekStartDate: week.dateOnly },
      include: { track: { select: { nameAr: true } } },
      orderBy: [
        { cumulativeScore: 'desc' },
        { daysContributed: 'desc' },
        { trackId: 'asc' },
      ],
      take: 3,
    });

    const lastUpdatedAt = rows.reduce<Date | null>((acc, r) => {
      if (!acc) return r.lastUpdatedAt;
      return r.lastUpdatedAt > acc ? r.lastUpdatedAt : acc;
    }, null);

    const topTracks: WeeklyTopTrack[] = rows.map((r, i) => ({
      rank: i + 1,
      trackId: r.trackId,
      trackName: r.track.nameAr,
      leaderName: r.trackLeadName,
      cumulativeScore: round1(r.cumulativeScore),
      reportQualityScore: round1(r.reportQualityScore),
      leaderEngagementScore: round1(r.leaderEngagementScore),
      daysContributed: r.daysContributed,
    }));

    // Week starts on Sunday (dow=0), so day-index within the week is
    // simply the offset from Sunday. No need to round-trip through Date.
    const dowOffset = diffDays(week.startDateStr, riyadhDateString(now));

    return {
      weekStartDate: week.startDateStr,
      weekEndDate: week.endDateStr,
      currentDayInWeek: RIYADH_WEEKDAY_LABELS[dowOffset] ?? '',
      daysElapsedInWeek: dowOffset + 1,
      lastUpdatedAt: lastUpdatedAt ? lastUpdatedAt.toISOString() : null,
      topTracks,
    };
  }

  // ─── Internals ─────────────────────────────────────────────────────

  /**
   * Builds the per-track aggregate for the window
   *   [weekStartStr, min(weekStartStr+6, lastDayStr)]
   * by combining persisted daily snapshots with (optionally) today's
   * live computation.
   */
  private async aggregate(
    tracks: Array<{ id: string; nameAr: string }>,
    weekStartStr: string,
    lastDayStr: string,
    opts: { includeTodayLive?: boolean } = {},
  ): Promise<AggregatedTrack[]> {
    const includeTodayLive = opts.includeTodayLive ?? true;
    const todayStr = riyadhDateString(new Date());
    const todayInRange =
      includeTodayLive && lastDayStr >= todayStr && weekStartStr <= todayStr;

    // Snapshots cover Sunday up to yesterday (or up to lastDayStr if
    // archiving — in that case lastDayStr is Saturday of the closed
    // week).
    const snapshotEndStr = todayInRange
      ? addDaysRiyadh(todayStr, -1)
      : lastDayStr;

    const accumulators = new Map<string, AggregatedTrack>();
    for (const t of tracks) {
      accumulators.set(t.id, {
        trackId: t.id,
        trackName: t.nameAr,
        reportQualityScore: 0,
        leaderEngagementScore: 0,
        cumulativeScore: 0,
        daysContributed: 0,
        trackLeadId: null,
        trackLeadName: null,
      });
    }

    if (snapshotEndStr >= weekStartStr) {
      const { date: from } = riyadhDateBoundaries(weekStartStr);
      const { date: to } = riyadhDateBoundaries(snapshotEndStr);

      const snapshots = (await this.prisma.dailyTrackPerformance.findMany({
        where: { date: { gte: from, lte: to } },
        select: {
          trackId: true,
          date: true,
          avgReportQualityScore: true,
          trackLeadEngagement: true,
          trackLeadId: true,
          trackLeadName: true,
        },
      })) as DailySnapshotRow[];

      for (const s of snapshots) {
        const acc = accumulators.get(s.trackId);
        if (!acc) continue;
        const q = s.avgReportQualityScore ?? 0;
        const e = s.trackLeadEngagement ?? 0;
        if (q === 0 && e === 0) continue;
        acc.reportQualityScore += q;
        acc.leaderEngagementScore += e;
        acc.cumulativeScore += q + e;
        acc.daysContributed += 1;
        // The lead can change during the week (rare, but possible). Use
        // the most recent non-null name we see — snapshots come back in
        // insertion order, so we just last-write-wins.
        if (s.trackLeadId) acc.trackLeadId = s.trackLeadId;
        if (s.trackLeadName) acc.trackLeadName = s.trackLeadName;
      }
    }

    if (todayInRange) {
      const today = await this.qualityFirst.getTodayPerformance();
      this.foldLiveToday(accumulators, today);
    }

    return Array.from(accumulators.values());
  }

  private foldLiveToday(
    accumulators: Map<string, AggregatedTrack>,
    today: TodayPerformance,
  ): void {
    for (const t of today.topTracks) {
      const acc = accumulators.get(t.trackId);
      if (!acc) continue;
      const q = t.breakdown.avgReportQuality.score;
      const e = t.breakdown.trackLeadEngagement.score;
      if (q === 0 && e === 0) continue;
      acc.reportQualityScore += q;
      acc.leaderEngagementScore += e;
      acc.cumulativeScore += q + e;
      acc.daysContributed += 1;
      if (t.trackLead) {
        acc.trackLeadId = t.trackLead.id;
        acc.trackLeadName = t.trackLead.name;
      }
    }
  }

}

// ─── Helpers ─────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function diffDays(fromStr: string, toStr: string): number {
  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const [ty, tm, td] = toStr.split('-').map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}
