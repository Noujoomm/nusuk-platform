/**
 * Best Employee Calculator (Phase 4)
 *
 * Picks one "best employee" per track for the day. Quality-first:
 *
 *   finalScore = avgReportQuality × 0.70  +  normalizedEngagement × 0.30
 *
 * The 70/30 split (vs 60/40 at the track level) raises the bar for
 * individuals — an employee who sends ten flat reports loses to one
 * who sends two strong ones, and personal engagement only counts as
 * a tiebreaker.
 *
 * Eligibility: the employee MUST have submitted at least one report
 * that cleared MIN_QUALITY_THRESHOLD that day. Engagement alone
 * doesn't crown anyone — this is a "best output" award, not a
 * "most active" award.
 *
 * Track leads are excluded by the service layer before calling here.
 */

import { ReportForQuality, calculateReportQuality } from './report-quality.calculator';
import { MIN_QUALITY_THRESHOLD } from './report-quality.calculator';
import {
  MemberActionCounts,
  calculateMemberEngagement,
} from './track-engagement.calculator';

export interface EmployeeInput {
  employeeId: string;
  employeeName: string;
  employeeAvatar: string | null;
  reports: ReadonlyArray<ReportForQuality>;
  actions: MemberActionCounts;
}

export interface EmployeeScore {
  employeeId: string;
  employeeName: string;
  employeeAvatar: string | null;
  reportsCount: number;
  validReportsCount: number;
  avgReportQuality: number;
  engagementRaw: number;
  engagementScore: number;
  finalScore: number;
}

const QUALITY_WEIGHT = 0.70;
const ENGAGEMENT_WEIGHT = 0.30;

/**
 * Returns scored employees sorted by finalScore desc + the chosen winner.
 * `winner` is null when no employee has a valid (≥30) report — engagement
 * alone doesn't crown anyone.
 *
 * Engagement is normalized within the track (max engagement → 100).
 */
export function pickBestEmployee(
  inputs: ReadonlyArray<EmployeeInput>,
): { winner: EmployeeScore | null; scored: EmployeeScore[] } {
  if (inputs.length === 0) return { winner: null, scored: [] };

  // Pre-compute per-employee raws
  const enriched = inputs.map((e) => {
    let totalQuality = 0;
    let validCount = 0;
    for (const r of e.reports) {
      const q = calculateReportQuality(r);
      if (q >= MIN_QUALITY_THRESHOLD) {
        totalQuality += q;
        validCount += 1;
      }
    }
    const avgQuality = validCount > 0 ? totalQuality / validCount : 0;
    const engagementRaw = calculateMemberEngagement(e.actions);
    return {
      e,
      reportsCount: e.reports.length,
      validCount,
      avgQuality,
      engagementRaw,
    };
  });

  const maxEngagement = Math.max(...enriched.map((x) => x.engagementRaw));

  const scored: EmployeeScore[] = enriched.map((x) => {
    const engagementScore = maxEngagement > 0 ? (x.engagementRaw / maxEngagement) * 100 : 0;
    return {
      employeeId: x.e.employeeId,
      employeeName: x.e.employeeName,
      employeeAvatar: x.e.employeeAvatar,
      reportsCount: x.reportsCount,
      validReportsCount: x.validCount,
      avgReportQuality: x.avgQuality,
      engagementRaw: x.engagementRaw,
      engagementScore,
      finalScore: x.avgQuality * QUALITY_WEIGHT + engagementScore * ENGAGEMENT_WEIGHT,
    };
  });

  // Sort by finalScore desc, tiebreak by avgQuality, then employeeId for determinism
  scored.sort(
    (a, b) =>
      b.finalScore - a.finalScore ||
      b.avgReportQuality - a.avgReportQuality ||
      a.employeeId.localeCompare(b.employeeId),
  );

  // Eligibility: must have submitted at least one valid report
  const eligible = scored.filter((s) => s.validReportsCount > 0);
  return { winner: eligible[0] ?? null, scored };
}
