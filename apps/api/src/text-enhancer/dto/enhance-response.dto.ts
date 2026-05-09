export type InterventionLevel = 'light' | 'medium' | 'heavy';

export interface QualityScores {
  language: number;
  organization: number;
  clarity: number;
  professionalism: number;
}

export interface EnhanceResponse {
  enhancedText: string;
  interventionLevel: InterventionLevel;
  qualityScores: QualityScores;
  changesCount: number;
  diagnosticSummary: string;
  auditId: string;
}
