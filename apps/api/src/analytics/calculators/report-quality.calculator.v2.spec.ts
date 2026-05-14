/**
 * v2 regression suite — pins the FROZEN discrete-tier scoring so the
 * rollback path (`USE_QUALITY_V25=false`) stays trustworthy. These are
 * the original v2 assertions, repointed at `calculateReportQualityV2`.
 * Do not relax them; if one fails, the v2 fallback drifted.
 */

import type { ReportForQuality } from './report-quality.calculator';
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

describe('calculateReportQualityV2 (frozen tiers)', () => {
  it('returns 0 for an empty report', () => {
    expect(calculateReportQualityV2(empty)).toBe(0);
  });

  describe('1. required-field completeness (30 = 10+10+10)', () => {
    it('credits 10 when title is ≥ 10 chars', () => {
      expect(calculateReportQualityV2({ ...empty, title: 'Daily Track Report' })).toBe(10);
    });
    it('does not credit short titles (< 10 chars)', () => {
      expect(calculateReportQualityV2({ ...empty, title: 'Hi' })).toBe(0);
    });
    it('credits 10 when achievements ≥ 50 chars', () => {
      expect(calculateReportQualityV2({ ...empty, achievements: 'a'.repeat(50) })).toBe(15);
    });
    it('credits 10 when both trackId and reportDate are present', () => {
      expect(
        calculateReportQualityV2({ ...empty, trackId: 't1', reportDate: new Date() }),
      ).toBe(10);
    });
    it('does not credit if only trackId is set', () => {
      expect(calculateReportQualityV2({ ...empty, trackId: 't1' })).toBe(0);
    });
  });

  describe('2. content depth (graduated 25/20/15/10/5/0)', () => {
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
      const requiredAchPts = len >= 50 ? 10 : 0;
      expect(calculateReportQualityV2(r)).toBe(10 + requiredAchPts + 10 + depthPts);
    });
  });

  describe('3. valid attachments (graduated 20/15/10/0)', () => {
    const validPdf = { sizeBytes: 50_000, mimeType: 'application/pdf' };
    it('1 valid → 10', () => {
      expect(calculateReportQualityV2(baseFilled({ attachments: [validPdf] }))).toBe(45);
    });
    it('2 valid → 15', () => {
      expect(
        calculateReportQualityV2(baseFilled({ attachments: [validPdf, validPdf] })),
      ).toBe(50);
    });
    it('3+ valid → 20', () => {
      expect(
        calculateReportQualityV2(
          baseFilled({ attachments: [validPdf, validPdf, validPdf, validPdf] }),
        ),
      ).toBe(55);
    });
    it('rejects attachments below 10 KB', () => {
      expect(
        calculateReportQualityV2(
          baseFilled({ attachments: [{ sizeBytes: 5_000, mimeType: 'application/pdf' }] }),
        ),
      ).toBe(35);
    });
    it('rejects unrecognized mime types', () => {
      expect(
        calculateReportQualityV2(
          baseFilled({ attachments: [{ sizeBytes: 50_000, mimeType: 'application/x-evil' }] }),
        ),
      ).toBe(35);
    });
  });

  describe('4. structured metadata (15 = 5+5+5)', () => {
    it('credits 5 per filled metadata field, additive', () => {
      expect(calculateReportQualityV2(baseFilled({ kpiUpdates: 'kpi' }))).toBe(40);
      expect(
        calculateReportQualityV2(baseFilled({ kpiUpdates: 'kpi', upcomingTasks: 'plan' })),
      ).toBe(45);
      expect(
        calculateReportQualityV2(
          baseFilled({ kpiUpdates: 'kpi', upcomingTasks: 'plan', challenges: 'X' }),
        ),
      ).toBe(50);
    });
    it('whitespace-only fields do not count', () => {
      expect(
        calculateReportQualityV2(baseFilled({ kpiUpdates: '   ', upcomingTasks: '\n\t' })),
      ).toBe(35);
    });
  });

  describe('5. structured writing (10)', () => {
    it('credits when achievements has ≥3 lines AND bullets', () => {
      const r = baseFilled({
        achievements: '- first item\n- second item\n- third item\n- fourth item',
      });
      expect(calculateReportQualityV2(r)).toBe(30 + 5 + 10);
    });
    it('does NOT credit a single paragraph even if long', () => {
      expect(calculateReportQualityV2(baseFilled({ achievements: 'a'.repeat(500) }))).toBe(55);
    });
  });

  it('caps at 100 when everything filled to the max', () => {
    const validPdf = { sizeBytes: 100_000, mimeType: 'application/pdf' };
    const r: ReportForQuality = {
      title: 'Comprehensive Daily Report',
      trackId: 'track_1',
      reportDate: new Date(),
      achievements:
        '## Highlights\n- shipped feature A\n- closed 3 bugs\n- onboarded 2 users\n' +
        'x'.repeat(500),
      kpiUpdates: 'KPI snapshot',
      upcomingTasks: 'Plan',
      challenges: 'Issue',
      notes: 'Notes',
      attachments: [validPdf, validPdf, validPdf],
    };
    expect(calculateReportQualityV2(r)).toBe(100);
  });

  it('does not throw on undefined input', () => {
    expect(calculateReportQualityV2({} as ReportForQuality)).toBe(0);
  });
});
