// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Page from '@/app/page';
import { useLibrary } from '@/lib/store';

vi.mock('@/data/phn-pilot.json', async () => {
  const { seedTrials } = await import('@/data/seed-trials');
  const trials = ['treatment', 'prevention'].map((context, index) => {
    const pmid = `9990000${index + 1}`;
    const title =
      context === 'treatment'
        ? 'Established postherpetic neuralgia trial'
        : 'Acute zoster prevention trial';
    return {
      ...seedTrials[0],
      id: pmid,
      pmid,
      acronym: `PHN DRAFT ${index + 1}`,
      title,
      displayTitle: title,
      specialties: ['Neuropathic Pain'],
      treatmentProtocol: undefined,
      provenance: {
        source: 'pubmed-live',
        status: 'Extraction draft',
        reviewedOn: null,
        sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      },
      extraction: {
        method: 'source-assisted',
        sourceLevel: 'full-text',
        clinicalContext: context,
        model: null,
        reviewStatus: 'Draft — needs clinical review',
        evidence: [
          {
            field: 'Population',
            quote: `Fixture excerpt for ${context}.`,
            sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
            location: 'Methods — participants',
          },
        ],
        missing: ['Random sequence generation requires verification.'],
      },
    };
  });
  return {
    default: {
      schemaVersion: 1,
      topic: 'Postherpetic neuralgia',
      generatedAt: '2026-10-18T00:00:00Z',
      scope: { from: '2016-10-18', to: '2026-10-18', query: 'PHN fixture query' },
      execution: {
        mode: 'source-assisted',
        externalApiStatus: 'not-run',
        note: 'Source-assisted prototype; no external API requests have run.',
        models: { screening: null, fullText: null },
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        plannedMaxCostUsd: 2.68,
        budgetCapUsd: 10,
        plannedWorkflow: {
          candidateCount: 27,
          abstractCount: 27,
          targetFulltextCount: 3,
          fulltextRatio: 0.1,
          abstractModel: 'gpt-6-luna',
          fulltextModel: 'gpt-6.1-sol',
        },
      },
      counts: { candidates: 27, abstracts: 27, fullTexts: 2, detailed: 2 },
      records: [
        ...trials.map((trial) => ({
          pmid: trial.pmid,
          title: trial.title,
          publicationDate: '2025-01-01',
          journal: trial.journal,
          publicationTypes: ['Randomized Controlled Trial'],
          sourceUrl: trial.provenance.sourceUrl,
          fullTextUrl: null,
          category: trial.extraction.clinicalContext,
          reason: `Source-assisted ${trial.extraction.clinicalContext} screening.`,
          abstractAvailable: true,
          fullTextAvailable: true,
          hasDetailed: true,
        })),
        ...Array.from({ length: 25 }, (_, index) => ({
          pmid: `888000${String(index).padStart(2, '0')}`,
          title: `Source-only candidate ${index + 1}`,
          publicationDate: '2025-01-01',
          journal: 'Fixture journal',
          publicationTypes: ['Journal Article'],
          sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/888000${String(index).padStart(2, '0')}/`,
          fullTextUrl: null,
          category: 'unclear',
          reason: 'Context requires verification.',
          abstractAvailable: true,
          fullTextAvailable: false,
          hasDetailed: false,
        })),
      ],
      trials,
    },
  };
});

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  useLibrary.setState({ bookmarks: [], readIds: [], notes: {}, imported: [], compareIds: [] });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function renderPage() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Page />
    </QueryClientProvider>,
  );
}

describe('PHN extraction pilot workflow', () => {
  it('opens from both workspaces and distinguishes source-assisted drafts from an external API run', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Open PHN pilot' }));
    expect(screen.getByRole('heading', { name: 'PHN extraction pilot' })).toBeTruthy();
    expect(screen.getByText(/External API: Not run/)).toBeTruthy();
    expect(screen.getByText(/Recorded API cost: US\$0.00/)).toBeTruthy();
    expect(screen.getByText('Drafts require clinical review')).toBeTruthy();
    expect(screen.getByText(/source-assisted prototype/)).toBeTruthy();
    expect(screen.getByText('US$2.68 · not incurred cost')).toBeTruthy();
    expect(screen.getByText('US$10.00')).toBeTruthy();
    expect(
      screen.getByText(/27 abstracts with gpt-6-luna; up to 3 selected full texts/),
    ).toBeTruthy();
    expect(
      screen.getByText(/Abstract screening: Not run; full-text extraction: Not run/),
    ).toBeTruthy();
    const sourceIndex = within(screen.getByRole('region', { name: 'PHN pilot source index' }));
    expect(sourceIndex.getAllByRole('article')).toHaveLength(24);
    await user.click(sourceIndex.getByRole('button', { name: 'Next' }));
    expect(sourceIndex.getAllByRole('article')).toHaveLength(3);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'PHN clinical context' }),
      'prevention',
    );
    expect(sourceIndex.getAllByRole('article')).toHaveLength(1);
    expect(
      sourceIndex.queryByRole('navigation', { name: 'PHN candidate source pages' }),
    ).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Back to evidence updates' }));
    await user.click(screen.getByRole('button', { name: 'Clinical digests' }));
    expect(screen.getAllByRole('article')).toHaveLength(12);
    await user.click(screen.getByRole('button', { name: 'PHN pilot' }));
    expect(screen.getByRole('heading', { name: 'PHN extraction pilot' })).toBeTruthy();
    cleanup();
    window.history.replaceState({}, '', '/?view=phn');
    renderPage();
    expect(screen.getByRole('heading', { name: 'PHN extraction pilot' })).toBeTruthy();
  });

  it('separates PHN treatment from prevention and exposes sourced fields and unresolved gaps', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Open PHN pilot' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'PHN clinical context' }),
      'treatment',
    );
    const drafts = within(screen.getByRole('region', { name: 'Detailed PHN extraction drafts' }));
    expect(drafts.getAllByRole('article')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Acute zoster prevention trial' })).toBeNull();
    const sources = within(screen.getByRole('region', { name: 'PHN pilot source index' }));
    expect(sources.getAllByRole('article')).toHaveLength(1);
    await user.click(drafts.getByRole('button', { name: 'Read digest' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('Draft — needs clinical review')).toBeTruthy();
    expect(dialog.getByText('Fixture excerpt for treatment.')).toBeTruthy();
    expect(dialog.getByRole('link', { name: 'Methods — participants' })).toBeTruthy();
    expect(dialog.getByText('Random sequence generation requires verification.')).toBeTruthy();
    expect(useLibrary.getState().readIds).toEqual([]);
  });

  it('retains pilot bookmarks and independent read status across workspaces and storage hydration', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Open PHN pilot' }));
    const title = 'Established postherpetic neuralgia trial';
    await user.click(screen.getByRole('button', { name: `Bookmark ${title}` }));
    await user.click(screen.getByRole('button', { name: `Mark ${title} as read` }));
    const persisted = localStorage.getItem('pain-digest-library-v1')!;
    await user.click(
      within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', {
        name: 'Bookmarks 1',
      }),
    );
    expect(screen.getByRole('button', { name: title })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: `Mark ${title} as unread` }).getAttribute('aria-pressed'),
    ).toBe('true');
    await user.click(screen.getByRole('button', { name: `Remove bookmark for ${title}` }));
    expect(useLibrary.getState().readIds).toContain('99900001');
    cleanup();
    await act(async () => {
      useLibrary.setState({ bookmarks: [], readIds: [], imported: [] });
      localStorage.setItem('pain-digest-library-v1', persisted);
      await useLibrary.persist.rehydrate();
    });
    renderPage();
    await user.click(
      within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', {
        name: 'Bookmarks 1',
      }),
    );
    expect(screen.getByRole('button', { name: title })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: `Mark ${title} as unread` }));
    expect(useLibrary.getState().bookmarks).toContain('99900001');
    expect(useLibrary.getState().readIds).not.toContain('99900001');
  });
});
