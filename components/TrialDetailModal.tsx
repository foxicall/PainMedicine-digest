import { useState } from 'react';
import {
  Bookmark,
  Copy,
  ExternalLink,
  FileText,
  NotebookPen,
  ShieldCheck,
  ArrowUpRight,
  Check,
} from 'lucide-react';
import type { ClinicalTrialSummary } from '@/types/trial';
import { useLibrary } from '@/lib/store';
import { vancouverCitation } from '@/lib/export';
import { Modal, Pill } from './ui';
import { TreatmentProtocol } from './TreatmentProtocol';
import { classifyDisease, diseaseLabel } from '@/lib/diseases';

export function TrialDetailModal({
  trial: t,
  onClose,
  notify,
}: {
  trial: ClinicalTrialSummary | null;
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const [tab, setTab] = useState<'digest' | 'notes' | 'source'>('digest');
  const { bookmarks, toggleBookmark, notes, setNote } = useLibrary();
  const copy = async () => {
    if (!t) return;
    try {
      await navigator.clipboard.writeText(vancouverCitation(t));
      notify('Vancouver citation copied');
    } catch {
      notify('Select the citation below and copy it manually.');
      setTab('source');
    }
  };
  return (
    <Modal
      open={!!t}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setTab('digest');
        }
      }}
      title={t?.acronym ?? 'Trial details'}
      description={
        t ? `${t.journalAbbreviation} · ${t.year} · PMID ${t.pmid}` : 'Clinical trial digest'
      }
    >
      {t && (
        <>
          <div className="detail-heading">
            <div className="disease-tags" title={classifyDisease(t).basis}>
              {classifyDisease(t).ids.map((id) => (
                <span key={id}>{diseaseLabel(id)}</span>
              ))}
              <small>{classifyDisease(t).basis}</small>
            </div>
            <div className="card-tags">
              {t.specialties.map((s) => (
                <Pill key={s} tone="indigo">
                  {s}
                </Pill>
              ))}
              <Pill tone="amber">{t.provenance.status}</Pill>
            </div>
            <h2>{t.title}</h2>
            <p>
              {t.leadAuthor} (lead) · {t.seniorAuthor} (last named author)
            </p>
            <div className="detail-toolbar">
              <a
                className="button button-primary small"
                href={t.provenance.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Read on PubMed <ArrowUpRight size={14} />
              </a>
              <button className="button button-secondary small" onClick={copy}>
                <Copy size={14} /> Copy citation
              </button>
              <button
                className="button button-secondary small"
                aria-pressed={bookmarks.includes(t.id)}
                onClick={() => toggleBookmark(t)}
              >
                <Bookmark size={14} fill={bookmarks.includes(t.id) ? 'currentColor' : 'none'} />
                {bookmarks.includes(t.id) ? 'Saved' : 'Save trial'}
              </button>
            </div>
          </div>
          <div className="detail-tabs" role="group" aria-label="Trial detail view">
            {(
              [
                { id: 'digest', label: 'Clinical digest', icon: FileText },
                { id: 'notes', label: 'My notes', icon: NotebookPen },
                { id: 'source', label: 'Source & citation', icon: ExternalLink },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                aria-pressed={tab === item.id}
                className={tab === item.id ? 'active' : ''}
                onClick={() => setTab(item.id)}
              >
                <item.icon size={15} />
                {item.label}
                {item.id === 'notes' && notes[t.id] && <span className="tiny-dot" />}
              </button>
            ))}
          </div>
          <div className="detail-body">
            {tab === 'digest' && (
              <>
                <div className="detail-takeaway">
                  <div className="section-eyebrow">CLINICAL BOTTOM LINE</div>
                  <p>{t.bottomLine}</p>
                </div>
                <section>
                  <h3>Study at a glance</h3>
                  <div className="detail-stats">
                    <div>
                      <span>Sample size</span>
                      <strong>{t.sampleSize?.toLocaleString() ?? 'Not extracted'}</strong>
                      <small>{t.sampleSizeBasis}</small>
                    </div>
                    <div>
                      <span>Follow-up</span>
                      <strong>{t.duration}</strong>
                    </div>
                    <div>
                      <span>Intervention</span>
                      <strong>{t.interventionType ?? 'Not classified'}</strong>
                    </div>
                  </div>
                </section>
                <section>
                  <h3>PICO architecture</h3>
                  <div className="pico-detail">
                    {(['population', 'intervention', 'comparator', 'outcomes'] as const).map(
                      (key, i) => (
                        <div key={key}>
                          <span className="pico-letter">{'PICO'[i]}</span>
                          <div>
                            <h4>{key.charAt(0).toUpperCase() + key.slice(1)}</h4>
                            <p>{t.pico[key]}</p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </section>
                <TreatmentProtocol key={t.pmid} trial={t} />
                <section>
                  <h3>Outcomes & clinical relevance</h3>
                  <div className="outcome-highlight">
                    <div>
                      <span className="outcome-caption">
                        {t.outcome.kind.toUpperCase()} · {t.outcome.timepoint}
                      </span>
                      <strong>{t.outcome.value}</strong>
                      <span>{t.outcome.context}</span>
                    </div>
                  </div>
                  <dl className="evidence-table">
                    <div>
                      <dt>P value</dt>
                      <dd>{t.outcome.pValue ?? 'Not extracted'}</dd>
                    </div>
                    <div>
                      <dt>Confidence interval</dt>
                      <dd>{t.outcome.confidenceInterval ?? 'Not extracted'}</dd>
                    </div>
                    <div>
                      <dt>Clinical relevance</dt>
                      <dd>{t.outcome.clinicalMeaning}</dd>
                    </div>
                    <div>
                      <dt>NNT / NNH</dt>
                      <dd>
                        {t.outcome.nnt ? `NNT: ${t.outcome.nnt}` : 'NNT: not calculated'}
                        <br />
                        {t.outcome.nnh ? `NNH: ${t.outcome.nnh}` : 'NNH: not calculated'}
                      </dd>
                    </div>
                  </dl>
                </section>
                <section>
                  <h3>Safety & tolerability</h3>
                  <p>{t.safety.summary}</p>
                  <p className="muted">
                    Discontinuation:{' '}
                    {t.safety.discontinuation ?? 'Not extracted from the abstract.'}
                  </p>
                </section>
                <section>
                  <h3>
                    <ShieldCheck size={17} /> Methodological quality & risk of bias
                  </h3>
                  <dl className="evidence-table">
                    <div>
                      <dt>Blinding</dt>
                      <dd>{t.methodology.blinding}</dd>
                    </div>
                    <div>
                      <dt>Randomization</dt>
                      <dd>{t.methodology.randomization}</dd>
                    </div>
                    <div>
                      <dt>Analysis population</dt>
                      <dd>{t.methodology.intentionToTreat}</dd>
                    </div>
                    <div>
                      <dt>Risk of bias</dt>
                      <dd>
                        <Pill tone="amber">{t.methodology.riskOfBias}</Pill>
                      </dd>
                    </div>
                    <div>
                      <dt>Interpretation</dt>
                      <dd>{t.methodology.limitations}</dd>
                    </div>
                  </dl>
                </section>
                <p className="provenance-note">
                  {t.provenance.reviewedOn
                    ? `Abstract-based seed summary · source retrieved ${t.provenance.reviewedOn}.`
                    : 'Live PubMed metadata · awaiting clinical appraisal.'}{' '}
                  Consult the original paper before applying findings in practice.
                </p>
              </>
            )}
            {tab === 'notes' && (
              <section className="notes-section">
                <h3>Your reading notes</h3>
                <p className="muted">
                  Keep your interpretation, journal club questions, and follow-up ideas with this
                  paper. Notes stay in this browser.
                </p>
                <label htmlFor="trial-notes" className="sr-only">
                  Personal notes for {t.acronym}
                </label>
                <textarea
                  id="trial-notes"
                  value={notes[t.id] ?? ''}
                  onChange={(e) => setNote(t, e.target.value)}
                  maxLength={20000}
                  placeholder="What matters for your practice?"
                />
                <div className="note-status">
                  <span>
                    <Check size={14} /> Stored locally as you type
                  </span>
                  <span>{(notes[t.id] ?? '').length.toLocaleString()} / 20,000</span>
                </div>
                <p className="provenance-note">
                  Save the trial and export your saved library as CSV to back up notes. Avoid
                  entering patient-identifying information.
                </p>
              </section>
            )}
            {tab === 'source' && (
              <>
                <section>
                  <h3>Vancouver citation</h3>
                  <p className="citation-block">{vancouverCitation(t)}</p>
                  {t.doi && (
                    <a
                      className="source-link"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://doi.org/${t.doi}`}
                    >
                      DOI: {t.doi} <ExternalLink size={13} />
                    </a>
                  )}
                  <a
                    className="source-link"
                    target="_blank"
                    rel="noreferrer"
                    href={t.provenance.sourceUrl}
                  >
                    PubMed: {t.pmid} <ExternalLink size={13} />
                  </a>
                </section>
                <section>
                  <h3>{t.abstract ? 'PubMed abstract' : 'Original abstract'}</h3>
                  {t.abstract ? (
                    <p className="abstract-text">{t.abstract}</p>
                  ) : (
                    <p>
                      The seed library provides concise paraphrased summaries.{' '}
                      <a
                        className="inline-link"
                        href={t.provenance.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Read the original abstract on PubMed.
                      </a>
                    </p>
                  )}
                </section>
                <section>
                  <h3>Provenance</h3>
                  <p>
                    {t.provenance.status}.{' '}
                    {t.provenance.reviewedOn
                      ? `Bibliography checked against NCBI on ${t.provenance.reviewedOn}.`
                      : 'Specialty labels are generated by keyword matching; other clinical fields require manual review.'}{' '}
                    Last named author is displayed as the senior-author field; authorship roles have
                    not been independently confirmed.
                  </p>
                </section>
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
