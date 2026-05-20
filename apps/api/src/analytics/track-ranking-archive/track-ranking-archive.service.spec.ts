/**
 * Unit tests for the pure weekly-aggregation logic. The DB-touching
 * snapshot/list methods are thin Prisma wrappers and aren't unit-tested
 * here. The @prisma/client virtual mock keeps jest's rootDir=src resolver
 * happy (the service file transitively imports PrismaService).
 */

jest.mock('@prisma/client', () => ({ PrismaClient: class {}, Prisma: {} }), {
  virtual: true,
});

import {
  DailyRankingRow,
  aggregateWeeklyRanking,
} from './track-ranking-archive.service';

const row = (over: Partial<DailyRankingRow>): DailyRankingRow => ({
  trackId: 't',
  trackNameAr: 'مسار',
  leaderNameAr: null,
  qualityPercent: 0,
  reportCount: 0,
  ...over,
});

describe('aggregateWeeklyRanking', () => {
  it('averages a track\'s daily percentages over the days it appeared', () => {
    const out = aggregateWeeklyRanking([
      row({ trackId: 'a', qualityPercent: 80, reportCount: 2 }),
      row({ trackId: 'a', qualityPercent: 100, reportCount: 3 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].qualityPercent).toBe(90); // (80 + 100) / 2
    expect(out[0].reportCount).toBe(5); // summed
  });

  it('re-ranks by average percentage descending', () => {
    const out = aggregateWeeklyRanking([
      row({ trackId: 'low', qualityPercent: 40 }),
      row({ trackId: 'high', qualityPercent: 95 }),
      row({ trackId: 'mid', qualityPercent: 70 }),
    ]);
    expect(out.map((t) => t.trackId)).toEqual(['high', 'mid', 'low']);
  });

  it('breaks ties on trackId ascending (deterministic)', () => {
    const out = aggregateWeeklyRanking([
      row({ trackId: 'b', qualityPercent: 88 }),
      row({ trackId: 'a', qualityPercent: 88 }),
    ]);
    expect(out.map((t) => t.trackId)).toEqual(['a', 'b']);
  });

  it('rounds the weekly average to one decimal', () => {
    const out = aggregateWeeklyRanking([
      row({ trackId: 'a', qualityPercent: 100 }),
      row({ trackId: 'a', qualityPercent: 100 }),
      row({ trackId: 'a', qualityPercent: 99 }),
    ]);
    // (100 + 100 + 99) / 3 = 99.666... → 99.7
    expect(out[0].qualityPercent).toBe(99.7);
  });

  it('keeps the last non-null leader name across the week', () => {
    const out = aggregateWeeklyRanking([
      row({ trackId: 'a', leaderNameAr: 'حسان' }),
      row({ trackId: 'a', leaderNameAr: null }),
      row({ trackId: 'a', leaderNameAr: 'خالد' }),
    ]);
    expect(out[0].leaderNameAr).toBe('خالد');
  });

  it('a track at 100% every day stays exactly 100% for the week', () => {
    const out = aggregateWeeklyRanking([
      row({ trackId: 'a', qualityPercent: 100 }),
      row({ trackId: 'a', qualityPercent: 100 }),
      row({ trackId: 'a', qualityPercent: 100 }),
    ]);
    expect(out[0].qualityPercent).toBe(100);
  });

  it('returns an empty list for no daily rows', () => {
    expect(aggregateWeeklyRanking([])).toEqual([]);
  });
});
