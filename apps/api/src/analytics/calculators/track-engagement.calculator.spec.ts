import {
  MemberActionCounts,
  aggregateTrackEngagement,
  calculateMemberEngagement,
  getTop3EngagingTracks,
  rankTrackEngagement,
} from './track-engagement.calculator';

const zero: MemberActionCounts = {
  comments: 0,
  statusUpdates: 0,
  reportReviews: 0,
  reportSubmissions: 0,
  meetingsJoined: 0,
  reactions: 0,
};

describe('calculateMemberEngagement', () => {
  it('returns 0 for all-zero', () => {
    expect(calculateMemberEngagement(zero)).toBe(0);
  });

  it('weights reportSubmissions highest (6)', () => {
    expect(calculateMemberEngagement({ ...zero, reportSubmissions: 1 })).toBe(6);
    expect(calculateMemberEngagement({ ...zero, reportReviews: 1 })).toBe(5);
    expect(calculateMemberEngagement({ ...zero, statusUpdates: 1 })).toBe(4);
    expect(calculateMemberEngagement({ ...zero, comments: 1 })).toBe(3);
    expect(calculateMemberEngagement({ ...zero, reactions: 1 })).toBe(1);
  });

  it('sums weighted counts', () => {
    expect(
      calculateMemberEngagement({
        comments: 2, statusUpdates: 1, reportReviews: 1,
        reportSubmissions: 1, meetingsJoined: 0, reactions: 3,
      }),
    ).toBe(2 * 3 + 4 + 5 + 6 + 3);
  });
});

describe('aggregateTrackEngagement', () => {
  it('zero members → zero everything', () => {
    const r = aggregateTrackEngagement({ trackId: 't', trackName: 'T', members: [] });
    expect(r.totalEngagement).toBe(0);
    expect(r.membersCount).toBe(0);
    expect(r.avgEngagementPerMember).toBe(0);
  });

  it('computes avg across members', () => {
    const r = aggregateTrackEngagement({
      trackId: 't', trackName: 'T',
      members: [
        { memberId: 'a', actions: { ...zero, comments: 5 } },   // 15
        { memberId: 'b', actions: { ...zero, comments: 1 } },   // 3
      ],
    });
    expect(r.totalEngagement).toBe(18);
    expect(r.membersCount).toBe(2);
    expect(r.avgEngagementPerMember).toBe(9);
    expect(r.memberBreakdown).toEqual([
      { memberId: 'a', score: 15 },
      { memberId: 'b', score: 3 },
    ]);
  });
});

describe('rankTrackEngagement', () => {
  const mk = (id: string, total: number, count: number) => ({
    trackId: id, trackName: id.toUpperCase(),
    totalEngagement: total,
    membersCount: count,
    avgEngagementPerMember: count > 0 ? total / count : 0,
    memberBreakdown: [],
  });

  it('top 3 get ranks 1-3, rest are null', () => {
    const r = rankTrackEngagement([
      mk('a', 100, 10), // avg 10
      mk('b', 80, 10),  // avg 8
      mk('c', 60, 10),  // avg 6
      mk('d', 40, 10),  // avg 4
      mk('e', 20, 10),  // avg 2
    ]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3, null, null]);
  });

  it('penalizes large teams (uses avg, not total)', () => {
    const r = rankTrackEngagement([
      mk('big',   200, 100), // avg 2
      mk('small', 50,  10),  // avg 5 — wins
    ]);
    expect(r[0].trackId).toBe('small');
    expect(r[1].trackId).toBe('big');
  });

  it('handles all-zero (no division by zero)', () => {
    const r = rankTrackEngagement([mk('a', 0, 5), mk('b', 0, 5)]);
    expect(r.every((x) => x.engagementScore === 0)).toBe(true);
    expect(r.every((x) => x.rank === null)).toBe(true);
  });

  it('tiebreaks by trackId for determinism', () => {
    const r = rankTrackEngagement([mk('z', 50, 10), mk('a', 50, 10)]);
    expect(r[0].trackId).toBe('a');
    expect(r[1].trackId).toBe('z');
  });
});

describe('getTop3EngagingTracks', () => {
  it('returns max 3 with non-zero engagement', () => {
    const mk = (id: string, total: number) => ({
      trackId: id, trackName: id, totalEngagement: total,
      membersCount: 1, avgEngagementPerMember: total, memberBreakdown: [],
    });
    expect(getTop3EngagingTracks([mk('a', 30), mk('b', 20), mk('c', 10), mk('d', 5)]))
      .toHaveLength(3);

    expect(getTop3EngagingTracks([mk('a', 30)]))
      .toHaveLength(1);

    // All zero → no entries returned
    expect(getTop3EngagingTracks([mk('a', 0), mk('b', 0)]))
      .toHaveLength(0);
  });
});
