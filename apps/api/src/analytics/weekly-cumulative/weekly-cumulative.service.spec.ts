/**
 * Behavioural unit tests for the public outputs of WeeklyCumulativeService.
 *
 * Focus: the documented tie-break and the rank/labels in the response.
 * Prisma is stubbed; we don't spin up a real DB.
 *
 * The @prisma/client virtual mock below is needed because the service
 * file's import chain transitively pulls in PrismaService → @prisma/client,
 * and jest in this repo runs with rootDir=src which doesn't resolve to
 * the workspace-hoisted client. The service code paths exercised here
 * never call into the mocked client — we inject a hand-stubbed
 * PrismaService directly.
 */

jest.mock(
  '@prisma/client',
  () => ({ PrismaClient: class {}, Prisma: {} }),
  { virtual: true },
);

import { WeeklyCumulativeService, WeeklyCumulativeResponse } from './weekly-cumulative.service';

type Row = {
  trackId: string;
  weekStartDate: Date;
  cumulativeScore: number;
  reportQualityScore: number;
  leaderEngagementScore: number;
  daysContributed: number;
  trackLeadName: string | null;
  isArchived: boolean;
  lastUpdatedAt: Date;
  track: { nameAr: string };
};

const baseTime = new Date('2026-05-07T08:00:00Z'); // Wed in Riyadh
const weekStart = new Date(Date.UTC(2026, 4, 3));   // Sun 2026-05-03

const buildRow = (over: Partial<Row>): Row => ({
  trackId: 't',
  weekStartDate: weekStart,
  cumulativeScore: 0,
  reportQualityScore: 0,
  leaderEngagementScore: 0,
  daysContributed: 0,
  trackLeadName: null,
  isArchived: false,
  lastUpdatedAt: new Date('2026-05-07T07:59:00Z'),
  track: { nameAr: 'مسار' },
  ...over,
});

/**
 * Sort rows the way Prisma will, given our orderBy clause:
 *   cumulativeScore DESC, daysContributed DESC, trackId ASC
 * This is what we're testing the service to *assume*; we keep the
 * ordering in the stub so that any code that depends on it is exercised.
 */
const sortLikePrisma = (rows: Row[]): Row[] =>
  [...rows].sort((a, b) => {
    if (b.cumulativeScore !== a.cumulativeScore)
      return b.cumulativeScore - a.cumulativeScore;
    if (b.daysContributed !== a.daysContributed)
      return b.daysContributed - a.daysContributed;
    return a.trackId.localeCompare(b.trackId);
  });

const buildService = (rows: Row[]): WeeklyCumulativeService => {
  const prisma: any = {
    weeklyCumulativeScore: {
      findMany: jest.fn(async ({ take }: any) => {
        const sorted = sortLikePrisma(rows);
        return take ? sorted.slice(0, take) : sorted;
      }),
      upsert: jest.fn(),
      findFirst: jest.fn(),
    },
    track: { findMany: jest.fn() },
    dailyTrackPerformance: { findMany: jest.fn() },
  };
  const qualityFirst: any = { getTodayPerformance: jest.fn() };
  return new WeeklyCumulativeService(prisma, qualityFirst);
};

describe('WeeklyCumulativeService.getCurrentWeekTopThree', () => {
  it('breaks ties on daysContributed DESC, then trackId ASC', async () => {
    const rows: Row[] = [
      buildRow({ trackId: 't_b', cumulativeScore: 200, daysContributed: 4, track: { nameAr: 'B' } }),
      buildRow({ trackId: 't_c', cumulativeScore: 200, daysContributed: 3, track: { nameAr: 'C' } }),
      buildRow({ trackId: 't_a', cumulativeScore: 200, daysContributed: 4, track: { nameAr: 'A' } }),
      buildRow({ trackId: 't_d', cumulativeScore: 100, daysContributed: 5, track: { nameAr: 'D' } }),
    ];
    const svc = buildService(rows);
    const r: WeeklyCumulativeResponse = await svc.getCurrentWeekTopThree(baseTime);
    // Same score (200) → more days wins. t_a and t_b both have 4 days,
    // tie broken by trackId asc (t_a < t_b). t_c has 3 days so it's
    // third. t_d (score 100) is excluded.
    expect(r.topTracks.map((t) => t.trackId)).toEqual(['t_a', 't_b', 't_c']);
    expect(r.topTracks.map((t) => t.rank)).toEqual([1, 2, 3]);
  });

  it('reports the most recent lastUpdatedAt across the returned rows', async () => {
    const rows: Row[] = [
      buildRow({
        trackId: 't_a',
        cumulativeScore: 50,
        lastUpdatedAt: new Date('2026-05-07T07:00:00Z'),
      }),
      buildRow({
        trackId: 't_b',
        cumulativeScore: 30,
        lastUpdatedAt: new Date('2026-05-07T07:30:00Z'),
      }),
    ];
    const r = await buildService(rows).getCurrentWeekTopThree(baseTime);
    expect(r.lastUpdatedAt).toBe('2026-05-07T07:30:00.000Z');
  });

  it('reports the Riyadh weekday + days-elapsed for `now`', async () => {
    // 2026-05-07 11:00 UTC = 14:00 Riyadh, Thursday → dow=4.
    const r = await buildService([]).getCurrentWeekTopThree(
      new Date('2026-05-07T11:00:00Z'),
    );
    expect(r.weekStartDate).toBe('2026-05-03');
    expect(r.weekEndDate).toBe('2026-05-09');
    expect(r.currentDayInWeek).toBe('الخميس');
    expect(r.daysElapsedInWeek).toBe(5); // Sun..Thu inclusive = 5
  });

  it('returns empty topTracks + null lastUpdatedAt when nothing has been computed', async () => {
    const r = await buildService([]).getCurrentWeekTopThree(baseTime);
    expect(r.topTracks).toEqual([]);
    expect(r.lastUpdatedAt).toBeNull();
  });

  it('rounds scores to one decimal in the response', async () => {
    const rows: Row[] = [
      buildRow({
        trackId: 't_a',
        cumulativeScore: 123.456,
        reportQualityScore: 60.5555,
        leaderEngagementScore: 62.9,
        daysContributed: 3,
      }),
    ];
    const r = await buildService(rows).getCurrentWeekTopThree(baseTime);
    expect(r.topTracks[0].cumulativeScore).toBe(123.5);
    expect(r.topTracks[0].reportQualityScore).toBe(60.6);
    expect(r.topTracks[0].leaderEngagementScore).toBe(62.9);
  });
});
