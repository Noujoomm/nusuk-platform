/**
 * v2.5 suite — the continuous-gradient calculator.
 *
 * Most assertions are PROPERTY-based, not magic-number based: the whole
 * point of v2.5 is that scores form a smooth continuum, so pinning exact
 * decimals would be brittle and would obscure the property we actually
 * care about (continuity, determinism, no hidden multipliers, 0..100,
 * 100-achievable). The two exact anchors that DO matter — empty → 0 and
 * perfect → 100 — are asserted exactly.
 */

import {
  MIN_QUALITY_THRESHOLD,
  QUALITY_BUCKETS,
  ReportForQuality,
  bucketOf,
  calculateReportQuality,
  calculateReportQualityDetailed,
  hasStructuredContent,
} from './report-quality.calculator';
import { calculateReportQualityV2 } from './report-quality.calculator.v2';

const empty: ReportForQuality = {
  title: null,
  trackId: null,
  reportDate: null,
  achievements: null,
  kpiUpdates: null,
  challenges: null,
  notes: null,
  upcomingTasks: null,
  attachments: [],
};

const baseFilled = (over: Partial<ReportForQuality> = {}): ReportForQuality => ({
  ...empty,
  title: 'Daily Track Report',
  trackId: 'track_1',
  reportDate: new Date('2026-05-05'),
  achievements: 'a'.repeat(60),
  ...over,
});

const validPdf = (bytes = 60_000) => ({ sizeBytes: bytes, mimeType: 'application/pdf' });

/** A genuinely perfect report — every axis maxed. */
const perfectReport: ReportForQuality = {
  title: 'Comprehensive Daily Track Report',
  trackId: 'track_1',
  reportDate: new Date('2026-05-05'),
  achievements:
    '## أبرز ما تحقق\n' +
    '- أنجزنا تسليم الدفعة الأولى\n' +
    '- أغلقنا ثلاث ملاحظات جودة\n' +
    '- **تدريب** فريقين ميدانيين\n' +
    'x'.repeat(520),
  kpiUpdates: 'تحديث مؤشرات الأداء: الإنجاز 82٪ مقابل مستهدف 80٪ لهذا الأسبوع.',
  upcomingTasks: 'خطة الأسبوع القادم: توسعة نقطتي توزيع جديدتين ومراجعة المخزون.',
  challenges: 'التحدي الرئيسي: تأخر مورد التغليف، وجارٍ التنسيق مع بديل معتمد.',
  notes: 'ملاحظات إضافية',
  attachments: [validPdf(400_000), validPdf(400_000), validPdf(400_000)],
};

describe('calculateReportQualityDetailed (v2.5)', () => {
  describe('exact anchors', () => {
    it('empty report → 0', () => {
      expect(calculateReportQualityDetailed(empty).finalScore).toBe(0);
    });

    it('genuinely perfect report → exactly 100 (the ceiling is reachable)', () => {
      expect(calculateReportQualityDetailed(perfectReport).finalScore).toBe(100);
    });

    it('does not throw on undefined input', () => {
      expect(calculateReportQualityDetailed({} as ReportForQuality).finalScore).toBe(0);
    });
  });

  describe('result shape + no hidden multipliers', () => {
    it('tags the formula version', () => {
      expect(calculateReportQualityDetailed(baseFilled()).formulaVersion).toBe('v2.5');
    });

    it('the five contributions sum exactly to finalScore', () => {
      const r = calculateReportQualityDetailed(
        baseFilled({
          achievements: 'a'.repeat(237),
          kpiUpdates: 'partial kpi text',
          attachments: [validPdf(123_456)],
        }),
      );
      const sum =
        r.breakdown.completeness.contribution +
        r.breakdown.depth.contribution +
        r.breakdown.attachments.contribution +
        r.breakdown.metadata.contribution +
        r.breakdown.structure.contribution;
      expect(r.finalScore).toBeCloseTo(sum, 2);
    });

    it('weights sum exactly to 1.0 (30/25/20/15/10)', () => {
      const b = calculateReportQualityDetailed(baseFilled()).breakdown;
      expect(b.completeness.weight).toBe(0.3);
      expect(b.depth.weight).toBe(0.25);
      expect(b.attachments.weight).toBe(0.2);
      expect(b.metadata.weight).toBe(0.15);
      expect(b.structure.weight).toBe(0.1);
      expect(
        b.completeness.weight +
          b.depth.weight +
          b.attachments.weight +
          b.metadata.weight +
          b.structure.weight,
      ).toBe(1.0);
    });

    it('each axis: contribution ≈ score × weight', () => {
      const b = calculateReportQualityDetailed(baseFilled({ kpiUpdates: 'kpi text here' })).breakdown;
      for (const axis of Object.values(b)) {
        expect(axis.contribution).toBeCloseTo(axis.score * axis.weight, 2);
      }
    });
  });

  describe('continuity — no fixed buckets', () => {
    it('produces a wide spread of distinct scores for varied inputs', () => {
      // 20 reports varying achievements length only — under v2 this would
      // collapse onto ~6 depth tiers; under v2.5 every length is distinct.
      const scores = Array.from({ length: 20 }, (_, i) =>
        calculateReportQualityDetailed(baseFilled({ achievements: 'a'.repeat(40 + i * 23) }))
          .finalScore,
      );
      expect(new Set(scores).size).toBeGreaterThan(15);
    });

    it('a 73%-filled report does not snap to a categorical value', () => {
      // achievements at 365/500 chars ≈ 73% of the depth runway
      const score = calculateReportQualityDetailed(
        baseFilled({ achievements: 'a'.repeat(365) }),
      ).finalScore;
      expect([0, 25, 50, 75, 100]).not.toContain(score);
    });

    it('depth rises monotonically with achievements length', () => {
      const at = (len: number) =>
        calculateReportQualityDetailed(baseFilled({ achievements: 'a'.repeat(len) })).breakdown
          .depth.score;
      expect(at(500)).toBeGreaterThan(at(300));
      expect(at(300)).toBeGreaterThan(at(150));
      expect(at(150)).toBeGreaterThan(at(60));
    });

    it('metadata gives partial credit on field length (not just presence)', () => {
      const short = calculateReportQualityDetailed(baseFilled({ kpiUpdates: 'kpi' })).breakdown
        .metadata.score;
      const long = calculateReportQualityDetailed(
        baseFilled({ kpiUpdates: 'a'.repeat(40) }),
      ).breakdown.metadata.score;
      expect(long).toBeGreaterThan(short);
      expect(short).toBeGreaterThan(0);
    });

    it('attachments: same count, larger bytes → higher score', () => {
      const small = calculateReportQualityDetailed(
        baseFilled({ attachments: [validPdf(15_000)] }),
      ).breakdown.attachments.score;
      const big = calculateReportQualityDetailed(
        baseFilled({ attachments: [validPdf(900_000)] }),
      ).breakdown.attachments.score;
      expect(big).toBeGreaterThan(small);
    });
  });

  describe('determinism — no AI, no randomness', () => {
    it('returns an identical score across 1000 invocations', () => {
      const r = baseFilled({
        achievements: 'a'.repeat(312),
        attachments: [validPdf(77_777)],
        challenges: 'some challenge text',
      });
      const scores = Array.from({ length: 1000 }, () => calculateReportQuality(r));
      expect(new Set(scores).size).toBe(1);
    });
  });

  describe('boundary conditions', () => {
    it('never returns a negative score', () => {
      expect(calculateReportQualityDetailed(empty).finalScore).toBeGreaterThanOrEqual(0);
    });

    it('never exceeds 100 even with oversized inputs', () => {
      const huge: ReportForQuality = {
        ...perfectReport,
        achievements: 'x'.repeat(50_000),
        attachments: Array.from({ length: 20 }, () => validPdf(5_000_000)),
      };
      expect(calculateReportQualityDetailed(huge).finalScore).toBeLessThanOrEqual(100);
    });

    it('every axis score stays within 0..100', () => {
      const b = calculateReportQualityDetailed(perfectReport).breakdown;
      for (const axis of Object.values(b)) {
        expect(axis.score).toBeGreaterThanOrEqual(0);
        expect(axis.score).toBeLessThanOrEqual(100);
      }
    });
  });
});

describe('calculateReportQuality — backward-compatible entry point', () => {
  it('returns a bare number equal to detailed.finalScore (v2.5 default)', () => {
    const r = baseFilled({ achievements: 'a'.repeat(280), kpiUpdates: 'kpi' });
    expect(calculateReportQuality(r)).toBe(calculateReportQualityDetailed(r).finalScore);
  });

  describe('USE_QUALITY_V25 feature flag', () => {
    const original = process.env.USE_QUALITY_V25;
    afterEach(() => {
      if (original === undefined) delete process.env.USE_QUALITY_V25;
      else process.env.USE_QUALITY_V25 = original;
    });

    it('falls back to frozen v2 when USE_QUALITY_V25=false', () => {
      process.env.USE_QUALITY_V25 = 'false';
      const r = baseFilled({ achievements: 'a'.repeat(300), attachments: [validPdf()] });
      expect(calculateReportQuality(r)).toBe(calculateReportQualityV2(r));
    });

    it('uses v2.5 for any other flag value (including unset)', () => {
      delete process.env.USE_QUALITY_V25;
      const r = baseFilled({ achievements: 'a'.repeat(300), attachments: [validPdf()] });
      expect(calculateReportQuality(r)).toBe(calculateReportQualityDetailed(r).finalScore);
    });
  });
});

describe('hasStructuredContent (v2.5 — derived from the graded ratio)', () => {
  it('false for empty / unstructured short text', () => {
    expect(hasStructuredContent(null)).toBe(false);
    expect(hasStructuredContent('')).toBe(false);
    expect(hasStructuredContent('one\ntwo')).toBe(false);
  });

  it('true for clearly structured text (multi-line + markers)', () => {
    expect(hasStructuredContent('- one\n- two\n- three\n- four')).toBe(true);
    expect(hasStructuredContent('# A\nbody\n# B\nbody\n# C')).toBe(true);
  });
});

describe('bucketOf — display labels, unchanged from v2', () => {
  it.each([
    [100, 'excellent'],
    [85, 'excellent'],
    [84, 'good'],
    [70, 'good'],
    [69, 'fair'],
    [50, 'fair'],
    [49, 'poor'],
    [30, 'poor'],
    [29, 'dropped'],
    [0, 'dropped'],
  ])('quality %i → %s', (q, bucket) => {
    expect(bucketOf(q)).toBe(bucket);
  });
});

describe('thresholds — unchanged from v2', () => {
  it('MIN_QUALITY_THRESHOLD = 30', () => {
    expect(MIN_QUALITY_THRESHOLD).toBe(30);
  });
  it('bucket boundaries 85/70/50/30', () => {
    expect(QUALITY_BUCKETS.EXCELLENT).toBe(85);
    expect(QUALITY_BUCKETS.GOOD).toBe(70);
    expect(QUALITY_BUCKETS.FAIR).toBe(50);
    expect(QUALITY_BUCKETS.POOR).toBe(30);
  });
});
