import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileText,
  Search,
} from 'lucide-react';
import { extractionContextLabels, getPhnTrial, phnPilot } from '@/lib/phn-pilot';
import { unreadFirst } from '@/lib/reading-order';
import { useLibrary } from '@/lib/store';
import type { ExtractionContext } from '@/types/extraction';
import type { ClinicalTrialSummary } from '@/types/trial';
import { ReadingFilter, type ReadingStatus } from './ReadingActions';
import { TrialCard } from './TrialCard';

const SOURCE_PAGE_SIZE = 24;

export function PhnPilot({
  onOpenTrial,
  onBack,
  notify,
}: {
  onOpenTrial: (trial: ClinicalTrialSummary) => void;
  onBack: () => void;
  notify: (message: string) => void;
}) {
  const [category, setCategory] = useState<ExtractionContext | 'all'>('all');
  const [search, setSearch] = useState('');
  const [readingStatus, setReadingStatus] = useState<ReadingStatus>('all');
  const [sourcePage, setSourcePage] = useState(0);
  const readIds = useLibrary((state) => state.readIds);
  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const candidates = useMemo(
    () =>
      phnPilot.records.filter(
        (record) =>
          (category === 'all' || record.category === category) &&
          `${record.title} ${record.journal} ${record.pmid}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [category, search],
  );
  const records = useMemo(
    () =>
      unreadFirst(
        candidates.filter(
          (record) =>
            readingStatus === 'all' || readSet.has(record.pmid) === (readingStatus === 'read'),
        ),
        readSet,
        (record) => record.pmid,
      ),
    [candidates, readingStatus, readSet],
  );
  const trials = records.flatMap((record) => {
    const trial = getPhnTrial(record.pmid);
    return trial ? [trial] : [];
  });
  const sourcePages = Math.max(1, Math.ceil(records.length / SOURCE_PAGE_SIZE));
  const currentSourcePage = Math.min(sourcePage, sourcePages - 1);
  const sourceRecords = records.slice(
    currentSourcePage * SOURCE_PAGE_SIZE,
    (currentSourcePage + 1) * SOURCE_PAGE_SIZE,
  );
  const { counts, execution } = phnPilot;
  const apiStatus =
    execution.externalApiStatus === 'completed'
      ? 'Completed'
      : execution.externalApiStatus === 'partial'
        ? 'Partially completed'
        : 'Not run';
  return (
    <section className="phn-pilot" aria-label="Postherpetic neuralgia extraction pilot">
      <button className="text-button pilot-back" onClick={onBack}>
        <ArrowLeft size={15} /> Back to evidence updates
      </button>
      <div className="pilot-heading">
        <div className="eyebrow">POSTHERPETIC NEURALGIA · EXTRACTION PILOT</div>
        <h1>PHN extraction pilot</h1>
        <p>
          Source-linked study drafts with the intervention, dose, outcomes and missing details kept
          together. Established PHN treatment and prevention are labeled separately.
        </p>
      </div>
      <div className="pilot-draft-notice" role="note">
        <FileText size={20} />
        <div>
          <strong>Drafts require clinical review</strong>
          <p>
            {execution.mode === 'source-assisted'
              ? 'This is a source-assisted prototype. External model extraction has not been completed.'
              : 'These structured fields were extracted using an external model and require source verification.'}{' '}
            Candidate records include acute-zoster prevention studies and records outside
            established PHN treatment. Risk of bias has not been formally assessed.
          </p>
        </div>
      </div>
      <dl className="pilot-stats">
        {[
          ['Candidate records', counts.candidates],
          ['Abstracts retrieved', counts.abstracts],
          ['Full texts retrieved', counts.fullTexts],
          ['Detailed drafts', counts.detailed],
        ].map(([label, count]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{Number(count).toLocaleString()}</dd>
          </div>
        ))}
      </dl>
      <details className="pilot-execution">
        <summary>
          External API: {apiStatus} · Recorded API cost: US${execution.costUsd.toFixed(2)}
        </summary>
        <p>{execution.note}</p>
        <dl className="evidence-table">
          <div>
            <dt>Extraction method</dt>
            <dd>{execution.mode === 'source-assisted' ? 'Source-assisted' : 'External API'}</dd>
          </div>
          <div>
            <dt>External model requests</dt>
            <dd>{execution.requests.toLocaleString()}</dd>
          </div>
          {execution.plannedMaxCostUsd !== undefined && (
            <div>
              <dt>Planned API reservation (estimate)</dt>
              <dd>US${execution.plannedMaxCostUsd.toFixed(2)} · not incurred cost</dd>
            </div>
          )}
          {execution.budgetCapUsd !== undefined && (
            <div>
              <dt>Execution spending cap</dt>
              <dd>US${execution.budgetCapUsd.toFixed(2)}</dd>
            </div>
          )}
          <div>
            <dt>Recorded tokens</dt>
            <dd>
              {execution.inputTokens.toLocaleString()} input /{' '}
              {execution.outputTokens.toLocaleString()} output
            </dd>
          </div>
          <div>
            <dt>Models used</dt>
            <dd>
              Abstract screening: {execution.models.screening ?? 'Not run'}; full-text extraction:{' '}
              {execution.models.fullText ?? 'Not run'}
            </dd>
          </div>
          <div>
            <dt>Source collection</dt>
            <dd>
              {phnPilot.scope.from} – {phnPilot.scope.to} · generated{' '}
              {phnPilot.generatedAt.slice(0, 10)}
            </dd>
          </div>
        </dl>
        <p className="pilot-query">PubMed query: {phnPilot.scope.query}</p>
        <a
          className="source-link"
          href={`${import.meta.env.BASE_URL}data/phn-api-plan.json`}
          target="_blank"
          rel="noreferrer"
        >
          View API dry-run plan (JSON) <ArrowUpRight size={12} />
        </a>
      </details>
      <div className="pilot-filters">
        <label>
          <span>Clinical context</span>
          <select
            aria-label="PHN clinical context"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as ExtractionContext | 'all');
              setSourcePage(0);
            }}
          >
            <option value="all">All candidate records ({counts.candidates})</option>
            {Object.entries(extractionContextLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label} ({phnPilot.records.filter((record) => record.category === id).length})
              </option>
            ))}
          </select>
        </label>
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search PHN pilot"
            placeholder="Search treatment, title, journal or PMID…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSourcePage(0);
            }}
          />
        </label>
      </div>
      <div className="library-reading-toolbar">
        <ReadingFilter
          label="PHN pilot reading status"
          value={readingStatus}
          onChange={(value) => {
            setReadingStatus(value);
            setSourcePage(0);
          }}
          total={candidates.length}
          read={candidates.filter((record) => readSet.has(record.pmid)).length}
        />
        <p>Unread first. Read status and bookmarks are shared with your library.</p>
      </div>
      <section aria-label="Detailed PHN extraction drafts" className="pilot-drafts">
        <div className="pilot-section-heading">
          <h2>Detailed study drafts</h2>
          <span>{trials.length} in this selection</span>
        </div>
        {trials.length ? (
          <div className="trial-grid">
            {trials.map((trial) => (
              <TrialCard key={trial.pmid} trial={trial} onOpen={onOpenTrial} notify={notify} />
            ))}
          </div>
        ) : (
          <p className="watch-empty">
            No detailed drafts match this selection. Source records remain below.
          </p>
        )}
      </section>
      <section className="pilot-index" aria-label="PHN pilot source index">
        <div className="pilot-section-heading">
          <h2>Candidate source index</h2>
          <span>{records.length.toLocaleString()} records in this selection</span>
        </div>
        <p className="muted">
          Context labels are preliminary screening decisions. A candidate match does not establish
          eligibility, randomization, effectiveness or current clinical guidance.
        </p>
        <a
          className="button button-secondary small pilot-source-download"
          href={`${import.meta.env.BASE_URL}data/phn-source-index.csv`}
          download
        >
          <FileDown size={14} /> Download source index CSV
        </a>
        <div className="pilot-source-list">
          {sourceRecords.map((record) => {
            const trial = getPhnTrial(record.pmid);
            return (
              <article className="pilot-source" key={record.pmid}>
                <div className="pilot-source-meta">
                  <span>
                    {record.journal} · {record.publicationDate}
                  </span>
                  <span className="extraction-context">
                    {extractionContextLabels[record.category]}
                  </span>
                  {readSet.has(record.pmid) && <span>Already read</span>}
                </div>
                <h3>
                  <a href={record.sourceUrl} target="_blank" rel="noreferrer">
                    {record.title}
                  </a>
                </h3>
                <p>{record.reason}</p>
                <div className="pilot-source-links">
                  <a href={record.sourceUrl} target="_blank" rel="noreferrer">
                    PMID {record.pmid} <ArrowUpRight size={12} />
                  </a>
                  <span>
                    {record.abstractAvailable ? 'Abstract retrieved' : 'No abstract retrieved'}
                  </span>
                  {record.fullTextUrl && (
                    <a href={record.fullTextUrl} target="_blank" rel="noreferrer">
                      {record.fullTextAvailable ? 'Full text retrieved' : 'Full-text source'}{' '}
                      <ArrowUpRight size={12} />
                    </a>
                  )}
                  {trial && (
                    <button className="text-button" onClick={() => onOpenTrial(trial)}>
                      Open extraction draft <ArrowUpRight size={12} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {!records.length && (
            <p className="watch-empty">No candidate records match these filters.</p>
          )}
        </div>
        {sourcePages > 1 && (
          <nav className="watch-pagination" aria-label="PHN candidate source pages">
            <button
              className="button button-secondary"
              disabled={currentSourcePage === 0}
              onClick={() => setSourcePage(currentSourcePage - 1)}
            >
              <ChevronLeft size={15} /> Previous
            </button>
            <span>
              Page {currentSourcePage + 1} of {sourcePages} ·{' '}
              {currentSourcePage * SOURCE_PAGE_SIZE + 1}–
              {Math.min((currentSourcePage + 1) * SOURCE_PAGE_SIZE, records.length)} of{' '}
              {records.length}
            </span>
            <button
              className="button button-secondary"
              disabled={currentSourcePage === sourcePages - 1}
              onClick={() => setSourcePage(currentSourcePage + 1)}
            >
              Next <ChevronRight size={15} />
            </button>
          </nav>
        )}
      </section>
    </section>
  );
}
