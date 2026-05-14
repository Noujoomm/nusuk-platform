/**
 * Report Quality Calculator — v2 (FROZEN REFERENCE / FALLBACK)
 * ────────────────────────────────────────────────────────────
 * This is the original discrete-tier scoring, preserved verbatim so the
 * `USE_QUALITY_V25` feature flag can fall back to it instantly, and so
 * the v2 unit tests keep a real implementation to assert against.
 *
 * DO NOT add features here. New work goes in `report-quality.calculator.ts`
 * (v2.5, continuous-gradient). This file only exists for rollback safety.
 *
 * Why v2 was replaced: every sub-score jumps between a handful of fixed
 * tiers, so averaging two reports lands on a tiny grid of possible
 * values — different tracks kept showing the *same* number (the
 * "stuck at 40.5% / 67.5%" report). v2.5 makes each axis a continuous
 * function of the same inputs. Axes, weights, and the 0–100 range are
 * identical between the two; only the within-axis curve changed.
 */

import type { ReportForQuality } from './report-quality.calculator';

const MIN_TITLE_LENGTH = 10;
const MIN_ACHIEVEMENTS_LENGTH = 50;
const MIN_ATTACHMENT_BYTES = 10_000;

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

/** v2 structured-content heuristic — kept identical to the original. */
export function hasStructuredContentV2(text: string | null | undefined): boolean {
  if (!text) return false;
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 3) return false;
  const hasBullets = /(^|\n)\s*[•\-*]\s/.test(text) || /(^|\n)\s*\d+[.)]\s/.test(text);
  const hasHeadings = /(^|\n)\s*#+\s/.test(text) || /\*\*[^*\n]+\*\*/.test(text);
  return hasBullets || hasHeadings;
}

/** v2 scoring — discrete tiers. Returns 0–100. */
export function calculateReportQualityV2(report: ReportForQuality): number {
  let score = 0;

  // 1. Required-field completeness (30)
  const title = report.title?.trim() ?? '';
  const achievements = report.achievements?.trim() ?? '';
  const hasTrack = !!report.trackId?.trim();
  const hasDate = !!report.reportDate;
  if (title.length >= MIN_TITLE_LENGTH) score += 10;
  if (achievements.length >= MIN_ACHIEVEMENTS_LENGTH) score += 10;
  if (hasTrack && hasDate) score += 10;

  // 2. Content depth (25, graduated on achievements length)
  const len = achievements.length;
  if (len >= 500) score += 25;
  else if (len >= 300) score += 20;
  else if (len >= 200) score += 15;
  else if (len >= 100) score += 10;
  else if (len >= 50) score += 5;

  // 3. Valid attachments (20, graduated count)
  const validAttachments = (report.attachments ?? []).filter(
    (a) => a.sizeBytes > MIN_ATTACHMENT_BYTES && VALID_MIME_TYPES.has(a.mimeType),
  ).length;
  if (validAttachments >= 3) score += 20;
  else if (validAttachments === 2) score += 15;
  else if (validAttachments === 1) score += 10;

  // 4. Structured metadata (15 = 5+5+5)
  if (report.kpiUpdates?.trim()) score += 5;
  if (report.upcomingTasks?.trim()) score += 5;
  if (report.challenges?.trim()) score += 5;

  // 5. Structured writing (10)
  if (hasStructuredContentV2(report.achievements)) score += 10;

  return Math.min(score, 100);
}
