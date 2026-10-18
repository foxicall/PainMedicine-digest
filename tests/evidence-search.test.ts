import { describe, expect, it } from 'vitest';
import { createEvidenceSearch } from '@/lib/evidence-search';
import type { EvidenceRecord } from '@/types/evidence';

const records = [
  {
    pmid: '100',
    title: 'High-frequency spinal cord stimulation for pain',
    journal: 'PAIN',
    journalAbbreviation: 'Pain',
    authors: ['García AB'],
  },
  {
    pmid: '200',
    title: 'Fremanezumab for chronic migraine',
    journal: 'New England Journal of Medicine',
    journalAbbreviation: 'N Engl J Med',
    authors: ['Smith CD'],
  },
] as EvidenceRecord[];
describe('clinical index search', () => {
  it('matches reordered clinical terms, hyphens, authors and exact PMIDs', () => {
    const search = createEvidenceSearch(records);
    expect(search('spinal cord high frequency').map((r) => r.pmid)).toEqual(['100']);
    expect(search('garcia').map((r) => r.pmid)).toEqual(['100']);
    expect(search('200').map((r) => r.pmid)).toEqual(['200']);
  });
  it('retains fuzzy matching for drug-name typos and empty-search reset', () => {
    const search = createEvidenceSearch(records);
    expect(search('fremanezumabb').map((r) => r.pmid)).toEqual(['200']);
    expect(search('')).toEqual(records);
    expect(search('nonexistentmoleculename')).toEqual([]);
  });
});
