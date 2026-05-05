import { ReportForQuality } from './report-quality.calculator';
import { pickBestEmployee } from './best-employee.calculator';
import { MemberActionCounts } from './track-engagement.calculator';

const validPdf = { sizeBytes: 100_000, mimeType: 'application/pdf' };

const zero: MemberActionCounts = {
  comments: 0, statusUpdates: 0, reportReviews: 0,
  reportSubmissions: 0, meetingsJoined: 0, reactions: 0,
};

// Carefully crafted reports targeting specific quality buckets
const reportAt = (target: 95 | 60 | 0): ReportForQuality => {
  if (target === 95) {
    return {
      title: 'Comprehensive Daily Report',
      trackId: 'track_1',
      reportDate: new Date('2026-05-05'),
      achievements: '- one\n- two\n- three\n' + 'x'.repeat(500),
      kpiUpdates: 'kpi',
      upcomingTasks: 'plan',
      challenges: null, // 95 (skip 5 to avoid 100)
      notes: null,
      attachments: [validPdf, validPdf, validPdf],
    };
  }
  if (target === 60) {
    return {
      title: 'Daily Track Report',
      trackId: 'track_1',
      reportDate: new Date(),
      achievements: 'a'.repeat(200),
      kpiUpdates: 'kpi',
      upcomingTasks: null,
      challenges: null,
      notes: null,
      attachments: [validPdf],
    };
  }
  return {
    title: null, trackId: null, reportDate: null,
    achievements: null, kpiUpdates: null,
    challenges: null, notes: null, upcomingTasks: null, attachments: [],
  };
};

describe('pickBestEmployee', () => {
  it('returns null when no employees', () => {
    const r = pickBestEmployee([]);
    expect(r.winner).toBeNull();
    expect(r.scored).toEqual([]);
  });

  it('quality-first: 1 excellent report BEATS 10 mediocre ones', () => {
    const r = pickBestEmployee([
      {
        employeeId: 'a', employeeName: 'A', employeeAvatar: null,
        reports: [reportAt(95)],
        actions: zero,
      },
      {
        employeeId: 'b', employeeName: 'B', employeeAvatar: null,
        reports: Array(10).fill(reportAt(60)),
        actions: zero,
      },
    ]);
    expect(r.winner?.employeeId).toBe('a');
    expect(r.winner?.avgReportQuality).toBe(95);
  });

  it('engagement breaks ties on identical quality', () => {
    const r = pickBestEmployee([
      {
        employeeId: 'a', employeeName: 'A', employeeAvatar: null,
        reports: [reportAt(95)],
        actions: { ...zero, comments: 1 },
      },
      {
        employeeId: 'b', employeeName: 'B', employeeAvatar: null,
        reports: [reportAt(95)],
        actions: zero,
      },
    ]);
    expect(r.winner?.employeeId).toBe('a');
  });

  it('refuses to crown engagement-only winner (no valid reports)', () => {
    const r = pickBestEmployee([
      {
        employeeId: 'busy_but_silent', employeeName: 'B', employeeAvatar: null,
        reports: [reportAt(0), reportAt(0)], // all dropped
        actions: { ...zero, comments: 100 },
      },
    ]);
    expect(r.winner).toBeNull();
  });

  it('excludes employees without valid reports from `winner`', () => {
    const r = pickBestEmployee([
      {
        employeeId: 'a', employeeName: 'A', employeeAvatar: null,
        reports: [reportAt(0)], // dropped
        actions: { ...zero, comments: 50 },
      },
      {
        employeeId: 'b', employeeName: 'B', employeeAvatar: null,
        reports: [reportAt(60)],
        actions: zero,
      },
    ]);
    expect(r.winner?.employeeId).toBe('b');
  });

  it('70% quality / 30% engagement weighting', () => {
    const r = pickBestEmployee([
      {
        employeeId: 'a', employeeName: 'A', employeeAvatar: null,
        reports: [reportAt(95)],            // quality 95
        actions: zero,                       // engagement 0
      },
      {
        employeeId: 'b', employeeName: 'B', employeeAvatar: null,
        reports: [reportAt(60)],            // quality 60
        actions: { ...zero, reportReviews: 100 }, // big engagement, gets 100 normalized
      },
    ]);
    // a: 95×0.7 + 0×0.3 = 66.5
    // b: 60×0.7 + 100×0.3 = 72.0  → wins despite lower quality
    expect(r.winner?.employeeId).toBe('b');
    // Note: this confirms the weights operate as designed; in practice
    // the spec says "1 excellent BEATS 10 mediocre" which holds when
    // engagement is comparable. Here engagement is wildly different.
  });
});
