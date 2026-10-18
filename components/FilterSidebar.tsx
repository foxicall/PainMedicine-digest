import {
  Activity,
  Brain,
  Bone,
  Pill as PillIcon,
  SlidersHorizontal,
  Zap,
  RotateCcw,
  Check,
  BookOpen,
  ArrowUpRight,
} from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import { SPECIALTIES, INTERVENTIONS } from '@/types/trial';
import type { ClinicalTrialSummary, TrialFilters } from '@/types/trial';
import { activeFilterCount, defaultFilters } from '@/lib/trials';

const icons = [Zap, Brain, Bone, Activity, PillIcon];
const shortNames = [
  'Neuropathic pain',
  'Headache & facial pain',
  'Musculoskeletal / spine',
  'Interventional pain',
  'Pharmacotherapy',
];
export function FilterSidebar({
  filters,
  onChange,
  trials,
  onMethodology,
}: {
  filters: TrialFilters;
  onChange: (filters: TrialFilters) => void;
  trials: ClinicalTrialSummary[];
  onMethodology: () => void;
}) {
  const update = (patch: Partial<TrialFilters>) => onChange({ ...filters, ...patch });
  const total = activeFilterCount(filters);
  return (
    <div className="filter-inner">
      <div className="filter-title">
        <span>
          <SlidersHorizontal size={17} /> Refine evidence
        </span>
        <button
          className="text-button muted"
          onClick={() => onChange({ ...defaultFilters, query: filters.query })}
          aria-label="Reset filters"
        >
          <RotateCcw size={13} /> Reset{total > 0 ? ` (${total})` : ''}
        </button>
      </div>
      <fieldset className="filter-section">
        <legend>SUBSPECIALTY</legend>
        {SPECIALTIES.map((s, i) => {
          const Icon = icons[i];
          const checked = filters.specialties.includes(s);
          return (
            <label key={s} className={`category-option ${checked ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  update({
                    specialties: checked
                      ? filters.specialties.filter((v) => v !== s)
                      : [...filters.specialties, s],
                  })
                }
              />
              <Icon size={17} />
              <span>{shortNames[i]}</span>
              <span className="category-count">
                {trials.filter((t) => t.specialties.includes(s)).length}
              </span>
              {checked && <Check size={13} className="category-check" />}
            </label>
          );
        })}
        <p className="filter-hint">Select one or more specialties</p>
      </fieldset>
      <fieldset className="filter-section">
        <legend>PUBLICATION YEAR</legend>
        <div className="year-labels">
          <span>{filters.years[0]}</span>
          <span className="muted">—</span>
          <span>{filters.years[1]}</span>
        </div>
        <Slider.Root
          className="range-slider"
          min={2016}
          max={2026}
          step={1}
          minStepsBetweenThumbs={0}
          value={filters.years}
          onValueChange={(years) => update({ years: years as [number, number] })}
        >
          <Slider.Track className="range-track">
            <Slider.Range className="range-fill" />
          </Slider.Track>
          <Slider.Thumb className="range-thumb" aria-label="Earliest publication year" />
          <Slider.Thumb className="range-thumb" aria-label="Latest publication year" />
        </Slider.Root>
        <div className="range-captions">
          <span>2016</span>
          <span>2026</span>
        </div>
      </fieldset>
      <fieldset className="filter-section">
        <legend>SAMPLE SIZE</legend>
        <div className="segmented-control">
          {[0, 100, 500].map((n) => (
            <button
              key={n}
              aria-pressed={filters.minSample === n}
              className={filters.minSample === n ? 'active' : ''}
              onClick={() => update({ minSample: n })}
            >
              {n ? `N ≥ ${n}` : 'Any'}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="filter-section">
        <legend>INTERVENTION TYPE</legend>
        {INTERVENTIONS.map((type) => (
          <label className="check-option" key={type}>
            <input
              type="checkbox"
              checked={filters.interventions.includes(type)}
              onChange={(e) =>
                update({
                  interventions: e.target.checked
                    ? [...filters.interventions, type]
                    : filters.interventions.filter((t) => t !== type),
                })
              }
            />
            <span>{type}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="filter-section journals">
        <legend>JOURNAL SELECTION</legend>
        <label className="check-option">
          <input
            type="checkbox"
            checked={filters.highImpactOnly}
            onChange={(e) => update({ highImpactOnly: e.target.checked })}
          />
          <span>High-impact journals only</span>
        </label>
        <p className="filter-hint">
          PAIN, Lancet, JAMA, NEJM,
          <br />
          Cephalalgia & Anesthesiology
        </p>
      </fieldset>
      <div className="sidebar-note">
        <BookOpen size={20} />
        <h4>A clearer view of the evidence.</h4>
        <p>Structured summaries. Transparent methods. Original sources, always.</p>
        <button className="text-button" onClick={onMethodology}>
          Our approach <ArrowUpRight size={14} />
        </button>
      </div>
    </div>
  );
}
