import { describe, expect, it } from 'vitest';
import { phnPilot, getPhnTrial, resolvePhnTrial } from '@/lib/phn-pilot';
import { evidenceToTrial } from '@/lib/evidence';
import type { EvidenceRecord } from '@/types/evidence';

describe('PHN source-assisted pilot', () => {
  it('keeps the source index, detailed reports and API accounting consistent', () => {
    expect(phnPilot.records).toHaveLength(phnPilot.counts.candidates);
    expect(new Set(phnPilot.records.map((record) => record.pmid)).size).toBe(
      phnPilot.records.length,
    );
    expect(phnPilot.trials).toHaveLength(phnPilot.counts.detailed);
    expect(phnPilot.trials.length).toBeGreaterThanOrEqual(10);
    for (const trial of phnPilot.trials) {
      const record = phnPilot.records.find((item) => item.pmid === trial.pmid)!;
      expect(record.hasDetailed && record.fullTextAvailable).toBe(true);
      expect(record.category).toBe(trial.extraction!.clinicalContext);
      expect(trial.provenance.status).toBe('Extraction draft');
      expect(trial.extraction!.evidence.length).toBeGreaterThanOrEqual(8);
      expect(trial.methodology.riskOfBias).toBe('Not formally assessed');
      expect(trial.outcome.nnt).toBeNull();
      expect(trial.outcome.nnh).toBeNull();
    }
    if (phnPilot.execution.externalApiStatus === 'not-run') {
      expect(phnPilot.execution.requests).toBe(0);
      expect(phnPilot.execution.inputTokens + phnPilot.execution.outputTokens).toBe(0);
      expect(phnPilot.execution.costUsd).toBe(0);
      expect(phnPilot.execution.models).toEqual({ screening: null, fullText: null });
    }
  });

  it('preserves clinically material distinctions rather than upgrading negative or incomplete evidence', () => {
    const prevention = getPhnTrial('31166976')!;
    expect(prevention.extraction!.clinicalContext).toBe('prevention');
    expect(prevention.bottomLine).toMatch(/not|no significant/i);
    const crisugabalin = getPhnTrial('39320907')!;
    expect(crisugabalin.sampleSize).toBe(372);
    expect(crisugabalin.sampleSizeBasis).toContain('366');
    const saline = getPhnTrial('36451915')!;
    expect(saline.sampleSize).toBe(40);
    expect(saline.sampleSizeBasis).toContain('36');
    expect(saline.bottomLine).toMatch(/did not improve|no.*benefit/i);
    expect(getPhnTrial('28266963')!.outcome.context + getPhnTrial('28266963')!.bottomLine).toMatch(
      /primary.*not|no.*primary|negative primary/i,
    );
    for (const pmid of ['26714731', '27764706']) {
      expect(phnPilot.records.find((record) => record.pmid === pmid)!.category).toBe('other');
    }
  });

  it('opens current source drafts from PubMed metadata while preserving unrelated records', () => {
    const trial = getPhnTrial('41527251')!;
    const metadata: EvidenceRecord = {
      pmid: trial.pmid,
      title: trial.title,
      authors: trial.authors,
      journal: trial.journal,
      journalAbbreviation: trial.journalAbbreviation,
      issns: [],
      publicationDate: '2026-01-12',
      datePrecision: 'day',
      dateBasis: 'electronic',
      publicationTypes: ['Randomized Controlled Trial'],
      doi: trial.doi,
      volume: '',
      issue: '',
      pages: '',
    };
    expect(evidenceToTrial(metadata)).toBe(trial);
    expect(resolvePhnTrial({ ...trial, treatmentProtocol: undefined, extraction: undefined })).toBe(
      trial,
    );
    const unrelated = { ...trial, id: '12345678', pmid: '12345678' };
    expect(resolvePhnTrial(unrelated)).toBe(unrelated);
  });
});
