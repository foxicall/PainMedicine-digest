import type { ClinicalTrialSummary, Specialty } from '@/types/trial';

const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
export const PUBMED_STRATEGY =
  '("Pain"[Mesh] OR "Pain Management"[Mesh] OR "Neuropathic Pain" OR "Chronic Pain" OR "Migraine Disorders"[Mesh]) AND ("randomized controlled trial"[pt] OR "RCT") AND ("2016/01/01"[Date - Publication] : "3000"[Date - Publication])';
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Per-browser queue: <=2.5 requests/sec, including retries. A shared deployment
// should proxy/cache centrally to enforce NCBI's per-IP aggregate rate limit.
async function ncbiRequest(
  endpoint: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<string> {
  const job = async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await delay(Math.max(0, 420 - (Date.now() - lastRequest)));
      signal?.throwIfAborted();
      lastRequest = Date.now();
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(abort, 15000);
      try {
        const url = `${BASE}${endpoint}?${new URLSearchParams({ db: 'pubmed', tool: 'pain_medicine_trial_digest', ...params })}`;
        const response = await fetch(url, { signal: controller.signal });
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          const retryAfter = Number(response.headers.get('retry-after'));
          await delay(Math.min(10000, Math.max(1000 * (attempt + 1), retryAfter * 1000 || 0)));
          continue;
        }
        if (!response.ok)
          throw new Error(`PubMed returned HTTP ${response.status}. Try again later.`);
        return await response.text();
      } catch (error) {
        if (signal?.aborted) throw error;
        if (controller.signal.aborted)
          throw new Error('PubMed request timed out. Your local library is still available.');
        if (error instanceof TypeError)
          throw new Error('PubMed could not be reached. Check your connection or try again later.');
        throw error;
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
      }
    }
    throw new Error('PubMed is busy. Please try again later.');
  };
  const request = queue.then(job, job);
  queue = request.catch(() => undefined);
  return request;
}

export function publicationEndDate(now = new Date()) {
  return now < new Date('2027-01-01T00:00:00Z')
    ? now.toISOString().slice(0, 10).replaceAll('-', '/')
    : '2026/12/31';
}

const text = (el: Element, selector: string) =>
  el.querySelector(selector)?.textContent?.trim() ?? '';
const NR = 'Not extracted; review the source abstract and full text.';

export function parsePubMedXML(xml: string): ClinicalTrialSummary[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('PubMed returned invalid XML.');
  if (doc.querySelector('ERROR'))
    throw new Error('PubMed returned an error in the article response.');
  return Array.from(doc.querySelectorAll('PubmedArticle')).flatMap((article) => {
    const a = article.querySelector('MedlineCitation > Article');
    if (!a) return [];
    const pmid = text(article, 'MedlineCitation > PMID');
    const title = text(a, 'ArticleTitle');
    const rawDate = text(a, 'Journal > JournalIssue > PubDate');
    const year = Number(
      text(a, 'Journal > JournalIssue > PubDate > Year') || rawDate.match(/(?:19|20)\d{2}/)?.[0],
    );
    const publications = Array.from(
      a.querySelectorAll('PublicationTypeList > PublicationType'),
    ).map((t) => t.textContent?.toLowerCase());
    // Broad search can return protocols or articles that just mention "RCT".
    if (
      !pmid ||
      !title ||
      !Number.isFinite(year) ||
      year < 2016 ||
      year > 2026 ||
      !publications.includes('randomized controlled trial')
    )
      return [];
    const abstract = Array.from(a.querySelectorAll('Abstract > AbstractText'))
      .map(
        (el) =>
          `${el.getAttribute('Label') ? el.getAttribute('Label') + ': ' : ''}${el.textContent?.trim() ?? ''}`,
      )
      .join('\n\n');
    const authors = Array.from(a.querySelectorAll('AuthorList > Author'))
      .map(
        (author) =>
          text(author, 'CollectiveName') ||
          `${text(author, 'LastName')} ${text(author, 'Initials')}`.trim(),
      )
      .filter(Boolean);
    const personal = Array.from(a.querySelectorAll('AuthorList > Author'))
      .filter((el) => text(el, 'LastName'))
      .map((el) => `${text(el, 'LastName')} ${text(el, 'Initials')}`.trim());
    const doi = text(article, 'PubmedData > ArticleIdList > ArticleId[IdType="doi"]') || null;
    const journal = text(a, 'Journal > Title');
    const journalAbbreviation = text(a, 'Journal > ISOAbbreviation') || journal;
    const corpus = `${title} ${abstract}`;
    const specialties: Specialty[] = [];
    if (/neuropath|sciatica|radicul|postherpetic/i.test(corpus))
      specialties.push('Neuropathic Pain');
    if (/migraine|headache|trigeminal|facial pain/i.test(corpus))
      specialties.push('Headache & Facial Pain');
    if (/back pain|osteoarthritis|fibromyalgia|musculoskeletal|spinal/i.test(corpus))
      specialties.push('Musculoskeletal / Spine');
    if (/stimulation|radiofrequency|epidural|ablation/i.test(corpus))
      specialties.push('Interventional Pain');
    if (
      /gabapentin|pregabalin|duloxetine|opioid|cgrp|cannabinoid|zumab|gepant|amitriptyline/i.test(
        corpus,
      )
    )
      specialties.push('Pharmacotherapy');
    return [
      {
        id: pmid,
        pmid,
        acronym: 'PUBMED IMPORT',
        title,
        displayTitle: title.replace(/\.$/, ''),
        authors,
        leadAuthor: personal[0] || authors[0] || 'Not listed',
        seniorAuthor: personal.at(-1) || 'Not listed',
        journal,
        journalAbbreviation,
        year,
        volume: text(a, 'JournalIssue > Volume'),
        issue: text(a, 'JournalIssue > Issue'),
        pages: text(a, 'Pagination > MedlinePgn') || text(a, 'Pagination > StartPage'),
        doi,
        highImpact: /JAMA|Lancet|N Engl J Med|Cephalalgia|^Pain$|Anesthesiology/i.test(
          journalAbbreviation,
        ),
        specialties,
        interventionType: null,
        sampleSize: null,
        sampleSizeBasis: 'Not extracted',
        duration: 'Not extracted',
        bottomLine:
          'Newly indexed evidence. Read the abstract and source paper; a clinical takeaway has not yet been appraised.',
        pico: { population: NR, intervention: NR, comparator: NR, outcomes: NR },
        outcome: {
          label: 'Awaiting outcome extraction',
          value: 'Not appraised',
          context: 'View the source abstract',
          pValue: null,
          confidenceInterval: null,
          nnt: null,
          nnh: null,
          clinicalMeaning: NR,
          timepoint: NR,
          kind: 'unreviewed' as const,
        },
        safety: { summary: NR, discontinuation: null },
        methodology: {
          blinding: NR,
          randomization: NR,
          intentionToTreat: NR,
          riskOfBias: 'Not formally assessed' as const,
          limitations:
            'Bibliographic data only. Specialty tags are keyword-generated and require review.',
        },
        provenance: {
          source: 'pubmed-live' as const,
          reviewedOn: null,
          status: 'Awaiting appraisal' as const,
          sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        },
        abstract: abstract || null,
      },
    ];
  });
}

export async function searchPubMed(query: string, signal?: AbortSignal) {
  // Bound the user's open-ended strategy to the requested publication window.
  const term = `(${PUBMED_STRATEGY}) AND ("2016/01/01"[Date - Publication] : "${publicationEndDate()}"[Date - Publication])${query.trim() ? ` AND (${query.trim()})` : ''}`;
  const payload = JSON.parse(
    await ncbiRequest(
      'esearch.fcgi',
      { term, retmode: 'json', retmax: '30', sort: 'pub_date' },
      signal,
    ),
  );
  const result = payload.esearchresult;
  if (payload.error || result?.errorlist || !Array.isArray(result?.idlist))
    throw new Error('PubMed could not process this search. Try a simpler query.');
  if (!result.idlist.length) return { trials: [], total: Number(result.count) || 0, fetched: 0 };
  const xml = await ncbiRequest(
    'efetch.fcgi',
    { id: result.idlist.join(','), retmode: 'xml' },
    signal,
  );
  return {
    trials: parsePubMedXML(xml),
    total: Number(result.count) || 0,
    fetched: result.idlist.length,
  };
}

// Independent of the legacy RCT/year search: newer/nonrandomized indexed trials
// must also be able to retrieve their original abstract. Never infer a dose.
export async function fetchStudyAbstract(pmid: string, signal?: AbortSignal) {
  if (!/^\d{1,10}$/.test(pmid)) throw new Error('Invalid PubMed identifier.');
  const xml = await ncbiRequest('efetch.fcgi', { id: pmid, retmode: 'xml' }, signal);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror, ERROR'))
    throw new Error('PubMed returned an invalid article response.');
  const article = Array.from(doc.querySelectorAll('PubmedArticle')).find(
    (a) => text(a, 'MedlineCitation > PMID') === pmid,
  );
  if (!article) throw new Error('The requested PubMed article was not returned.');
  return {
    pmid,
    abstract:
      Array.from(article.querySelectorAll('Article > Abstract > AbstractText'))
        .map(
          (el) =>
            `${el.getAttribute('Label') ? `${el.getAttribute('Label')}: ` : ''}${el.textContent?.trim() ?? ''}`,
        )
        .join('\n\n') || null,
  };
}
