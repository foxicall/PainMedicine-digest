import { ExternalLink, X } from 'lucide-react';
import type { ClinicalTrialSummary } from '@/types/trial';
import { Modal } from './ui';
import { useLibrary } from '@/lib/store';

export function CompareModal({
  open,
  onOpenChange,
  trials,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trials: ClinicalTrialSummary[];
}) {
  const toggleCompare = useLibrary((s) => s.toggleCompare);
  const rows: [string, (t: ClinicalTrialSummary) => string][] = [
    ['Clinical takeaway', (t) => t.bottomLine],
    ['Population', (t) => t.pico.population],
    [
      'Sample size',
      (t) => `${t.sampleSize?.toLocaleString() ?? 'Not extracted'} · ${t.sampleSizeBasis}`,
    ],
    ['Intervention', (t) => t.pico.intervention],
    ['Comparator', (t) => t.pico.comparator],
    ['Outcome', (t) => `${t.outcome.label} (${t.outcome.kind})`],
    ['Result', (t) => `${t.outcome.value} · ${t.outcome.context}`],
    ['Timepoint', (t) => t.outcome.timepoint],
    ['P value', (t) => t.outcome.pValue ?? 'Not extracted'],
    ['Confidence interval', (t) => t.outcome.confidenceInterval ?? 'Not extracted'],
    [
      'NNT / NNH',
      (t) => `NNT: ${t.outcome.nnt ?? 'Not calculated'}; NNH: ${t.outcome.nnh ?? 'Not calculated'}`,
    ],
    ['Safety', (t) => t.safety.summary],
    ['Discontinuation', (t) => t.safety.discontinuation ?? 'Not extracted'],
    ['Blinding', (t) => t.methodology.blinding],
    ['Randomization', (t) => t.methodology.randomization],
    ['Analysis population', (t) => t.methodology.intentionToTreat],
    ['Risk of bias', (t) => t.methodology.riskOfBias],
    ['Interpretation', (t) => t.methodology.limitations],
  ];
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Evidence, side by side"
      description="Compare populations, treatments, outcomes, and study methods."
      wide
    >
      <div className="comparison-note">
        Cross-trial comparisons are descriptive. Differences in populations, endpoints, and
        follow-up prevent a direct treatment ranking.
      </div>
      {trials.length < 2 ? (
        <div className="empty-state">
          <h3>Select at least two trials</h3>
          <p>Close this view and add another study using its Compare button.</p>
        </div>
      ) : (
        <div className="comparison-scroll">
          <table className="comparison-table">
            <thead>
              <tr>
                <th scope="col">STUDY CHARACTERISTIC</th>
                {trials.map((t) => (
                  <th scope="col" key={t.id}>
                    <div>
                      <span>{t.acronym}</span>
                      <button
                        className="icon-button"
                        onClick={() => toggleCompare(t.id)}
                        aria-label={`Remove ${t.acronym} from comparison`}
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <p>{t.displayTitle}</p>
                    <span className="muted">
                      {t.journalAbbreviation} · {t.year}
                    </span>
                    <a href={t.provenance.sourceUrl} target="_blank" rel="noreferrer">
                      PubMed <ExternalLink size={12} />
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, getValue]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {trials.map((t) => (
                    <td key={t.id}>{getValue(t)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
