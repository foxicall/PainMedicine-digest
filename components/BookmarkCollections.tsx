import { useMemo } from 'react';
import { Bookmark, FolderOpen } from 'lucide-react';
import { DISEASES, diseaseCounts, type DiseaseId } from '@/lib/diseases';
import type { ClinicalTrialSummary } from '@/types/trial';

export function BookmarkCollections({
  trials,
  disease,
  onChange,
}: {
  trials: ClinicalTrialSummary[];
  disease: DiseaseId | 'all';
  onChange: (id: DiseaseId | 'all') => void;
}) {
  const counts = useMemo(() => diseaseCounts(trials), [trials]);
  return (
    <div className="bookmark-collections">
      <div className="filter-title">
        <span>
          <FolderOpen size={18} /> Disease collections
        </span>
      </div>
      <p>Choose a condition to browse your bookmarks.</p>
      <div
        className="bookmark-collection-list"
        role="group"
        aria-label="Bookmark disease collections"
      >
        <button
          className={disease === 'all' ? 'active' : ''}
          aria-pressed={disease === 'all'}
          onClick={() => onChange('all')}
        >
          <Bookmark size={15} />
          <span>All bookmarks</span>
          <strong>{trials.length}</strong>
        </button>
        {DISEASES.filter((d) => counts.has(d.id) || d.id === disease).map((d) => (
          <button
            key={d.id}
            className={disease === d.id ? 'active' : ''}
            aria-pressed={disease === d.id}
            onClick={() => onChange(d.id)}
          >
            <span>{d.label}</span>
            <strong>{counts.get(d.id) ?? 0}</strong>
          </button>
        ))}
      </div>
      <p className="filter-hint">
        A study can belong to several diseases. Each bookmark appears once in the full list.
      </p>
      <div className="bookmark-storage-note">
        <Bookmark size={18} />
        <p>
          Bookmarks, read status and notes stay in this browser. All publication years are included.
        </p>
      </div>
    </div>
  );
}
