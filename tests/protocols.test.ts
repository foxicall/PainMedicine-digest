import { describe, expect, it } from 'vitest';
import { seedTrials } from '@/data/seed-trials';
import { treatmentProtocols } from '@/data/treatment-protocols';
import { classifyDisease } from '@/lib/diseases';
import { defaultFilters, filterTrials, groupTrialsByDisease } from '@/lib/trials';
import { toCSV } from '@/lib/export';
import { protocolText } from '@/types/protocol';

describe('disease navigation', () => {
  it('keeps overlapping SPACE populations discoverable without duplicating the library', () => {
    expect(
      filterTrials(seedTrials, { ...defaultFilters, disease: 'osteoarthritis' }).map(
        (t) => t.acronym,
      ),
    ).toEqual(['SPACE']);
    const grouped = groupTrialsByDisease(seedTrials, 'all').flatMap(([, studies]) => studies);
    expect(grouped).toHaveLength(12);
    expect(new Set(grouped.map((t) => t.id)).size).toBe(12);
    expect(
      filterTrials(seedTrials, {
        ...defaultFilters,
        disease: 'low-back',
        interventions: ['Drug'],
      }).map((t) => t.acronym),
    ).toEqual(['SPACE']);
  });
  it('does not infer a migraine subtype from a drug or turn noncancer pain into cancer pain', () => {
    expect(classifyDisease({ pmid: '1', title: 'Fremanezumab for migraine' }).ids).toEqual([
      'migraine',
    ]);
    expect(
      classifyDisease({ pmid: '2', title: 'Opioids for chronic non-cancer pain' }).ids,
    ).not.toContain('cancer');
    expect(
      classifyDisease({ pmid: '3', title: 'Episodic and chronic migraine prevention' }).ids,
    ).toEqual(['episodic-migraine', 'chronic-migraine']);
    expect(classifyDisease({ pmid: '4', title: 'Digital pain care' })).toEqual({
      ids: ['unclassified'],
      basis: 'Title keywords — unconfirmed',
    });
  });
  it('still finds an exact trial identifier when protocol text broadens the fuzzy index', () => {
    expect(
      filterTrials(seedTrials, { ...defaultFilters, query: 'OPTION-DM' }).map((t) => t.acronym),
    ).toEqual(['OPTION-DM']);
  });
});

describe('study-specific treatment provenance', () => {
  it('provides traceable regimens for each curated report without upgrading risk-of-bias status', () => {
    for (const trial of seedTrials) {
      const protocol = trial.treatmentProtocol!;
      expect(protocol).toBeDefined();
      expect(protocol.arms.length).toBeGreaterThanOrEqual(2);
      expect(classifyDisease(trial).basis).toBe('Reviewed population');
      expect(trial.methodology.riskOfBias).toBe('Not formally assessed');
      for (const arm of protocol.arms) {
        expect(arm.sourceIds.length).toBeGreaterThan(0);
        for (const id of arm.sourceIds) {
          const source = protocol.sources.find((s) => s.id === id);
          expect(source?.url).toMatch(/^https:\/\//);
          expect(source?.location).toBeTruthy();
        }
      }
    }
  });
  it('preserves loading doses and differentiates diagnostic and therapeutic local anesthetic', () => {
    for (const id of ['29813147', '29848108'])
      expect(treatmentProtocols[id].arms[0].titration).toContain('240 mg');
    const halo = treatmentProtocols['29171818'];
    expect(halo.arms[0].schedule).toContain('placebo injections at weeks 4 and 8');
    expect(halo.arms[1].titration).toContain('675 mg loading');
    const mint = treatmentProtocols['28672319'];
    expect(mint.arms[0].role).toBe('Diagnostic selection');
    expect(mint.arms[0].dose).toContain('0.5 mL');
    expect(mint.arms[1].dose).toContain('1–2 mL');
    expect(mint.arms[1].parameters).toContain('90°C');
    expect(treatmentProtocols['27584814'].arms[0].schedule).toContain('≥40%');
  });
  it('exports complete arm-specific regimens, source links and missing-data labels', () => {
    const csv = toCSV(seedTrials);
    expect(csv).toContain('Procedure and dosage by arm');
    expect(csv).toContain('100 mL in 0.9% saline');
    expect(csv).toContain('Dose: Not extracted');
    expect(csv).toContain('https://njl-admin.nihr.ac.uk/document/download/2025066');
    expect(protocolText()).toContain('Not extracted');
  });
});
