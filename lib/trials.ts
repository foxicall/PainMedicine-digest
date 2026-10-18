import Fuse from 'fuse.js';
import type { ClinicalTrialSummary, TrialFilters } from '@/types/trial';

export const defaultFilters: TrialFilters = {
  query: '',
  specialties: [],
  years: [2016, Math.max(2026, new Date().getUTCFullYear())],
  minSample: 0,
  interventions: [],
  highImpactOnly: false,
};

export function searchTrials(trials: ClinicalTrialSummary[], query: string) {
  if (!query.trim()) return trials;
  const fuse = new Fuse(trials, {
    keys: [
      { name: 'acronym', weight: 2 },
      { name: 'displayTitle', weight: 2 },
      'title',
      'bottomLine',
      'pico.population',
      'pico.intervention',
      'specialties',
      'authors',
      'pmid',
      'journal',
    ],
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
  const phrase = fuse.search(query.trim()).map((r) => r.item);
  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (phrase.length || words.length < 2) return phrase;
  // Intersect word-level fuzzy hits for compound clinical queries.
  const hitSets = words.map((word) => new Set(fuse.search(word).map((r) => r.item.id)));
  return trials.filter((t) => hitSets.every((hits) => hits.has(t.id)));
}

export function filterTrials(trials: ClinicalTrialSummary[], filters: TrialFilters) {
  return searchTrials(trials, filters.query).filter(
    (t) =>
      t.year >= filters.years[0] &&
      t.year <= filters.years[1] &&
      (!filters.specialties.length || filters.specialties.some((s) => t.specialties.includes(s))) &&
      (!filters.minSample || (t.sampleSize !== null && t.sampleSize >= filters.minSample)) &&
      (!filters.interventions.length ||
        (t.interventionType !== null && filters.interventions.includes(t.interventionType))) &&
      (!filters.highImpactOnly || t.highImpact),
  );
}

export function activeFilterCount(f: TrialFilters) {
  return (
    f.specialties.length +
    f.interventions.length +
    Number(f.minSample > 0) +
    Number(f.highImpactOnly) +
    Number(f.years[0] !== defaultFilters.years[0] || f.years[1] !== defaultFilters.years[1])
  );
}

export function mergeTrials(local: ClinicalTrialSummary[], incoming: ClinicalTrialSummary[]) {
  // Reviewed local records take precedence over unappraised live metadata.
  return Array.from(new Map([...incoming, ...local].map((t) => [t.pmid, t])).values());
}

export function evidenceMatches(trials: ClinicalTrialSummary[], question: string) {
  const stopwords = new Set([
    'what',
    'which',
    'does',
    'with',
    'have',
    'show',
    'about',
    'does',
    'help',
    'the',
    'for',
    'and',
    'are',
    'how',
    'can',
    'did',
    'there',
    'trials',
    'evidence',
    'compared',
    'versus',
    'effective',
    'work',
    'better',
    'than',
  ]);
  const words = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));
  if (!words.length) return [];
  const scores = new Map<string, number>();
  for (const word of words)
    for (const t of searchTrials(trials, word)) scores.set(t.id, (scores.get(t.id) ?? 0) + 1);
  const max = Math.max(0, ...scores.values());
  return trials
    .filter((t) => (scores.get(t.id) ?? 0) >= Math.max(1, max - 1))
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
    .slice(0, 4);
}
