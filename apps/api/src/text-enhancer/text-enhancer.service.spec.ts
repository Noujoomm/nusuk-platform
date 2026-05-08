/**
 * Tests focus on the two pure pieces of the service that don't touch
 * Anthropic or Prisma: the intervention-level decision and the rubric
 * resolver.
 *
 * The Anthropic call is the integration boundary — wired through env
 * config and tested by deploying. Putting a mock around it would
 * just test the mock.
 *
 * The @prisma/client virtual mock is needed because the service file
 * transitively imports PrismaService, and jest in this repo runs with
 * rootDir=src which doesn't resolve the workspace-hoisted client.
 * `decideInterventionLevel` is static so the test never actually
 * constructs the service.
 */

jest.mock(
  '@prisma/client',
  () => ({ PrismaClient: class {}, Prisma: {} }),
  { virtual: true },
);

import { TextEnhancerService } from './text-enhancer.service';
import { resolveRubric, FALLBACK_RUBRIC } from './rubrics';

describe('TextEnhancerService.decideInterventionLevel', () => {
  const decide = TextEnhancerService.decideInterventionLevel;

  it('picks "light" when the average is exactly the threshold (4.0)', () => {
    expect(
      decide({ language: 4, organization: 4, clarity: 4, professionalism: 4 }),
    ).toBe('light');
  });

  it('picks "light" when the average is above the threshold', () => {
    expect(
      decide({ language: 5, organization: 4, clarity: 4, professionalism: 5 }),
    ).toBe('light');
  });

  it('picks "medium" for an average just under 4.0', () => {
    // 3 + 4 + 4 + 4 = 15 / 4 = 3.75
    expect(
      decide({ language: 3, organization: 4, clarity: 4, professionalism: 4 }),
    ).toBe('medium');
  });

  it('picks "medium" at exactly the heavy threshold (2.5)', () => {
    // The cutoff is < 2.5 → heavy, so 2.5 itself is still medium.
    expect(
      decide({ language: 3, organization: 2, clarity: 3, professionalism: 2 }),
    ).toBe('medium');
  });

  it('picks "heavy" below the heavy threshold', () => {
    // 2 + 2 + 2 + 2 = 2.0
    expect(
      decide({ language: 2, organization: 2, clarity: 2, professionalism: 2 }),
    ).toBe('heavy');
  });

  it('picks "heavy" for very low scores', () => {
    expect(
      decide({ language: 1, organization: 1, clarity: 1, professionalism: 1 }),
    ).toBe('heavy');
  });
});

describe('resolveRubric', () => {
  it('returns the fallback rubric for a null/empty track name', () => {
    expect(resolveRubric(null)).toBe(FALLBACK_RUBRIC);
    expect(resolveRubric('')).toBe(FALLBACK_RUBRIC);
    expect(resolveRubric(undefined)).toBe(FALLBACK_RUBRIC);
  });

  it('matches each canonical track name to its own rubric', () => {
    expect(resolveRubric('مسار الطباعة').key).toBe('printing');
    expect(resolveRubric('مسار التوزيع').key).toBe('distribution');
    expect(resolveRubric('مسار الكاميرات النوارية').key).toBe('cameras-nawariya');
    expect(resolveRubric('مسار التدريب').key).toBe('training');
    expect(resolveRubric('مسار علاقات الشركات').key).toBe('company-relations');
    expect(resolveRubric('المسار الاستشاري').key).toBe('consulting');
    expect(resolveRubric('مسار تمكين المستخدمين').key).toBe('user-empowerment');
  });

  it('survives surface variation in the track name (no "مسار" prefix, partial words)', () => {
    expect(resolveRubric('الطباعة').key).toBe('printing');
    expect(resolveRubric('التوزيع الميداني').key).toBe('distribution');
    expect(resolveRubric('كاميرات').key).toBe('cameras-nawariya');
    expect(resolveRubric('التدريب الميداني').key).toBe('training');
    expect(resolveRubric('علاقات الشركات الحجاجية').key).toBe('company-relations');
    expect(resolveRubric('استشاري').key).toBe('consulting');
    expect(resolveRubric('تمكين المستخدم').key).toBe('user-empowerment');
  });

  it('falls back rather than throwing on unknown track names', () => {
    expect(resolveRubric('مسار غير موجود').key).toBe(FALLBACK_RUBRIC.key);
  });
});
