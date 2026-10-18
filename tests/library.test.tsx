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
  useLibrary.setState({ bookmarks: [], notes: {}, imported: [], compareIds: [] });
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
  it('searches, saves a trial, writes notes, and persists the library', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Clinical digests' }));
    await user.type(screen.getByRole('textbox', { name: 'Search trial library' }), 'OPTION-DM');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Save OPTION-DM' }));
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
});
