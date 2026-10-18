import data from '@/data/phn-pilot.json';
import type { ExtractionContext, ExtractionPilot } from '@/types/extraction';
import type { ClinicalTrialSummary } from '@/types/trial';

export const phnPilot = data as ExtractionPilot;
const trialsByPmid = new Map(phnPilot.trials.map((trial) => [trial.pmid, trial]));

export const extractionContextLabels: Record<ExtractionContext, string> = {
  treatment: 'Established PHN treatment',
  prevention: 'PHN prevention / acute zoster',
  mixed: 'Mixed population / context',
  other: 'Other / outside PHN treatment',
  unclear: 'Context requires verification',
};

export function getPhnTrial(pmid: string) {
  return trialsByPmid.get(pmid);
}

// Refresh a retained metadata-only record without adding the whole pilot to the library.
export function resolvePhnTrial(trial: ClinicalTrialSummary): ClinicalTrialSummary {
  return getPhnTrial(trial.pmid) ?? trial;
}
