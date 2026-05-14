/**
 * Tests for the TRACK-level aggregator. These intentionally do NOT
 * hard-code report-quality output numbers — that's `report-quality`'s
 * job to test. Here we derive each fixture's score via
 * `calculateReportQuality` at runtime and assert the aggregator's
 * invariants (average-not-sum, threshold filtering, distribution
 * bucketing) hold regardless of the underlying formula version.
 */

import {
  MIN_QUALITY_THRESHOLD,
  ReportForQuality,
  bucketOf,
  calculateReportQuality,
} from './report-quality.calculator';
import { calculateTrackQualityScore } from './track-quality.calculator';

const validPdf = (bytes = 400_000) => ({ sizeBytes: bytes, mimeType: 'application/pdf' });

/** A strong report — designed to land in the EXCELLENT bucket. */
const highReport: ReportForQuality = {
  title: 'Comprehensive Daily Track Report',
  trackId: 'track_1',
  reportDate: new Date('2026-05-05'),
  achievements:
    '## أبرز الإنجازات\n' +
    '- تسليم الدفعة الأولى بالكامل\n' +
    '- إغلاق ثلاث ملاحظات جودة\n' +
    '- **تدريب** فريقين ميدانيين\n' +
    'x'.repeat(520),
  kpiUpdates: 'تحديث مؤشرات الأداء: نسبة الإنجاز 82٪ مقابل مستهدف 80٪.',
  upcomingTasks: 'خطة الأسبوع القادم: توسعة نقطتي توزيع ومراجعة المخزون.',
  challenges: 'التحدي: تأخر مورد التغليف، وجارٍ التنسيق مع بديل معتمد.',
  notes: null,
  attachments: [validPdf(), validPdf(), validPdf()],
};

/** A middling report — clears the threshold but well below `highReport`. */
const midReport: ReportForQuality = {
  title: 'Daily Track Report',
  trackId: 'track_1',
  reportDate: new Date('2026-05-05'),
  achievements: 'a'.repeat(210),
  kpiUpdates: 'kpi snapshot for the week',
  upcomingTasks: null,
  challenges: null,
  notes: null,
  attachments: [validPdf(120_000)],
};

/** Empty — must fall below MIN_QUALITY_THRESHOLD and be dropped. */
const lowReport: ReportForQuality = {
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

// Derived once — the aggregator tests below reason in terms of these.
const H = calculateReportQuality(highReport);
const M = calculateReportQuality(midReport);
const L = calculateReportQuality(lowReport);

describe('fixture sanity (ordering the aggregator tests rely on)', () => {
  it('high > mid ≥ threshold > low', () => {
    expect(L).toBeLessThan(MIN_QUALITY_THRESHOLD);
    expect(M).toBeGreaterThanOrEqual(MIN_QUALITY_THRESHOLD);
    expect(H).toBeGreaterThan(M);
  });
});

describe('calculateTrackQualityScore', () => {
  describe('the central invariant: AVERAGE not SUM', () => {
    it('Track A (1 high report) BEATS Track B (10 mid reports)', () => {
      const a = calculateTrackQualityScore([highReport]);
      const b = calculateTrackQualityScore(Array(10).fill(midReport));
      expect(a.avgQuality).toBeCloseTo(H, 5);
      expect(b.avgQuality).toBeCloseTo(M, 5);
      expect(a.score).toBeGreaterThan(b.score);
    });

    it('adding more reports of the same quality does NOT change the score', () => {
      const one = calculateTrackQualityScore([highReport]);
      const five = calculateTrackQualityScore(Array(5).fill(highReport));
      expect(one.score).toBe(five.score);
    });

    it('mixing one weaker report into a strong batch lowers the average', () => {
      const allHigh = calculateTrackQualityScore([highReport, highReport]);
      const mixed = calculateTrackQualityScore([highReport, highReport, midReport]);
      expect(mixed.avgQuality).toBeLessThan(allHigh.avgQuality);
      expect(mixed.avgQuality).toBeCloseTo((H + H + M) / 3, 5);
    });
  });

  describe('zero-score conditions', () => {
    it('NO_REPORTS_SUBMITTED when reports array is empty', () => {
      const r = calculateTrackQualityScore([]);
      expect(r.score).toBe(0);
      expect(r.reason).toBe('NO_REPORTS_SUBMITTED');
      expect(r.reportsCount).toBe(0);
    });

    it('ALL_REPORTS_LOW_QUALITY when every report is below the threshold', () => {
      const r = calculateTrackQualityScore([lowReport, lowReport]);
      expect(r.score).toBe(0);
      expect(r.reason).toBe('ALL_REPORTS_LOW_QUALITY');
      expect(r.reportsCount).toBe(2);
      expect(r.droppedReportsCount).toBe(2);
      expect(r.validReportsCount).toBe(0);
    });

    it('reason is null when score > 0', () => {
      expect(calculateTrackQualityScore([highReport]).reason).toBeNull();
    });
  });

  describe('threshold filtering', () => {
    it('drops below-threshold reports from the average but counts them in reportsCount', () => {
      const r = calculateTrackQualityScore([highReport, lowReport]);
      expect(r.reportsCount).toBe(2);
      expect(r.validReportsCount).toBe(1);
      expect(r.droppedReportsCount).toBe(1);
      expect(r.avgQuality).toBeCloseTo(H, 5); // dropped report is NOT averaged in
    });
  });

  describe('quality distribution (histogram)', () => {
    it('bucketizes valid reports by their actual score', () => {
      const r = calculateTrackQualityScore([highReport, highReport, midReport]);
      // Derive the expected histogram from the fixtures' real buckets so
      // the test stays correct across formula versions.
      const expected = { excellent: 0, good: 0, fair: 0, poor: 0 };
      for (const score of [H, H, M]) {
        const b = bucketOf(score);
        if (b !== 'dropped') expected[b] += 1;
      }
      expect(r.qualityDistribution).toEqual(expected);
    });

    it('all-zero distribution when no valid reports', () => {
      expect(calculateTrackQualityScore([]).qualityDistribution).toEqual({
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
      });
    });
  });

  describe('numeric correctness', () => {
    it('score equals avgQuality (the schema field is a duplicate for clarity)', () => {
      const r = calculateTrackQualityScore([highReport, midReport]);
      expect(r.score).toBe(r.avgQuality);
    });
  });
});
