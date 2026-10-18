import type { ClinicalTrialSummary } from './trial';

export type ExtractionContext = 'treatment' | 'prevention' | 'mixed' | 'other' | 'unclear';

export interface TrialExtraction {
  method: 'source-assisted' | 'external-api';
  sourceLevel: 'abstract' | 'full-text';
  clinicalContext: ExtractionContext;
  model: string | null;
  reviewStatus: 'Draft — needs clinical review';
  evidence: { field: string; quote: string; sourceUrl: string; location: string }[];
  missing: string[];
}

export interface ExtractionPilot {
  schemaVersion: 1;
  topic: string;
  generatedAt: string;
  scope: { from: string; to: string; query: string };
  execution: {
    mode: 'source-assisted' | 'external-api';
    externalApiStatus: 'not-run' | 'completed' | 'partial';
    note: string;
    models: { screening: string | null; fullText: string | null };
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    plannedMaxCostUsd?: number;
    budgetCapUsd?: number;
  };
  counts: { candidates: number; abstracts: number; fullTexts: number; detailed: number };
  records: {
    pmid: string;
    title: string;
    publicationDate: string;
    journal: string;
    publicationTypes: string[];
    sourceUrl: string;
    fullTextUrl: string | null;
    category: ExtractionContext;
    reason: string;
    abstractAvailable: boolean;
    fullTextAvailable: boolean;
    hasDetailed: boolean;
  }[];
  trials: ClinicalTrialSummary[];
}
