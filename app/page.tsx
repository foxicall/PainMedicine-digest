import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Database,
  FileDown,
  GitCompareArrows,
  LayoutGrid,
  List,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { seedTrials } from '@/data/seed-trials';
import type { ClinicalTrialSummary, TrialFilters } from '@/types/trial';
import { activeFilterCount, defaultFilters, filterTrials, mergeTrials } from '@/lib/trials';
import { downloadFile, toBibTeX, toCSV } from '@/lib/export';
import { useLibrary } from '@/lib/store';
import { TrialCard } from '@/components/TrialCard';
import { FilterSidebar } from '@/components/FilterSidebar';
import { TrialDetailModal } from '@/components/TrialDetailModal';
import { CompareModal } from '@/components/CompareModal';
import { AskEvidenceModal, MethodologyModal, PubMedModal } from '@/components/EvidenceDialogs';
import { EmptyState, Modal } from '@/components/ui';

export default function Page() {
  const [filters, setFilters] = useState<TrialFilters>(defaultFilters);
  const [view, setView] = useState<'all' | 'saved'>('all');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState('newest');
  const [selectedTrial, setSelectedTrial] = useState<ClinicalTrialSummary | null>(null);
  const [dialog, setDialog] = useState<
    'pubmed' | 'ask' | 'methodology' | 'compare' | 'filters' | null
  >(null);
  const [remoteTrials, setRemoteTrials] = useState<ClinicalTrialSummary[]>([]);
  const [toast, setToast] = useState('');
  const [storageError, setStorageError] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { bookmarks, notes, imported, compareIds, clearCompare, toggleCompare } = useLibrary();
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }, []);
  const onImport = useCallback(
    (records: ClinicalTrialSummary[]) => setRemoteTrials((prev) => mergeTrials(prev, records)),
    [],
  );
  const allTrials = useMemo(
    () => mergeTrials(seedTrials, mergeTrials(imported, remoteTrials)),
    [imported, remoteTrials],
  );
  const savedTrials = useMemo(
    () => allTrials.filter((t) => bookmarks.includes(t.id)),
    [allTrials, bookmarks],
  );
  const visible = useMemo(() => {
    const list = filterTrials(view === 'saved' ? savedTrials : allTrials, filters);
    if (sort === 'newest') return list.sort((a, b) => b.year - a.year);
    if (sort === 'oldest') return list.sort((a, b) => a.year - b.year);
    if (sort === 'largest') return list.sort((a, b) => (b.sampleSize ?? -1) - (a.sampleSize ?? -1));
    return list;
  }, [allTrials, savedTrials, filters, view, sort]);
  const comparisons = allTrials.filter((t) => compareIds.includes(t.id));
  const totalParticipants = seedTrials.reduce((sum, t) => sum + (t.sampleSize ?? 0), 0);
  const filterCount = activeFilterCount(filters);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    const failed = () => setStorageError(true);
    document.addEventListener('keydown', shortcut);
    window.addEventListener('digest-storage-error', failed);
    return () => {
      document.removeEventListener('keydown', shortcut);
      window.removeEventListener('digest-storage-error', failed);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const exportLibrary = (format: 'csv' | 'bib') => {
    if (!visible.length) return;
    downloadFile(
      format === 'csv' ? toCSV(visible, notes) : toBibTeX(visible),
      `pain-digest-${view}-${new Date().toISOString().slice(0, 10)}.${format}`,
      format === 'csv' ? 'text/csv;charset=utf-8' : 'application/x-bibtex',
    );
    notify(
      `Exported ${visible.length} ${visible.length === 1 ? 'trial' : 'trials'} as ${format === 'csv' ? 'CSV' : 'BibTeX'}`,
    );
  };
  const changeView = (v: 'all' | 'saved') => {
    setView(v);
  };

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to trial library
      </a>
      <header className="site-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView('all');
            setFilters(defaultFilters);
          }}
          aria-label="Pain Medicine Trial Digest home"
        >
          <span className="brand-mark">
            <BookOpen size={27} strokeWidth={1.6} />
            <span>+</span>
          </span>
          <span>
            <strong>Pain Medicine</strong>
            <small>TRIAL DIGEST</small>
          </span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === 'all' ? 'active' : ''} onClick={() => changeView('all')}>
            <BookOpen size={16} />
            Trial library
          </button>
          <button className={view === 'saved' ? 'active' : ''} onClick={() => changeView('saved')}>
            <Bookmark size={16} />
            Saved trials
            {bookmarks.length > 0 && <span className="nav-count">{bookmarks.length}</span>}
          </button>
          <button onClick={() => setDialog('methodology')}>
            Our approach <ArrowUpRight size={13} />
          </button>
        </nav>
        <div className="header-actions">
          <span className="header-caption">
            <span className="tiny-dot" /> Evidence into practice
          </span>
          <button
            className="icon-button help-button"
            onClick={() => setDialog('methodology')}
            aria-label="About this digest"
          >
            <CircleHelp size={19} />
          </button>
        </div>
      </header>
      <div className="app-shell">
        <aside className="desktop-sidebar" aria-label="Filter trials">
          <FilterSidebar
            filters={filters}
            onChange={setFilters}
            trials={allTrials}
            onMethodology={() => setDialog('methodology')}
          />
        </aside>
        <main id="main-content" className="main-content">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="eyebrow-line" /> A CLINICAL EVIDENCE COMPANION
              </div>
              <h1>
                Better evidence.
                <br />
                <span>More informed care.</span>
              </h1>
              <p>
                Landmark pain medicine trials, distilled.
                <br className="desktop-break" /> Explore the findings. Understand the context.
                Inform your practice.
              </p>
              <div className="hero-footnote">
                <span>
                  <Check size={13} /> Structured PICO summaries
                </span>
                <span>
                  <Check size={13} /> Original sources
                </span>
              </div>
            </div>
            <button className="hero-aside" onClick={() => setDialog('methodology')}>
              <div className="hero-illustration" aria-hidden="true">
                <div className="illustration-orbit orbit-one" />
                <div className="illustration-orbit orbit-two" />
                <div className="paper-back" />
                <div className="paper-front">
                  <span className="paper-label">THE CLINICAL DIGEST</span>
                  <div className="paper-title-line" />
                  <div className="paper-title-line short" />
                  <div className="paper-chart">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="paper-rule" />
                  <div className="paper-lines" />
                </div>
                <span className="illustration-badge">
                  <ShieldCheck size={22} />
                </span>
              </div>
              <div className="hero-aside-caption">
                <span>From paper to practice.</span>
                <ArrowUpRight size={16} />
              </div>
              <p>
                A little less reading.
                <br />A lot more understanding.
              </p>
            </button>
          </section>
          <section className="stats-strip" aria-label="Library overview">
            <div>
              <BookOpen size={19} />
              <span>
                <strong>{allTrials.length}</strong>
                <small>Trial reports</small>
              </span>
            </div>
            <div>
              <Users size={20} />
              <span>
                <strong>{totalParticipants.toLocaleString()}</strong>
                <small>Participants in seed reports*</small>
              </span>
            </div>
            <div>
              <Activity size={20} />
              <span>
                <strong>5</strong>
                <small>Subspecialties</small>
              </span>
            </div>
            <div className="year-stat">
              <CalendarDays size={20} />
              <span>
                <strong>2016–2026</strong>
                <small>Publication window</small>
              </span>
            </div>
          </section>
          {storageError && (
            <div className="error-banner" role="alert">
              Browser storage is unavailable or full. Changes are available for this session only;
              export CSV to preserve your notes.
            </div>
          )}
          <section className="library-section" aria-label="Trial library">
            <div className="library-heading">
              <div>
                <h2>
                  {view === 'all' ? 'The trial library' : 'Your saved library'}
                  <span className="heading-count">
                    {view === 'all' ? allTrials.length : savedTrials.length}
                  </span>
                </h2>
                <p>
                  {view === 'all'
                    ? 'Clinically relevant research. A consistent, clearer perspective.'
                    : 'The evidence you want to return to. Notes stay in this browser.'}
                </p>
              </div>
              <div className="library-heading-actions">
                <button className="button button-secondary" onClick={() => setDialog('pubmed')}>
                  <Database size={15} />
                  Explore PubMed <ArrowUpRight size={13} />
                </button>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger
                    className="button button-secondary export-button"
                    disabled={!visible.length}
                  >
                    <ArrowDownToLine size={15} />
                    <span>Export</span>
                    <ChevronDown size={12} />
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className="dropdown-content" align="end" sideOffset={8}>
                      <DropdownMenu.Label>
                        EXPORT {visible.length} VISIBLE TRIALS
                      </DropdownMenu.Label>
                      <DropdownMenu.Item onSelect={() => exportLibrary('csv')}>
                        <FileDown size={15} />
                        CSV with personal notes
                      </DropdownMenu.Item>
                      <DropdownMenu.Item onSelect={() => exportLibrary('bib')}>
                        <BookOpen size={15} />
                        BibTeX references
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            </div>
            <div className="search-toolbar">
              <div className="search-field">
                <Search size={19} />
                <input
                  ref={searchRef}
                  aria-label="Search trial library"
                  placeholder="Search a treatment, condition, or trial…"
                  value={filters.query}
                  onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                />
                {filters.query ? (
                  <button
                    className="icon-button"
                    aria-label="Clear search"
                    onClick={() => setFilters({ ...filters, query: '' })}
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <kbd>⌘ K</kbd>
                )}
              </div>
              <button className="button ask-button" onClick={() => setDialog('ask')}>
                <Sparkles size={16} />
                <span>Ask the evidence</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="library-tabs-row">
              <div className="library-tabs" role="group" aria-label="Library view">
                <button
                  className={view === 'all' ? 'active' : ''}
                  aria-pressed={view === 'all'}
                  onClick={() => changeView('all')}
                >
                  All trials <span>{allTrials.length}</span>
                </button>
                <button
                  className={view === 'saved' ? 'active' : ''}
                  aria-pressed={view === 'saved'}
                  onClick={() => changeView('saved')}
                >
                  <Bookmark size={14} />
                  Saved <span>{savedTrials.length}</span>
                </button>
              </div>
              <div className="display-controls">
                <label htmlFor="sort-trials">Sort by:</label>
                <select id="sort-trials" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="largest">Largest sample</option>
                  <option value="relevance">Relevance</option>
                </select>
                <div className="layout-switch">
                  <button
                    className={layout === 'grid' ? 'active' : ''}
                    aria-label="Grid view"
                    aria-pressed={layout === 'grid'}
                    onClick={() => setLayout('grid')}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    className={layout === 'list' ? 'active' : ''}
                    aria-label="List view"
                    aria-pressed={layout === 'list'}
                    onClick={() => setLayout('list')}
                  >
                    <List size={18} />
                  </button>
                </div>
              </div>
            </div>
            <div className="results-row">
              <p>
                Showing <strong>{visible.length}</strong>{' '}
                {visible.length === 1 ? 'trial' : 'trials'}
                {filters.query && (
                  <>
                    {' '}
                    for <strong>“{filters.query}”</strong>
                  </>
                )}
              </p>
              <button
                className="mobile-filter-button button button-secondary small"
                onClick={() => setDialog('filters')}
              >
                <SlidersHorizontal size={14} />
                Filters{filterCount > 0 ? ` (${filterCount})` : ''}
              </button>
              <span className="source-status">
                <span className="tiny-dot" />
                Source-linked ·{' '}
                {remoteTrials.length ? 'Seed + PubMed records' : '12-study starter library'}
              </span>
            </div>
            {(filterCount > 0 || filters.query) && (
              <div className="active-filters">
                {filters.specialties.map((s) => (
                  <button
                    key={s}
                    onClick={() =>
                      setFilters({
                        ...filters,
                        specialties: filters.specialties.filter((v) => v !== s),
                      })
                    }
                  >
                    {s}
                    <X size={12} />
                  </button>
                ))}
                {filters.interventions.map((s) => (
                  <button
                    key={s}
                    onClick={() =>
                      setFilters({
                        ...filters,
                        interventions: filters.interventions.filter((v) => v !== s),
                      })
                    }
                  >
                    {s}
                    <X size={12} />
                  </button>
                ))}
                {filters.minSample > 0 && (
                  <button onClick={() => setFilters({ ...filters, minSample: 0 })}>
                    N ≥ {filters.minSample}
                    <X size={12} />
                  </button>
                )}
                {filters.highImpactOnly && (
                  <button onClick={() => setFilters({ ...filters, highImpactOnly: false })}>
                    High-impact journals
                    <X size={12} />
                  </button>
                )}
                {(filters.years[0] !== 2016 || filters.years[1] !== 2026) && (
                  <button onClick={() => setFilters({ ...filters, years: [2016, 2026] })}>
                    {filters.years.join('–')}
                    <X size={12} />
                  </button>
                )}
                <button className="clear-all" onClick={() => setFilters(defaultFilters)}>
                  Clear all
                </button>
              </div>
            )}
            {visible.length ? (
              <div className={`trial-grid ${layout === 'list' ? 'trial-list' : ''}`}>
                {visible.map((trial) => (
                  <TrialCard
                    trial={trial}
                    key={trial.id}
                    onOpen={setSelectedTrial}
                    notify={notify}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={
                  view === 'saved' && !savedTrials.length ? (
                    <Bookmark size={27} />
                  ) : (
                    <Search size={27} />
                  )
                }
                title={
                  view === 'saved' && !savedTrials.length
                    ? 'Your reading list starts here.'
                    : 'No trials match these filters.'
                }
                description={
                  view === 'saved' && !savedTrials.length
                    ? 'Tap the bookmark on any trial to keep it here. Add personal notes in the study details.'
                    : 'Try a broader search, adjust the year range, or clear your filters.'
                }
                action={
                  <button
                    className="button button-primary"
                    onClick={() => {
                      setFilters(defaultFilters);
                      if (!savedTrials.length) setView('all');
                    }}
                  >
                    {view === 'saved' && !savedTrials.length
                      ? 'Explore the library'
                      : 'Clear filters'}
                    <ArrowRight size={15} />
                  </button>
                }
              />
            )}
            {visible.length > 0 && (
              <div className="library-end">
                <span />
                <BookOpen size={17} />
                <span />
                <p>You’re up to date with this selection.</p>
                <button className="text-button" onClick={() => setDialog('pubmed')}>
                  Discover more on PubMed <ArrowUpRight size={13} />
                </button>
              </div>
            )}
          </section>
          <footer className="site-footer">
            <div>
              <span className="footer-brand">Pain Medicine Trial Digest</span>
              <p>Evidence into practice. Always with context.</p>
            </div>
            <p>
              Abstract-based summaries · Not a systematic review
              <br />
              *Sum of reported sample sizes; not unique participants.
            </p>
            <button onClick={() => setDialog('methodology')}>
              Methods & sources <ArrowUpRight size={13} />
            </button>
          </footer>
        </main>
      </div>
      {comparisons.length > 0 && (
        <div className="compare-dock">
          <span className="compare-dock-icon">
            <GitCompareArrows size={20} />
          </span>
          <div>
            <strong>{comparisons.length} of 3 trials selected</strong>
            <p>
              {comparisons.length === 1 ? 'Select one more to compare' : 'Ready for a closer look'}
            </p>
          </div>
          <div className="compare-chips">
            {comparisons.map((t) => (
              <button key={t.id} onClick={() => toggleCompare(t.id)}>
                {t.acronym}
                <X size={12} />
              </button>
            ))}
          </div>
          <button className="text-button muted" onClick={clearCompare}>
            Clear
          </button>
          <button
            className="button button-primary"
            disabled={comparisons.length < 2}
            onClick={() => setDialog('compare')}
          >
            Compare trials <ArrowRight size={15} />
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      <TrialDetailModal
        trial={selectedTrial}
        onClose={() => setSelectedTrial(null)}
        notify={notify}
      />
      <CompareModal
        open={dialog === 'compare'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        trials={comparisons}
      />
      <MethodologyModal
        open={dialog === 'methodology'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      />
      <PubMedModal
        open={dialog === 'pubmed'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        onImport={onImport}
      />
      <AskEvidenceModal
        open={dialog === 'ask'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        trials={allTrials}
        onOpenTrial={setSelectedTrial}
      />
      <Modal
        open={dialog === 'filters'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title="Refine evidence"
        description="Choose the studies that matter to you."
      >
        <FilterSidebar
          filters={filters}
          onChange={setFilters}
          trials={allTrials}
          onMethodology={() => setDialog('methodology')}
        />
        <div className="mobile-filter-footer">
          <button className="button button-primary" onClick={() => setDialog(null)}>
            Show {visible.length} trials
            <ArrowRight size={15} />
          </button>
        </div>
      </Modal>
    </>
  );
}
