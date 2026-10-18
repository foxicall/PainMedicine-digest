import {
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  GitCompareArrows,
  ShieldCheck,
  Users,
  Clock3,
  Sparkles,
} from 'lucide-react';
import type { ClinicalTrialSummary } from '@/types/trial';
import { Pill } from './ui';
import { useLibrary } from '@/lib/store';
import { vancouverCitation } from '@/lib/export';
import { classifyDisease, diseaseLabel } from '@/lib/diseases';
import { ReadingActions } from './ReadingActions';
import { extractionContextLabels } from '@/lib/phn-pilot';

export interface TrialCardProps {
  trial: ClinicalTrialSummary;
  onOpen: (trial: ClinicalTrialSummary) => void;
  notify: (message: string) => void;
}
export function TrialCard({ trial: t, onOpen, notify }: TrialCardProps) {
  const { compareIds, toggleCompare } = useLibrary();
  const compared = compareIds.includes(t.id);
  const tone =
    t.specialties[0] === 'Neuropathic Pain'
      ? 'purple'
      : t.specialties[0] === 'Headache & Facial Pain'
        ? 'blue'
        : 'indigo';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(vancouverCitation(t));
      notify('Vancouver citation copied');
    } catch {
      notify('Clipboard unavailable. Open the study to select and copy its citation.');
    }
  };
  return (
    <article className={`trial-card ${compared ? 'card-compared' : ''}`}>
      <div className="card-header">
        <div className="card-tags">
          <Pill tone={tone}>{t.specialties[0] ?? 'Pain medicine'}</Pill>
          {t.extraction && <Pill tone="amber">Extraction draft</Pill>}
          {t.highImpact && (
            <span
              className="impact-badge"
              title="Included in the editorial journal list; not a study-quality rating"
            >
              <Sparkles size={11} /> Editorial journal
            </span>
          )}
        </div>
      </div>
      <ReadingActions trial={t} />
      {t.extraction && (
        <div className="extraction-card-context">
          <strong>{extractionContextLabels[t.extraction.clinicalContext]}</strong>
          <span>
            {t.extraction.sourceLevel === 'full-text' ? 'Full-text source' : 'Abstract source'}
            {' · '}Needs clinical review
          </span>
        </div>
      )}
      <div className="study-kicker">
        {t.acronym} <span>•</span> {t.year}
      </div>
      <div className="disease-tags" title={classifyDisease(t).basis}>
        {classifyDisease(t).ids.map((id) => (
          <span key={id}>{diseaseLabel(id)}</span>
        ))}
      </div>
      <h3>
        <button onClick={() => onOpen(t)}>{t.displayTitle}</button>
      </h3>
      <div className="card-bibliography">
        <span>{t.leadAuthor} et al.</span>
        <span>·</span>
        <span className="journal-name">{t.journalAbbreviation}</span>
      </div>
      <div className="card-secondary-meta">
        Senior: {t.seniorAuthor} <span>·</span>{' '}
        <a href={t.provenance.sourceUrl} target="_blank" rel="noreferrer">
          PMID {t.pmid}
        </a>
        {t.doi && (
          <a
            className="doi-link"
            href={`https://doi.org/${t.doi}`}
            target="_blank"
            rel="noreferrer"
            title={t.doi}
          >
            DOI <ArrowUpRight size={10} />
          </a>
        )}
      </div>
      <div className="takeaway">
        <div className="section-eyebrow">
          <span className="tiny-dot" /> CLINICAL BOTTOM LINE
        </div>
        <p>{t.bottomLine}</p>
      </div>
      <div className="study-facts">
        <span title={t.sampleSizeBasis}>
          <Users size={13} />{' '}
          {t.sampleSize !== null ? `N = ${t.sampleSize.toLocaleString()}` : 'N not extracted'}
        </span>
        <span>
          <Clock3 size={13} /> {t.duration}
        </span>
      </div>
      <div className="pico-mini">
        {(['population', 'intervention', 'comparator', 'outcomes'] as const).map((key, i) => (
          <div key={key}>
            <span className="pico-letter">{'PICO'[i]}</span>
            <p>
              <strong>
                {key === 'outcomes' ? 'Outcome' : key.charAt(0).toUpperCase() + key.slice(1)}
              </strong>
              <span>{t.pico[key]}</span>
            </p>
          </div>
        ))}
      </div>
      <div className="protocol-preview">
        <div className="section-eyebrow">INTERVENTION & DOSING</div>
        <p>
          {t.treatmentProtocol?.summary ??
            'Study-specific procedure and dose not yet extracted. Open the digest to retrieve the source abstract.'}
        </p>
        <button className="text-button" onClick={() => onOpen(t)}>
          View regimen & sources <ArrowUpRight size={13} />
        </button>
      </div>
      <div className={`outcome-highlight ${t.outcome.kind === 'unreviewed' ? 'unreviewed' : ''}`}>
        <div>
          <span className="outcome-caption">
            {t.outcome.kind === 'secondary'
              ? 'SECONDARY FOLLOW-UP'
              : t.outcome.kind === 'unreviewed'
                ? 'NEW FROM PUBMED'
                : 'KEY OUTCOME'}
          </span>
          <strong>{t.outcome.value}</strong>
          <span>{t.outcome.context}</span>
        </div>
        <span className="p-value">
          {t.outcome.pValue
            ? `P ${t.outcome.pValue}`
            : t.outcome.confidenceInterval
              ? 'CI in details'
              : 'See details'}
        </span>
      </div>
      <div className="card-appraisal">
        <p>
          <strong>Safety</strong> {t.safety.summary}
        </p>
        <p>
          <ShieldCheck size={13} />
          <span>
            {t.methodology.blinding} <span className="muted">· RoB unassessed</span>
          </span>
        </p>
      </div>
      <div className="card-actions">
        <button
          className={`compare-button ${compared ? 'selected' : ''}`}
          aria-pressed={compared}
          onClick={() => {
            if (!toggleCompare(t.id)) notify('Compare up to 3 trials. Remove one to add another.');
          }}
        >
          {compared ? <Check size={14} /> : <GitCompareArrows size={14} />} Compare
        </button>
        <div>
          <a
            className="icon-button"
            href={t.provenance.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${t.acronym} on PubMed`}
          >
            <ExternalLink size={15} />
          </a>
          <button
            className="icon-button"
            onClick={copy}
            aria-label={`Copy Vancouver citation for ${t.acronym}`}
          >
            <Copy size={15} />
          </button>
          <button className="detail-button" onClick={() => onOpen(t)}>
            Read digest <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
