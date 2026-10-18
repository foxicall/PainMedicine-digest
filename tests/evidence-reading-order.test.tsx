// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceWatch } from '@/components/EvidenceWatch';
import { useLibrary } from '@/lib/store';
import type { EvidenceRecord, EvidenceSnapshot } from '@/types/evidence';

const { records, snapshot } = vi.hoisted(() => {
  const records: EvidenceRecord[] = Array.from({ length: 27 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - index - 1);
    return {
      pmid: String(90000000 + index),
      title: `Pain treatment study ${index}`,
      authors: ['Trial Author'],
      journal: 'Test Journal',
      journalAbbreviation: 'Test J',
      issns: ['1234-5678'],
      publicationDate: date.toISOString().slice(0, 10),
      datePrecision: 'day',
      dateBasis: 'Electronic publication',
      publicationTypes: ['Randomized Controlled Trial'],
      doi: null,
      volume: '',
      issue: '',
      pages: '',
    };
  });
  const feed = {
    records,
    query: 'pain',
    from: records.at(-1)!.publicationDate,
    to: records[0].publicationDate,
    matched: records.length,
    excludedDates: 0,
    excludedJournal: 0,
    lastSuccessAt: new Date().toISOString(),
    status: 'ok' as const,
  };
  const snapshot: EvidenceSnapshot = {
    schemaVersion: 1,
    attemptedAt: new Date().toISOString(),
    preview: false,
    feeds: { trials: feed, guidelines: feed, recent: feed },
    metrics: [],
    sources: [],
  };
  return { records, snapshot };
});

vi.mock('@/lib/evidence', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/evidence')>()),
  useEvidence: () => ({ data: snapshot, isFetching: false, error: null, refetch: vi.fn() }),
}));

beforeEach(() => {
  localStorage.clear();
  useLibrary.setState({ bookmarks: [], readIds: [], notes: {}, imported: [], compareIds: [] });
});
afterEach(cleanup);

it('orders the full evidence index before pagination, including newly read records', async () => {
  const user = userEvent.setup();
  useLibrary.setState({ readIds: [records[0].pmid, records[12].pmid] });
  render(<EvidenceWatch onOpenTrial={vi.fn()} />);
  const titles = () =>
    screen.getAllByRole('article').map((card) => within(card).getByRole('heading').textContent);
  expect(screen.getAllByRole('article')).toHaveLength(24);
  expect(titles()[0]).toBe(records[1].title);
  expect(titles().at(-1)).toBe(records[25].title);
  expect(titles()).not.toContain(records[0].title);
  expect(titles()).not.toContain(records[12].title);

  await user.click(
    within(screen.getAllByRole('article')[0]).getByRole('button', { name: /as read$/ }),
  );
  expect(titles()[0]).toBe(records[2].title);
  expect(titles().at(-1)).toBe(records[26].title);
  expect(screen.queryByRole('button', { name: /as unread$/ })).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(titles()).toEqual([records[0].title, records[1].title, records[12].title]);
  await user.click(
    within(screen.getAllByRole('article')[0]).getByRole('button', { name: /as unread$/ }),
  );
  await user.click(screen.getByRole('button', { name: 'Previous' }));
  expect(titles()[0]).toBe(records[0].title);
});
