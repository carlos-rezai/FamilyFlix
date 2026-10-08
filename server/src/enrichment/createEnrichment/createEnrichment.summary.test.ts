// @vitest-environment node
//
// 23 — Enrichment, Phase 3: "setup's readiness" (issue #206).
//
// `summary()` — the `EnrichmentSummary` the setup and the Settings sync row
// both read: the library's titles (every **Movie** and **Series**) and how
// many have **Full details**, when a **Sync** last reached review, whether a
// key is stored, whether TMDB answered the client's reachability probe —
// asked by the server, so a Wi-Fi with no internet behind it is offline —
// and the reachable **Library folders** (none on a fresh library). An
// empty library answers zeros, not an error.
//
// A real in-memory SQLite library and a fake TMDB client, the
// `createEnrichment` suites' precedent. Nothing here goes online.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createMedia } from '../../media/createMedia/createMedia';
import {
  fakeTmdb,
  TMDB_KEY as KEY,
} from '../../test-support/fakeTmdb/fakeTmdb';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { createEnrichment } from './createEnrichment';

function world({ reachable = true } = {}) {
  const storage = freshStorage();
  const client = fakeTmdb({ reachable });
  const enrichment = createEnrichment({
    storage,
    client,
    media: createMedia(sandboxRoot('familyflix-enrich-summary-')),
  });
  return { storage, client, enrichment };
}

describe('createEnrichment: summary — the counts', () => {
  it('answers zeros for an empty library, not an error', async () => {
    const { enrichment } = world();

    const summary = await enrichment.summary();

    expect(summary).toMatchObject({ total: 0, complete: 0 });
  });

  it('counts movies and series, and those with Full details', async () => {
    const { storage, enrichment } = world();
    storage.addMovie(
      newMovie({
        title: 'Complete',
        synopsis: 'Has everything.',
        posterPath: 'complete/poster.jpg',
      })
    );
    storage.addMovie(newMovie({ title: 'Bare' }));
    storage.addSeries({
      title: 'Complete Show',
      synopsis: 'Has everything.',
      posterPath: 'complete-show/poster.jpg',
    });
    storage.addSeries({ title: 'Bare Show' });

    const summary = await enrichment.summary();

    expect(summary).toMatchObject({ total: 4, complete: 2 });
  });
});

describe('createEnrichment: summary — the key, the last sync, the root', () => {
  it('says no key is set on a fresh library, and never synced', async () => {
    const { enrichment } = world();

    const summary = await enrichment.summary();

    expect(summary).toMatchObject({
      keySet: false,
      lastSyncedAt: null,
      libraryFolders: [],
    });
  });

  it('says a key is set once one is stored', async () => {
    const { storage, enrichment } = world();
    storage.setTmdbKey(KEY);

    expect((await enrichment.summary()).keySet).toBe(true);
  });

  // Issue #271: the summary answers the reachable Library folders, in the
  // order added — the folders a Sync can write back into.
  it('answers the reachable Library folders in the order added', async () => {
    const { storage, enrichment } = world();
    const first = sandboxRoot('familyflix-enrich-folder-a-');
    const second = sandboxRoot('familyflix-enrich-folder-b-');
    storage.addLibraryFolder(first);
    storage.addLibraryFolder(second);

    expect((await enrichment.summary()).libraryFolders).toEqual([
      first,
      second,
    ]);
  });

  it('leaves out a Library folder that cannot be reached', async () => {
    const { storage, enrichment } = world();
    const here = sandboxRoot('familyflix-enrich-folder-a-');
    storage.addLibraryFolder(join(here, 'not-there'));
    storage.addLibraryFolder(here);

    expect((await enrichment.summary()).libraryFolders).toEqual([here]);
  });

  it('answers when a Sync last reached review', async () => {
    const { storage, enrichment } = world();
    storage.setEnrichmentLastSyncedAt('2026-09-26T09:30:00.000Z');

    expect((await enrichment.summary()).lastSyncedAt).toBe(
      '2026-09-26T09:30:00.000Z'
    );
  });
});

describe('createEnrichment: summary — online', () => {
  it('is online when TMDB answered the probe', async () => {
    const { client, enrichment } = world({ reachable: true });

    const summary = await enrichment.summary();

    expect(client.reachable).toHaveBeenCalled();
    expect(summary.online).toBe(true);
  });

  it('is offline when the probe did not answer', async () => {
    const { enrichment } = world({ reachable: false });

    expect((await enrichment.summary()).online).toBe(false);
  });

  it('asks the probe even with no key stored', async () => {
    const { client, enrichment } = world({ reachable: false });

    const summary = await enrichment.summary();

    expect(client.reachable).toHaveBeenCalled();
    expect(summary).toMatchObject({ keySet: false, online: false });
  });
});
