/** Keep each status in its existing order, and never mutate search results. */
export function unreadFirst<T>(
  records: readonly T[],
  readIds: ReadonlySet<string>,
  getId: (record: T) => string,
): T[] {
  const unread: T[] = [];
  const read: T[] = [];
  for (const record of records) {
    (readIds.has(getId(record)) ? read : unread).push(record);
  }
  return [...unread, ...read];
}
