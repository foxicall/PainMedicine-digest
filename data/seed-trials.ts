import metadata from './pubmed-metadata.json';
import type { ClinicalTrialSummary, Specialty, InterventionType } from '@/types/trial';

// Abstract-based demo library, not an exhaustive systematic review.
// Bibliography retrieved directly from NCBI EFetch on 2026-10-18.
const NP: Specialty = 'Neuropathic Pain';
const HA: Specialty = 'Headache & Facial Pain';
const MS: Specialty = 'Musculoskeletal / Spine';
const IP: Specialty = 'Interventional Pain';
const RX: Specialty = 'Pharmacotherapy';
type SeedInput = {
  pmid: keyof typeof metadata;
  acronym: string;
  displayTitle: string;
  specialties: Specialty[];
  interventionType: InterventionType;
  sampleSize: number;
  sampleSizeBasis?: string;
  duration: string;
  bottomLine: string;
  population: string;
  intervention: string;
  comparator: string;
  label: string;
  value: string;
  context: string;
  pValue?: string;
  confidenceInterval?: string;
  nnt?: string;
  clinicalMeaning: string;
  timepoint: string;
  secondary?: boolean;
  safety: string;
  discontinuation?: string;
  blinding: string;
  randomization?: string;
  intentionToTreat?: string;
  limitations: string;
};

function trial(s: SeedInput): ClinicalTrialSummary {
  const bib = metadata[s.pmid];
  return {
    ...bib,
    id: s.pmid,
    pmid: s.pmid,
    acronym: s.acronym,
    displayTitle: s.displayTitle,
    highImpact: /JAMA|Lancet|N Engl J Med|Cephalalgia|^Pain$|Anesthesiology/i.test(
      bib.journalAbbreviation,
    ),
    specialties: s.specialties,
    interventionType: s.interventionType,
    sampleSize: s.sampleSize,
    sampleSizeBasis: s.sampleSizeBasis ?? 'Randomized participants',
    duration: s.duration,
    bottomLine: s.bottomLine,
    pico: {
      population: s.population,
      intervention: s.intervention,
      comparator: s.comparator,
      outcomes: s.label,
    },
    outcome: {
      label: s.label,
      value: s.value,
      context: s.context,
      pValue: s.pValue ?? null,
      confidenceInterval: s.confidenceInterval ?? null,
      nnt: s.nnt ?? null,
      nnh: null,
      clinicalMeaning: s.clinicalMeaning,
      timepoint: s.timepoint,
      kind: s.secondary ? 'secondary' : 'primary',
    },
    safety: { summary: s.safety, discontinuation: s.discontinuation ?? null },
    methodology: {
      blinding: s.blinding,
      randomization:
        s.randomization ?? 'Randomized; sequence generation and concealment not extracted.',
      intentionToTreat:
        s.intentionToTreat ?? 'Analysis population requires full-text verification.',
      riskOfBias: 'Not formally assessed',
      limitations: s.limitations,
    },
    provenance: {
      source: 'pubmed-abstract-seed',
      reviewedOn: '2026-10-18',
      status: 'Abstract-based summary',
      sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/`,
    },
    abstract: null,
  };
}

export const seedTrials: ClinicalTrialSummary[] = [
  trial({
    pmid: '36007534',
    acronym: 'OPTION-DM',
    displayTitle: 'Three treatment pathways for painful diabetic neuropathy',
    specialties: [NP, RX],
    interventionType: 'Drug',
    sampleSize: 140,
    duration: '16 weeks / pathway',
    bottomLine:
      'Amitriptyline-, duloxetine-, and pregabalin-based pathways produced similar pain relief. Combination therapy was associated with further improvement when monotherapy was insufficient.',
    population: 'Diabetic peripheral neuropathic pain; baseline NRS ≥4.',
    intervention:
      'Three 16-week pathways: amitriptyline → pregabalin, pregabalin → amitriptyline, duloxetine → pregabalin; titrated to tolerance (75, 600, 120 mg/day maxima).',
    comparator: 'Active treatment pathways; add-on after 6 weeks if NRS >3.',
    label: 'Mean daily pain at week 16',
    value: '6.6 → 3.3',
    context: 'NRS score across all three pathways',
    confidenceInterval:
      '98.3% CI −0.5 to 0.3 for duloxetine–pregabalin vs amitriptyline–pregabalin',
    clinicalMeaning:
      'Between-pathway difference −0.1 points; no statistically significant difference.',
    timepoint: '16 weeks per pathway',
    safety: 'Dizziness, nausea, and dry mouth differed by pathway.',
    blinding: 'Double-blind crossover',
    randomization: 'Six sequences, site-stratified permuted blocks of 6 or 12.',
    intentionToTreat: '130 of 140 randomized participants started treatment and were analyzed.',
    limitations:
      '84 completed at least two pathways. Add-on therapy was conditional on response, not separately randomized.',
  }),
  trial({
    pmid: '33818600',
    acronym: 'SENZA-PDN',
    displayTitle: '10-kHz spinal cord stimulation for painful diabetic neuropathy',
    specialties: [NP, IP],
    interventionType: 'Device',
    sampleSize: 216,
    duration: '6 months',
    bottomLine:
      'Adding 10-kHz spinal cord stimulation increased pain response in refractory diabetic neuropathy. Interpret the large effect alongside the open-label design and implantation risks.',
    population: 'Refractory PDN ≥1 year; VAS ≥5/10; HbA1c ≤10%.',
    intervention: 'Implanted 10-kHz SCS plus conventional medical management.',
    comparator: 'Conventional medical management alone.',
    label: '≥50% pain relief without neurological worsening',
    value: '79% vs 5%',
    context: 'SCS + medical management vs medical management',
    pValue: '<0.001',
    confidenceInterval: 'Difference 73.6 percentage points; 95% CI 64.2 to 83.0',
    nnt: '2 (calculated: ceil[1 / 0.736]; 3-month composite outcome)',
    clinicalMeaning: 'Composite pain response and no neurological deterioration.',
    timepoint: '3 months',
    safety: 'Infection requiring device removal occurred in 2 SCS patients (2%).',
    blinding: 'Open-label',
    intentionToTreat: 'Reported ITT endpoint: 75/95 vs 5/94; 216 randomized.',
    limitations:
      'No sham comparator; subjective outcomes and incomplete primary-endpoint denominators require appraisal.',
  }),
  trial({
    pmid: '32209650',
    acronym: 'PROMISE-2',
    displayTitle: 'Eptinezumab for the prevention of chronic migraine',
    specialties: [HA, RX],
    interventionType: 'Drug',
    sampleSize: 1072,
    sampleSizeBasis: 'Treated participants',
    duration: '12-week primary endpoint',
    bottomLine:
      'Eptinezumab reduced monthly migraine days more than placebo over 12 weeks in chronic migraine. The 300-mg arm improved by 2.6 additional days per month.',
    population: 'Adults with chronic migraine; baseline ≈16.1 migraine days/month.',
    intervention: 'Eptinezumab 100 or 300 mg IV at baseline and week 12.',
    comparator: 'IV placebo.',
    label: 'Change in monthly migraine days',
    value: '−8.2 vs −5.6',
    context: 'Days/month · 300 mg vs placebo',
    pValue: '<0.0001',
    clinicalMeaning: '100-mg arm: −7.7 days; absolute placebo-adjusted benefit 2.1 days.',
    timepoint: 'Weeks 1–12',
    safety:
      'Any TEAE: 43.5% (100 mg), 52.0% (300 mg), 46.7% (placebo); nasopharyngitis more frequent with 300 mg.',
    blinding: 'Double-blind',
    limitations:
      'Short primary follow-up; cannot establish comparative effectiveness against other CGRP therapies.',
  }),
  trial({
    pmid: '29813147',
    acronym: 'EVOLVE-1',
    displayTitle: 'Galcanezumab for the prevention of episodic migraine',
    specialties: [HA, RX],
    interventionType: 'Drug',
    sampleSize: 858,
    sampleSizeBasis: 'Treated / intention-to-treat population',
    duration: '6 months',
    bottomLine:
      'Monthly galcanezumab reduced migraine headache days more than placebo. The 120-mg and 240-mg doses showed similar efficacy over six months.',
    population: 'Adults 18–65 with 4–14 migraine headache days/month.',
    intervention: 'Galcanezumab 120 or 240 mg subcutaneously every month.',
    comparator: 'Monthly placebo; no other preventive medication.',
    label: 'Change in monthly migraine headache days',
    value: '−4.7 vs −2.8',
    context: 'Days/month · 120 mg vs placebo',
    pValue: '<0.001',
    clinicalMeaning: '1.9 additional migraine-free days/month (difference of reported means).',
    timepoint: 'Months 1–6',
    safety: 'Treatment was generally well tolerated in the reported trial.',
    discontinuation: 'Adverse-event discontinuation <5% in each group.',
    blinding: 'Double-blind',
    randomization: '2:1:1 assignment to placebo, 120 mg, or 240 mg; concealment not extracted.',
    intentionToTreat: '858 participants in the reported ITT population.',
    limitations: 'Selected episodic migraine population; six-month efficacy horizon.',
  }),
  trial({
    pmid: '29848108',
    acronym: 'EVOLVE-2',
    displayTitle: 'Galcanezumab in a global episodic migraine population',
    specialties: [HA, RX],
    interventionType: 'Drug',
    sampleSize: 915,
    sampleSizeBasis: 'Intention-to-treat population',
    duration: '6 months',
    bottomLine:
      'Galcanezumab improved migraine frequency versus placebo in a second phase 3 trial. Injection-site reactions were more frequent with active treatment.',
    population: 'Episodic migraine; global multicenter cohort.',
    intervention: 'Galcanezumab 120 or 240 mg subcutaneously monthly.',
    comparator: 'Monthly placebo.',
    label: 'Change in monthly migraine headache days',
    value: '−4.3 vs −2.3',
    context: 'Days/month · 120 mg vs placebo',
    confidenceInterval: '120-mg placebo-adjusted difference −2.0 days; 95% CI −2.6 to −1.5',
    clinicalMeaning: '240-mg arm: −4.2 days; similar efficacy to 120 mg.',
    timepoint: 'Months 1–6',
    safety:
      'Injection-site pain common in all arms; reactions and pruritus more frequent with galcanezumab.',
    blinding: 'Double-blind',
    intentionToTreat: '915 in ITT analysis.',
    limitations: 'Full-text review needed for allocation concealment and missing-data methods.',
  }),
  trial({
    pmid: '29509867',
    acronym: 'SPACE',
    displayTitle: 'Opioid versus nonopioid treatment for chronic musculoskeletal pain',
    specialties: [MS, RX],
    interventionType: 'Drug',
    sampleSize: 240,
    duration: '12 months',
    bottomLine:
      'Opioids did not improve pain-related function more than nonopioid therapy over 12 months. Medication-related symptoms were more common with opioids.',
    population: 'Moderate-to-severe chronic back or hip/knee osteoarthritis pain; VA primary care.',
    intervention:
      'Stepped opioid strategy starting with morphine, oxycodone, or hydrocodone/acetaminophen.',
    comparator: 'Stepped nonopioid strategy starting with acetaminophen or an NSAID.',
    label: 'BPI interference at 12 months',
    value: '3.4 vs 3.3',
    context: 'Opioid vs nonopioid · 0–10 scale',
    pValue: '=0.58 (overall)',
    confidenceInterval: 'Difference 0.1 points; 95% CI −0.5 to 0.7',
    clinicalMeaning: 'Prespecified clinically important difference: 1 BPI point.',
    timepoint: '12 months',
    safety: 'Medication symptoms: 1.8 vs 0.9 (opioid vs nonopioid); overall P=0.03.',
    blinding: 'Masked outcome assessors',
    limitations: 'Predominantly male VA population; participants knew treatment assignment.',
  }),
  trial({
    pmid: '29171821',
    acronym: 'STRIVE',
    displayTitle: 'Erenumab for episodic migraine prevention',
    specialties: [HA, RX],
    interventionType: 'Drug',
    sampleSize: 955,
    duration: '6 months',
    bottomLine:
      'Erenumab reduced monthly migraine days and increased ≥50% response rates versus placebo. Half of participants receiving 140 mg met the responder threshold.',
    population: 'Episodic migraine; baseline mean 8.3 migraine days/month.',
    intervention: 'Erenumab 70 or 140 mg subcutaneously monthly.',
    comparator: 'Monthly placebo.',
    label: 'Change in monthly migraine days',
    value: '−3.7 vs −1.8',
    context: 'Days/month · 140 mg vs placebo',
    pValue: '<0.001',
    nnt: '5 (calculated: ceil[1 / (0.500 − 0.266)]; secondary ≥50% response, months 4–6)',
    clinicalMeaning: 'Secondary ≥50% response: 50.0% vs 26.6% for 140 mg vs placebo.',
    timepoint: 'Months 4–6',
    safety: 'Reported adverse-event rates were similar across active and placebo groups.',
    blinding: 'Blinding details require full-text verification',
    limitations:
      'Long-term durability and rare adverse events cannot be established by this six-month trial.',
  }),
  trial({
    pmid: '29171818',
    acronym: 'HALO-CM',
    displayTitle: 'Fremanezumab for the preventive treatment of chronic migraine',
    specialties: [HA, RX],
    interventionType: 'Drug',
    sampleSize: 1130,
    duration: '12 weeks',
    bottomLine:
      'Monthly or quarterly fremanezumab reduced qualifying headache days versus placebo. The monthly regimen yielded 2.1 fewer days beyond the placebo reduction.',
    population: 'Chronic migraine: ≥15 headache days and ≥8 migraine days/month.',
    intervention: 'SC 675 mg once (quarterly) or 675 mg then 225 mg at weeks 4 and 8 (monthly).',
    comparator: 'Matching placebo.',
    label: 'Change in qualifying headache days/month',
    value: '−4.6 vs −2.5',
    context: 'Monthly regimen vs placebo',
    pValue: '<0.001',
    clinicalMeaning: 'Secondary ≥50% response: 41% monthly vs 18% placebo.',
    timepoint: '12 weeks',
    safety:
      'Injection-site reactions common; hepatic abnormalities: 1% in each active arm vs <1% placebo.',
    blinding: 'Blinding details require full-text verification',
    randomization: '1:1:1 assignment; sequence and concealment not extracted.',
    limitations:
      'Qualifying headache days are not interchangeable with migraine-day endpoints in other trials.',
  }),
  trial({
    pmid: '28328324',
    acronym: 'PRECISE',
    displayTitle: 'Pregabalin for acute and chronic sciatica',
    specialties: [NP, MS, RX],
    interventionType: 'Drug',
    sampleSize: 209,
    duration: '8 weeks',
    bottomLine:
      'Pregabalin did not significantly improve sciatica leg pain versus placebo at 8 weeks. Adverse events, including dizziness, were more frequent.',
    population: 'Patients with acute or chronic sciatica.',
    intervention: 'Pregabalin 150 mg/day, titrated up to 600 mg/day for up to 8 weeks.',
    comparator: 'Matching placebo.',
    label: 'Leg-pain intensity at week 8',
    value: '3.7 vs 3.1',
    context: 'Pregabalin vs placebo · 0–10 scale',
    pValue: '=0.19',
    confidenceInterval: 'Adjusted difference 0.5 points; 95% CI −0.2 to 1.2',
    clinicalMeaning:
      'No statistically significant improvement in the primary or secondary outcomes.',
    timepoint: '8 weeks',
    safety:
      '227 adverse events with pregabalin vs 124 with placebo; these are event counts, not patient risks.',
    blinding: 'Double-blind',
    intentionToTreat: 'Two ineligible pregabalin participants excluded after randomization.',
    limitations: 'Do not extrapolate this sciatica finding to all neuropathic pain conditions.',
  }),
  trial({
    pmid: '28672319',
    acronym: 'MINT',
    displayTitle: 'Radiofrequency denervation for chronic low back pain',
    specialties: [MS, IP],
    interventionType: 'Invasive',
    sampleSize: 681,
    sampleSizeBasis: 'Total across three randomized trials',
    duration: '3-month primary endpoint',
    bottomLine:
      'Adding radiofrequency denervation to exercise did not produce a clinically important pain benefit in these three pragmatic trials.',
    population: 'Chronic low back pain with positive diagnostic blocks; failed conservative care.',
    intervention: 'Radiofrequency denervation plus a 3-month standardized exercise program.',
    comparator: 'Exercise program with psychological support as needed.',
    label: 'Pain intensity: facet-joint trial',
    value: '−0.18 points',
    context: 'Between-group NRS difference; facet cohort only',
    confidenceInterval: '95% CI −0.76 to 0.40 (facet cohort)',
    clinicalMeaning: 'MCID was 2 points; SI-joint and combination differences −0.71 and −0.99.',
    timepoint: '3 months',
    safety: 'Adverse-event detail was not extracted from the abstract.',
    blinding: 'Nonblinded',
    limitations:
      'Three distinct cohorts, not one pooled effect. Technique and patient selection limit generalization.',
  }),
  trial({
    pmid: '27584814',
    acronym: 'SENZA · 24 MONTHS',
    displayTitle: 'High-frequency versus traditional spinal cord stimulation',
    specialties: [MS, IP],
    interventionType: 'Device',
    sampleSize: 198,
    duration: '24 months',
    bottomLine:
      'Among implanted patients, 10-kHz stimulation retained higher back-pain response rates at 24 months than traditional low-frequency SCS.',
    population: 'Chronic back and leg pain, both VAS ≥5; 86.6% had prior back surgery.',
    intervention: '10-kHz high-frequency spinal cord stimulation.',
    comparator: 'Traditional low-frequency SCS.',
    label: '≥50% back-pain response · secondary follow-up',
    value: '76.5% vs 49.3%',
    context: 'High-frequency vs traditional SCS',
    pValue: '<0.001',
    confidenceInterval: 'Difference 27.2 percentage points; 95% CI 10.1 to 41.8',
    clinicalMeaning: '24-month result is secondary; original primary endpoint was at 3 months.',
    timepoint: '24 months',
    secondary: true,
    safety: 'Procedure and device adverse-event details require full-text review.',
    blinding: 'Blinding details require full-text verification',
    randomization: '1:1 assignment to stimulation systems.',
    intentionToTreat:
      '171 of 198 randomized participants successfully trialed and received implants.',
    limitations:
      'Secondary follow-up and implanted population; assess attrition and responder enrichment before interpretation.',
  }),
  trial({
    pmid: '27002445',
    acronym: 'MBSR / CBT',
    displayTitle: 'Mindfulness and cognitive behavioral therapy for chronic back pain',
    specialties: [MS],
    interventionType: 'Physical / Digital Therapy',
    sampleSize: 342,
    duration: '26-week primary endpoint',
    bottomLine:
      'Mindfulness-based stress reduction and CBT improved function and pain bothersomeness versus usual care. Neither active approach was clearly superior.',
    population: 'Adults 20–70 with chronic low back pain; mean duration 7.3 years.',
    intervention: 'MBSR or CBT in eight weekly 2-hour group sessions.',
    comparator: 'Usual care; also compared MBSR with CBT.',
    label: '≥30% functional improvement · coprimary',
    value: '60.5% vs 44.1%',
    context: 'MBSR vs usual care · RDQ responders',
    pValue: '=0.04 (overall)',
    confidenceInterval: 'RR 1.37; 95% CI 1.06 to 1.77 (MBSR vs usual care)',
    clinicalMeaning: 'Pain-bothersomeness responders: 43.6% MBSR vs 26.6% usual care (coprimary).',
    timepoint: '26 weeks',
    safety: 'Adverse-event detail was not extracted from the abstract.',
    blinding: 'Interviewer-blind',
    intentionToTreat: 'Reported intention-to-treat analysis.',
    limitations: 'Participants could not be blinded; group-session attendance was incomplete.',
  }),
];
