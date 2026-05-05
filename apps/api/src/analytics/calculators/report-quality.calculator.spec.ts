import {
  MIN_QUALITY_THRESHOLD,
  QUALITY_BUCKETS,
  ReportForQuality,
  bucketOf,
  calculateReportQuality,
  hasStructuredContent,
} from './report-quality.calculator';

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
  title: 'Daily Track Report', // 18 chars ≥ 10
  trackId: 'track_1',
  reportDate: new Date('2026-05-05'),
  achievements: 'a'.repeat(60), // ≥ 50 chars (required) and ≥ 50 (depth tier 5)
  ...over,
});

describe('calculateReportQuality', () => {
  it('returns 0 for an empty report', () => {
    expect(calculateReportQuality(empty)).toBe(0);
  });

  describe('1. required-field completeness (30 = 10+10+10)', () => {
    it('credits 10 when title is ≥ 10 chars', () => {
      const r = { ...empty, title: 'Daily Track Report' };
      // achievements null → 0 from required-achievements; trackId+date missing → 0
      expect(calculateReportQuality(r)).toBe(10);
    });

    it('does not credit short titles (< 10 chars)', () => {
      const r = { ...empty, title: 'Hi' };
      expect(calculateReportQuality(r)).toBe(0);
    });

    it('credits 10 when achievements ≥ 50 chars (separate from depth tier)', () => {
      const r = { ...empty, achievements: 'a'.repeat(50) };
      // 10 (achievements ≥ 50) + 5 (depth tier ≥ 50)
      expect(calculateReportQuality(r)).toBe(15);
    });

    it('credits 10 when both trackId and reportDate are present', () => {
      const r = { ...empty, trackId: 't1', reportDate: new Date() };
      expect(calculateReportQuality(r)).toBe(10);
    });

    it('does not credit if only trackId is set (date missing)', () => {
      const r = { ...empty, trackId: 't1' };
      expect(calculateReportQuality(r)).toBe(0);
    });
  });

  describe('2. content depth on achievements (graduated 25/20/15/10/5/0)', () => {
    const variants: Array<[number, number]> = [
      [500, 25],
      [300, 20],
      [200, 15],
      [100, 10],
      [50, 5],
      [49, 0],
    ];
    it.each(variants)('achievements length %i → depth tier %i', (len, depthPts) => {
      const r = baseFilled({ achievements: 'a'.repeat(len) });
      // base required: 10 (title) + (len ≥ 50 ? 10 : 0) + 10 (track+date) + depth
      const requiredAchPts = len >= 50 ? 10 : 0;
      const expected = 10 + requiredAchPts + 10 + depthPts;
      expect(calculateReportQuality(r)).toBe(expected);
    });
  });

  describe('3. valid attachments (graduated 20/15/10/0)', () => {
    const validPdf = { sizeBytes: 50_000, mimeType: 'application/pdf' };

    it('1 valid → 10', () => {
      const r = baseFilled({ attachments: [validPdf] });
      // base 30 (title+ach+date) + depth 5 + attach 10 = 45
      expect(calculateReportQuality(r)).toBe(45);
    });

    it('2 valid → 15', () => {
      const r = baseFilled({ attachments: [validPdf, validPdf] });
      expect(calculateReportQuality(r)).toBe(50);
    });

    it('3+ valid → 20', () => {
      const r = baseFilled({ attachments: [validPdf, validPdf, validPdf, validPdf] });
      expect(calculateReportQuality(r)).toBe(55);
    });

    it('rejects attachments below 10 KB', () => {
      const r = baseFilled({ attachments: [{ sizeBytes: 5_000, mimeType: 'application/pdf' }] });
      expect(calculateReportQuality(r)).toBe(35);
    });

    it('rejects unrecognized mime types', () => {
      const r = baseFilled({ attachments: [{ sizeBytes: 50_000, mimeType: 'application/x-evil' }] });
      expect(calculateReportQuality(r)).toBe(35);
    });
  });

  describe('4. structured metadata (15 = 5+5+5)', () => {
    it('credits 5 per filled metadata field, additive', () => {
      const r = baseFilled({ kpiUpdates: 'kpi' });
      expect(calculateReportQuality(r)).toBe(35 + 5);

      const r2 = baseFilled({ kpiUpdates: 'kpi', upcomingTasks: 'plan' });
      expect(calculateReportQuality(r2)).toBe(35 + 10);

      const r3 = baseFilled({ kpiUpdates: 'kpi', upcomingTasks: 'plan', challenges: 'X' });
      expect(calculateReportQuality(r3)).toBe(35 + 15);
    });

    it('whitespace-only fields do not count', () => {
      const r = baseFilled({ kpiUpdates: '   ', upcomingTasks: '\n\t' });
      expect(calculateReportQuality(r)).toBe(35);
    });
  });

  describe('5. structured writing (10)', () => {
    it('credits when achievements has ≥3 lines AND bullets', () => {
      const r = baseFilled({
        achievements: '- first item\n- second item\n- third item\n- fourth item',
      });
      // 30 base + depth (length ~50 → 5) + structure 10 = 45
      expect(calculateReportQuality(r)).toBe(30 + 5 + 10);
    });

    it('does NOT credit a single paragraph even if long', () => {
      const r = baseFilled({ achievements: 'a'.repeat(500) });
      // 30 base + 25 depth + 0 structure
      expect(calculateReportQuality(r)).toBe(55);
    });

    it('credits headings (markdown #)', () => {
      const r = baseFilled({
        achievements: '# Today\nshipped feature\n# Tomorrow\nplan deploy\n# Notes',
      });
      // 30 base + depth (len >= 50 → 5) + 10 structure = 45
      expect(calculateReportQuality(r)).toBeGreaterThanOrEqual(45);
    });
  });

  it('caps at 100 when everything filled to the max', () => {
    const validPdf = { sizeBytes: 100_000, mimeType: 'application/pdf' };
    const r: ReportForQuality = {
      title: 'Comprehensive Daily Report',
      trackId: 'track_1',
      reportDate: new Date(),
      achievements:
        '## Highlights\n- shipped feature A\n- closed 3 bugs\n- onboarded 2 users\n' + 'x'.repeat(500),
      kpiUpdates: 'KPI snapshot',
      upcomingTasks: 'Plan',
      challenges: 'Issue',
      notes: 'Notes',
      attachments: [validPdf, validPdf, validPdf],
    };
    expect(calculateReportQuality(r)).toBe(100);
  });

  it('does not throw on undefined input', () => {
    expect(calculateReportQuality({} as ReportForQuality)).toBe(0);
  });
});

describe('hasStructuredContent', () => {
  it('returns false for empty/short input', () => {
    expect(hasStructuredContent(null)).toBe(false);
    expect(hasStructuredContent('')).toBe(false);
    expect(hasStructuredContent('one\ntwo')).toBe(false);
  });

  it('requires both ≥3 lines AND (bullets or headings)', () => {
    expect(hasStructuredContent('one\ntwo\nthree')).toBe(false);
    expect(hasStructuredContent('- one\n- two\n- three')).toBe(true);
    expect(hasStructuredContent('# A\n# B\n# C')).toBe(true);
    expect(hasStructuredContent('1. one\n2. two\n3. three')).toBe(true);
  });
});

describe('bucketOf', () => {
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

describe('thresholds', () => {
  it('exposes MIN_QUALITY_THRESHOLD = 30', () => {
    expect(MIN_QUALITY_THRESHOLD).toBe(30);
  });
  it('exposes bucket boundaries', () => {
    expect(QUALITY_BUCKETS.EXCELLENT).toBe(85);
    expect(QUALITY_BUCKETS.GOOD).toBe(70);
    expect(QUALITY_BUCKETS.FAIR).toBe(50);
    expect(QUALITY_BUCKETS.POOR).toBe(30);
  });
});
