import { describe, expect, it } from 'vitest';
import { eligibleMetric, shiftMonths, validateSnapshot, withinWindow } from '@/lib/evidence';
import type { EvidenceRecord, JournalMetric } from '@/types/evidence';
import metrics from '@/data/journal-metrics.json';
import snapshot from '@/data/evidence-preview.json';

describe('evidence eligibility and stale snapshot behavior', () => {
  it('uses calendar months with leap and month-end clamping', () => {
    expect(shiftMonths(new Date('2026-05-31Z'), -3)).toBe('2026-02-28');
    expect(shiftMonths(new Date('2024-02-29Z'), -120)).toBe('2014-02-28');
  });
  it('requires strictly >10, exact annual year and recent official verification', () => {
    const metric = metrics[0] as JournalMetric;
    const now = new Date('2026-10-18T12:00:00Z');
    expect(eligibleMetric(metric, now)).toBe(true);
    expect(eligibleMetric({ ...metric, value: 10 }, now)).toBe(false);
    expect(eligibleMetric({ ...metric, verification: 'unverified' }, now)).toBe(false);
    expect(eligibleMetric(metric, new Date('2028-10-19Z'))).toBe(false);
  });
  it('excludes uncertain boundary months and stale records from rolling windows', () => {
    const record = { publicationDate: '2026-07-01', datePrecision: 'month' } as EvidenceRecord;
    expect(withinWindow(record, '2026-07-18', '2026-10-18')).toBe(false);
    expect(
      withinWindow({ ...record, publicationDate: '2026-08-01' }, '2026-07-18', '2026-10-18'),
    ).toBe(true);
    expect(
      withinWindow({ ...record, publicationDate: '2026-10-01' }, '2026-07-18', '2026-10-18'),
    ).toBe(false);
  });
  it('rejects an HTML or incomplete response without replacing a valid snapshot', () => {
    expect(() => validateSnapshot('<html>fallback</html>')).toThrow();
    expect(() =>
      validateSnapshot({ schemaVersion: 1, metrics: [], sources: [], feeds: {} }),
    ).toThrow();
    expect(validateSnapshot(snapshot).schemaVersion).toBe(1);
  });
});
