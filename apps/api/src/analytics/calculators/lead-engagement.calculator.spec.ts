import {
  LEAD_ACTION_WEIGHTS,
  LeadActionCounts,
  calculateLeadRawEngagement,
  normalizeLeadEngagement,
} from './lead-engagement.calculator';

const zeroActions: LeadActionCounts = {
  comments: 0,
  statusUpdates: 0,
  reportReviews: 0,
  meetingsJoined: 0,
  reactions: 0,
  logins: 0,
};

describe('calculateLeadRawEngagement', () => {
  it('returns 0 for all-zero counts', () => {
    expect(calculateLeadRawEngagement(zeroActions)).toBe(0);
  });

  it('applies per-action weights', () => {
    const r = calculateLeadRawEngagement({
      comments: 1, statusUpdates: 1, reportReviews: 1,
      meetingsJoined: 1, reactions: 1, logins: 0,
    });
    expect(r).toBe(3 + 4 + 5 + 4 + 1);
  });

  it('clamps logins to 1 (presence-only, no double-counting)', () => {
    expect(calculateLeadRawEngagement({ ...zeroActions, logins: 5 })).toBe(2);
    expect(calculateLeadRawEngagement({ ...zeroActions, logins: 1 })).toBe(2);
    expect(calculateLeadRawEngagement({ ...zeroActions, logins: 0 })).toBe(0);
  });

  it('weights are stable (regression guard)', () => {
    expect(LEAD_ACTION_WEIGHTS).toEqual({
      comments: 3,
      statusUpdates: 4,
      reportReviews: 5,
      meetingsJoined: 4,
      reactions: 1,
      logins: 2,
    });
  });
});

describe('normalizeLeadEngagement', () => {
  it('returns [] for empty input', () => {
    expect(normalizeLeadEngagement([])).toEqual([]);
  });

  it('top lead gets 100, others scale relatively', () => {
    const r = normalizeLeadEngagement([
      { leadId: 'a', leadName: 'A', leadAvatar: null,
        actions: { ...zeroActions, comments: 10 } },        // 30
      { leadId: 'b', leadName: 'B', leadAvatar: null,
        actions: { ...zeroActions, comments: 5 } },         // 15 (50%)
      { leadId: 'c', leadName: 'C', leadAvatar: null,
        actions: zeroActions },                              // 0
    ]);
    expect(r[0].normalizedScore).toBe(100);
    expect(r[1].normalizedScore).toBe(50);
    expect(r[2].normalizedScore).toBe(0);
  });

  it('all-zero input → all-zero scores (no divide by zero)', () => {
    const r = normalizeLeadEngagement([
      { leadId: 'a', leadName: 'A', leadAvatar: null, actions: zeroActions },
      { leadId: 'b', leadName: 'B', leadAvatar: null, actions: zeroActions },
    ]);
    expect(r.every((x) => x.normalizedScore === 0)).toBe(true);
  });

  it('preserves input order so callers can map to track ids', () => {
    const r = normalizeLeadEngagement([
      { leadId: 'a', leadName: 'A', leadAvatar: null, actions: zeroActions },
      { leadId: 'b', leadName: 'B', leadAvatar: null, actions: { ...zeroActions, comments: 1 } },
    ]);
    expect(r[0].leadId).toBe('a');
    expect(r[1].leadId).toBe('b');
  });
});
