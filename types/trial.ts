import type { DiseaseId } from '@/lib/diseases';
import type { TreatmentProtocol } from './protocol';
import type { TrialExtraction } from './extraction';

export const SPECIALTIES = [
  'Neuropathic Pain',
  'Headache & Facial Pain',
  'Musculoskeletal / Spine',
  'Interventional Pain',
  'Pharmacotherapy',
] as const;
export type Specialty = (typeof SPECIALTIES)[number];
export const INTERVENTIONS = ['Drug', 'Device', 'Invasive', 'Physical / Digital Therapy'] as const;
export type InterventionType = (typeof INTERVENTIONS)[number];

export interface ClinicalTrialSummary {
  id: string;
  acronym: string;
  title: string;
  displayTitle: string;
  authors: string[];
  leadAuthor: string;
  seniorAuthor: string;
  journal: string;
  journalAbbreviation: string;
  year: number;
  volume?: string;
  issue?: string;
  pages?: string;
  doi: string | null;
  pmid: string;
  highImpact: boolean; // Editorial journal list; not an impact-factor or quality score.
  specialties: Specialty[];
  interventionType: InterventionType | null;
  sampleSize: number | null;
  sampleSizeBasis: string;
  duration: string;
  bottomLine: string;
  pico: { population: string; intervention: string; comparator: string; outcomes: string };
  outcome: {
    label: string;
    value: string;
    context: string;
    pValue: string | null;
    confidenceInterval: string | null;
    nnt: string | null;
    nnh: string | null;
    clinicalMeaning: string;
    timepoint: string;
    kind: 'primary' | 'secondary' | 'unreviewed';
  };
  safety: { summary: string; discontinuation: string | null };
  methodology: {
    blinding: string;
    randomization: string;
    intentionToTreat: string;
    riskOfBias: 'Not formally assessed';
    limitations: string;
  };
  provenance: {
    source: 'pubmed-abstract-seed' | 'pubmed-live';
    reviewedOn: string | null;
    status: 'Abstract-based summary' | 'Awaiting appraisal' | 'Extraction draft';
    sourceUrl: string;
  };
  abstract: string | null;
  // Optional to preserve older local bookmarks and unappraised PubMed imports.
  treatmentProtocol?: TreatmentProtocol;
  extraction?: TrialExtraction;
}

export interface TrialFilters {
  query: string;
  disease: DiseaseId | 'all';
  specialties: Specialty[];
  years: [number, number];
  minSample: number;
  interventions: InterventionType[];
  highImpactOnly: boolean;
}
