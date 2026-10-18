import type { ClinicalTrialSummary } from '@/types/trial';
import { classifyDisease, diseaseLabel } from './diseases';
import { protocolText } from '@/types/protocol';

export function vancouverCitation(t: ClinicalTrialSummary) {
  const authors = t.authors.slice(0, 6).join(', ') + (t.authors.length > 6 ? ', et al' : '');
  const location = `${t.volume ?? ''}${t.issue ? `(${t.issue})` : ''}${t.pages ? `:${t.pages}` : ''}`;
  return `${authors}. ${t.title.replace(/\.$/, '')}. ${t.journalAbbreviation}. ${t.year}${location ? `;${location}` : ''}.${t.doi ? ` doi:${t.doi}.` : ''} PMID: ${t.pmid}.`;
}

export function csvCell(value: unknown) {
  let safe = value === null || value === undefined ? '' : String(value);
  // Prevent spreadsheet formula execution, including whitespace-prefixed payloads.
  if (/^[\s]*[=+\-@]/.test(safe) || /^[\t\r\n]/.test(safe)) safe = `'${safe}`;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCSV(trials: ClinicalTrialSummary[], notes: Record<string, string> = {}) {
  const headers = [
    'Trial',
    'Title',
    'Authors',
    'Journal',
    'Year',
    'PMID',
    'DOI',
    'Diseases',
    'Disease classification basis',
    'Procedure and dosage by arm',
    'Regimen source URLs',
    'Regimen source check date',
    'Regimen gaps',
    'Sample size',
    'Sample basis',
    'Clinical takeaway',
    'Population',
    'Intervention',
    'Comparator',
    'Outcome',
    'Result',
    'Timepoint',
    'P value',
    'Confidence interval',
    'NNT',
    'NNH',
    'Safety',
    'Discontinuation',
    'Blinding',
    'Randomization',
    'ITT',
    'Risk of bias',
    'Source status',
    'Source URL',
    'Personal notes',
  ];
  return (
    '\uFEFF' +
    [
      headers,
      ...trials.map((t) => [
        t.acronym,
        t.title,
        t.authors.join('; '),
        t.journal,
        t.year,
        t.pmid,
        t.doi,
        classifyDisease(t).ids.map(diseaseLabel).join('; '),
        classifyDisease(t).basis,
        protocolText(t.treatmentProtocol),
        t.treatmentProtocol?.sources.map((s) => s.url).join('; ') ?? '',
        t.treatmentProtocol?.checkedOn ?? '',
        t.treatmentProtocol?.gaps.join('; ') ?? 'Awaiting extraction',
        t.sampleSize,
        t.sampleSizeBasis,
        t.bottomLine,
        t.pico.population,
        t.pico.intervention,
        t.pico.comparator,
        t.outcome.label,
        t.outcome.value,
        t.outcome.timepoint,
        t.outcome.pValue,
        t.outcome.confidenceInterval,
        t.outcome.nnt,
        t.outcome.nnh,
        t.safety.summary,
        t.safety.discontinuation,
        t.methodology.blinding,
        t.methodology.randomization,
        t.methodology.intentionToTreat,
        t.methodology.riskOfBias,
        t.provenance.status,
        t.provenance.sourceUrl,
        notes[t.id] ?? '',
      ]),
    ]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n')
  );
}

const bibEscape = (s: string) =>
  s.replace(/[\\{}%&#_$]/g, (c) => (c === '\\' ? '\\textbackslash{}' : `\\${c}`));
export function toBibTeX(trials: ClinicalTrialSummary[]) {
  return trials
    .map((t) => {
      const authors = t.authors
        .map((author) => {
          const personal = /^(.*) ([A-Z]{1,6})$/.exec(author);
          return personal ? `${bibEscape(personal[1])}, ${personal[2]}` : `{${bibEscape(author)}}`;
        })
        .join(' and ');
      const fields = {
        title: t.title,
        author: authors,
        journal: t.journal,
        year: String(t.year),
        volume: t.volume,
        number: t.issue,
        pages: t.pages,
        doi: t.doi,
        pmid: t.pmid,
        url: t.provenance.sourceUrl,
      };
      return `@article{pubmed${t.pmid},\n${Object.entries(fields)
        .filter(([, v]) => v)
        .map(([k, v]) => `  ${k} = {${k === 'author' ? v : bibEscape(v!)}},`)
        .join('\n')}\n}`;
    })
    .join('\n\n');
}

export function downloadFile(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
