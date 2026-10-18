// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Page from '@/app/page';
import { useLibrary } from '@/lib/store';
import { seedTrials } from '@/data/seed-trials';

beforeEach(() => {
  // JSDOM has no layout engine; Radix uses ResizeObserver to measure sliders.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  localStorage.clear();
  useLibrary.setState({ bookmarks: [], readIds: [], notes: {}, imported: [], compareIds: [] });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Page />
    </QueryClientProvider>,
  );

describe('reading workflow', () => {
  it('moves read studies behind unread studies while preserving the selected sort', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Clinical digests' }));
    await user.click(screen.getByRole('checkbox', { name: 'Group by disease' }));
    const cardIds = () =>
      screen.getAllByRole('article').map((card) =>
        within(card)
          .getByRole('link', { name: /^PMID / })
          .textContent?.replace('PMID ', ''),
      );
    const original = cardIds();
    expect(original[0]).toBe('36007534');
    await user.click(screen.getByRole('button', { name: 'Mark OPTION-DM as read' }));
    expect(cardIds()).toEqual([...original.slice(1), original[0]]);
    await user.click(screen.getByRole('button', { name: 'Mark OPTION-DM as unread' }));
    expect(cardIds()).toEqual(original);

    await user.click(screen.getByRole('button', { name: 'Mark HALO-CM as read' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by:' }), 'largest');
    const largest = cardIds();
    expect(largest[0]).toBe('32209650'); // PROMISE-2: largest unread sample.
    expect(largest.at(-1)).toBe('29171818'); // HALO-CM: largest overall, already read.
    const unreadSizes = largest
      .slice(0, -1)
      .map((id) => seedTrials.find((trial) => trial.id === id)!.sampleSize!);
    expect(unreadSizes).toEqual([...unreadSizes].sort((a, b) => b - a));
    await user.click(screen.getByRole('button', { name: 'Mark HALO-CM as unread' }));
    expect(cardIds()[0]).toBe('29171818');
  });
  it('keeps disease collections inside unread-first bookmark sections', async () => {
    const user = userEvent.setup();
    const option = seedTrials.find((trial) => trial.acronym === 'OPTION-DM')!;
    const senza = seedTrials.find((trial) => trial.acronym === 'SENZA-PDN')!;
    const space = seedTrials.find((trial) => trial.acronym === 'SPACE')!;
    for (const trial of [option, senza, space]) useLibrary.getState().toggleBookmark(trial);
    useLibrary.getState().toggleRead(option);
    useLibrary.getState().toggleRead(space);
    renderPage();
    await user.click(
      within(screen.getByRole('navigation')).getByRole('button', { name: 'Bookmarks 3' }),
    );
    const unread = screen.getByRole('region', { name: 'Unread publications' });
    const read = screen.getByRole('region', { name: 'Already read publications' });
    expect(unread.compareDocumentPosition(read) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(unread).getAllByRole('article')).toHaveLength(1);
    expect(within(unread).getByRole('button', { name: senza.displayTitle })).toBeTruthy();
    expect(
      within(unread).getByRole('heading', { name: 'Painful diabetic neuropathy' }),
    ).toBeTruthy();
    expect(within(read).getAllByRole('article')).toHaveLength(2);
    expect(within(read).getByRole('heading', { name: 'Painful diabetic neuropathy' })).toBeTruthy();
    expect(within(read).getByRole('heading', { name: /Low back/ })).toBeTruthy();
    const collections = within(screen.getByRole('group', { name: 'Bookmark disease collections' }));
    await user.click(collections.getByRole('button', { name: 'Painful diabetic neuropathy 2' }));
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: space.displayTitle })).toBeNull();
    expect(screen.getAllByRole('article')[0].textContent).toContain(senza.displayTitle);
    expect(screen.getAllByRole('article')[1].textContent).toContain(option.displayTitle);
  });
  it('filters by disease and displays sourced regimens in the digest', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Clinical digests' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Disease / condition' }),
      'osteoarthritis',
    );
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(
      (screen.getByRole('checkbox', { name: 'Group by disease' }) as HTMLInputElement).checked,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Read digest' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('heading', { name: 'Intervention protocol & dosing' })).toBeTruthy();
    expect(dialog.getByText(/Protocol ceiling: 100/)).toBeTruthy();
    expect(
      dialog.getAllByRole('link', { name: /SPACE: primary randomized trial/ }).length,
    ).toBeGreaterThan(0);
  });
  it('searches, saves a trial, writes notes, and persists the library', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Clinical digests' }));
    await user.type(screen.getByRole('textbox', { name: 'Search trial library' }), 'OPTION-DM');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Bookmark OPTION-DM' }));
    await user.click(screen.getByRole('button', { name: 'Read digest' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'My notes' }));
    await user.type(
      dialog.getByRole('textbox', { name: 'Personal notes for OPTION-DM' }),
      'Discuss crossover attrition',
    );
    const stored = JSON.parse(localStorage.getItem('pain-digest-library-v1')!);
    expect(stored.state.bookmarks).toContain('36007534');
    expect(stored.state.notes['36007534']).toBe('Discuss crossover attrition');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('enforces a maximum of three comparison selections', () => {
    for (const t of seedTrials.slice(0, 3))
      expect(useLibrary.getState().toggleCompare(t.id)).toBe(true);
    expect(useLibrary.getState().toggleCompare(seedTrials[3].id)).toBe(false);
    expect(useLibrary.getState().compareIds).toHaveLength(3);
    useLibrary.getState().toggleCompare(seedTrials[0].id);
    expect(useLibrary.getState().toggleCompare(seedTrials[3].id)).toBe(true);
  });
  it('keeps saved remote records across storage rehydration', async () => {
    const remote = {
      ...seedTrials[0],
      id: '98765432',
      pmid: '98765432',
      provenance: { ...seedTrials[0].provenance, source: 'pubmed-live' as const },
    };
    useLibrary.getState().toggleBookmark(remote);
    const persisted = localStorage.getItem('pain-digest-library-v1');
    useLibrary.setState({ bookmarks: [], imported: [] });
    localStorage.setItem('pain-digest-library-v1', persisted!);
    await useLibrary.persist.rehydrate();
    expect(useLibrary.getState().imported[0].pmid).toBe(remote.pmid);
    expect(useLibrary.getState().bookmarks).toContain(remote.id);
  });
  it('marks a study read in its digest and filters it without changing its bookmark', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Clinical digests' }));
    await user.type(screen.getByRole('textbox', { name: 'Search trial library' }), 'OPTION-DM');
    await user.click(screen.getByRole('button', { name: 'Bookmark OPTION-DM' }));
    await user.click(screen.getByRole('button', { name: 'Read digest' }));
    expect(useLibrary.getState().readIds).toEqual([]);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark OPTION-DM as read' }),
    );
    await user.keyboard('{Escape}');
    expect(
      screen.getByRole('button', { name: 'Mark OPTION-DM as unread' }).getAttribute('aria-pressed'),
    ).toBe('true');
    const reading = within(screen.getByRole('group', { name: 'Reading status' }));
    await user.click(reading.getByRole('button', { name: 'Unread 0' }));
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    await user.click(reading.getByRole('button', { name: 'Already read 1' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Mark OPTION-DM as unread' }));
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(useLibrary.getState().bookmarks).toContain('36007534');
  });
  it('always groups bookmarks by disease and includes archived publications', async () => {
    const user = userEvent.setup();
    const space = seedTrials.find((t) => t.acronym === 'SPACE')!;
    const oldGuideline = {
      ...seedTrials[0],
      id: '12345',
      pmid: '12345',
      acronym: 'GUIDELINE',
      title: 'Migraine practice guideline',
      displayTitle: 'Migraine practice guideline',
      year: 2010,
      provenance: { ...seedTrials[0].provenance, source: 'pubmed-live' as const },
    };
    useLibrary.getState().toggleBookmark(space);
    useLibrary.getState().toggleBookmark(oldGuideline);
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Clinical digests' }));
    await user.click(screen.getByRole('checkbox', { name: 'Group by disease' }));
    await user.click(
      within(screen.getByRole('navigation')).getByRole('button', { name: 'Bookmarks 2' }),
    );
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByRole('checkbox', { name: 'Group by disease' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Migraine — subtype unspecified' })).toBeTruthy();
    const collections = within(screen.getByRole('group', { name: 'Bookmark disease collections' }));
    await user.click(collections.getByRole('button', { name: 'Osteoarthritis 1' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Osteoarthritis' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Remove bookmark for SPACE' }));
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    await user.click(collections.getByRole('button', { name: 'All bookmarks 1' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Migraine practice guideline' })).toBeTruthy();
  });
});
