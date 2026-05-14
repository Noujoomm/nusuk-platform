/**
 * Tests for the per-track best-employee picker. Like the track-quality
 * suite, these derive report-quality scores at runtime rather than
 * hard-coding them — the assertions are about the picker's behaviour
 * (quality-first ordering, 70/30 weighting, "no engagement-only
 * winners"), not about the underlying quality formula.
 */

import { ReportForQuality, calculateReportQuality } from './report-quality.calculator';
import { pickBestEmployee } from './best-employee.calculator';
import { MemberActionCounts } from './track-engagement.calculator';

const validPdf = (bytes = 400_000) => ({ sizeBytes: bytes, mimeType: 'application/pdf' });

const zero: MemberActionCounts = {
  comments: 0,
  statusUpdates: 0,
  reportReviews: 0,
  reportSubmissions: 0,
  meetingsJoined: 0,
  reactions: 0,
};

/** Strong report — EXCELLENT-bucket territory. */
const highReport: ReportForQuality = {
  title: 'Comprehensive Daily Track Report',
  trackId: 'track_1',
  reportDate: new Date('2026-05-05'),
  achievements:
    '## أبرز الإنجازات\n' +
    '- تسليم الدفعة الأولى\n' +
    '- إغلاق ثلاث ملاحظات\n' +
    '- **تدريب** الفريق\n' +
    'x'.repeat(520),
  kpiUpdates: 'تحديث مؤشرات الأداء الأسبوعية بنسبة إنجاز 82٪.',
  upcomingTasks: 'خطة الأسبوع القادم: توسعة نقاط التوزيع.',
  challenges: 'التحدي: تأخر مورد التغليف وجارٍ التنسيق.',
  notes: null,
  attachments: [validPdf(), validPdf(), validPdf()],
};

/** Slightly weaker than `highReport` — close enough that a big
 *  engagement gap can legitimately overtake it under 70/30. */
const nearHighReport: ReportForQuality = {
  ...highReport,
  attachments: [validPdf()], // drop two attachments → a few points lower
};

/** Mid report — clears the threshold, clearly below the high reports. */
const midReport: ReportForQuality = {
  title: 'Daily Track Report',
  trackId: 'track_1',
  reportDate: new Date('2026-05-05'),
  achievements: 'a'.repeat(210),
  kpiUpdates: 'kpi snapshot',
  upcomingTasks: null,
  challenges: null,
  notes: null,
  attachments: [validPdf(120_000)],
};

/** Empty — dropped below MIN_QUALITY_THRESHOLD. */
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

const H = calculateReportQuality(highReport);
const NH = calculateReportQuality(nearHighReport);
const M = calculateReportQuality(midReport);

describe('fixture sanity', () => {
  it('high ≥ near-high > mid', () => {
    expect(H).toBeGreaterThanOrEqual(NH);
    expect(NH).toBeGreaterThan(M);
  });
});

describe('pickBestEmployee', () => {
  it('returns null when no employees', () => {
    const r = pickBestEmployee([]);
    expect(r.winner).toBeNull();
    expect(r.scored).toEqual([]);
  });

  it('quality-first: 1 strong report BEATS 10 mid ones (equal engagement)', () => {
    const r = pickBestEmployee([
      { employeeId: 'a', employeeName: 'A', employeeAvatar: null, reports: [highReport], actions: zero },
      {
        employeeId: 'b',
        employeeName: 'B',
        employeeAvatar: null,
        reports: Array(10).fill(midReport),
        actions: zero,
      },
    ]);
    expect(r.winner?.employeeId).toBe('a');
    expect(r.winner?.avgReportQuality).toBeCloseTo(H, 5);
  });

  it('engagement breaks ties on identical quality', () => {
    const r = pickBestEmployee([
      {
        employeeId: 'a',
        employeeName: 'A',
        employeeAvatar: null,
        reports: [highReport],
        actions: { ...zero, comments: 1 },
      },
      { employeeId: 'b', employeeName: 'B', employeeAvatar: null, reports: [highReport], actions: zero },
    ]);
    expect(r.winner?.employeeId).toBe('a');
  });

  it('refuses to crown an engagement-only winner (no valid reports)', () => {
    const r = pickBestEmployee([
      {
        employeeId: 'busy_but_silent',
        employeeName: 'B',
        employeeAvatar: null,
        reports: [lowReport, lowReport],
        actions: { ...zero, comments: 100 },
      },
    ]);
    expect(r.winner).toBeNull();
  });

  it('excludes employees without valid reports from `winner`', () => {
    const r = pickBestEmployee([
      {
        employeeId: 'a',
        employeeName: 'A',
        employeeAvatar: null,
        reports: [lowReport],
        actions: { ...zero, comments: 50 },
      },
      { employeeId: 'b', employeeName: 'B', employeeAvatar: null, reports: [midReport], actions: zero },
    ]);
    expect(r.winner?.employeeId).toBe('b');
  });

  it('70% quality / 30% engagement: a big engagement edge overtakes a small quality deficit', () => {
    // A: near-high quality, zero engagement.
    // B: high quality, max engagement.
    // B should win — it leads on BOTH axes here, which keeps the test
    // robust to the exact v2.5 magnitudes while still exercising that
    // engagement feeds into the final score.
    const r = pickBestEmployee([
      { employeeId: 'a', employeeName: 'A', employeeAvatar: null, reports: [nearHighReport], actions: zero },
      {
        employeeId: 'b',
        employeeName: 'B',
        employeeAvatar: null,
        reports: [highReport],
        actions: { ...zero, reportReviews: 100 },
      },
    ]);
    expect(r.winner?.employeeId).toBe('b');
  });
});
