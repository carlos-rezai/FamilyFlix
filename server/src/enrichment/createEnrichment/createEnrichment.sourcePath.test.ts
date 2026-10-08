// @vitest-environment node
//
// 23 — Enrichment, Phase 7: "remember the library root and source folders"
// (issue #210).
//
// A **Decision** row's mono path line is the title's **Library folder** joined
// to its `source_folder` — `sourcePath`, since issue #271 — so the
// maintainer can find the folder the title came from. It is `null`, and the
// row draws no line, whenever either half is not on record: a title added by
// hand has no source folder, and a title under no listed folder has no root. Every kind of Decision carries it: `ambiguous`, `missing` and
// `conflict`.
//
// A real SQLite library on disk (so the `source_folder` column, which no
// shared type carries, can be set on the row the way an import would leave
// it) and a fake TMDB client, the `createEnrichment` suites' precedent.

import { Readable } from 'node:stream';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ENRICH_FIELDS,
  type Decision,
  type EnrichField,
  type EnrichmentRun,
} from '@/types';
import { createSqliteStorage } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  fakeTmdb,
  reviewed,
  TMDB_KEY as KEY,
  tmdbMovieDetail,
  tmdbMovieResult,
} from '../../test-support/fakeTmdb/fakeTmdb';
import type {
  TmdbMovieDetail,
  TmdbMovieResult,
} from '../tmdbClient/tmdbClient';
import { createEnrichment } from './createEnrichment';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const ROOT = 'E:\\Movies';

const ALL_FIELDS: EnrichField[] = [...ENRICH_FIELDS];

/** What TMDB's search answers, by the query it is sent. */
const SEARCHES: Record<string, TmdbMovieResult[]> = {
  // Two releases share the title: ambiguous.
  'Harbor Lights': [
    tmdbMovieResult(101, 'Harbor Lights', 1963),
    tmdbMovieResult(102, 'Harbor Lights', 2019),
  ],
  // Nothing at all: missing.
  Sundial: [],
};

const DETAILS: TmdbMovieDetail[] = [tmdbMovieDetail(501, 'Lanternlight', 2011)];

function world() {
  const dir = sandboxRoot('familyflix-enrich-source-');
  const dbPath = join(dir, 'familyflix.db');
  const storage = track(createSqliteStorage(dbPath));
  storage.setTmdbKey(KEY);
  const media = createMedia(join(dir, 'media'));
  const enrichment = createEnrichment({
    storage,
    client: fakeTmdb({ searches: SEARCHES, movies: DETAILS }),
    media,
  });

  /** A film in the library, its video really stored, and what else is given. */
  async function addFilm(
    title: string,
    year: number | null,
    values: { tmdbId?: number; synopsis?: string } = {}
  ): Promise<string> {
    const folder = media.reserveFolder(title, year);
    const videoPath = await media.storeUpload(
      folder,
      'video.mp4',
      Readable.from([Buffer.from('video bytes')])
    );
    return storage.addMovie({ title, year, videoPath, ...values }).id;
  }

  let listedRoot: { id: string } | undefined;

  /**
   * The folder an import would have recorded for the film: its Source folder,
   * under the **Library folder** at `ROOT`.
   */
  function recordSourceFolder(id: string, folder: string): void {
    listedRoot ??= storage.addLibraryFolder(ROOT);
    storage.setSourceFolder(id, listedRoot.id, folder);
  }
  return { storage, enrichment, addFilm, recordSourceFolder };
}

type Enrichment = ReturnType<typeof world>['enrichment'];

async function syncEverything(enrichment: Enrichment): Promise<EnrichmentRun> {
  await enrichment.start({
    scope: 'all',
    fields: ALL_FIELDS,
    writeSheet: false,
    writePosters: false,
  });
  return reviewed(enrichment);
}

function decisionFor(run: EnrichmentRun, title: string): Decision {
  const found = run.decisions.find((each) => each.title === title);
  if (found === undefined) throw new Error(`no Decision for ${title}`);
  return found;
}

/** A path compared without the trailing separator the prototype draws. */
const bare = (path: string | null) =>
  path === null ? null : path.replace(/[\\/]+$/, '');

describe('createEnrichment: a Decision’s path — root + source folder', () => {
  it('is drawn on an ambiguous Decision', async () => {
    const { enrichment, addFilm, recordSourceFolder } = world();
    recordSourceFolder(
      await addFilm('Harbor Lights', 1963),
      'Harbor.Lights.1080p'
    );

    const decision = decisionFor(
      await syncEverything(enrichment),
      'Harbor Lights'
    );

    expect(decision.kind).toBe('ambiguous');
    expect(bare(decision.path)).toBe(join(ROOT, 'Harbor.Lights.1080p'));
  });

  it('is drawn on a missing Decision, keeping the folders in between', async () => {
    const { enrichment, addFilm, recordSourceFolder } = world();
    recordSourceFolder(
      await addFilm('Sundial', 2004),
      join('Drama', 'Sundial')
    );

    const decision = decisionFor(await syncEverything(enrichment), 'Sundial');

    expect(decision.kind).toBe('missing');
    expect(bare(decision.path)).toBe(join(ROOT, 'Drama', 'Sundial'));
  });

  it('is drawn on a conflict Decision', async () => {
    const { enrichment, addFilm, recordSourceFolder } = world();
    recordSourceFolder(
      await addFilm('Lanternlight', 2011, {
        tmdbId: 501,
        synopsis: 'Our own words for it.',
      }),
      'Lanternlight (2011)'
    );

    const decision = decisionFor(
      await syncEverything(enrichment),
      'Lanternlight'
    );

    expect(decision.kind).toBe('conflict');
    expect(bare(decision.path)).toBe(join(ROOT, 'Lanternlight (2011)'));
  });
});

describe('createEnrichment: a Decision’s path — none when not on record', () => {
  it('is null for a title with no source folder', async () => {
    const { enrichment, addFilm } = world();
    await addFilm('Sundial', 2004);

    const decision = decisionFor(await syncEverything(enrichment), 'Sundial');

    expect(decision.path).toBeNull();
  });

  it('is null when the title’s Library folder was removed', async () => {
    const { storage, enrichment, addFilm, recordSourceFolder } = world();
    recordSourceFolder(await addFilm('Sundial', 2004), 'Sundial');
    storage.removeLibraryFolder(storage.libraryFolders()[0].id);

    const decision = decisionFor(await syncEverything(enrichment), 'Sundial');

    expect(decision.path).toBeNull();
  });
});
