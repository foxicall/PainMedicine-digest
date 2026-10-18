import { describe, it, expect } from 'vitest';
import { seedTrials } from '@/data/seed-trials';
import { defaultFilters, filterTrials, mergeTrials, evidenceMatches } from '@/lib/trials';
import { csvCell, toBibTeX, toCSV, vancouverCitation } from '@/lib/export';

describe('clinical library invariants', () => {
  it('has 12 uniquely identified, in-window source-linked reports', () => {
    expect(seedTrials).toHaveLength(12);
    expect(new Set(seedTrials.map((t) => t.pmid)).size).toBe(12);
    for (const t of seedTrials) {
      expect(t.year).toBeGreaterThanOrEqual(2016);
      expect(t.year).toBeLessThanOrEqual(2026);
      expect(t.provenance.sourceUrl).toBe(`https://pubmed.ncbi.nlm.nih.gov/${t.pmid}/`);
      expect(t.doi).toMatch(/^10\./);
      expect(t.methodology.riskOfBias).toBe('Not formally assessed');
      expect(t.authors).toContain(t.leadAuthor);
    }
  });
  it('does not present the SENZA 24-month follow-up as the primary endpoint', () => {
    expect(seedTrials.find((t) => t.pmid === '27584814')?.outcome.kind).toBe('secondary');
  });
  it('retains original sample denominators and labels derived NNT', () => {
    expect(seedTrials.find((t) => t.acronym === 'PROMISE-2')?.sampleSizeBasis).toBe(
      'Treated participants',
    );
    for (const t of seedTrials.filter((t) => t.outcome.nnt))
      expect(t.outcome.nnt).toContain('calculated');
  });
});

describe('search and filtering', () => {
  it('finds a misspelled molecule name', () => {
    expect(
      filterTrials(seedTrials, { ...defaultFilters, query: 'fremanezumabb' }).map((t) => t.acronym),
    ).toContain('HALO-CM');
  });
  it('finds multiword stimulation queries', () => {
    expect(
      filterTrials(seedTrials, {
        ...defaultFilters,
        query: 'spinal cord stimulation high frequency',
      }).length,
    ).toBeGreaterThan(0);
  });
  it('combines sample size, year, intervention, and specialty filters', () => {
    const found = filterTrials(seedTrials, {
      ...defaultFilters,
      years: [2018, 2020],
      minSample: 500,
      specialties: ['Headache & Facial Pain'],
      interventions: ['Drug'],
    });
    expect(found.map((t) => t.acronym).sort()).toEqual(['EVOLVE-1', 'EVOLVE-2', 'PROMISE-2']);
  });
  it('combines specialty choices with OR, and omits unknown N when a threshold is active', () => {
    const unknown = { ...seedTrials[0], sampleSize: null };
    expect(filterTrials([unknown], { ...defaultFilters, minSample: 100 })).toEqual([]);
    expect(filterTrials([unknown], defaultFilters)).toHaveLength(1);
    const found = filterTrials(seedTrials, {
      ...defaultFilters,
      specialties: ['Neuropathic Pain', 'Headache & Facial Pain'],
    });
    expect(found.some((t) => t.acronym === 'PRECISE')).toBe(true);
    expect(found.some((t) => t.acronym === 'HALO-CM')).toBe(true);
  });
  it('returns an empty state for unmatched conditions', () => {
    expect(filterTrials(seedTrials, { ...defaultFilters, query: 'xyzzyunmatched' })).toHaveLength(
      0,
    );
  });
  it('prefers reviewed seed summaries when merging duplicate PMID records', () => {
    expect(mergeTrials([seedTrials[0]], [{ ...seedTrials[0], bottomLine: 'Unreviewed' }])).toEqual([
      seedTrials[0],
    ]);
  });
  it('retrieves source findings for evidence questions without answering unsupported questions', () => {
    expect(
      evidenceMatches(seedTrials, 'Does pregabalin help sciatica?').map((t) => t.acronym),
    ).toContain('PRECISE');
    expect(evidenceMatches(seedTrials, 'What about xyzzyunmatched?')).toEqual([]);
  });
});

describe('portable exports', () => {
  it('neutralizes spreadsheet formulas including whitespace-prefixed ones', () => {
    for (const input of ['=HYPERLINK("bad")', '+cmd', '-cmd', '@sum', '  =1+1', '\tbad'])
      expect(csvCell(input)).toMatch(/^"'/);
    expect(csvCell('A "quote", and comma')).toBe('"A ""quote"", and comma"');
  });
  it('includes user notes, sources, and clinical context in CSV', () => {
    const csv = toCSV([seedTrials[0]], { [seedTrials[0].id]: 'Journal club\nFollow up' });
    expect(csv).toContain('Journal club\nFollow up');
    expect(csv).toContain(seedTrials[0].provenance.sourceUrl);
    expect(csv).toContain('Not formally assessed');
  });
  it('produces complete Vancouver and BibTeX identifiers', () => {
    const trial = seedTrials[0];
    expect(vancouverCitation(trial)).toContain(`PMID: ${trial.pmid}`);
    expect(vancouverCitation(trial)).toContain(trial.doi);
    expect(toBibTeX([trial])).toContain(`@article{pubmed${trial.pmid}`);
    expect(toBibTeX([trial])).toContain(' and ');
    expect(toBibTeX([trial])).toContain('Tesfaye, S and');
    expect(toBibTeX([trial])).toContain('{OPTION-DM trial group}');
    expect(vancouverCitation(trial)).toContain('680-690');
  });
});
