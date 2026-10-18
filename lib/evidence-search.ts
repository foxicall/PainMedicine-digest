import Fuse from 'fuse.js';
import type { EvidenceRecord } from '@/types/evidence';

const normalize = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// Build the search corpus once per feed/filter change. Most clinical queries
// match their words directly; fuzzy scoring is needed only for unmatched input.
export function createEvidenceSearch(records: EvidenceRecord[]) {
  const entries = records.map((record) => ({
    record,
    text: normalize(
      `${record.title} ${record.journal} ${record.journalAbbreviation} ${record.authors.join(' ')} ${record.pmid}`,
    ),
  }));
  let fuzzy: Fuse<(typeof entries)[number]> | undefined;
  return (query: string): EvidenceRecord[] => {
    const text = normalize(query);
    if (!text) return records;
    const words = text.split(' ');
    const exact = entries.filter((entry) => words.every((word) => entry.text.includes(word)));
    if (exact.length) return exact.map((entry) => entry.record);
    fuzzy ??= new Fuse(entries, {
      keys: ['text'],
      threshold: 0.3,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
    return fuzzy.search(text).map((result) => result.item.record);
  };
}
