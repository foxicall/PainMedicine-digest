import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ClinicalTrialSummary } from '@/types/trial';

interface LibraryState {
  bookmarks: string[];
  notes: Record<string, string>;
  imported: ClinicalTrialSummary[];
  compareIds: string[];
  toggleBookmark: (trial: ClinicalTrialSummary) => void;
  setNote: (trial: ClinicalTrialSummary, note: string) => void;
  toggleCompare: (id: string) => boolean;
  clearCompare: () => void;
}

const reportStorageError = () => window.dispatchEvent(new CustomEvent('digest-storage-error'));
const safeStorage = {
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      reportStorageError();
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {
      reportStorageError();
    }
  },
};
const retain = (records: ClinicalTrialSummary[], t: ClinicalTrialSummary) =>
  t.provenance.source === 'pubmed-live' && !records.some((r) => r.id === t.id)
    ? [...records, t]
    : records;

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      bookmarks: [],
      notes: {},
      imported: [],
      compareIds: [],
      toggleBookmark: (t) =>
        set((s) => ({
          bookmarks: s.bookmarks.includes(t.id)
            ? s.bookmarks.filter((id) => id !== t.id)
            : [...s.bookmarks, t.id],
          imported: retain(s.imported, t),
        })),
      setNote: (t, note) =>
        set((s) => ({ notes: { ...s.notes, [t.id]: note }, imported: retain(s.imported, t) })),
      toggleCompare: (id) => {
        const ids = get().compareIds;
        if (!ids.includes(id) && ids.length >= 3) return false;
        set({ compareIds: ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id] });
        return true;
      },
      clearCompare: () => set({ compareIds: [] }),
    }),
    {
      name: 'pain-digest-library-v1',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ bookmarks: s.bookmarks, notes: s.notes, imported: s.imported }),
    },
  ),
);
