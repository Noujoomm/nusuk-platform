/**
 * Track Performance Service — Quality-First (Phases 1-5 orchestrator).
 *
 * Public surface used by the controller, scheduler, and any other caller:
 *   - getTodayPerformance()      → full Top-3 + engaging + best employees
 *   - getTrackBreakdown(trackId) → single-track detail
 *   - getHistory(from, to)       → snapshot rows (paginated)
 *   - persistTodaySnapshot()     → cron-callable, idempotent upsert
 *
 * Composition:
 *   - 4 pure calculators (./calculators/*.ts) own all scoring math.
 *   - This file owns I/O: pulling reports/comments/updates/users from
 *     Prisma, identifying track leads, writing the snapshot row.
 *   - No engagement is invented: counts come from existing tables
 *     (Comment, DailyUpdate, TaskUpdate, Report). Action types in the
 *     spec without a data source today are passed as 0 — the calculator
 *     contract still accepts them, so adding a UserActionLog later is
 *     a one-place change.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  ReportForQuality,
  bucketOf,
} from '../calculators/report-quality.calculator';
import {
  TrackQualityResult,
  calculateTrackQualityScore,
} from '../calculators/track-quality.calculator';
import {
  LeadActionCounts,
  LeadEngagementResult,
  normalizeLeadEngagement,
} from '../calculators/lead-engagement.calculator';
import {
  MemberActionCounts,
  TrackEngagementAggregate,
  TrackEngagementRanked,
  aggregateTrackEngagement,
  rankTrackEngagement,
} from '../calculators/track-engagement.calculator';
import {
  EmployeeScore,
  pickBestEmployee,
} from '../calculators/best-employee.calculator';
import { riyadhDateBoundaries, riyadhDateString } from '../utils/riyadh-time.util';

const QUALITY_WEIGHT = 0.6;
const ENGAGEMENT_WEIGHT = 0.4;

export interface TrackTopRecord {
  rank: number;
  trackId: string;
  trackName: string;
  trackLead: { id: string; name: string; avatar: string | null } | null;
  finalScore: number;
  breakdown: {
    avgReportQuality: { score: number; weight: number; contribution: number };
    trackLeadEngagement: { score: number; weight: number; contribution: number };
  };
  metrics: {
    reportsCount: number;
    validReportsCount: number;
    avgReportQuality: number;
    leadEngagementActions: number;
    qualityDistribution: TrackQualityResult['qualityDistribution'];
  };
  zeroReason: string | null;
}

export interface TrackEngagingRecord {
  rank: number;
  trackId: string;
  trackName: string;
  engagementScore: number;
  totalEngagementActions: number;
  membersCount: number;
  avgPerMember: number;
}

export interface BestEmployeeRecord {
  trackId: string;
  trackName: string;
  bestEmployee: {
    id: string;
    name: string;
    avatar: string | null;
    reportsCount: number;
    avgReportQuality: number;
    engagementScore: number;
    finalScore: number;
  } | null;
  reason?: 'NO_EMPLOYEES' | 'NO_VALID_REPORTS';
}

export interface TodayPerformance {
  date: string;
  timezone: 'Asia/Riyadh';
  calculatedAt: string;
  topTracks: TrackTopRecord[];
  topEngagingTracks: TrackEngagingRecord[];
  bestEmployeesPerTrack: BestEmployeeRecord[];
}

interface TrackEngineResult {
  trackId: string;
  trackName: string;
  quality: TrackQualityResult;
  leadInput: {
    leadId: string | null;
    leadName: string | null;
    leadAvatar: string | null;
    actions: LeadActionCounts;
  };
  engagement: TrackEngagementAggregate;
  bestEmployee: { winner: EmployeeScore | null; scored: EmployeeScore[] };
  members: Array<{ id: string; nameAr: string; role: string }>;
}

@Injectable()
export class QualityFirstPerformanceService {
  private readonly logger = new Logger(QualityFirstPerformanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Public API ──────────────────────────────────────────────────────

  async getTodayPerformance(): Promise<TodayPerformance> {
    const today = riyadhDateString(new Date());
    const { start } = riyadhDateBoundaries(today);
    return this.computeForRange(today, start);
  }

  async getTrackBreakdown(trackId: string): Promise<{
    track: TrackTopRecord;
    engaging: TrackEngagingRecord | null;
    bestEmployee: BestEmployeeRecord | null;
  }> {
    const today = await this.getTodayPerformance();
    const t = today.topTracks.find((x) => x.trackId === trackId);
    if (!t) throw new NotFoundException('Track not found in today\'s ranking');
    return {
      track: t,
      engaging: today.topEngagingTracks.find((x) => x.trackId === trackId) ?? null,
      bestEmployee: today.bestEmployeesPerTrack.find((x) => x.trackId === trackId) ?? null,
    };
  }

  async getHistory(fromDate: string, toDate: string) {
    const { date: from } = riyadhDateBoundaries(fromDate);
    const { date: to } = riyadhDateBoundaries(toDate);
    return this.prisma.dailyTrackPerformance.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: [{ date: 'desc' }, { rank: 'asc' }],
      include: { track: { select: { id: true, nameAr: true } } },
    });
  }

  /**
   * Idempotent upsert: writes the new quality-first fields onto today's
   * existing DailyTrackPerformance row (or creates it if absent). Called
   * by both the cron and the admin recalculate endpoint.
   */
  async persistTodaySnapshot(targetDate?: string): Promise<{ written: number; date: string }> {
    const dateStr = targetDate ?? riyadhDateString(new Date());
    const { start, date: dateOnly } = riyadhDateBoundaries(dateStr);
    const todayPerf = await this.computeForRange(dateStr, start);
    let written = 0;

    for (const t of todayPerf.topTracks) {
      const engaging = todayPerf.topEngagingTracks.find((e) => e.trackId === t.trackId);
      const employee = todayPerf.bestEmployeesPerTrack.find((e) => e.trackId === t.trackId);

      await this.prisma.dailyTrackPerformance.upsert({
        where: { trackId_date: { trackId: t.trackId, date: dateOnly } },
        create: {
          trackId: t.trackId,
          date: dateOnly,
          reportsCount: t.metrics.reportsCount,
          interactionsCount: t.metrics.leadEngagementActions,
          reportsScore: t.breakdown.avgReportQuality.score,
          interactionsScore: t.breakdown.trackLeadEngagement.score,
          finalScore: t.finalScore,
          rank: t.rank,
          avgReportQualityScore: t.breakdown.avgReportQuality.score,
          trackLeadEngagement: t.breakdown.trackLeadEngagement.score,
          trackLeadId: t.trackLead?.id ?? null,
          trackLeadName: t.trackLead?.name ?? null,
          trackLeadRawEngagement: t.metrics.leadEngagementActions,
          bestEmployeeId: employee?.bestEmployee?.id ?? null,
          bestEmployeeName: employee?.bestEmployee?.name ?? null,
          bestEmployeeQuality: employee?.bestEmployee?.avgReportQuality ?? null,
          totalTrackEngagement: engaging?.totalEngagementActions ?? null,
          engagementRank: engaging?.rank ?? null,
          validReportsCount: t.metrics.validReportsCount,
          excellentReportsCount: t.metrics.qualityDistribution.excellent,
          goodReportsCount: t.metrics.qualityDistribution.good,
          fairReportsCount: t.metrics.qualityDistribution.fair,
          poorReportsCount: t.metrics.qualityDistribution.poor,
          zeroReason: t.zeroReason,
        },
        update: {
          reportsCount: t.metrics.reportsCount,
          interactionsCount: t.metrics.leadEngagementActions,
          reportsScore: t.breakdown.avgReportQuality.score,
          interactionsScore: t.breakdown.trackLeadEngagement.score,
          finalScore: t.finalScore,
          rank: t.rank,
          avgReportQualityScore: t.breakdown.avgReportQuality.score,
          trackLeadEngagement: t.breakdown.trackLeadEngagement.score,
          trackLeadId: t.trackLead?.id ?? null,
          trackLeadName: t.trackLead?.name ?? null,
          trackLeadRawEngagement: t.metrics.leadEngagementActions,
          bestEmployeeId: employee?.bestEmployee?.id ?? null,
          bestEmployeeName: employee?.bestEmployee?.name ?? null,
          bestEmployeeQuality: employee?.bestEmployee?.avgReportQuality ?? null,
          totalTrackEngagement: engaging?.totalEngagementActions ?? null,
          engagementRank: engaging?.rank ?? null,
          validReportsCount: t.metrics.validReportsCount,
          excellentReportsCount: t.metrics.qualityDistribution.excellent,
          goodReportsCount: t.metrics.qualityDistribution.good,
          fairReportsCount: t.metrics.qualityDistribution.fair,
          poorReportsCount: t.metrics.qualityDistribution.poor,
          zeroReason: t.zeroReason,
          capturedAt: new Date(),
        },
      });
      written += 1;
    }
    this.logger.log(`persistTodaySnapshot date=${dateStr} written=${written}`);
    return { written, date: dateStr };
  }

  // ─── Core compute ────────────────────────────────────────────────────

  private async computeForRange(dateStr: string, startInstant: Date): Promise<TodayPerformance> {
    const tracks = await this.prisma.track.findMany({
      where: { isActive: true },
      select: { id: true, nameAr: true },
      orderBy: { sortOrder: 'asc' },
    });

    const perTrack: TrackEngineResult[] = [];
    for (const t of tracks) {
      perTrack.push(await this.computeForTrack(t.id, t.nameAr, startInstant));
    }

    // ─── Top 3 tracks (60% quality + 40% normalized lead engagement) ───
    const leadInputs = perTrack
      .filter((p) => p.leadInput.leadId !== null)
      .map((p) => ({
        leadId: p.leadInput.leadId as string,
        leadName: p.leadInput.leadName ?? '',
        leadAvatar: p.leadInput.leadAvatar,
        actions: p.leadInput.actions,
      }));
    const leadResults: LeadEngagementResult[] = normalizeLeadEngagement(leadInputs);
    const leadByTrack = new Map<string, LeadEngagementResult>();
    perTrack.forEach((p, i) => {
      const lead = leadResults.find((l) => l.leadId === p.leadInput.leadId);
      if (lead) leadByTrack.set(p.trackId, lead);
    });

    const topUnsorted = perTrack.map<TrackTopRecord>((p) => {
      const lead = leadByTrack.get(p.trackId);
      const qScore = p.quality.score;
      const eScore = lead?.normalizedScore ?? 0;
      const finalScore = qScore * QUALITY_WEIGHT + eScore * ENGAGEMENT_WEIGHT;
      return {
        rank: 0,
        trackId: p.trackId,
        trackName: p.trackName,
        trackLead: p.leadInput.leadId
          ? {
              id: p.leadInput.leadId,
              name: p.leadInput.leadName ?? '',
              avatar: p.leadInput.leadAvatar,
            }
          : null,
        finalScore: round1(finalScore),
        breakdown: {
          avgReportQuality: {
            score: round1(qScore),
            weight: QUALITY_WEIGHT,
            contribution: round1(qScore * QUALITY_WEIGHT),
          },
          trackLeadEngagement: {
            score: round1(eScore),
            weight: ENGAGEMENT_WEIGHT,
            contribution: round1(eScore * ENGAGEMENT_WEIGHT),
          },
        },
        metrics: {
          reportsCount: p.quality.reportsCount,
          validReportsCount: p.quality.validReportsCount,
          avgReportQuality: round1(p.quality.avgQuality),
          leadEngagementActions: lead?.rawScore ?? 0,
          qualityDistribution: p.quality.qualityDistribution,
        },
        zeroReason: p.quality.reason,
      };
    });

    topUnsorted.sort(
      (a, b) =>
        b.finalScore - a.finalScore ||
        b.metrics.validReportsCount - a.metrics.validReportsCount ||
        a.trackId.localeCompare(b.trackId),
    );
    const topTracks = topUnsorted.slice(0, 3).map((t, i) => ({ ...t, rank: i + 1 }));

    // ─── Top 3 engaging tracks (avg engagement per member) ─────────────
    const ranked: TrackEngagementRanked[] = rankTrackEngagement(perTrack.map((p) => p.engagement));
    const top3Engaging = ranked
      .slice(0, 3)
      .filter((r) => r.rank !== null)
      .map<TrackEngagingRecord>((r) => ({
        rank: r.rank as number,
        trackId: r.trackId,
        trackName: r.trackName,
        engagementScore: round1(r.engagementScore),
        totalEngagementActions: r.totalEngagement,
        membersCount: r.membersCount,
        avgPerMember: round1(r.avgEngagementPerMember),
      }));

    // ─── Best employee per track ───────────────────────────────────────
    const bestEmployeesPerTrack: BestEmployeeRecord[] = perTrack.map((p) => {
      const employees = p.members.filter((m) => m.role !== 'track_lead');
      if (employees.length === 0) {
        return { trackId: p.trackId, trackName: p.trackName, bestEmployee: null, reason: 'NO_EMPLOYEES' };
      }
      const w = p.bestEmployee.winner;
      if (!w) {
        return { trackId: p.trackId, trackName: p.trackName, bestEmployee: null, reason: 'NO_VALID_REPORTS' };
      }
      return {
        trackId: p.trackId,
        trackName: p.trackName,
        bestEmployee: {
          id: w.employeeId,
          name: w.employeeName,
          avatar: w.employeeAvatar,
          reportsCount: w.validReportsCount,
          avgReportQuality: round1(w.avgReportQuality),
          engagementScore: round1(w.engagementScore),
          finalScore: round1(w.finalScore),
        },
      };
    });

    return {
      date: dateStr,
      timezone: 'Asia/Riyadh',
      calculatedAt: new Date().toISOString(),
      topTracks,
      topEngagingTracks: top3Engaging,
      bestEmployeesPerTrack,
    };
  }

  private async computeForTrack(
    trackId: string,
    trackName: string,
    startInstant: Date,
  ): Promise<TrackEngineResult> {
    // 1. Members of the track via TrackPermission
    const perms = await this.prisma.trackPermission.findMany({
      where: { trackId },
      include: {
        user: {
          select: { id: true, name: true, nameAr: true, role: true, isActive: true },
        },
      },
    });
    const activeMembers = perms
      .filter((p) => p.user?.isActive)
      .map((p) => ({
        id: p.user!.id,
        nameAr: p.user!.nameAr,
        role: p.user!.role as string,
      }));

    // 2. Identify lead: prefer role=track_lead among assigned members
    const leadMember = activeMembers.find((m) => m.role === 'track_lead') ?? null;

    // 3. Today's reports (with quality fields + attachment metadata)
    const todayReports = await this.prisma.report.findMany({
      where: { trackId, createdAt: { gte: startInstant } },
      select: {
        authorId: true,
        title: true,
        trackId: true,
        reportDate: true,
        achievements: true,
        kpiUpdates: true,
        challenges: true,
        notes: true,
        upcomingTasks: true,
        attachments: { select: { sizeBytes: true, mimeType: true } },
      },
    });
    const reportsForQuality: ReportForQuality[] = todayReports;
    const quality = calculateTrackQualityScore(reportsForQuality);

    // 4. Per-user engagement counts (today, scoped to relevant signals)
    const memberIds = activeMembers.map((m) => m.id);
    const engagementByUser = new Map<string, MemberActionCounts>();
    if (memberIds.length > 0) {
      const [comments, dailyUpdates, taskUpdates] = await Promise.all([
        this.prisma.comment.groupBy({
          by: ['authorId'],
          where: { authorId: { in: memberIds }, createdAt: { gte: startInstant } },
          _count: true,
        }),
        this.prisma.dailyUpdate.groupBy({
          by: ['authorId'],
          where: { authorId: { in: memberIds }, createdAt: { gte: startInstant } },
          _count: true,
        }),
        this.prisma.taskUpdate.groupBy({
          by: ['authorId'],
          where: { authorId: { in: memberIds }, createdAt: { gte: startInstant } },
          _count: true,
        }),
      ]);

      const reportsByAuthor = new Map<string, number>();
      for (const r of todayReports) {
        reportsByAuthor.set(r.authorId, (reportsByAuthor.get(r.authorId) ?? 0) + 1);
      }

      for (const m of activeMembers) {
        engagementByUser.set(m.id, {
          comments: comments.find((c) => c.authorId === m.id)?._count ?? 0,
          statusUpdates:
            (dailyUpdates.find((u) => u.authorId === m.id)?._count ?? 0) +
            (taskUpdates.find((u) => u.authorId === m.id)?._count ?? 0),
          // No first-class signal yet — keep contract, pass 0.
          reportReviews: 0,
          reportSubmissions: reportsByAuthor.get(m.id) ?? 0,
          meetingsJoined: 0,
          reactions: 0,
        });
      }
    }

    // 5. Lead input
    const leadActions: LeadActionCounts = leadMember
      ? {
          comments: engagementByUser.get(leadMember.id)?.comments ?? 0,
          statusUpdates: engagementByUser.get(leadMember.id)?.statusUpdates ?? 0,
          reportReviews: 0,
          meetingsJoined: 0,
          reactions: 0,
          logins: 0,
        }
      : {
          comments: 0, statusUpdates: 0, reportReviews: 0,
          meetingsJoined: 0, reactions: 0, logins: 0,
        };

    // 6. Track-level engagement aggregate (members)
    const engagement = aggregateTrackEngagement({
      trackId,
      trackName,
      members: activeMembers.map((m) => ({
        memberId: m.id,
        actions:
          engagementByUser.get(m.id) ?? {
            comments: 0, statusUpdates: 0, reportReviews: 0,
            reportSubmissions: 0, meetingsJoined: 0, reactions: 0,
          },
      })),
    });

    // 7. Best employee (excludes lead)
    const employees = activeMembers.filter((m) => m.role !== 'track_lead');
    const reportsByAuthor = new Map<string, ReportForQuality[]>();
    for (const r of todayReports) {
      const arr = reportsByAuthor.get(r.authorId) ?? [];
      arr.push(r);
      reportsByAuthor.set(r.authorId, arr);
    }
    const bestEmployee = pickBestEmployee(
      employees.map((e) => ({
        employeeId: e.id,
        employeeName: e.nameAr,
        employeeAvatar: null,
        reports: reportsByAuthor.get(e.id) ?? [],
        actions:
          engagementByUser.get(e.id) ?? {
            comments: 0, statusUpdates: 0, reportReviews: 0,
            reportSubmissions: 0, meetingsJoined: 0, reactions: 0,
          },
      })),
    );

    return {
      trackId,
      trackName,
      quality,
      leadInput: {
        leadId: leadMember?.id ?? null,
        leadName: leadMember?.nameAr ?? null,
        leadAvatar: null,
        actions: leadActions,
      },
      engagement,
      bestEmployee,
      members: activeMembers,
    };
  }
}

// helper used inline above so the result is JSON-friendly
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
