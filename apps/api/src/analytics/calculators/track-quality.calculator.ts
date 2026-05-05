/**
 * Track Quality Calculator (Phase 1 — Quality-First)
 *
 * Aggregates per-report quality scores into a single track-level score
 * for the day. The fundamental rule: **average, not sum**.
 *
 *   Track A: 1 report at quality 95   →  avgQuality = 95
 *   Track B: 10 reports at quality 60 →  avgQuality = 60
 *   ⇒ Track A wins.
 *
 * This is the opposite of the previous count-weighted formula, and the
 * rationale is stated explicitly in the spec: flooding the platform with
 * mediocre reports must NOT be rewarded over careful, complete work.
 *
 * No relative normalization across tracks: the absolute quality (0–100)
 * is the score. A track that hits 92% gets 92 regardless of what other
 * tracks did. (Lead engagement IS normalized relatively in a separate
 * calculator — that's intentional, see lead-engagement.calculator.ts.)
 */

import {
  calculateReportQuality,
  MIN_QUALITY_THRESHOLD,
  QUALITY_BUCKETS,
  ReportForQuality,
} from './report-quality.calculator';

/** Why a track scored zero. Surfaced in the API for the UI to render. */
export type ZeroReason =
  | 'NO_REPORTS_SUBMITTED'
  | 'ALL_REPORTS_LOW_QUALITY';

export interface TrackQualityResult {
  /** 0–100. Average quality of valid reports; 0 if none qualified. */
  score: number;
  /** Number of reports submitted today (any quality). */
  reportsCount: number;
  /** Reports that cleared the MIN_QUALITY_THRESHOLD. */
  validReportsCount: number;
  /** Reports below the threshold (filtered out of the average). */
  droppedReportsCount: number;
  /** Same as score — kept distinct for the schema's avgReportQualityScore field. */
  avgQuality: number;
  /** Histogram by bucket — for the UI's "2 ممتاز، 1 جيد" line. */
  qualityDistribution: {
    excellent: number; // ≥ 85
    good: number;      // 70–84
    fair: number;      // 50–69
    poor: number;      // 30–49
  };
  /** When score is 0, why. Null when score > 0. */
  reason: ZeroReason | null;
}

/**
 * Compute one track's quality result for a single day from its reports.
 * Pure: no DB, no clock. The caller fetches today's reports and passes them in.
 */
export function calculateTrackQualityScore(
  reports: ReadonlyArray<ReportForQuality>,
): TrackQualityResult {
  const reportsCount = reports.length;

  if (reportsCount === 0) {
    return {
      score: 0,
      reportsCount: 0,
      validReportsCount: 0,
      droppedReportsCount: 0,
      avgQuality: 0,
      qualityDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
      reason: 'NO_REPORTS_SUBMITTED',
    };
  }

  const distribution = { excellent: 0, good: 0, fair: 0, poor: 0 };
  let totalQuality = 0;
  let validReportsCount = 0;
  let droppedReportsCount = 0;

  for (const r of reports) {
    const q = calculateReportQuality(r);
    if (q < MIN_QUALITY_THRESHOLD) {
      droppedReportsCount += 1;
      continue;
    }
    totalQuality += q;
    validReportsCount += 1;
    if (q >= QUALITY_BUCKETS.EXCELLENT) distribution.excellent += 1;
    else if (q >= QUALITY_BUCKETS.GOOD) distribution.good += 1;
    else if (q >= QUALITY_BUCKETS.FAIR) distribution.fair += 1;
    else distribution.poor += 1;
  }

  if (validReportsCount === 0) {
    return {
      score: 0,
      reportsCount,
      validReportsCount: 0,
      droppedReportsCount,
      avgQuality: 0,
      qualityDistribution: distribution,
      reason: 'ALL_REPORTS_LOW_QUALITY',
    };
  }

  const avgQuality = totalQuality / validReportsCount;

  return {
    score: avgQuality,
    reportsCount,
    validReportsCount,
    droppedReportsCount,
    avgQuality,
    qualityDistribution: distribution,
    reason: null,
  };
}
