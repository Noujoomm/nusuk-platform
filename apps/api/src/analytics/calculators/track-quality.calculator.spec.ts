import { ReportForQuality } from './report-quality.calculator';
import { calculateTrackQualityScore } from './track-quality.calculator';

const validPdf = { sizeBytes: 100_000, mimeType: 'application/pdf' };

const reportAt = (qualityTarget: 95 | 60 | 0): ReportForQuality => {
  if (qualityTarget === 95) {
    // 30 (required) + 25 (depth ≥500) + 20 (3 attachments) + 15 (metadata) + 10 (structure) = 100
    // Limit to 95 by trimming one metadata field.
    return {
      title: 'Comprehensive Daily Report',
      trackId: 'track_1',
      reportDate: new Date('2026-05-05'),
      achievements: '- one\n- two\n- three\n' + 'x'.repeat(500),
      kpiUpdates: 'kpi',
      upcomingTasks: 'plan',
      challenges: null, // skip 5 to land at 95
      notes: null,
      attachments: [validPdf, validPdf, validPdf],
    };
  }
  if (qualityTarget === 60) {
    // ~60: 30 (required) + 15 (depth 200-299) + 10 (1 attachment) + 0 metadata + 0 structure = 55
    // Add metadata 5 to land at 60.
    return {
      title: 'Daily Track Report',
      trackId: 'track_1',
      reportDate: new Date('2026-05-05'),
      achievements: 'a'.repeat(200),
      kpiUpdates: 'kpi',
      upcomingTasks: null,
      challenges: null,
      notes: null,
      attachments: [validPdf],
    };
  }
  // qualityTarget 0
  return {
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
};

describe('calculateTrackQualityScore', () => {
  describe('the central invariant: AVERAGE not SUM', () => {
    it('Track A (1 report @ 95) BEATS Track B (10 reports @ 60)', () => {
      const a = calculateTrackQualityScore([reportAt(95)]);
      const b = calculateTrackQualityScore(Array(10).fill(reportAt(60)));

      // Sanity: per-report quality is what we expect
      expect(a.avgQuality).toBe(95);
      expect(b.avgQuality).toBe(60);

      // The headline assertion
      expect(a.score).toBeGreaterThan(b.score);
      expect(a.score).toBe(95);
      expect(b.score).toBe(60);
    });

    it('adding more reports of the same quality does NOT change the score', () => {
      const oneReport = calculateTrackQualityScore([reportAt(95)]);
      const fiveReports = calculateTrackQualityScore(Array(5).fill(reportAt(95)));
      expect(oneReport.score).toBe(fiveReports.score);
    });

    it('mixing one bad report into a high-quality batch lowers the average', () => {
      const allHigh = calculateTrackQualityScore([reportAt(95), reportAt(95)]);
      const mixed = calculateTrackQualityScore([reportAt(95), reportAt(95), reportAt(60)]);
      expect(mixed.avgQuality).toBeLessThan(allHigh.avgQuality);
      expect(mixed.avgQuality).toBeCloseTo((95 + 95 + 60) / 3);
    });
  });

  describe('zero-score conditions', () => {
    it('NO_REPORTS_SUBMITTED when reports array is empty', () => {
      const r = calculateTrackQualityScore([]);
      expect(r.score).toBe(0);
      expect(r.reason).toBe('NO_REPORTS_SUBMITTED');
      expect(r.reportsCount).toBe(0);
    });

    it('ALL_REPORTS_LOW_QUALITY when every report falls below MIN_QUALITY_THRESHOLD', () => {
      const r = calculateTrackQualityScore([reportAt(0), reportAt(0)]);
      expect(r.score).toBe(0);
      expect(r.reason).toBe('ALL_REPORTS_LOW_QUALITY');
      expect(r.reportsCount).toBe(2);
      expect(r.droppedReportsCount).toBe(2);
      expect(r.validReportsCount).toBe(0);
    });

    it('reason is null when score > 0', () => {
      const r = calculateTrackQualityScore([reportAt(95)]);
      expect(r.reason).toBeNull();
    });
  });

  describe('threshold filtering', () => {
    it('drops below-threshold reports from the average but counts them in reportsCount', () => {
      const r = calculateTrackQualityScore([reportAt(95), reportAt(0)]);
      expect(r.reportsCount).toBe(2);
      expect(r.validReportsCount).toBe(1);
      expect(r.droppedReportsCount).toBe(1);
      expect(r.avgQuality).toBe(95); // dropped report is NOT averaged in
    });
  });

  describe('quality distribution (histogram)', () => {
    it('bucketizes valid reports into excellent/good/fair/poor', () => {
      // Quality 95 → excellent
      // Quality 60 → fair
      const r = calculateTrackQualityScore([reportAt(95), reportAt(95), reportAt(60)]);
      expect(r.qualityDistribution).toEqual({
        excellent: 2,
        good: 0,
        fair: 1,
        poor: 0,
      });
    });

    it('all-zero distribution when no valid reports', () => {
      const r = calculateTrackQualityScore([]);
      expect(r.qualityDistribution).toEqual({
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
      });
    });
  });

  describe('numeric correctness', () => {
    it('score equals avgQuality (the schema field is a duplicate for clarity)', () => {
      const r = calculateTrackQualityScore([reportAt(95), reportAt(60)]);
      expect(r.score).toBe(r.avgQuality);
    });
  });
});
