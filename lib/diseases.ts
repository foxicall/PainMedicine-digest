// Title-based indexing is a navigation aid, never a confirmed study diagnosis.
// Curated studies use explicit population-based labels, including overlapping cohorts.
export const DISEASES = [
  {
    id: 'pdn',
    label: 'Painful diabetic neuropathy',
    group: 'Neuropathic pain',
    pattern: /diabet\w*.{0,40}(neuropath|nerve pain)|(neuropath\w*|nerve pain).{0,40}diabet/i,
  },
  {
    id: 'phn',
    label: 'Postherpetic neuralgia',
    group: 'Neuropathic pain',
    pattern: /post[ -]?herpetic|herpes zoster.{0,30}(pain|neuralgia)/i,
  },
  {
    id: 'radicular',
    label: 'Sciatica / radicular pain',
    group: 'Neuropathic pain',
    pattern: /sciatica|radicul\w*|radicular pain/i,
  },
  {
    id: 'trigeminal',
    label: 'Trigeminal neuralgia',
    group: 'Neuropathic pain',
    pattern: /trigeminal neuralgia/i,
  },
  {
    id: 'crps',
    label: 'Complex regional pain syndrome',
    group: 'Neuropathic pain',
    pattern: /complex regional pain|\bCRPS\b/i,
  },
  {
    id: 'neuropathic',
    label: 'Other / unspecified neuropathic pain',
    group: 'Neuropathic pain',
    pattern: /neuropath\w*|neuralgia|phantom limb/i,
  },
  {
    id: 'episodic-migraine',
    label: 'Episodic migraine',
    group: 'Headache & facial pain',
    pattern: /episodic (?:and chronic )?migraine|chronic and episodic migraine/i,
  },
  {
    id: 'chronic-migraine',
    label: 'Chronic migraine',
    group: 'Headache & facial pain',
    pattern: /chronic (?:and episodic )?migraine|episodic and chronic migraine/i,
  },
  {
    id: 'migraine',
    label: 'Migraine — subtype unspecified',
    group: 'Headache & facial pain',
    pattern: /migraine/i,
  },
  {
    id: 'cluster',
    label: 'Cluster headache',
    group: 'Headache & facial pain',
    pattern: /cluster headache/i,
  },
  {
    id: 'headache',
    label: 'Other headache / facial pain',
    group: 'Headache & facial pain',
    pattern: /headache|facial pain|temporomandibular/i,
  },
  {
    id: 'low-back',
    label: 'Low back / chronic back & leg pain',
    group: 'Musculoskeletal & spine',
    pattern: /(?:low[ -]?back|back|lumbar).{0,20}pain|failed back surgery|spinal stenosis/i,
  },
  {
    id: 'osteoarthritis',
    label: 'Osteoarthritis',
    group: 'Musculoskeletal & spine',
    pattern: /osteoarthrit/i,
  },
  {
    id: 'fibromyalgia',
    label: 'Fibromyalgia',
    group: 'Musculoskeletal & spine',
    pattern: /fibromyalgia/i,
  },
  {
    id: 'neck',
    label: 'Neck pain / cervical disorders',
    group: 'Musculoskeletal & spine',
    pattern: /neck pain|cervical (?:pain|radicul|spondyl)/i,
  },
  {
    id: 'musculoskeletal',
    label: 'Other musculoskeletal pain',
    group: 'Musculoskeletal & spine',
    pattern: /musculoskeletal|shoulder pain|tendinopathy|myofascial|arthritis/i,
  },
  {
    id: 'cancer',
    label: 'Cancer-related pain',
    group: 'Other pain conditions',
    pattern:
      /cancer pain|cancer-related pain|pain.{0,30}(?:cancer|malignan)|(?:cancer|malignan).{0,30}pain/i,
  },
  {
    id: 'postoperative',
    label: 'Postoperative / procedural pain',
    group: 'Other pain conditions',
    pattern:
      /post[ -]?operativ|postsurgical|post-surgical|perioperativ|surgical pain|procedural pain|labor analgesia/i,
  },
  {
    id: 'pelvic',
    label: 'Pelvic pain / endometriosis',
    group: 'Other pain conditions',
    pattern: /pelvic pain|endometriosis|dysmenorrh/i,
  },
  {
    id: 'unclassified',
    label: 'Other / unclassified pain',
    group: 'Other pain conditions',
    pattern: /$^/,
  },
] as const;
export type DiseaseId = (typeof DISEASES)[number]['id'];
export interface DiseaseClassification {
  ids: DiseaseId[];
  basis: 'Reviewed population' | 'Title keywords — unconfirmed';
}

export const curatedDiseases: Record<string, DiseaseId[]> = {
  '36007534': ['pdn'],
  '33818600': ['pdn'],
  '32209650': ['chronic-migraine'],
  '29171818': ['chronic-migraine'],
  '29813147': ['episodic-migraine'],
  '29848108': ['episodic-migraine'],
  '29171821': ['episodic-migraine'],
  '29509867': ['low-back', 'osteoarthritis'],
  '28328324': ['radicular'],
  '28672319': ['low-back'],
  '27584814': ['low-back'],
  '27002445': ['low-back'],
};

export function classifyDisease(record: { pmid: string; title: string }): DiseaseClassification {
  const curated = curatedDiseases[record.pmid];
  if (curated) return { ids: curated, basis: 'Reviewed population' };
  const title = record.title
    .normalize('NFKC')
    .replace(/[‐‑–—]/g, '-')
    .replace(/non[ -]?(?:cancer|malignant)/gi, 'nononcologic');
  let ids: DiseaseId[] = DISEASES.filter((d) => d.pattern.test(title)).map((d) => d.id);
  // Avoid generic labels when a more specific subtype is present in the title.
  if (ids.some((id) => ['pdn', 'phn', 'radicular', 'trigeminal', 'crps'].includes(id)))
    ids = ids.filter((id) => id !== 'neuropathic');
  if (ids.some((id) => id === 'episodic-migraine' || id === 'chronic-migraine'))
    ids = ids.filter((id) => id !== 'migraine');
  if (
    ids.some((id) => ['episodic-migraine', 'chronic-migraine', 'migraine', 'cluster'].includes(id))
  )
    ids = ids.filter((id) => id !== 'headache');
  if (ids.includes('osteoarthritis')) ids = ids.filter((id) => id !== 'musculoskeletal');
  return { ids: ids.length ? ids : ['unclassified'], basis: 'Title keywords — unconfirmed' };
}
export const diseaseLabel = (id: DiseaseId) => DISEASES.find((d) => d.id === id)!.label;

export function diseaseCounts(records: { pmid: string; title: string }[]) {
  const counts = new Map<DiseaseId, number>();
  for (const record of records)
    for (const id of classifyDisease(record).ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}
