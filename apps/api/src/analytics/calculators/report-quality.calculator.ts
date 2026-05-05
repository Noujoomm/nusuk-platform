/**
 * Report Quality Calculator (Phase 1 — Quality-First)
 *
 * Pure, deterministic, no I/O. Given the same input it always returns the
 * same number — every branch is unit-tested.
 *
 * Philosophy: ONE excellent report beats TEN mediocre ones.
 *   - This file scores ONE report from 0–100.
 *   - The track-level aggregator (track-quality.calculator.ts) takes the
 *     AVERAGE of qualifying reports — not the sum.
 *
 * The 100 points are split as follows, mapped to Roya's actual `Report`
 * model fields (no spec field invented):
 *
 *   1. Required-field completeness  (30 = 10+10+10)
 *      - 10 if `title` is set and ≥10 chars (rules out one-word titles)
 *      - 10 if `achievements` (≈ description) is ≥50 chars
 *      - 10 if `trackId` and `reportDate` are both present
 *
 *   2. Content depth                (25, graduated)
 *      Length of the achievements field (the main narrative):
 *        ≥500 → 25, ≥300 → 20, ≥200 → 15, ≥100 → 10, ≥50 → 5, else 0
 *
 *   3. Valid attachments            (20, graduated)
 *      Count of attachments >10 KB with a recognized mime type:
 *        ≥3 → 20, 2 → 15, 1 → 10, 0 → 0
 *
 *   4. Structured metadata          (15 = 5+5+5)
 *      Each filled (non-empty after trim) earns 5:
 *        - `kpiUpdates`     (KPI snapshot present)
 *        - `upcomingTasks`  (forward plan present)
 *        - `challenges`     (transparent about issues)
 *
 *   5. Structured writing           (10)
 *      The achievements text shows formatting effort: 3+ non-empty lines
 *      AND (bullets OR headings). Single-paragraph reports get 0 here.
 *
 * Reports below {@link MIN_QUALITY_THRESHOLD} are filtered out at the
 * track level — they don't pull the average down (and don't count
 * toward the validReportsCount). That's the anti-gaming guarantee.
 */

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

const MIN_TITLE_LENGTH = 10;
const MIN_ACHIEVEMENTS_LENGTH = 50;
const MIN_ATTACHMENT_BYTES = 10_000;

/** Recognized document/image mimes. Tiny files still must clear MIN_ATTACHMENT_BYTES. */
const VALID_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',     // xlsx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'text/csv',
  'text/plain',
  'application/zip',
]);

/** Reports below this score are dropped from track-level aggregation. */
export const MIN_QUALITY_THRESHOLD = 30;

/**
 * Detect light formatting in the narrative text. Mirrors the spec's
 * `hasStructuredContent` — at least three non-empty lines AND either
 * bullets or markdown-style headings/bold. Returns true only when both
 * conditions hold.
 */
export function hasStructuredContent(text: string | null | undefined): boolean {
  if (!text) return false;
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 3) return false;
  const hasBullets = /(^|\n)\s*[•\-*]\s/.test(text) || /(^|\n)\s*\d+[.)]\s/.test(text);
  const hasHeadings = /(^|\n)\s*#+\s/.test(text) || /\*\*[^*\n]+\*\*/.test(text);
  return hasBullets || hasHeadings;
}

/** Returns 0–100. Safe on partial / null fields — never throws. */
export function calculateReportQuality(report: ReportForQuality): number {
  let score = 0;

  // ─── 1. Required-field completeness (30) ─────────────────────────────
  const title = report.title?.trim() ?? '';
  const achievements = report.achievements?.trim() ?? '';
  const hasTrack = !!report.trackId?.trim();
  const hasDate = !!report.reportDate;

  if (title.length >= MIN_TITLE_LENGTH) score += 10;
  if (achievements.length >= MIN_ACHIEVEMENTS_LENGTH) score += 10;
  if (hasTrack && hasDate) score += 10;

  // ─── 2. Content depth (25, graduated on achievements length) ─────────
  const len = achievements.length;
  if (len >= 500) score += 25;
  else if (len >= 300) score += 20;
  else if (len >= 200) score += 15;
  else if (len >= 100) score += 10;
  else if (len >= 50) score += 5;

  // ─── 3. Valid attachments (20, graduated count) ──────────────────────
  const validAttachments = (report.attachments ?? []).filter(
    (a) => a.sizeBytes > MIN_ATTACHMENT_BYTES && VALID_MIME_TYPES.has(a.mimeType),
  ).length;
  if (validAttachments >= 3) score += 20;
  else if (validAttachments === 2) score += 15;
  else if (validAttachments === 1) score += 10;

  // ─── 4. Structured metadata (15 = 5+5+5) ─────────────────────────────
  if (report.kpiUpdates?.trim()) score += 5;
  if (report.upcomingTasks?.trim()) score += 5;
  if (report.challenges?.trim()) score += 5;

  // ─── 5. Structured writing (10) ──────────────────────────────────────
  if (hasStructuredContent(report.achievements)) score += 10;

  return Math.min(score, 100);
}

/** Quality bucket thresholds — reused by aggregator + UI. */
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
