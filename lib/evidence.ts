import { useQuery } from '@tanstack/react-query';
import preview from '@/data/evidence-preview.json';
import type { EvidenceRecord, EvidenceSnapshot, JournalMetric } from '@/types/evidence';
import type { ClinicalTrialSummary } from '@/types/trial';
import { seedTrials } from '@/data/seed-trials';

export function shiftMonths(day: Date, months: number) {
  const shifted = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0));
  shifted.setUTCDate(Math.min(day.getUTCDate(), lastDay.getUTCDate()));
  return shifted.toISOString().slice(0, 10);
}

export function eligibleMetric(metric: JournalMetric, now = new Date()) {
  const age = metric.verifiedOn
    ? (now.getTime() - Date.parse(metric.verifiedOn)) / 86400000
    : Infinity;
  return (
    metric.verification === 'official' &&
    metric.value !== null &&
    metric.value > 10 &&
    metric.year !== null &&
    metric.year >= now.getUTCFullYear() - 2 &&
    metric.year < now.getUTCFullYear() &&
    age >= 0 &&
    age < 366
  );
}

export function withinWindow(record: EvidenceRecord, from: string, to: string) {
  let end = record.publicationDate;
  const date = new Date(`${record.publicationDate}T00:00:00Z`);
  if (record.datePrecision === 'month') {
    end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10);
  }
  if (record.datePrecision === 'year') end = `${date.getUTCFullYear()}-12-31`;
  return record.publicationDate >= from && end <= to;
}

export function validateSnapshot(value: unknown): EvidenceSnapshot {
  const data = value as EvidenceSnapshot;
  if (
    data?.schemaVersion !== 1 ||
    !data.feeds ||
    !Array.isArray(data.metrics) ||
    !Array.isArray(data.sources)
  ) {
    throw new Error('The evidence snapshot is invalid. Showing the bundled preview.');
  }
  for (const key of ['trials', 'guidelines', 'recent'] as const) {
    const feed = data.feeds[key];
    if (
      !feed ||
      !Array.isArray(feed.records) ||
      !Number.isFinite(feed.matched) ||
      !Number.isFinite(feed.excludedDates) ||
      !Number.isFinite(feed.excludedJournal) ||
      !['ok', 'error', 'not-run'].includes(feed.status) ||
      feed.records.some(
        (r) =>
          !/^\d+$/.test(r.pmid) ||
          typeof r.title !== 'string' ||
          !Array.isArray(r.authors) ||
          !Array.isArray(r.issns) ||
          typeof r.journal !== 'string' ||
          typeof r.journalAbbreviation !== 'string' ||
          !Array.isArray(r.publicationTypes) ||
          !['day', 'month', 'year'].includes(r.datePrecision) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(r.publicationDate) ||
          !Number.isFinite(Date.parse(r.publicationDate)),
      )
    ) {
      throw new Error('Incomplete evidence snapshot. The last available preview is retained.');
    }
  }
  return data;
}

export function useEvidence() {
  return useQuery({
    queryKey: ['evidence-snapshot-v1'],
    initialData: preview as EvidenceSnapshot,
    initialDataUpdatedAt: 0,
    queryFn: async ({ signal }) => {
      const response = await fetch(`${import.meta.env.BASE_URL}data/evidence.json`, {
        signal,
        cache: 'no-cache',
      });
      if (!response.ok)
        throw new Error(
          `Update unavailable (HTTP ${response.status}); showing the last available snapshot.`,
        );
      return validateSnapshot(await response.json());
    },
    staleTime: 5 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: 1,
  });
}

const NR = 'Awaiting extraction and clinical appraisal. Review the source paper.';
export function evidenceToTrial(record: EvidenceRecord): ClinicalTrialSummary {
  const curated = seedTrials.find((t) => t.pmid === record.pmid);
  if (curated) return curated;
  return {
    id: record.pmid,
    pmid: record.pmid,
    acronym: 'INDEXED PUBLICATION',
    title: record.title,
    displayTitle: record.title,
    authors: record.authors,
    leadAuthor: record.authors[0] ?? 'Not listed',
    seniorAuthor: record.authors.at(-1) ?? 'Not listed',
    journal: record.journal,
    journalAbbreviation: record.journalAbbreviation,
    year: Number(record.publicationDate.slice(0, 4)),
    volume: record.volume,
    issue: record.issue,
    pages: record.pages,
    doi: record.doi,
    highImpact: false,
    specialties: [],
    interventionType: null,
    sampleSize: null,
    sampleSizeBasis: 'Not extracted',
    duration: 'Not extracted',
    bottomLine:
      'This publication has been indexed automatically. A clinical take-home message has not yet been appraised.',
    pico: { population: NR, intervention: NR, comparator: NR, outcomes: NR },
    outcome: {
      label: 'Awaiting outcome extraction',
      value: 'Not appraised',
      context: 'Read the source paper',
      pValue: null,
      confidenceInterval: null,
      nnt: null,
      nnh: null,
      clinicalMeaning: NR,
      timepoint: NR,
      kind: 'unreviewed',
    },
    safety: { summary: NR, discontinuation: null },
    methodology: {
      blinding: NR,
      randomization: NR,
      intentionToTreat: NR,
      riskOfBias: 'Not formally assessed',
      limitations: `Publication types: ${record.publicationTypes.join('; ')}. Bibliographic metadata only; clinical trial does not necessarily mean randomized trial.`,
    },
    provenance: {
      source: 'pubmed-live',
      status: 'Awaiting appraisal',
      reviewedOn: null,
      sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${record.pmid}/`,
    },
    abstract: null,
  };
}
