import type { ProtocolSource, TreatmentArm, TreatmentProtocol } from '@/types/protocol';

// Study-specific regimens, checked against the cited report/protocol, 2026-10-18.
// Null means not extracted, never zero. Protocol schedules are not achieved doses.
const report = (
  id: string,
  title: string,
  url: string,
  location = 'Methods: interventions',
): ProtocolSource => ({ id, title, url, location, kind: 'Trial report' });
const make = (
  summary: string,
  design: string,
  arms: TreatmentArm[],
  sources: ProtocolSource[],
  gaps: string[] = [],
): TreatmentProtocol => ({ summary, design, arms, sources, gaps, checkedOn: '2026-10-18' });
const galcanezumab = (name: string, url: string) =>
  make(
    'Galcanezumab SC: 240 mg loading → 120 mg monthly, or 240 mg monthly; 6 months.',
    'Two active dose groups and matching placebo. The 120 mg group received 240 mg at the first visit only.',
    [
      {
        label: 'Galcanezumab 120 mg regimen',
        role: 'Intervention',
        kind: 'Injection',
        agentOrProcedure: 'Galcanezumab',
        route: 'Subcutaneous (SC)',
        dose: '120 mg per maintenance dose',
        preparation:
          '120 mg in a 1 mL prefilled manual syringe; two injections per visit to preserve blinding.',
        schedule: 'Monthly for 6 months',
        titration:
          'First visit: 240 mg (two 120 mg injections). Later visits: 120 mg active + matching placebo.',
        sourceIds: ['report', 'review'],
      },
      {
        label: 'Galcanezumab 240 mg regimen',
        role: 'Active comparator',
        kind: 'Injection',
        agentOrProcedure: 'Galcanezumab',
        route: 'Subcutaneous',
        dose: '240 mg per dose',
        preparation: 'Two 120 mg / 1 mL active injections per visit.',
        schedule: 'Monthly for 6 months',
        titration: '240 mg from the first dose onward.',
        sourceIds: ['report', 'review'],
      },
      {
        label: 'Matching placebo',
        role: 'Control',
        kind: 'Injection',
        agentOrProcedure: 'Placebo',
        route: 'Subcutaneous',
        dose: 'No active galcanezumab',
        preparation: 'Two matching injections per visit.',
        schedule: 'Monthly for 6 months',
        sourceIds: ['review'],
      },
    ],
    [
      report('report', `${name}: primary trial report`, url),
      {
        ...report(
          'review',
          'CADTH clinical review: EVOLVE-1 and EVOLVE-2',
          'https://www.ncbi.nlm.nih.gov/books/NBK596661/',
          'Interventions: formulation and blinding',
        ),
        kind: 'Regulatory review',
      },
    ],
    ['Injection site rotation and needle specifications have not been extracted.'],
  );

export const treatmentProtocols: Record<string, TreatmentProtocol> = {
  '36007534': make(
    'Oral amitriptyline up to 75 mg/day, duloxetine up to 120 mg/day, pregabalin up to 600 mg/day; response-guided combinations.',
    'Three 16-week crossover pathways: amitriptyline → add pregabalin; pregabalin → add amitriptyline; duloxetine → add pregabalin. At week 6, add the second drug if NRS >3; otherwise continue monotherapy. These are protocol dose levels, not doses reached by every participant.',
    [
      {
        label: 'Amitriptyline in A–P / P–A pathways',
        role: 'Intervention',
        kind: 'Drug',
        agentOrProcedure: 'Amitriptyline',
        route: 'Oral',
        dose: '25 → 50 → 75 mg/day',
        schedule: 'Evening dose; pathway lasts 16 weeks.',
        titration:
          'Two-week initial titration to the tolerated dose; same titration approach when added after week 6.',
        sourceIds: ['protocol', 'report'],
      },
      {
        label: 'Duloxetine in D–P pathway',
        role: 'Intervention',
        kind: 'Drug',
        agentOrProcedure: 'Duloxetine',
        route: 'Oral',
        dose: '30 → 60 → 120 mg/day',
        schedule: '30 mg evening → 30 mg twice daily → 60 mg twice daily; 16-week pathway.',
        titration: 'Two-week initial titration to the tolerated dose.',
        sourceIds: ['protocol', 'report'],
      },
      {
        label: 'Pregabalin in all pathways',
        role: 'Intervention',
        kind: 'Drug',
        agentOrProcedure: 'Pregabalin',
        route: 'Oral',
        dose: 'eGFR ≥60: 150 → 300 → 600 mg/day',
        schedule:
          '75 → 150 → 300 mg twice daily; either initial treatment or added for the last 10 weeks.',
        titration:
          'eGFR 30–59 mL/min: 75 mg/day → 75 mg twice daily → 150 mg twice daily (300 mg/day maximum).',
        sourceIds: ['protocol', 'report'],
      },
    ],
    [
      report(
        'report',
        'OPTION-DM: Lancet trial report',
        'https://pubmed.ncbi.nlm.nih.gov/36007534/',
        'Methods; treatment pathways',
      ),
      {
        ...report(
          'protocol',
          'OPTION-DM protocol v9.0',
          'https://njl-admin.nihr.ac.uk/document/download/2025066',
          'Dose levels 1–3; renal dosing table',
        ),
        kind: 'Trial protocol',
      },
    ],
    ['Washout/taper details between pathways have not been extracted.'],
  ),
  '33818600': make(
    '10-kHz SCS: epidural leads T8–T11; 30 μs, 0.5–3.5 mA; 5–7-day trial before implantation.',
    '10-kHz spinal cord stimulation plus conventional medical management (CMM) versus CMM alone. Implantation follows successful temporary stimulation.',
    [
      {
        label: '10-kHz SCS + CMM',
        role: 'Intervention',
        kind: 'Procedure',
        agentOrProcedure: 'Senza spinal cord stimulation system',
        route: 'Percutaneous epidural leads spanning T8–T11',
        schedule:
          'Temporary trial 5–7 days; permanent system for responders; randomized comparison through 6 months.',
        technique:
          'Temporary epidural stimulation followed by implantation after ≥50% trial pain relief.',
        parameters:
          'Frequency 10,000 Hz; pulse width 30 μs; bipolar stimulation; amplitude 0.5–3.5 mA.',
        coInterventions: 'Conventional medical management continued.',
        sourceIds: ['report'],
      },
      {
        label: 'CMM alone',
        role: 'Control',
        kind: 'Usual care',
        agentOrProcedure: 'Conventional medical management',
        dose: null,
        schedule: '6-month randomized comparison',
        sourceIds: ['report'],
      },
    ],
    [
      report(
        'report',
        'SENZA-PDN: randomized trial',
        'https://jamanetwork.com/journals/jamaneurology/fullarticle/2777806',
        'Methods: interventions; eFigure 2 in Supplement 3',
      ),
    ],
    [
      'Peri-implant local anesthetic, antibiotic and sedation regimens were not extracted; CMM was not a single fixed drug dose.',
    ],
  ),
  '32209650': make(
    'Eptinezumab 100 or 300 mg IV in 100 mL saline over 30 minutes; day 0 and week 12.',
    'Two fixed-dose IV groups versus placebo; primary efficacy assessed during weeks 1–12.',
    [
      ...[100, 300].map((dose, i): TreatmentArm => ({
        label: `Eptinezumab ${dose} mg`,
        role: i ? 'Active comparator' : 'Intervention',
        kind: 'Injection',
        agentOrProcedure: 'Eptinezumab',
        route: 'Intravenous infusion',
        dose: `${dose} mg per infusion`,
        preparation: 'Total infusion volume 100 mL in 0.9% saline.',
        schedule:
          'Day 0 and week 12; infusion over 30 minutes (up to 15 additional minutes permitted).',
        titration: 'Fixed randomized dose; no titration.',
        sourceIds: ['report'],
      })),
      {
        label: 'IV placebo',
        role: 'Control',
        kind: 'Injection',
        agentOrProcedure: 'Placebo',
        route: 'Intravenous infusion',
        dose: 'No active eptinezumab',
        preparation: 'Total infusion volume 100 mL in 0.9% saline.',
        schedule: 'Same infusion schedule as active groups.',
        sourceIds: ['report'],
      },
    ],
    [
      report(
        'report',
        'PROMISE-2: primary report',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC7274916/',
        'Methods: study design and treatment',
      ),
    ],
  ),
  '29813147': galcanezumab(
    'EVOLVE-1',
    'https://jamanetwork.com/journals/jamaneurology/fullarticle/2681442',
  ),
  '29848108': galcanezumab('EVOLVE-2', 'https://journals.sagepub.com/doi/10.1177/0333102418779543'),
  '29171821': make(
    'Erenumab 70 or 140 mg SC every month for 6 months versus matching placebo.',
    'Three parallel groups; dose-specific efficacy assessed at months 4–6.',
    [
      ...[70, 140].map((dose, i): TreatmentArm => ({
        label: `Erenumab ${dose} mg`,
        role: i ? 'Active comparator' : 'Intervention',
        kind: 'Injection',
        agentOrProcedure: 'Erenumab',
        route: 'Subcutaneous',
        dose: `${dose} mg per dose`,
        preparation: null,
        schedule: 'Monthly for 6 months',
        titration: 'Fixed assigned dose.',
        sourceIds: ['report'],
      })),
      {
        label: 'Matching placebo',
        role: 'Control',
        kind: 'Injection',
        agentOrProcedure: 'Placebo',
        route: 'Subcutaneous',
        dose: 'No active erenumab',
        preparation: null,
        schedule: 'Monthly for 6 months',
        sourceIds: ['report'],
      },
    ],
    [
      report(
        'report',
        'STRIVE: primary trial report',
        'https://www.nejm.org/doi/full/10.1056/NEJMoa1705848',
        'Methods; abstract intervention schedule',
      ),
    ],
    [
      'Trial-specific injection volume and concentration have not been extracted; marketed formulations are not substituted.',
    ],
  ),
  '29171818': make(
    'Fremanezumab SC: quarterly 675 mg once; monthly 675 mg loading then 225 mg at weeks 4 and 8.',
    'Chronic-migraine regimens in HALO-CM. The monthly arm used a 675 mg loading dose; do not substitute the episodic-migraine schedule.',
    [
      {
        label: 'Quarterly fremanezumab',
        role: 'Intervention',
        kind: 'Injection',
        agentOrProcedure: 'Fremanezumab',
        route: 'Subcutaneous',
        dose: '675 mg at baseline',
        preparation: 'Three 225 mg / 1.5 mL injections (4.5 mL total active drug).',
        schedule:
          'Active dose at baseline; single placebo injections at weeks 4 and 8. Trial: 12 weeks.',
        sourceIds: ['report', 'followup'],
      },
      {
        label: 'Monthly fremanezumab',
        role: 'Active comparator',
        kind: 'Injection',
        agentOrProcedure: 'Fremanezumab',
        route: 'Subcutaneous',
        dose: '675 mg initially, then 225 mg per maintenance dose',
        preparation:
          'Baseline: three 225 mg / 1.5 mL injections; maintenance: one 1.5 mL injection.',
        schedule: 'Baseline, week 4 and week 8; 12-week study.',
        titration: '675 mg loading at baseline; 225 mg at weeks 4 and 8.',
        sourceIds: ['report', 'followup'],
      },
      {
        label: 'Matching placebo',
        role: 'Control',
        kind: 'Injection',
        agentOrProcedure: 'Placebo',
        route: 'Subcutaneous',
        dose: 'No active fremanezumab',
        preparation: 'Three 1.5 mL injections at baseline; one at weeks 4 and 8.',
        schedule: 'Baseline, week 4 and week 8.',
        sourceIds: ['followup'],
      },
    ],
    [
      report(
        'report',
        'HALO-CM: primary trial',
        'https://www.nejm.org/doi/full/10.1056/NEJMoa1709038',
      ),
      {
        ...report(
          'followup',
          'HALO EM/CM responder analysis: trial dosing methods',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC7792179/',
          'Methods: study design and treatments',
        ),
        kind: 'Trial follow-up',
      },
    ],
  ),
  '28328324': make(
    'Pregabalin oral 75 mg twice daily → up to 300 mg twice daily; 8 weeks including taper.',
    'Pregabalin plus usual care versus matching placebo plus usual care; doses individualized for response and tolerability.',
    [
      {
        label: 'Pregabalin',
        role: 'Intervention',
        kind: 'Drug',
        agentOrProcedure: 'Pregabalin',
        route: 'Oral',
        dose: 'Start 75 mg twice daily (150 mg/day); maximum 300 mg twice daily (600 mg/day).',
        schedule: 'Up to 8 weeks: 3-week escalation, 4-week maintenance, final-week taper.',
        titration:
          'Planned weekly daily-dose levels: 150 → 300 → 450 → 600 mg/day as tolerated. Gradually taper to cessation in week 8.',
        coInterventions: 'Usual care in both groups.',
        sourceIds: ['report', 'protocol'],
      },
      {
        label: 'Matching placebo',
        role: 'Control',
        kind: 'Drug',
        agentOrProcedure: 'Matching placebo capsules',
        route: 'Oral',
        dose: 'No active pregabalin',
        schedule: 'Same titration and taper schedule, up to 8 weeks.',
        sourceIds: ['protocol'],
      },
    ],
    [
      report(
        'report',
        'PRECISE: primary report',
        'https://www.nejm.org/doi/full/10.1056/NEJMoa1614292',
      ),
      {
        ...report(
          'protocol',
          'PRECISE protocol',
          'https://link.springer.com/article/10.1186/1745-6215-14-213',
          'Intervention; Table 1',
        ),
        kind: 'Trial protocol',
      },
    ],
  ),
  '29509867': make(
    'SPACE compared stepped medication strategies; opioid ceiling 100 morphine-equivalent mg/day, individualized titration.',
    'Pragmatic 12-month treat-to-target strategies, not a fixed-dose drug comparison. The protocol ceiling is not a recommended starting or maintenance dose.',
    [
      {
        label: 'Opioid strategy',
        role: 'Intervention',
        kind: 'Drug',
        agentOrProcedure:
          'Step 1: immediate-release morphine, oxycodone or hydrocodone/acetaminophen. Step 2: sustained-action morphine or oxycodone. Step 3: transdermal fentanyl.',
        route: 'Oral; transdermal fentanyl at step 3',
        dose: 'Protocol ceiling: 100 morphine-equivalent mg/day total; individual drug starting doses not extracted.',
        schedule: '12 months; reviews monthly until stable, then every 1–3 months.',
        titration:
          'Individualized to function, symptoms and tolerability; single-opioid therapy preferred.',
        sourceIds: ['report'],
      },
      {
        label: 'Nonopioid strategy',
        role: 'Active comparator',
        kind: 'Drug',
        agentOrProcedure:
          'Step 1: acetaminophen / NSAIDs. Step 2: nortriptyline, amitriptyline, gabapentin, topical capsaicin / lidocaine. Step 3: pregabalin, duloxetine or tramadol.',
        route: 'Oral / topical',
        dose: null,
        schedule: '12 months, with the same structured review schedule.',
        titration:
          'Individualized stepwise treatment. Tramadol was permitted in this trial’s nonopioid strategy.',
        sourceIds: ['report'],
      },
    ],
    [
      report(
        'report',
        'SPACE: primary randomized trial',
        'https://jamanetwork.com/journals/jama/fullarticle/2673971',
        'Intervention delivery; opioid and nonopioid prescribing strategies',
      ),
    ],
    [
      'Per-drug starting doses, maximum doses, patch strengths and topical concentrations require the medication protocol; they are not inferred from drug labels.',
    ],
  ),
  '28672319': make(
    'MINT: facet RFA 90°C for 90 s; SI techniques varied. Diagnostic lidocaine 2% blocks and 3-month exercise.',
    'Three distinct cohorts (facet, sacroiliac, combined sources). Diagnostic blocks and denervation anesthetic are separate. The combined cohort was randomized before diagnostic testing; denervation required a positive test.',
    [
      {
        label: 'Diagnostic blocks',
        role: 'Diagnostic selection',
        kind: 'Injection',
        agentOrProcedure: 'Lidocaine',
        route:
          'Facet medial branches; sacral lateral branches S1–S3 and L5 dorsal ramus as appropriate',
        dose: '0.5 mL of 2% lidocaine per described injection',
        preparation: '2% lidocaine; 0.5 mL volume per site.',
        schedule:
          'Before treatment selection; positive block: ≥50% pain relief within 30–90 minutes.',
        technique:
          'Fluoroscopic positioning; facet block 22-gauge needle; sacral block 25-gauge needle.',
        sourceIds: ['report'],
      },
      {
        label: 'Facet radiofrequency + exercise',
        role: 'Intervention',
        kind: 'Procedure',
        agentOrProcedure: 'Facet medial-branch denervation',
        route: 'Lumbar facet medial branches',
        dose: 'Lidocaine 2%: 1–2 mL per level before lesioning.',
        schedule: 'Denervation within 1 week of the first exercise session.',
        technique:
          'Prone; C-arm AP/lateral checks; 22 G curved needle, 10 mm active tip; sensory 50 Hz and motor 2 Hz testing.',
        parameters: '90°C for 90 seconds per lesion.',
        coInterventions:
          'Standardized exercise: 8–12 hours over 3 months; psychological care if needed.',
        sourceIds: ['report', 'supplement'],
      },
      {
        label: 'Sacroiliac radiofrequency + exercise',
        role: 'Intervention',
        kind: 'Procedure',
        agentOrProcedure: 'Physician-selected cooled RF, bipolar palisade or Simplicity III',
        route: 'Sacral lateral branches; additional monopolar L5/S1 dorsal ramus lesion',
        dose: 'Lidocaine 2% at lesion sites; volume not extracted.',
        schedule: 'Within 1 week of starting exercise.',
        technique:
          'Fluoroscopic guidance; palisade used six parallel 20 G needles, 10 mm active tips, 10 mm apart.',
        parameters:
          'Cooled RF: 60°C × 2.5 min/lesion. Palisade: eight lesions, 90°C × 180 s. Simplicity III: 85°C × 90 s/step.',
        sourceIds: ['supplement'],
      },
      {
        label: 'Combined-source cohort: disc options',
        role: 'Intervention',
        kind: 'Procedure',
        agentOrProcedure: 'Intradiscal electrothermal therapy (IDET) or biacuplasty when indicated',
        route: 'Intervertebral disc',
        schedule:
          'Diagnostic-test-dependent treatment; also used facet/SI techniques above when indicated.',
        technique: 'Fluoroscopic IDET catheter; biacuplasty: paired cooled 17 G needles.',
        parameters:
          'IDET: heat to 90°C over 12 min, hold 4 min. Biacuplasty: reported inner posterior disc profile 55/60°C, peripheral edge 45°C for 12–16 min.',
        sourceIds: ['supplement'],
      },
      {
        label: 'Exercise alone',
        role: 'Control',
        kind: 'Behavioral / physical',
        agentOrProcedure: 'Standardized exercise program',
        schedule: '8–12 hours over 3 months',
        coInterventions: 'Psychological care as needed.',
        sourceIds: ['report'],
      },
    ],
    [
      report(
        'report',
        'MINT: three randomized trials',
        'https://jamanetwork.com/journals/jama/fullarticle/2635632',
        'Diagnostic blocks; interventions; Supplement 2 eAppendix',
      ),
      report(
        'supplement',
        'MINT Supplement 2: procedure descriptions',
        'https://jamanetwork.com/journals/jama/fullarticle/2635632#supplemental-tab',
        'Supplement 2, eAppendix, PDF pages 2–4',
      ),
    ],
    [
      'SI procedures were not randomized against one another. Device temperatures are not interchangeable tissue temperatures; consult the complete eAppendix for geometry and placement.',
    ],
  ),
  '27584814': make(
    '10-kHz SCS: 30 μs pulses, lead tips T8/T9; trial up to 14 days before implant versus paresthesia-mapped traditional SCS.',
    '24-month follow-up of SENZA; procedural details below come from the original 2015 trial report for the same cohort.',
    [
      {
        label: 'High-frequency SCS',
        role: 'Intervention',
        kind: 'Procedure',
        agentOrProcedure: '10-kHz spinal cord stimulation',
        route: 'Posterior epidural space; lead tips at T8 and T9',
        schedule:
          'Trial up to 14 days; ≥40% back-pain reduction qualified for implantation. Follow-up: 24 months.',
        technique:
          'Two 8-contact percutaneous leads under radiographic guidance; no paresthesia mapping.',
        parameters:
          '10,000 Hz; 30 μs. Programmed amplitude minimum/maximum means (SD): 1.6 (1.1) / 3.8 (3.4) mA; these are observed settings, not fixed limits.',
        sourceIds: ['original', 'report'],
      },
      {
        label: 'Traditional SCS',
        role: 'Active comparator',
        kind: 'Procedure',
        agentOrProcedure: 'Traditional low-frequency spinal cord stimulation',
        route: 'Posterior epidural space; lead tips typically T7–T8',
        schedule: 'Same trial-to-implant pathway; 24-month follow-up.',
        technique: 'Two leads under radiographic guidance; intraoperative paresthesia mapping.',
        parameters:
          'Programmed minimum/maximum means (SD): frequency 39.2 (15.0) / 77.3 (133.5) Hz; amplitude 3.6 (2.8) / 8.5 (4.0) mA; pulse width 347 (148) / 591 (214) μs. These are observed settings.',
        sourceIds: ['original'],
      },
    ],
    [
      report(
        'report',
        'SENZA: 24-month randomized follow-up',
        'https://pubmed.ncbi.nlm.nih.gov/27584814/',
        'Abstract: methods and implanted population',
      ),
      report(
        'original',
        'Original SENZA RCT: Kapural et al., 2015',
        'https://s28.q4cdn.com/260621474/files/doc_downloads/outcomes/Kapural-Anesthesiology-2015-The-SENZA-RCT.pdf',
        'Page 853: interventions and implant procedures',
      ),
    ],
    [
      'Peri-implant medication doses not extracted. The 40% trial-to-implant criterion differs from the ≥50% efficacy responder endpoint.',
    ],
  ),
  '27002445': make(
    'MBSR or CBT: eight weekly 2-hour groups plus home practice; MBSR also offered an optional 6-hour retreat.',
    'Three parallel groups: mindfulness-based stress reduction, cognitive behavioral therapy, and usual care. No randomized medication or injection dose.',
    [
      {
        label: 'MBSR',
        role: 'Intervention',
        kind: 'Behavioral / physical',
        agentOrProcedure: 'Mindfulness meditation and yoga',
        schedule: 'Eight weekly 2-hour group sessions; optional 6-hour retreat.',
        technique: 'Instructor-led mindfulness training with home practice.',
        sourceIds: ['report', 'protocol'],
      },
      {
        label: 'CBT',
        role: 'Active comparator',
        kind: 'Behavioral / physical',
        agentOrProcedure: 'Cognitive behavioral therapy',
        schedule: 'Eight weekly 2-hour group sessions plus home practice.',
        technique: 'Training to change pain-related thoughts and behaviors.',
        sourceIds: ['report', 'protocol'],
      },
      {
        label: 'Usual care',
        role: 'Control',
        kind: 'Usual care',
        agentOrProcedure: 'Usual care',
        schedule: 'Primary outcome at 26 weeks.',
        sourceIds: ['report'],
      },
    ],
    [
      report('report', 'MBSR / CBT: randomized trial', 'https://pubmed.ncbi.nlm.nih.gov/27002445/'),
      {
        ...report(
          'protocol',
          'Mind-body Approaches to Pain protocol',
          'https://pubmed.ncbi.nlm.nih.gov/24906419/',
          'Intervention schedule and retreat',
        ),
        kind: 'Trial protocol',
      },
    ],
    ['Home-practice minutes and session-level curricula have not been extracted.'],
  ),
};
