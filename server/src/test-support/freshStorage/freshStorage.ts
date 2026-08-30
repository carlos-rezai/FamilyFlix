import { afterEach } from 'vitest';

import { createSqliteStorage } from '../../library';

/**
 * The storage harness every `library/` test opens its database through.
 *
 * Seven test files carried this verbatim before it moved here. It is a test
 * double's neighbour rather than backend logic — see README's note on
 * `server/src/test-support/` — and nothing that ships imports it.
 *
 * The `afterEach` below is registered at module scope, which under Vitest's
 * default isolation means **once per importing test file**: each file gets its
 * own module registry, so each gets its own `closeables` array and its own
 * teardown. Verified with a two-file probe before this helper was written, and
 * pinned by `freshStorage.test.ts`.
 */
interface Closeable {
  close(): void;
}

const closeables: Closeable[] = [];

/** Register a resource to be closed after the test that opened it. */
export function track<T extends Closeable>(resource: T): T {
  closeables.push(resource);
  return resource;
}

/** A fresh, fully-migrated in-memory repository, closed automatically. */
export function freshStorage(): ReturnType<typeof createSqliteStorage> {
  return track(createSqliteStorage(':memory:'));
}

afterEach(() => {
  for (const resource of closeables.splice(0)) {
    try {
      resource.close();
    } catch {
      // already closed by the test — fine.
    }
  }
});
