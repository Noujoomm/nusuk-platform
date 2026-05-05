/**
 * Lead Engagement Calculator (Phase 2)
 *
 * Pure scoring + relative normalization for the Track Lead's personal
 * engagement signal. Unlike the quality criterion (absolute), this one
 * IS normalized across all leads — top lead gets 100, others scale.
 *
 * Action weights (spec):
 *   - reportReviews   × 5  (most valuable — substantive feedback on team work)
 *   - meetingsJoined  × 4
 *   - statusUpdates   × 4
 *   - comments        × 3
 *   - logins          × 2  (counted once, presence-only)
 *   - reactions       × 1
 *
 * Note on data sources: the service layer derives these counts from
 * existing tables (Comment, DailyUpdate, TaskUpdate, Report). Some
 * action types in the spec — meetingsJoined, reactions, logins — have
 * no first-class data source today, so the service passes 0 for them.
 * Keeping them in the contract means we don't have to redesign when
 * those signals exist.
 */

export interface LeadActionCounts {
  comments: number;
  statusUpdates: number;
  reportReviews: number;
  meetingsJoined: number;
  reactions: number;
  logins: number;
}

export const LEAD_ACTION_WEIGHTS: Readonly<Record<keyof LeadActionCounts, number>> = {
  comments: 3,
  statusUpdates: 4,
  reportReviews: 5,
  meetingsJoined: 4,
  reactions: 1,
  logins: 2,
};

/** Sum-product of counts × weights. Cap `logins` at 1 (presence-only). */
export function calculateLeadRawEngagement(actions: LeadActionCounts): number {
  const loginsClamped = actions.logins > 0 ? 1 : 0;
  return (
    actions.comments * LEAD_ACTION_WEIGHTS.comments +
    actions.statusUpdates * LEAD_ACTION_WEIGHTS.statusUpdates +
    actions.reportReviews * LEAD_ACTION_WEIGHTS.reportReviews +
    actions.meetingsJoined * LEAD_ACTION_WEIGHTS.meetingsJoined +
    actions.reactions * LEAD_ACTION_WEIGHTS.reactions +
    loginsClamped * LEAD_ACTION_WEIGHTS.logins
  );
}

export interface LeadEngagementInput {
  leadId: string;
  leadName: string;
  leadAvatar: string | null;
  actions: LeadActionCounts;
}

export interface LeadEngagementResult {
  leadId: string;
  leadName: string;
  leadAvatar: string | null;
  rawScore: number;
  /** 0–100, normalized so the top lead scores 100. 0 if all leads at 0. */
  normalizedScore: number;
  breakdown: LeadActionCounts;
}

/**
 * Compute raw scores for every lead, then divide by the max to get a 0–100
 * scale. Result preserves input order — caller can map back to track ids.
 */
export function normalizeLeadEngagement(
  inputs: ReadonlyArray<LeadEngagementInput>,
): LeadEngagementResult[] {
  if (inputs.length === 0) return [];
  const raws = inputs.map((i) => calculateLeadRawEngagement(i.actions));
  const max = Math.max(...raws);
  return inputs.map((i, idx) => ({
    leadId: i.leadId,
    leadName: i.leadName,
    leadAvatar: i.leadAvatar,
    rawScore: raws[idx],
    normalizedScore: max > 0 ? (raws[idx] / max) * 100 : 0,
    breakdown: i.actions,
  }));
}
