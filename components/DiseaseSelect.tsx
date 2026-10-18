import { DISEASES, type DiseaseId } from '@/lib/diseases';

export function DiseaseSelect({
  value,
  onChange,
  counts,
  label = 'Disease / condition',
}: {
  value: DiseaseId | 'all';
  onChange: (disease: DiseaseId | 'all') => void;
  counts: Map<DiseaseId, number>;
  label?: string;
}) {
  return (
    <label className="disease-select">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as DiseaseId | 'all')}
      >
        <option value="all">All diseases</option>
        {[...new Set(DISEASES.map((d) => d.group))].map((group) => (
          <optgroup key={group} label={group}>
            {DISEASES.filter((d) => d.group === group).map((d) => (
              <option key={d.id} value={d.id}>
                {d.label} ({counts.get(d.id) ?? 0})
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
