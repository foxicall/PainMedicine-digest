import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Globe2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { createEvidenceSearch } from '@/lib/evidence-search';
import { classifyDisease, diseaseCounts, diseaseLabel, type DiseaseId } from '@/lib/diseases';
import { treatmentProtocols } from '@/data/treatment-protocols';
import { DiseaseSelect } from './DiseaseSelect';
import { ReadingActions, ReadingFilter, type ReadingStatus } from './ReadingActions';
import { useLibrary } from '@/lib/store';
import {
  eligibleMetric,
  evidenceToTrial,
  shiftMonths,
  useEvidence,
  withinWindow,
} from '@/lib/evidence';
import type { ClinicalTrialSummary } from '@/types/trial';
import type { EvidenceRecord, EvidenceSnapshot } from '@/types/evidence';

type Tab = keyof EvidenceSnapshot['feeds'];
const PAGE_SIZE = 24;
const dateLabel = (record: EvidenceRecord) =>
  record.publicationDate.slice(
    0,
    record.datePrecision === 'year' ? 4 : record.datePrecision === 'month' ? 7 : 10,
  );
const timestamp = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not yet successful';

export function EvidenceWatch({
  onOpenTrial,
}: {
  onOpenTrial: (trial: ClinicalTrialSummary) => void;
}) {
  const query = useEvidence();
  const data = query.data;
  const [tab, setTab] = useState<Tab>('trials');
  const [search, setSearch] = useState('');
  const [settledSearch, setSettledSearch] = useState('');
  const [country, setCountry] = useState('All countries');
  const [rctOnly, setRctOnly] = useState(false);
  const [disease, setDisease] = useState<DiseaseId | 'all'>('all');
  const [readingStatus, setReadingStatus] = useState<ReadingStatus>('all');
  const readIds = useLibrary((s) => s.readIds);
  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const [page, setPage] = useState(0);
  const today = new Date().toISOString().slice(0, 10);
  const start =
    tab === 'trials'
      ? shiftMonths(new Date(), -120)
      : tab === 'recent'
        ? shiftMonths(new Date(), -3)
        : '1900-01-01';
  const feed = data.feeds[tab];
  const stale = !feed.lastSuccessAt || Date.now() - Date.parse(feed.lastSuccessAt) > 48 * 3600_000;
  useEffect(() => {
    const timer = setTimeout(() => setSettledSearch(search), 175);
    return () => clearTimeout(timer);
  }, [search]);
  const eligibleRecords = useMemo(() => {
    let rows = feed.records.filter((r) => withinWindow(r, start, today));
    if (tab === 'recent')
      rows = rows.filter((r) =>
        data.metrics.some(
          (m) =>
            m.id === r.metricId &&
            eligibleMetric(m) &&
            m.issns.some((issn) => r.issns.includes(issn)),
        ),
      );
    if (tab === 'trials' && rctOnly)
      rows = rows.filter((r) => r.publicationTypes.includes('Randomized Controlled Trial'));
    return rows;
  }, [feed.records, start, today, tab, rctOnly, data.metrics]);
  const counts = useMemo(() => diseaseCounts(eligibleRecords), [eligibleRecords]);
  const diseaseRecords = useMemo(
    () =>
      disease === 'all'
        ? eligibleRecords
        : eligibleRecords.filter((r) => classifyDisease(r).ids.includes(disease)),
    [eligibleRecords, disease],
  );
  const findRecords = useMemo(() => createEvidenceSearch(diseaseRecords), [diseaseRecords]);
  const candidates = useMemo(() => findRecords(settledSearch), [findRecords, settledSearch]);
  const records = useMemo(
    () =>
      candidates.filter(
        (r) => readingStatus === 'all' || readSet.has(r.pmid) === (readingStatus === 'read'),
      ),
    [candidates, readingStatus, readSet],
  );
  const readCount = useMemo(
    () => candidates.filter((r) => readSet.has(r.pmid)).length,
    [candidates, readSet],
  );
  const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const sources = data.sources.filter(
    (s) =>
      (country === 'All countries' || s.country === country) &&
      (!search ||
        `${s.title} ${s.organization} ${s.country}`.toLowerCase().includes(search.toLowerCase())),
  );
  const changeTab = (value: Tab) => {
    setTab(value);
    setPage(0);
    setSearch('');
    setSettledSearch('');
  };

  return (
    <section className="evidence-watch" aria-label="Automatically updated evidence">
      <div className="watch-hero">
        <div>
          <div className="eyebrow">PAIN MEDICINE · LIVING EVIDENCE INDEX</div>
          <h1>
            Keep your evidence
            <br />
            <span>up to date.</span>
          </h1>
          <p>
            Clinical trials, international guidance, and recent research.
            <br />
            Original sources. Clear dates. Room for clinical judgment.
          </p>
        </div>
        <div className="watch-schedule">
          <CalendarDays size={22} />
          <strong>Daily refresh</strong>
          <span>Scheduled at 08:17 Taipei / 00:17 UTC</span>
          <small>GitHub may delay scheduled runs.</small>
          <a
            href="https://github.com/foxicall/PainMedicine-digest/actions/workflows/update-evidence.yml"
            target="_blank"
            rel="noreferrer"
          >
            View update runs <ArrowUpRight size={13} />
          </a>
        </div>
      </div>
      <div className="watch-tabs" role="group" aria-label="Evidence categories">
        {(
          [
            ['trials', 'Clinical trials', 'Rolling 10 years'],
            ['guidelines', 'Global guidelines', 'Official sources + PubMed'],
            ['recent', 'Recent high-IF research', '3 months · JIF >10'],
          ] as const
        ).map(([id, title, description]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            className={tab === id ? 'active' : ''}
            onClick={() => changeTab(id)}
          >
            <strong>{title}</strong>
            <span>{description}</span>
          </button>
        ))}
      </div>
      <div
        className={`watch-status ${stale || feed.status === 'error' ? 'watch-warning' : ''}`}
        role="status"
      >
        <div>
          <strong>
            {feed.status === 'error'
              ? 'Update failed — last successful records retained'
              : stale
                ? 'Snapshot is overdue for an update'
                : 'Source snapshot available'}
          </strong>
          <span>
            Last successful retrieval: {timestamp(feed.lastSuccessAt)} · Latest attempt:{' '}
            {timestamp(data.attemptedAt)}
          </span>
        </div>
        <button
          className="button button-secondary"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw size={14} className={query.isFetching ? 'spin' : ''} />
          {query.isFetching ? 'Checking…' : 'Check for updates'}
        </button>
      </div>
      {(query.error || data.preview || feed.error) && (
        <p className="watch-notice">
          {query.error?.message}{' '}
          {data.preview &&
            'Bundled preview: up to 12 records per feed. Connect to the deployed website to load the complete index.'}{' '}
          {feed.error}
        </p>
      )}
      <div className="watch-search-row">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search updated evidence"
            placeholder="Search a treatment, condition, journal, or PMID…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        {tab === 'trials' && (
          <label className="watch-checkbox">
            <input
              type="checkbox"
              checked={rctOnly}
              onChange={(e) => {
                setRctOnly(e.target.checked);
                setPage(0);
              }}
            />{' '}
            RCTs only
          </label>
        )}
        {tab === 'guidelines' && (
          <select
            aria-label="Guideline source country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            {['All countries', ...new Set(data.sources.map((s) => s.country))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
      </div>
      <div className="watch-disease-row">
        <DiseaseSelect
          value={disease}
          counts={counts}
          label="Browse evidence by disease"
          onChange={(value) => {
            setDisease(value);
            setPage(0);
          }}
        />
        <p>
          Index labels use title keywords unless the population has been reviewed. Unclassified
          records remain available.
          {tab === 'guidelines' &&
            ' Disease selection applies to PubMed records below, not the official-source directory.'}
        </p>
      </div>
      {tab === 'guidelines' && (
        <>
          <div className="watch-section-heading">
            <h2>
              <Globe2 size={20} /> Official guidance sources
            </h2>
            <p>
              Edition years are separate from website checks. Directories and newly discovered links
              require confirmation of guideline status; coverage is not all countries.
            </p>
          </div>
          <div className="guideline-grid">
            {sources.map((source) => (
              <article className="guideline-card" key={source.id}>
                <div className="study-kicker">
                  {source.country} · {source.kind.replace('-', ' ')}
                </div>
                <h3>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title} <ArrowUpRight size={14} />
                  </a>
                </h3>
                <p>
                  {source.organization}
                  {source.edition && ` · Edition ${source.edition}`}
                </p>
                <p>{source.note}</p>
                <small>
                  Page last reached: {timestamp(source.lastSuccessAt)}
                  {source.status === 'error' &&
                    ' · Latest check failed; current status unconfirmed'}
                </small>
                {!!source.links?.length && (
                  <details>
                    <summary>Discovered links · verify status ({source.links.length})</summary>
                    <ul>
                      {source.links.map((link) => (
                        <li key={link.url}>
                          <a href={link.url} target="_blank" rel="noreferrer">
                            {link.title} <ArrowUpRight size={12} />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </article>
            ))}
          </div>
          {!sources.length && (
            <p className="watch-notice">No official source matches these filters.</p>
          )}
          <div className="watch-section-heading">
            <h2>Newly published guideline records</h2>
            <p>
              PubMed-indexed guidelines, newest first. Country filters apply to the official
              directory above; publication metadata does not establish jurisdiction, endorsement, or
              whether a guideline is current.
            </p>
          </div>
        </>
      )}
      {tab === 'recent' && (
        <details className="metrics-panel">
          <summary>
            Journal Impact Factor sources & coverage (
            {data.metrics.filter((m) => eligibleMetric(m)).length} eligible journals)
          </summary>
          <p>
            Only configured journals with a verified annual JIF strictly above 10 qualify. General
            medicine, neurology and anaesthesia are included, with the same pain search applied. JIF
            is a journal metric, not a study-quality score. Unverified or expired metrics are
            excluded; verification expires after one year or when its metric year is more than two
            years old.
          </p>
          <div className="metric-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Journal</th>
                  <th>JIF / year</th>
                  <th>Verification</th>
                </tr>
              </thead>
              <tbody>
                {data.metrics.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <a href={m.sourceUrl} target="_blank" rel="noreferrer">
                        {m.name} <ArrowUpRight size={12} />
                      </a>
                    </td>
                    <td>
                      {m.value ?? 'Unverified'}
                      {m.year && ` / ${m.year}`}
                    </td>
                    <td>
                      {eligibleMetric(m) ? `Verified ${m.verifiedOn}` : 'Excluded'}
                      <small>{m.note}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <div className="watch-results-heading">
        <strong>
          {records.length.toLocaleString()} matching{' '}
          {tab === 'guidelines' ? 'guideline records' : 'publications'}
        </strong>
        <span>
          {tab !== 'guidelines'
            ? `${start} – ${today}`
            : 'No age cutoff; older guidance can remain relevant'}
        </span>
      </div>
      <div className="library-reading-toolbar">
        <ReadingFilter
          label="Updated evidence reading status"
          value={readingStatus}
          onChange={(value) => {
            setReadingStatus(value);
            setPage(0);
          }}
          total={candidates.length}
          read={readCount}
        />
        <p>Read status and bookmarks are shared with your library.</p>
      </div>
      <p className="watch-explanation">
        {tab === 'trials'
          ? 'Indexed clinical trials include randomized and non-randomized studies. Structured clinical summaries require appraisal; use “Open digest” to see available fields.'
          : tab === 'recent'
            ? 'All publication types are eligible, including reviews and correspondence; they are not all clinical trials.'
            : 'Publication does not establish that guidance has not been superseded.'}
      </p>
      <div className="evidence-records">
        {records.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((record) => {
          const metric = data.metrics.find((m) => m.id === record.metricId);
          const classification = classifyDisease(record);
          const protocol = treatmentProtocols[record.pmid];
          return (
            <article className="evidence-record" key={record.pmid}>
              <div className="record-journal">
                <span>{record.journalAbbreviation}</span>
                <span>
                  {dateLabel(record)} · {record.dateBasis}
                  {record.datePrecision !== 'day' ? ` (${record.datePrecision} only)` : ''}
                </span>
              </div>
              <h3>
                <a
                  href={`https://pubmed.ncbi.nlm.nih.gov/${record.pmid}/`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {record.title}
                </a>
              </h3>
              <p className="record-authors">
                {record.authors.slice(0, 3).join(', ')}
                {record.authors.length > 3 ? ', et al.' : ''}
              </p>
              <div className="record-tags">
                {classification.ids.map((id) => (
                  <span className="record-disease" key={id} title={classification.basis}>
                    {diseaseLabel(id)}
                  </span>
                ))}
                <span>
                  {record.publicationTypes.includes('Randomized Controlled Trial')
                    ? 'Randomized controlled trial'
                    : record.publicationTypes.filter((type) => type !== 'Journal Article')[0] ||
                      'Journal article'}
                </span>
                <span>{protocol ? 'Regimen sources checked' : 'Awaiting appraisal'}</span>
                {metric && (
                  <a href={metric.sourceUrl} target="_blank" rel="noreferrer">
                    JIF {metric.value} · {metric.year}
                  </a>
                )}
              </div>
              {tab === 'trials' && (
                <div className="record-takeaway">
                  <strong>Clinical takeaway</strong>
                  <p>
                    {protocol
                      ? 'A curated digest is available with population, outcomes, safety and appraisal context.'
                      : 'Awaiting clinical appraisal. Population, treatment regimen, effect estimates, safety and risk of bias have not been extracted automatically.'}
                  </p>
                  <strong>Intervention & dosing</strong>
                  <p>
                    {protocol?.summary ??
                      'Dose, injectate volume and procedure parameters: not extracted. Retrieve the source abstract in the digest.'}
                  </p>
                </div>
              )}
              <div className="record-actions">
                <a
                  href={`https://pubmed.ncbi.nlm.nih.gov/${record.pmid}/`}
                  target="_blank"
                  rel="noreferrer"
                >
                  PMID {record.pmid} <ArrowUpRight size={13} />
                </a>
                {record.doi && (
                  <a href={`https://doi.org/${record.doi}`} target="_blank" rel="noreferrer">
                    DOI <ArrowUpRight size={13} />
                  </a>
                )}
                {tab === 'trials' && (
                  <button
                    className="button button-secondary small"
                    onClick={() => onOpenTrial(evidenceToTrial(record))}
                  >
                    <BookOpen size={14} /> Open digest
                  </button>
                )}
              </div>
              <ReadingActions trial={evidenceToTrial(record)} />
            </article>
          );
        })}
      </div>
      {!records.length && (
        <div className="watch-empty">
          <Search size={24} />
          <h3>No eligible publications in this selection</h3>
          <p>
            Broaden the search, choose another disease or reading status, or check the retrieval
            status above.
          </p>
        </div>
      )}
      <div className="watch-pagination">
        <button
          className="button button-secondary"
          disabled={!currentPage}
          onClick={() => setPage(currentPage - 1)}
        >
          <ChevronLeft size={15} /> Previous
        </button>
        <span>
          Page {currentPage + 1} of {pages.toLocaleString()}
        </span>
        <button
          className="button button-secondary"
          disabled={currentPage + 1 >= pages}
          onClick={() => setPage(currentPage + 1)}
        >
          Next <ChevronRight size={15} />
        </button>
      </div>
      <details className="watch-methods">
        <summary>Search strategy, dates & index completeness</summary>
        <p>
          Last successful search matched {feed.matched.toLocaleString()} PubMed IDs;{' '}
          {feed.excludedDates.toLocaleString()} were excluded because their first publication date
          was outside the window or could not be established, and {feed.excludedJournal} failed
          exact ISSN matching. All search partitions and summary batches must succeed before that
          feed is replaced. PubMed indexing can be delayed and this search is not a systematic
          review.
        </p>
        <p>
          Windows roll daily. Electronic publication date takes precedence over print issue date.
          Month/year-only dates qualify only if the entire month/year is inside the window.
          Official-page availability checks do not establish a clinical revision or current
          endorsement. Annual JIF numbers require source review and are not inferred by an automated
          scraper.
        </p>
        <code>{feed.query}</code>
      </details>
    </section>
  );
}
