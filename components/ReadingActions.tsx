import { Bookmark, BookOpen, CheckCheck } from 'lucide-react';
import { useLibrary } from '@/lib/store';
import type { ClinicalTrialSummary } from '@/types/trial';

export function ReadingActions({ trial }: { trial: ClinicalTrialSummary }) {
  const label = trial.provenance.source === 'pubmed-live' ? trial.title : trial.acronym;
  const saved = useLibrary((s) => s.bookmarks.includes(trial.id));
  const read = useLibrary((s) => s.readIds.includes(trial.id));
  const toggleBookmark = useLibrary((s) => s.toggleBookmark);
  const toggleRead = useLibrary((s) => s.toggleRead);
  return (
    <div className="reading-actions" aria-label={`Reading actions for PMID ${trial.pmid}`}>
      <button
        className={`reading-action ${read ? 'is-read' : ''}`}
        aria-label={`Mark ${label} as ${read ? 'unread' : 'read'}`}
        aria-pressed={read}
        title={read ? 'Mark as unread' : 'Mark as read'}
        onClick={() => toggleRead(trial)}
      >
        {read ? <CheckCheck size={15} /> : <BookOpen size={15} />}
        {read ? 'Already read' : 'Mark as read'}
      </button>
      <button
        className={`reading-action ${saved ? 'is-bookmarked' : ''}`}
        aria-label={`${saved ? 'Remove bookmark for' : 'Bookmark'} ${label}`}
        aria-pressed={saved}
        title={saved ? 'Remove bookmark' : 'Add bookmark'}
        onClick={() => toggleBookmark(trial)}
      >
        <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />
        {saved ? 'Bookmarked' : 'Bookmark'}
      </button>
    </div>
  );
}

export type ReadingStatus = 'all' | 'unread' | 'read';
export function ReadingFilter({
  value,
  onChange,
  total,
  read,
  label = 'Reading status',
}: {
  value: ReadingStatus;
  onChange: (value: ReadingStatus) => void;
  total: number;
  read: number;
  label?: string;
}) {
  return (
    <div className="reading-filter" role="group" aria-label={label}>
      {(
        [
          ['all', 'All', total],
          ['unread', 'Unread', total - read],
          ['read', 'Already read', read],
        ] as const
      ).map(([id, title, count]) => (
        <button
          key={id}
          aria-pressed={value === id}
          className={value === id ? 'active' : ''}
          onClick={() => onChange(id)}
        >
          {title} <span>{count.toLocaleString()}</span>
        </button>
      ))}
    </div>
  );
}
