/**
 * Per-track editorial guidance injected into the enhancer prompts.
 *
 * Each track has its own glossary (terms the model must NOT "correct"),
 * tone guidance, and structure hints. The whole point of this layer
 * is to keep the enhanced output aligned with how each track actually
 * writes about its own work — printing-shop language is not the same
 * as PR/company-relations language, and rubric drift between them
 * shows up as unfair scoring on the daily leaderboard.
 *
 * Treat the strings here as content, not config: revising them is a
 * normal product-content edit. Keep them in Arabic (the prompts they
 * feed are in Arabic too) and prefer ≤150 words per field — long
 * rubrics inflate token cost on every enhance call.
 */
export interface TrackRubric {
  /** Slug-style id matching neither the Prisma trackId nor any DB key.
   *  Used only as the lookup key inside the rubrics map. */
  key: TrackRubricKey;
  /** Arabic display name; identifies the track to the model. */
  trackName: string;
  /** One-sentence description of the track for prompt context. */
  trackDescription: string;
  /** Domain-specific terms the model must reproduce verbatim. */
  domainGlossary: string[];
  /** What "professional" sounds like for this track. */
  toneGuidelines: string;
  /** Section names that frequently appear in this track's reports. */
  commonStructurePatterns: string[];
}

export type TrackRubricKey =
  | 'printing'
  | 'distribution'
  | 'cameras-nawariya'
  | 'training'
  | 'company-relations'
  | 'consulting'
  | 'user-empowerment';
