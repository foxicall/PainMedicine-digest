// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { useLibrary } from '@/lib/store';
import { seedTrials } from '@/data/seed-trials';
import { toCSV } from '@/lib/export';

const key = 'pain-digest-library-v1';
const reset = () =>
  useLibrary.setState({ bookmarks: [], readIds: [], notes: {}, imported: [], compareIds: [] });
beforeEach(() => {
  localStorage.clear();
  reset();
});

describe('persisted reading and bookmarks', () => {
  it('hydrates existing version-1 bookmarks and notes without losing them', async () => {
    const trial = seedTrials[0];
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        state: { bookmarks: [trial.id], notes: { [trial.id]: 'Existing note' }, imported: [] },
      }),
    );
    await useLibrary.persist.rehydrate();
    expect(useLibrary.getState().bookmarks).toEqual([trial.id]);
    expect(useLibrary.getState().notes[trial.id]).toBe('Existing note');
    expect(useLibrary.getState().readIds).toEqual([]);
    useLibrary.getState().toggleRead(trial);
    const persisted = JSON.parse(localStorage.getItem(key)!);
    expect(persisted.state.readIds).toEqual([trial.id]);
    expect(persisted.state.notes[trial.id]).toBe('Existing note');
  });
  it('retains a read indexed record across reloads, independently of bookmarks', async () => {
    const remote = {
      ...seedTrials[0],
      id: '87654321',
      pmid: '87654321',
      provenance: { ...seedTrials[0].provenance, source: 'pubmed-live' as const },
    };
    useLibrary.getState().toggleRead(remote);
    useLibrary.getState().toggleBookmark(remote);
    useLibrary.getState().setNote(remote, 'Read at journal club');
    const saved = localStorage.getItem(key)!;
    reset();
    localStorage.setItem(key, saved);
    await useLibrary.persist.rehydrate();
    expect(useLibrary.getState().readIds).toEqual([remote.id]);
    expect(useLibrary.getState().imported.map((t) => t.id)).toEqual([remote.id]);
    useLibrary.getState().toggleBookmark(remote);
    expect(useLibrary.getState().bookmarks).toEqual([]);
    expect(useLibrary.getState().readIds).toEqual([remote.id]);
    expect(useLibrary.getState().notes[remote.id]).toBe('Read at journal club');
    useLibrary.getState().toggleRead(remote);
    expect(useLibrary.getState().readIds).toEqual([]);
    expect(useLibrary.getState().notes[remote.id]).toBe('Read at journal club');
  });
  it('exports reading status, bookmark membership and existing notes together', () => {
    const [read, unread] = seedTrials;
    const csv = toCSV(
      [read, unread],
      { [read.id]: 'Keep this' },
      { readIds: [read.id], bookmarks: [read.id, unread.id] },
    );
    expect(csv).toContain('"Read status","Bookmarked"');
    expect(csv).toContain('"Already read","Yes"');
    expect(csv).toContain('"Unread","Yes"');
    expect(csv).toContain('Keep this');
  });
});
