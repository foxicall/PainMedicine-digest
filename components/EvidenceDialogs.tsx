import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Database,
  LoaderCircle,
  Search,
  Sparkles,
} from 'lucide-react';
import { Modal, EmptyState, Pill } from './ui';
import { evidenceMatches } from '@/lib/trials';
import { PUBMED_STRATEGY, searchPubMed } from '@/lib/pubmed';
import type { ClinicalTrialSummary } from '@/types/trial';

export function PubMedModal({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (trials: ClinicalTrialSummary[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const result = useQuery({
    queryKey: ['pubmed', submitted],
    queryFn: ({ signal }) => searchPubMed(submitted ?? '', signal),
    enabled: submitted !== null,
    retry: false,
    staleTime: 1000 * 60 * 15,
  });
  useEffect(() => {
    if (result.data) onImport(result.data.trials);
  }, [result.data, onImport]);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Explore PubMed"
      description="Find randomized pain medicine trials published from 2016 through 2026."
    >
      <div className="detail-body">
        <div className="import-intro">
          <div className="empty-icon">
            <Database size={24} />
          </div>
          <div>
            <h3>Go beyond the starter library</h3>
            <p>
              Search NCBI directly. New records include their source abstracts and remain marked as
              awaiting appraisal.
            </p>
          </div>
        </div>
        <form
          className="dialog-search"
          onSubmit={(e) => {
            e.preventDefault();
            if (submitted === query.trim()) void result.refetch();
            else setSubmitted(query.trim());
          }}
        >
          <label className="sr-only" htmlFor="pubmed-query">
            Additional PubMed search terms
          </label>
          <div className="input-wrap">
            <Search size={18} />
            <input
              id="pubmed-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. duloxetine, neuromodulation, migraine"
            />
          </div>
          <button className="button button-primary" disabled={result.isFetching}>
            {result.isFetching ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />}
            {result.isFetching ? 'Searching…' : 'Search PubMed'}
          </button>
        </form>
        <p className="muted small-text">
          Leave blank to discover recent trials. Retrieves the latest 30 matches, then verifies
          their RCT publication type.
        </p>
        {result.isError && (
          <div className="error-banner" role="alert">
            <strong>PubMed is unavailable</strong>
            <p>{result.error.message}</p>
            <p>Your local trial library is still available.</p>
          </div>
        )}
        {result.data && !result.isFetching && (
          <div className="import-result" role="status">
            <CheckCircle2 size={21} />
            <div>
              <h3>{result.data.trials.length} RCT records ready to explore</h3>
              <p>
                {result.data.total.toLocaleString()} search matches · {result.data.fetched} records
                fetched · {result.data.trials.length} eligible RCT publications. Existing seed
                summaries are preserved.
              </p>
              <button className="text-button" onClick={() => onOpenChange(false)}>
                View library <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
        <details className="search-strategy">
          <summary>View search strategy</summary>
          <code>{PUBMED_STRATEGY}</code>
          <p>
            The date range is capped at today or December 31, 2026, whichever is earlier. RCT
            indexing is required; newly published unindexed trials may be missed. This search is not
            an exhaustive systematic review.
          </p>
        </details>
      </div>
    </Modal>
  );
}

export function AskEvidenceModal({
  open,
  onOpenChange,
  trials,
  onOpenTrial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trials: ClinicalTrialSummary[];
  onOpenTrial: (t: ClinicalTrialSummary) => void;
}) {
  const [question, setQuestion] = useState('');
  const [submitted, setSubmitted] = useState('');
  const results = submitted ? evidenceMatches(trials, submitted) : [];
  const ask = (q: string) => {
    setQuestion(q);
    setSubmitted(q);
  };
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Ask the evidence"
      description="A source-linked guide to the trials in your current library."
    >
      <div className="detail-body">
        <div className="ask-intro">
          <Sparkles size={27} />
          <h2>Start with a clinical question.</h2>
          <p>Find relevant findings, then inspect the study behind them.</p>
        </div>
        <form
          className="dialog-search"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(question);
          }}
        >
          <label htmlFor="evidence-question" className="sr-only">
            Your evidence question
          </label>
          <div className="input-wrap">
            <input
              id="evidence-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Does pregabalin help sciatica?"
            />
          </div>
          <button className="button button-primary" disabled={!question.trim()}>
            Explore <ArrowRight size={16} />
          </button>
        </form>
        <div className="question-suggestions">
          {[
            'Does pregabalin help sciatica?',
            'What do CGRP migraine trials show?',
            'Spinal cord stimulation for neuropathy',
          ].map((q) => (
            <button key={q} onClick={() => ask(q)}>
              {q}
              <ArrowUpRight size={12} />
            </button>
          ))}
        </div>
        {submitted && (
          <div className="evidence-answers">
            <div className="section-eyebrow">RELEVANT FINDINGS · {results.length} STUDIES</div>
            {results.length ? (
              results.map((t) => (
                <button
                  className="evidence-answer"
                  key={t.id}
                  onClick={() => {
                    onOpenChange(false);
                    onOpenTrial(t);
                  }}
                >
                  <div>
                    <Pill tone="indigo">{t.acronym}</Pill>
                    <span>
                      {t.year} <ArrowUpRight size={14} />
                    </span>
                  </div>
                  <h3>{t.displayTitle}</h3>
                  <p>{t.bottomLine}</p>
                  <small>
                    {t.provenance.status} · PMID {t.pmid}
                  </small>
                </button>
              ))
            ) : (
              <EmptyState
                icon={<Search size={24} />}
                title="No matching studies in this library"
                description="Try a treatment or condition name, or import more records from PubMed."
              />
            )}
          </div>
        )}
        <p className="provenance-note">
          This tool retrieves existing summaries using keyword matching; it does not generate
          answers, assess evidence certainty, or give patient-specific advice. Matching studies may
          not directly answer every part of your question.
        </p>
      </div>
    </Modal>
  );
}

export function MethodologyModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="The digest standard"
      description="Useful at a glance. Transparent in the details."
    >
      <div className="detail-body methodology-body">
        <BookOpen size={30} />
        <h2>Evidence deserves context.</h2>
        <p>
          Pain Medicine Trial Digest helps you explore published randomized trials using a
          consistent clinical structure. It is a research reading aid, not a systematic review or a
          treatment guideline.
        </p>
        <section>
          <h3>01 · A source-linked starting point</h3>
          <p>
            The offline library contains 12 selected trial reports with PubMed bibliographies
            checked on October 18, 2026. These are abstract-based summaries; they have not undergone
            independent clinical or full-text peer review. The 2016–2026 window is inclusive, with
            live searches capped at the current date.
          </p>
        </section>
        <section>
          <h3>02 · PICO before conclusions</h3>
          <p>
            Every study separates population, intervention, comparator, outcomes, and follow-up.
            Sample sizes retain their original basis: randomized, treated, or analysis populations.
            Primary and secondary endpoints are distinguished.
          </p>
        </section>
        <section>
          <h3>03 · Make uncertainty visible</h3>
          <p>
            Missing confidence intervals, P values, discontinuation rates, and methods are marked as
            not extracted. NNTs are calculated only for specified binary outcomes and timepoints,
            rounded up, and labeled. No NNH is inferred from adverse-event counts.
          </p>
        </section>
        <section>
          <h3>04 · Methods are not a quality score</h3>
          <p>
            Blinding and analysis details are descriptive. All records remain “Not formally
            assessed” for risk of bias until a domain-level RoB 2 appraisal of the full report is
            completed. “Editorial journal” indicates a fixed journal-family selection (PAIN, Lancet,
            JAMA, NEJM, Cephalalgia, Anesthesiology), not an impact factor or endorsement.
          </p>
        </section>
        <section>
          <h3>05 · Private by design</h3>
          <p>
            Bookmarks and reading notes are stored in this browser. Searches sent through Explore
            PubMed go to NCBI. The evidence question tool runs locally. Export CSV to back up saved
            trials and notes; BibTeX exports citations.
          </p>
        </section>
        <p className="provenance-note">
          Comparisons describe trial differences. They do not establish head-to-head superiority
          when treatments were studied in different populations.
        </p>
      </div>
    </Modal>
  );
}
