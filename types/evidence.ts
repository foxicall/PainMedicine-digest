export interface EvidenceRecord {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  journalAbbreviation: string;
  issns: string[];
  publicationDate: string;
  datePrecision: 'day' | 'month' | 'year';
  dateBasis: string;
  publicationTypes: string[];
  doi: string | null;
  volume: string;
  issue: string;
  pages: string;
  metricId?: string;
}

export interface JournalMetric {
  id: string;
  name: string;
  issns: string[];
  value: number | null;
  year: number | null;
  sourceUrl: string;
  verifiedOn: string | null;
  verification: 'official' | 'unverified';
  note: string;
}

export interface GuidelineSource {
  id: string;
  country: string;
  organization: string;
  title: string;
  url: string;
  kind: 'guideline' | 'directory' | 'care-standard';
  edition: string | null;
  note: string;
  checkedAt?: string;
  lastSuccessAt?: string;
  status?: 'ok' | 'error';
  error?: string;
  links?: { title: string; url: string }[];
}

export interface EvidenceFeed {
  records: EvidenceRecord[];
  query: string;
  from: string;
  to: string;
  matched: number;
  excludedDates: number;
  excludedJournal: number;
  lastSuccessAt: string | null;
  status: 'ok' | 'error' | 'not-run';
  error?: string;
}

export interface EvidenceSnapshot {
  schemaVersion: 1;
  attemptedAt: string;
  preview: boolean;
  feeds: { trials: EvidenceFeed; guidelines: EvidenceFeed; recent: EvidenceFeed };
  metrics: JournalMetric[];
  sources: GuidelineSource[];
}
