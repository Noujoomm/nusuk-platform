/**
 * Report Quality Calculator — v2.5 (continuous gradient)
 *
 * Pure, deterministic, no I/O. Same input → same number, every time.
 * No randomness, no Date.now(), no env reads inside the scoring math.
 *
 * Philosophy: ONE excellent report beats TEN mediocre ones.
 *   - This file scores ONE report from 0–100.
 *   - The track-level aggregator (track-quality.calculator.ts) takes the
 *     AVERAGE of qualifying reports — not the sum.
 *
 * ── Why v2.5 ────────────────────────────────────────────────────────
 * v2 scored every axis in a handful of discrete tiers (e.g. depth was
 * one of {0,5,10,15,20,25}). Averaging two reports landed on a tiny
 * grid of possible values, so different tracks kept displaying the
 * SAME number ("stuck at 40.5% / 67.5%"). v2.5 keeps the EXACT SAME
 * five axes and the EXACT SAME weights (30/25/20/15/10) — it only
 * replaces each within-axis step function with a continuous one, so
 * any value in 0–100 is reachable and 100 is genuinely achievable.
 *
 * ── The five axes (weights unchanged from v2) ───────────────────────
 *   1. Required-field completeness  (30)  title len + achievements len
 *                                         + track/date presence
 *   2. Content depth                (25)  concave curve on achievements
 *                                         length, full marks at 500 chars
 *   3. Valid attachments            (20)  count ramp (15) + total-bytes
 *                                         substance bonus (5)
 *   4. Structured metadata          (15)  partial credit per field on
 *                                         its content length
 *   5. Structured writing           (10)  line-count ramp + formatting-
 *                                         marker variety
 *
 * Reports below {@link MIN_QUALITY_THRESHOLD} are filtered out at the
 * track level — they don't pull the average down. That's unchanged.
 *
 * ── Rollback ────────────────────────────────────────────────────────
 * `USE_QUALITY_V25=false` makes `calculateReportQuality` delegate to the
 * frozen v2 implementation in `report-quality.calculator.v2.ts`. The
 * flag is read at call time so it can be flipped without a redeploy of
 * the pure module graph. `calculateReportQualityDetailed` is always
 * v2.5 (the breakdown shape only exists in v2.5).
 */

import { calculateReportQualityV2 } from './report-quality.calculator.v2';

// ─── Public input contract (unchanged from v2) ───────────────────────
export interface ReportForQuality {
  title: string | null | undefined;
  trackId: string | null | undefined;
  reportDate: Date | string | null | undefined;
  /** Roya's primary narrative field. Plays the role of "description". */
  achievements: string | null | undefined;
  kpiUpdates: string | null | undefined;
  challenges: string | null | undefined;
  notes: string | null | undefined;
  upcomingTasks: string | null | undefined;
  attachments?: ReadonlyArray<{
    sizeBytes: number;
    mimeType: string;
  }>;
}

// ─── Tuning constants ────────────────────────────────────────────────
/** Title length (chars) that earns full title credit. */
const TITLE_FULL_LENGTH = 10;
/** Achievements length (chars) that earns full "achievements present" credit. */
const ACH_PRESENT_FULL_LENGTH = 50;
/** Achievements length (chars) for full depth marks. */
const DEPTH_FULL_LENGTH = 500;
/** Concavity of the depth curve (<1 → rewards getting started, diminishing returns). */
const DEPTH_CURVE_EXPONENT = 0.7;
/** A metadata field's length (chars) that earns its full 5-point share. */
const METADATA_FIELD_FULL_LENGTH = 40;
/** Attachment must exceed this size (bytes) to count as "valid". */
const MIN_ATTACHMENT_BYTES = 10_000;
/** Valid-attachment count for full count-credit. */
const ATTACH_COUNT_FULL = 3;
/** Total valid-attachment bytes for full substance-bonus. */
const ATTACH_BYTES_FULL = 1_000_000;
/** Non-empty line count for full line-structure credit. */
const STRUCT_LINES_FULL = 4;

/** Per-axis maximum points — MUST sum to 100. Weights are these / 100. */
const AXIS_MAX = {
  completeness: 30,
  depth: 25,
  attachments: 20,
  metadata: 15,
  structure: 10,
} as const;

/** Within `attachments` (20): how it splits between count and byte-substance. */
const ATTACH_COUNT_MAX = 15;
const ATTACH_BYTES_MAX = 5;

/** Within `structure` (10): how it splits between line-count and marker-variety. */
const STRUCT_LINES_SHARE = 0.6;
const STRUCT_MARKERS_SHARE = 0.4;

const VALID_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'text/csv',
  'text/plain',
  'application/zip',
]);

/** Reports below this score are dropped from track-level aggregation. */
export const MIN_QUALITY_THRESHOLD = 30;

// ─── Result contract (new in v2.5) ───────────────────────────────────
export interface CriterionBreakdown {
  /** Axis score normalised to 0–100 (raw axis points ÷ axis max × 100). */
  score: number;
  /** Axis weight as a fraction of the whole (axis max ÷ 100). */
  weight: number;
  /** Raw axis points = score × weight. The five contributions sum to finalScore. */
  contribution: number;
}

export interface ReportQualityResult {
  /** 0–100, rounded to 2 decimals. Equals the sum of the five contributions. */
  finalScore: number;
  breakdown: {
    completeness: CriterionBreakdown;
    depth: CriterionBreakdown;
    attachments: CriterionBreakdown;
    metadata: CriterionBreakdown;
    structure: CriterionBreakdown;
  };
  formulaVersion: 'v2.5';
}

// ─── Helpers ─────────────────────────────────────────────────────────
function clamp01(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= 1 ? 1 : n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * v2.5 structured-content signal — graded, not boolean. Returns 0–1:
 *   - 60% from how many non-empty lines (ramped, full at 4)
 *   - 40% from how many DISTINCT formatting marker types appear
 *     (bullets / headings / bold — 0..3 types)
 * v2's `hasStructuredContent` was a hard true/false; this keeps the
 * same intent but lets a "half-formatted" report score in between.
 */
function structuredWritingRatio(text: string | null | undefined): number {
  if (!text) return 0;
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const lineComponent = clamp01(lines.length / STRUCT_LINES_FULL);

  const hasBullets =
    /(^|\n)\s*[•\-*]\s/.test(text) || /(^|\n)\s*\d+[.)]\s/.test(text);
  const hasHeadings = /(^|\n)\s*#+\s/.test(text);
  const hasBold = /\*\*[^*\n]+\*\*/.test(text);
  const markerTypes = (hasBullets ? 1 : 0) + (hasHeadings ? 1 : 0) + (hasBold ? 1 : 0);
  const markerComponent = markerTypes / 3;

  return STRUCT_LINES_SHARE * lineComponent + STRUCT_MARKERS_SHARE * markerComponent;
}

/**
 * Kept for backward compatibility — some call sites / tests import this.
 * Now derived from the graded ratio: "structured" means the report
 * cleared roughly half of the formatting signal.
 */
export function hasStructuredContent(text: string | null | undefined): boolean {
  return structuredWritingRatio(text) >= 0.5;
}

// ─── Per-axis continuous scorers (each returns RAW axis points) ───────

/** Axis 1 — completeness (max 30). */
function scoreCompleteness(report: ReportForQuality): number {
  const titleLen = report.title?.trim().length ?? 0;
  const achLen = report.achievements?.trim().length ?? 0;
  const hasTrack = !!report.trackId?.trim();
  const hasDate = !!report.reportDate;

  const titlePts = clamp01(titleLen / TITLE_FULL_LENGTH) * 10;
  const achPts = clamp01(achLen / ACH_PRESENT_FULL_LENGTH) * 10;
  // Track/date are structural booleans — there's no "partial" trackId —
  // so this sub-part stays binary, split 5+5.
  const structPts = (hasTrack ? 5 : 0) + (hasDate ? 5 : 0);

  return titlePts + achPts + structPts;
}

/** Axis 2 — content depth (max 25), concave curve on achievements length. */
function scoreDepth(report: ReportForQuality): number {
  const achLen = report.achievements?.trim().length ?? 0;
  const ratio = clamp01(achLen / DEPTH_FULL_LENGTH);
  return AXIS_MAX.depth * Math.pow(ratio, DEPTH_CURVE_EXPONENT);
}

/** Axis 3 — valid attachments (max 20) = count ramp (15) + bytes substance (5). */
function scoreAttachments(report: ReportForQuality): number {
  const valid = (report.attachments ?? []).filter(
    (a) => a.sizeBytes > MIN_ATTACHMENT_BYTES && VALID_MIME_TYPES.has(a.mimeType),
  );
  const countPts = ATTACH_COUNT_MAX * clamp01(valid.length / ATTACH_COUNT_FULL);
  const totalBytes = valid.reduce((sum, a) => sum + a.sizeBytes, 0);
  const bytesPts = ATTACH_BYTES_MAX * clamp01(totalBytes / ATTACH_BYTES_FULL);
  return countPts + bytesPts;
}

/** Axis 4 — structured metadata (max 15), partial credit per field on length. */
function scoreMetadata(report: ReportForQuality): number {
  const fieldPts = (v: string | null | undefined): number =>
    5 * clamp01((v?.trim().length ?? 0) / METADATA_FIELD_FULL_LENGTH);
  return (
    fieldPts(report.kpiUpdates) +
    fieldPts(report.upcomingTasks) +
    fieldPts(report.challenges)
  );
}

/** Axis 5 — structured writing (max 10), graded formatting signal. */
function scoreStructure(report: ReportForQuality): number {
  return AXIS_MAX.structure * structuredWritingRatio(report.achievements);
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Full v2.5 evaluation with the per-axis breakdown. Always v2.5 (the
 * breakdown shape doesn't exist in v2). Safe on partial/null fields.
 */
export function calculateReportQualityDetailed(
  report: ReportForQuality,
): ReportQualityResult {
  const rawCompleteness = scoreCompleteness(report);
  const rawDepth = scoreDepth(report);
  const rawAttachments = scoreAttachments(report);
  const rawMetadata = scoreMetadata(report);
  const rawStructure = scoreStructure(report);

  // `score` (0–100) is the canonical, rounded per-axis number.
  // `contribution` is derived FROM the rounded score (not the raw value)
  // so the invariant `contribution === round2(score × weight)` holds
  // exactly — the tooltip can show `score` and the math still adds up.
  const axis = (raw: number, max: number): CriterionBreakdown => {
    const clampedRaw = Math.max(0, Math.min(raw, max));
    const score = round2((clampedRaw / max) * 100);
    const weight = max / 100;
    return { score, weight, contribution: round2(score * weight) };
  };

  const breakdown = {
    completeness: axis(rawCompleteness, AXIS_MAX.completeness),
    depth: axis(rawDepth, AXIS_MAX.depth),
    attachments: axis(rawAttachments, AXIS_MAX.attachments),
    metadata: axis(rawMetadata, AXIS_MAX.metadata),
    structure: axis(rawStructure, AXIS_MAX.structure),
  };

  const finalScore = round2(
    breakdown.completeness.contribution +
      breakdown.depth.contribution +
      breakdown.attachments.contribution +
      breakdown.metadata.contribution +
      breakdown.structure.contribution,
  );

  return { finalScore, breakdown, formulaVersion: 'v2.5' };
}

/**
 * Returns 0–100. Backward-compatible signature (number in → number out)
 * so every existing caller — track-quality aggregator, best-employee
 * calculator, the data-entry-performers ranking — keeps working untouched.
 *
 * Honours `USE_QUALITY_V25`: anything other than the literal string
 * "false" keeps v2.5 (the default). Set `USE_QUALITY_V25=false` for an
 * instant rollback to the frozen v2 tiers.
 */
export function calculateReportQuality(report: ReportForQuality): number {
  if (process.env.USE_QUALITY_V25 === 'false') {
    return calculateReportQualityV2(report);
  }
  return calculateReportQualityDetailed(report).finalScore;
}

// ─── Quality buckets (display-only — unchanged from v2) ───────────────
/**
 * Bucket thresholds for histogram/distribution display. These are a
 * LABELLING layer on top of the continuous score — they never feed
 * back into it. Kept identical to v2 so the UI's distribution counts
 * stay comparable across the rollout.
 */
export const QUALITY_BUCKETS = {
  EXCELLENT: 85,
  GOOD: 70,
  FAIR: 50,
  POOR: MIN_QUALITY_THRESHOLD, // 30
} as const;

export type QualityBucket = 'excellent' | 'good' | 'fair' | 'poor' | 'dropped';

/** Bucket a single quality score for histogram/distribution display. */
export function bucketOf(quality: number): QualityBucket {
  if (quality >= QUALITY_BUCKETS.EXCELLENT) return 'excellent';
  if (quality >= QUALITY_BUCKETS.GOOD) return 'good';
  if (quality >= QUALITY_BUCKETS.FAIR) return 'fair';
  if (quality >= QUALITY_BUCKETS.POOR) return 'poor';
  return 'dropped';
}
