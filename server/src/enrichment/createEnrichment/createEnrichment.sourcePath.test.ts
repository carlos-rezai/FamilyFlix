// @vitest-environment node
//
// 23 — Enrichment, Phase 7: "remember the library root and source folders"
// (issue #210).
//
// A **Decision** row's mono path line is the **Library root** joined to the
// title's `source_folder` — both remembered by the importer — so the
// maintainer can find the folder the title came from. It is `null`, and the
// row draws no line, whenever either half is not on record: a title added by
// hand has no source folder, and a library no import has run over has no
// root. Every kind of Decision carries it: `ambiguous`, `missing` and
// `conflict`.
//
// A real SQLite library on disk (so the `source_folder` column, which no
// shared type carries, can be set on the row the way an import would leave
// it) and a fake TMDB client, the `createEnrichment` suites' precedent.

import { Readable } from 'node:stream';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Decision, EnrichField, EnrichmentRun } from '@/types';
import { openDatabase } from '../../db';
import { createSqliteStorage } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type {
  TmdbClient,
  TmdbMovieDetail,
  TmdbMovieResult,
  TmdbOutcome,
} from '../tmdbClient/tmdbClient';
import { createEnrichment } from './createEnrichment';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const KEY = '0123456789abcdef0123456789abcdef';
const ROOT = 'E:\\Movies';

const ALL_FIELDS: EnrichField[] = [
  'synopsis',
  'poster',
  'backdrop',
  'runtime',
  'year',
  'genres',
  'director',
  'cast',
  'originalTitle',
  'tmdbScore',
];

function result(id: number, title: string, year: number): TmdbMovieResult {
  return {
    id,
    title,
    original_title: title,
    release_date: `${year}-06-14`,
    genre_ids: [18],
    original_language: 'en',
    poster_path: `/poster-${id}.jpg`,
    vote_average: 7.1,
  };
}

function detail(id: number, title: string, year: number): TmdbMovieDetail {
  return {
    id,
    title,
    original_title: title,
    overview: `The ${year} ${title}.`,
    release_date: `${year}-06-14`,
    runtime: 98,
    genres: [{ id: 18, name: 'Drama' }],
    vote_average: 7.1,
    poster_path: `/poster-${id}.jpg`,
    backdrop_path: `/backdrop-${id}.jpg`,
    credits: {
      cast: [{ name: `Lead of ${id}`, order: 0 }],
      crew: [{ name: `Director of ${id}`, job: 'Director' }],
    },
  };
}

/** What TMDB's search answers, by the query it is sent. */
const SEARCHES: Record<string, TmdbMovieResult[]> = {
  // Two releases share the title: ambiguous.
  'Harbor Lights': [
    result(101, 'Harbor Lights', 1963),
    result(102, 'Harbor Lights', 2019),
  ],
  // Nothing at all: missing.
  Sundial: [],
};

const DETAILS: TmdbMovieDetail[] = [detail(501, 'Lanternlight', 2011)];

const ok = <T>(value: T): Promise<TmdbOutcome<T>> =>
  Promise.resolve({ kind: 'ok', value });

function fakeTmdb() {
  return {
    authenticate: vi.fn<TmdbClient['authenticate']>(() =>
      Promise.resolve('accepted')
    ),
    searchMovie: vi.fn<TmdbClient['searchMovie']>((_key, title) =>
      ok(SEARCHES[title] ?? [])
    ),
    movie: vi.fn<TmdbClient['movie']>((_key, id) => {
      const found = DETAILS.find((each) => each.id === id);
      return found ? ok(found) : Promise.resolve({ kind: 'unreachable' });
    }),
    image: vi.fn<TmdbClient['image']>((path: string) =>
      ok(Readable.from([Buffer.from(`image bytes of ${path}`)]))
    ),
    reachable: vi.fn<TmdbClient['reachable']>(() => Promise.resolve(true)),
  };
}

function world() {
  const dir = sandboxRoot('familyflix-enrich-source-');
  const dbPath = join(dir, 'familyflix.db');
  const storage = track(createSqliteStorage(dbPath));
  const db = track(openDatabase(dbPath));
  storage.setTmdbKey(KEY);
  const media = createMedia(join(dir, 'media'));
  const enrichment = createEnrichment({
    storage,
    client: fakeTmdb() as unknown as TmdbClient,
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

  /** The folder an import would have recorded for the film. */
  function recordSourceFolder(id: string, folder: string): void {
    db.prepare('UPDATE movies SET source_folder = ? WHERE id = ?').run(
      folder,
      id
    );
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
  await vi.waitFor(() => {
    expect(enrichment.current()?.phase).toBe('review');
  });
  const run = enrichment.current();
  if (run === null) throw new Error('no Current enrichment run');
  return run;
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
    const { storage, enrichment, addFilm, recordSourceFolder } = world();
    storage.setLibraryRoot(ROOT);
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
    const { storage, enrichment, addFilm, recordSourceFolder } = world();
    storage.setLibraryRoot(ROOT);
    recordSourceFolder(
      await addFilm('Sundial', 2004),
      join('Drama', 'Sundial')
    );

    const decision = decisionFor(await syncEverything(enrichment), 'Sundial');

    expect(decision.kind).toBe('missing');
    expect(bare(decision.path)).toBe(join(ROOT, 'Drama', 'Sundial'));
  });

  it('is drawn on a conflict Decision', async () => {
    const { storage, enrichment, addFilm, recordSourceFolder } = world();
    storage.setLibraryRoot(ROOT);
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
    const { storage, enrichment, addFilm } = world();
    storage.setLibraryRoot(ROOT);
    await addFilm('Sundial', 2004);

    const decision = decisionFor(await syncEverything(enrichment), 'Sundial');

    expect(decision.path).toBeNull();
  });

  it('is null when no Library root is remembered', async () => {
    const { enrichment, addFilm, recordSourceFolder } = world();
    recordSourceFolder(await addFilm('Sundial', 2004), 'Sundial');

    const decision = decisionFor(await syncEverything(enrichment), 'Sundial');

    expect(decision.path).toBeNull();
  });
});
