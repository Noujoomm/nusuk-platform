/**
 * Pure formatter for the official Arabic absence letter.
 *
 * NO Prisma, NO DI — every function here is deterministic and unit-tested
 * against the spec's six canonical cases. The DB-touching wrapper lives in
 * services/letter-generator.service.ts.
 */

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export const DEFAULT_RECIPIENT = 'الدكتور/ حسام فقيها';

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export interface AbsenceEntry {
  employeeId: string;
  fullName: string;
  shortName?: string;
  track: string;
  absenceDates: Date[];
}

/** A partial-attendance entry: came and left but worked < 8h. */
export interface PartialEntry {
  employeeId: string;
  fullName: string;
  shortName?: string;
  track: string;
  /** Decimal hours, e.g. 6.5. Always non-null in v2 letters. */
  hoursWorked: number;
}

/** A missing-checkout entry: checked in but never checked out. */
export interface MissingCheckoutEntry {
  employeeId: string;
  fullName: string;
  shortName?: string;
  track: string;
}

export interface LetterContext {
  recipientName: string;
  reportType: 'daily' | 'range';
  reportDate?: Date;
  rangeStart?: Date;
  rangeEnd?: Date;
  /** Category 1 — fully absent. Required (range letter still uses only
   *  this). For daily letters in v2 it represents `status='absent'`. */
  absences: AbsenceEntry[];
  /** Category 2 — partial attendance (worked but < 8h). Optional: when
   *  omitted (range letter, callers that haven't migrated), the letter
   *  falls back to the single-category v1 layout. */
  partial?: PartialEntry[];
  /** Category 3 — missed checkout. Same optionality rules as `partial`. */
  missingCheckout?: MissingCheckoutEntry[];
  noteAboutLastDay?: boolean;
}

export interface GeneratedLetter {
  text: string;
  html: string;
  metadata: {
    generatedAt: string; // ISO
    totalAbsences: number;
    uniqueEmployees: number;
    period: string;
    /** Populated only on v2 (3-category) letters; null on legacy. */
    categoryCounts?: {
      absent: number;
      partial: number;
      missingCheckout: number;
    };
  };
}

// ─── Public API ────────────────────────────────────────────────────────

export function buildLetter(ctx: LetterContext): GeneratedLetter {
  // V2 layout (3 sections + on-call note) kicks in when the caller passes
  // EITHER category-2 or category-3. The range letter and any legacy
  // caller that supplies only `absences` keeps the original single-section
  // layout — that's the backward-compatibility hinge.
  const isThreeCategory = ctx.partial !== undefined || ctx.missingCheckout !== undefined;

  const lines: string[] = [];
  lines.push('السلام عليكم ورحمة الله وبركاته،');
  lines.push('');
  lines.push(`سعادة ${ctx.recipientName}،`);
  lines.push('تحية طيبة وبعد،');
  lines.push('');

  if (isThreeCategory) {
    buildThreeCategoryBody(ctx, lines);
  } else {
    buildLegacyBody(ctx, lines);
  }

  lines.push('');
  lines.push('وتفضلوا بقبول فائق التحية والتقدير.');

  const text = lines.join('\n');
  const html = lines
    .map((l) => (l === '' ? '<p class="h-3"></p>' : `<p>${escapeHtml(l)}</p>`))
    .join('');

  return {
    text,
    html,
    metadata: buildMetadata(ctx, isThreeCategory),
  };
}

// ─── Body builders (one per layout) ─────────────────────────────────────

function buildLegacyBody(ctx: LetterContext, lines: string[]): void {
  if (ctx.absences.length === 0) {
    lines.push(
      `نفيد سعادتكم بأنه تم مراجعة كشف الحضور والانصراف لجميع المسارات، ولم يتم تسجيل أي حالات غياب${formatPeriodPhrase(ctx)}.`,
    );
    return;
  }
  lines.push(
    'نفيد سعادتكم بأنه تم مراجعة كشف الحضور والانصراف لجميع المسارات، حيث تم تسجيل غياب على النحو التالي:',
  );
  lines.push('');
  for (const a of ctx.absences) lines.push(formatAbsenceLine(a));
  if (ctx.reportType === 'range' && ctx.noteAboutLastDay && ctx.rangeEnd) {
    lines.push('');
    lines.push(
      `كما نود الإشارة إلى أنه لا توجد أي حالات غياب بتاريخ ${formatArabicDate(ctx.rangeEnd, false)}.`,
    );
  }
}

function buildThreeCategoryBody(ctx: LetterContext, lines: string[]): void {
  const absent = ctx.absences;
  const partial = ctx.partial ?? [];
  const missing = ctx.missingCheckout ?? [];

  lines.push(
    `نرفع لسعادتكم تقرير الموظفين المتغيبين والمتأخرين عن الدوام${formatPeriodPhrase(ctx)}، علماً بأن موظفي On Call غير مشمولين في هذا التقرير.`,
  );
  lines.push('');

  lines.push('أولاً: الموظفون الغائبون كلياً');
  if (absent.length === 0) {
    lines.push('لا يوجد');
  } else {
    absent.forEach((e, i) => lines.push(`${toArabicIndic(i + 1)}. ${displayName(e)}`));
  }
  lines.push('');

  lines.push('ثانياً: الدوام الجزئي (أقل من 8 ساعات)');
  if (partial.length === 0) {
    lines.push('لا يوجد');
  } else {
    partial.forEach((e, i) =>
      lines.push(`${toArabicIndic(i + 1)}. ${displayName(e)} — ${formatHoursWorked(e.hoursWorked)}`),
    );
  }
  lines.push('');

  lines.push('ثالثاً: البصمة الناقصة (دخول بدون خروج)');
  if (missing.length === 0) {
    lines.push('لا يوجد');
  } else {
    missing.forEach((e, i) => lines.push(`${toArabicIndic(i + 1)}. ${displayName(e)}`));
  }
}

function buildMetadata(
  ctx: LetterContext,
  isThreeCategory: boolean,
): GeneratedLetter['metadata'] {
  const absentCount = ctx.absences.length;
  const partialCount = ctx.partial?.length ?? 0;
  const missingCount = ctx.missingCheckout?.length ?? 0;
  const totalAbsences = isThreeCategory
    ? absentCount + partialCount + missingCount
    : ctx.absences.reduce((s, a) => s + a.absenceDates.length, 0);
  const uniqueEmployees = isThreeCategory
    ? absentCount + partialCount + missingCount
    : absentCount;

  const meta: GeneratedLetter['metadata'] = {
    generatedAt: new Date().toISOString(),
    totalAbsences,
    uniqueEmployees,
    period: describePeriod(ctx),
  };
  if (isThreeCategory) {
    meta.categoryCounts = {
      absent: absentCount,
      partial: partialCount,
      missingCheckout: missingCount,
    };
  }
  return meta;
}

// ─── Display helpers ───────────────────────────────────────────────────

function displayName(e: { fullName: string; shortName?: string; track: string }): string {
  const base = e.shortName || e.fullName;
  return e.track ? `${base} (${e.track})` : base;
}

// ─── Pure helpers (exported for testing) ───────────────────────────────

/**
 * Renders one employee's absence line. Auto-picks the form:
 *  - 1 date     → "{name} ({track})، بتاريخ {DD MONTH YYYY}."
 *  - continuous → "{name} ({track})، وذلك خلال الفترة من {DD MONTH} وحتى {DD MONTH}."
 *  - 2 separate → "{name} ({track})، بتاريخَي {DD MONTH} و{DD MONTH}."
 *  - 3+ separate→ "{name} ({track})، بتواريخ: {…}، {…}، و{…}."
 *
 * The track in parentheses is appended only when present; missing track keeps
 * the line clean ("{name}، بتاريخ …").
 */
export function formatAbsenceLine(absence: AbsenceEntry): string {
  const baseName = absence.shortName || absence.fullName;
  const name = absence.track ? `${baseName} (${absence.track})` : baseName;
  const sorted = [...absence.absenceDates].sort((a, b) => a.getTime() - b.getTime());

  if (sorted.length === 1) {
    return `${name}، بتاريخ ${formatArabicDate(sorted[0], true)}.`;
  }
  if (areDatesContinuous(sorted)) {
    const start = formatArabicDate(sorted[0], false);
    const end = formatArabicDate(sorted[sorted.length - 1], false);
    return `${name}، وذلك خلال الفترة من ${start} وحتى ${end}.`;
  }
  const formatted = sorted.map((d) => formatArabicDate(d, false));
  if (formatted.length === 2) {
    return `${name}، بتاريخَي ${formatted[0]} و${formatted[1]}.`;
  }
  const last = formatted.pop()!;
  return `${name}، بتواريخ: ${formatted.join('، ')}، و${last}.`;
}

/**
 * Format a Date as Arabic. Uses UTC getters because our `reportDate` columns
 * are `@db.Date` (date-only) — Prisma returns them as UTC-midnight Date
 * objects, and using local getters would shift them by the server's timezone
 * offset (Riyadh is +3, so 2026-04-24 UTC could become April 23 in some TZs).
 */
export function formatArabicDate(date: Date, withYear: boolean): string {
  const day = date.getUTCDate();
  const month = ARABIC_MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return withYear ? `${day} ${month} ${year}` : `${day} ${month}`;
}

/** Are the dates exactly one calendar day apart, in order? */
export function areDatesContinuous(dates: Date[]): boolean {
  if (dates.length < 2) return true;
  const ONE_DAY = 24 * 60 * 60 * 1000;
  for (let i = 1; i < dates.length; i++) {
    const diff = dates[i].getTime() - dates[i - 1].getTime();
    // Round to nearest day in case of DST or stored-time noise.
    if (Math.round(diff / ONE_DAY) !== 1) return false;
  }
  return true;
}

/**
 * "فراس زهير فقيها" → "فراس فقيها"
 * "م. حامد الصايغ"   → "حامد الصايغ"
 * "محمد المالكي"     → "محمد المالكي"  (already 2 tokens, kept)
 * Strips honorifics first, then takes first + last token.
 */
export function deriveShortName(fullName: string): string {
  const stripped = fullName
    .replace(/^(م\.|د\.|أ\.|أ\.د\.|الدكتور|المهندس|الأستاذ|الدكتوره|المهندسه|الأستاذه)\s*/g, '')
    .trim();
  const parts = stripped.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(' ');
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

// ─── Internal helpers ──────────────────────────────────────────────────

function formatPeriodPhrase(ctx: LetterContext): string {
  if (ctx.reportType === 'daily' && ctx.reportDate) {
    return ` بتاريخ ${formatArabicDate(ctx.reportDate, true)}`;
  }
  if (ctx.reportType === 'range' && ctx.rangeStart && ctx.rangeEnd) {
    return ` خلال الفترة من ${formatArabicDate(ctx.rangeStart, false)} وحتى ${formatArabicDate(ctx.rangeEnd, true)}`;
  }
  return '';
}

function describePeriod(ctx: LetterContext): string {
  if (ctx.reportType === 'daily' && ctx.reportDate) {
    return formatArabicDate(ctx.reportDate, true);
  }
  if (ctx.rangeStart && ctx.rangeEnd) {
    return `${formatArabicDate(ctx.rangeStart, false)} - ${formatArabicDate(ctx.rangeEnd, true)}`;
  }
  return '';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── V2 (3-category) helpers ───────────────────────────────────────────

/**
 * Converts any digits in a string (or a number) to Arabic-Indic
 * (٠-٩). Non-digit characters pass through unchanged, so "6.5"
 * → "٦.٥" and ordering markers / Arabic text stay intact.
 *
 * Exported for the spec; used internally for list numbering and hours.
 */
export function toArabicIndic(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]);
}

/**
 * "6.5 ساعات" — Arabic-Indic digits, one decimal place, plural rules.
 *
 * In real partial-attendance data the value is always in (0, 8), so the
 * sub-2 / exactly-2 branches rarely fire — but the spec includes both
 * edge cases and they're cheap to handle.
 */
export function formatHoursWorked(h: number): string {
  // Round to 1 decimal so 6.499999 → 6.5 (Prisma Float arithmetic).
  const rounded = Math.round(h * 10) / 10;
  // Use `.toFixed(1)` only when there IS a non-zero decimal — "6.0
  // ساعات" reads worse than "6 ساعات".
  const numStr =
    rounded === Math.trunc(rounded) ? String(Math.trunc(rounded)) : rounded.toFixed(1);
  return `${toArabicIndic(numStr)} ${pluralizeHours(rounded)}`;
}

/**
 * Arabic plural rules for hours (ساعة). Covers the three cases that
 * actually appear in partial-attendance data:
 *   - h < 2        → singular "ساعة"
 *   - h === 2 exact→ dual "ساعتان"
 *   - h > 2        → plural "ساعات"
 * 11+ uses singular again in MSA, but partial-attendance hours are
 * always < 8, so we don't bother with that branch.
 */
export function pluralizeHours(h: number): string {
  if (h === 2) return 'ساعتان';
  if (h < 2) return 'ساعة';
  return 'ساعات';
}
