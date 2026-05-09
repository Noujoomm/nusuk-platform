/**
 * Track-name → rubric resolver.
 *
 * The API receives a Prisma `trackId` (CUID), not a rubric key, so the
 * service looks up the track row, hands its `nameAr` to `resolveRubric`,
 * and gets back the appropriate rubric. Names use a fuzzy match on the
 * stable Arabic root word so seasonal label tweaks (e.g. "مسار الطباعة"
 * vs "الطباعة") all resolve to the same rubric.
 *
 * If a track doesn't match anything, `resolveRubric` returns a generic
 * fallback rather than throwing — the user is still in the middle of
 * writing a report and we don't want to fail their click on a config
 * issue. The fallback is intentionally less opinionated than a real
 * track rubric so it doesn't push the writer's voice in a wrong
 * direction.
 */

import type { TrackRubric } from './rubric.interface';
import { camerasNawariyaRubric } from './cameras-nawariya.rubric';
import { companyRelationsRubric } from './company-relations.rubric';
import { consultingRubric } from './consulting.rubric';
import { distributionRubric } from './distribution.rubric';
import { printingRubric } from './printing.rubric';
import { trainingRubric } from './training.rubric';
import { userEmpowermentRubric } from './user-empowerment.rubric';

export const ALL_RUBRICS: readonly TrackRubric[] = Object.freeze([
  printingRubric,
  distributionRubric,
  camerasNawariyaRubric,
  trainingRubric,
  companyRelationsRubric,
  consultingRubric,
  userEmpowermentRubric,
]);

export const FALLBACK_RUBRIC: TrackRubric = {
  key: 'consulting', // structurally closest neutral choice
  trackName: 'مسار غير محدد',
  trackDescription:
    'مسار عام في منصة رؤية لمشروع بطاقة نُسك. التقرير عن نشاط تشغيلي أو إداري يومي/أسبوعي/شهري.',
  domainGlossary: ['بطاقة نُسك', 'منصة رؤية', 'موسم الحج', 'موسم العمرة'],
  toneGuidelines:
    'نبرة رسمية واضحة، موضوعية، مع الحفاظ التام على الأرقام والأسماء والتواريخ كما وردت.',
  commonStructurePatterns: [
    'الإنجازات',
    'التحديات',
    'الدعم المطلوب',
    'الخطوات القادمة',
  ],
};

/**
 * Maps a track's Arabic name (e.g. "مسار الطباعة") to a rubric. Uses a
 * substring match against each rubric's `trackName` after normalising
 * Arabic prefixes — robust to small label changes without spelling out
 * every possible variant.
 */
export function resolveRubric(trackNameAr: string | null | undefined): TrackRubric {
  if (!trackNameAr) return FALLBACK_RUBRIC;
  const needle = normalise(trackNameAr);
  for (const r of ALL_RUBRICS) {
    if (normalise(r.trackName).includes(needle) || needle.includes(normalise(r.trackName))) {
      return r;
    }
  }
  // Second pass: try matching the rubric key against well-known root words.
  // (Future-proofs against renaming, e.g. if "كاميرات نوارية" gets shortened.)
  if (needle.includes('طباع')) return printingRubric;
  if (needle.includes('توزيع')) return distributionRubric;
  if (needle.includes('كاميرا') || needle.includes('نواري')) return camerasNawariyaRubric;
  if (needle.includes('تدريب')) return trainingRubric;
  if (needle.includes('علاقات') || needle.includes('شركات')) return companyRelationsRubric;
  if (needle.includes('استشار')) return consultingRubric;
  if (needle.includes('تمكين') || needle.includes('مستخدم')) return userEmpowermentRubric;
  return FALLBACK_RUBRIC;
}

function normalise(s: string): string {
  return s
    .replace(/^(مسار|ال)\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type { TrackRubric, TrackRubricKey } from './rubric.interface';
