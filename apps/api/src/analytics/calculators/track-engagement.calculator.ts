/**
 * Track Engagement Calculator (Phase 3)
 *
 * Powers the "أفضل ٣ مسارات تفاعلاً" card. Independent of the quality
 * ranking — a track can rank high here while ranking low in the main
 * "Top 3 Tracks" list (and vice versa). That's intentional: this surfaces
 * vibrant teams; the main card surfaces excellent reports.
 *
 * Aggregation: SUM of every member's weighted action count, then DIVIDE
 * by member count. We use `avgEngagementPerMember` (not raw total) for
 * the normalized score so a 5-person track isn't penalized vs a
 * 20-person one.
 *
 * Action weights are intentionally heavier on producing/reviewing reports
 * (REPORT_SUBMISSION = 6) since those are the rarest, highest-effort
 * signals in the platform.
 */

export interface MemberActionCounts {
  comments: number;
  statusUpdates: number;
  reportReviews: number;
  reportSubmissions: number;
  meetingsJoined: number;
  reactions: number;
}

export const MEMBER_ACTION_WEIGHTS: Readonly<Record<keyof MemberActionCounts, number>> = {
  comments: 3,
  statusUpdates: 4,
  reportReviews: 5,
  reportSubmissions: 6,
  meetingsJoined: 4,
  reactions: 1,
};

export function calculateMemberEngagement(actions: MemberActionCounts): number {
  return (
    actions.comments * MEMBER_ACTION_WEIGHTS.comments +
    actions.statusUpdates * MEMBER_ACTION_WEIGHTS.statusUpdates +
    actions.reportReviews * MEMBER_ACTION_WEIGHTS.reportReviews +
    actions.reportSubmissions * MEMBER_ACTION_WEIGHTS.reportSubmissions +
    actions.meetingsJoined * MEMBER_ACTION_WEIGHTS.meetingsJoined +
    actions.reactions * MEMBER_ACTION_WEIGHTS.reactions
  );
}

export interface TrackEngagementInput {
  trackId: string;
  trackName: string;
  members: ReadonlyArray<{
    memberId: string;
    actions: MemberActionCounts;
  }>;
}

export interface TrackEngagementAggregate {
  trackId: string;
  trackName: string;
  totalEngagement: number;
  membersCount: number;
  avgEngagementPerMember: number;
  memberBreakdown: Array<{ memberId: string; score: number }>;
}

export interface TrackEngagementRanked extends TrackEngagementAggregate {
  /** 0–100, normalized on avgEngagementPerMember across all tracks. */
  engagementScore: number;
  /** 1, 2, 3, or null if the track is outside the top 3. */
  rank: number | null;
}

/** Stage 1 — pure aggregate, no ranking yet. */
export function aggregateTrackEngagement(input: TrackEngagementInput): TrackEngagementAggregate {
  let total = 0;
  const breakdown: Array<{ memberId: string; score: number }> = [];
  for (const m of input.members) {
    const s = calculateMemberEngagement(m.actions);
    total += s;
    breakdown.push({ memberId: m.memberId, score: s });
  }
  const count = input.members.length;
  return {
    trackId: input.trackId,
    trackName: input.trackName,
    totalEngagement: total,
    membersCount: count,
    avgEngagementPerMember: count > 0 ? total / count : 0,
    memberBreakdown: breakdown,
  };
}

/**
 * Stage 2 — normalize, sort, attach rank for top 3.
 * Tracks beyond the top 3 keep their score but rank=null.
 */
export function rankTrackEngagement(
  aggregates: ReadonlyArray<TrackEngagementAggregate>,
): TrackEngagementRanked[] {
  if (aggregates.length === 0) return [];
  const maxAvg = Math.max(...aggregates.map((a) => a.avgEngagementPerMember));
  const scored = aggregates.map<TrackEngagementRanked>((a) => ({
    ...a,
    engagementScore: maxAvg > 0 ? (a.avgEngagementPerMember / maxAvg) * 100 : 0,
    rank: null,
  }));
  // Sort by score desc, tiebreak by trackId for determinism
  scored.sort((a, b) => b.engagementScore - a.engagementScore || a.trackId.localeCompare(b.trackId));
  for (let i = 0; i < Math.min(3, scored.length); i++) {
    if (scored[i].engagementScore > 0) scored[i].rank = i + 1;
  }
  return scored;
}

export function getTop3EngagingTracks(
  aggregates: ReadonlyArray<TrackEngagementAggregate>,
): TrackEngagementRanked[] {
  return rankTrackEngagement(aggregates).slice(0, 3).filter((t) => t.rank !== null);
}
