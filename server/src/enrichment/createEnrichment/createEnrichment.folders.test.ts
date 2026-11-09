// @vitest-environment node
//
// 30 — Library folders, Phase 4: "the Sync over folders" (issue #271).
//
// A **Sync** over a library whose titles came from several **Library
// folders** (the **Write targets** retired in 58, issue #543):
//
// - A title's **Title folder** is its own Library folder joined to its
//   **Source folder**, so the **Layout fill** lands each poster in that
//   title's `Images/`, whichever folder holds it.
// - A title whose folder cannot be reached gets nothing written beside it,
//   and is still written into the library.
// - The summary lists the reachable folders' paths.
//
// A real SQLite library on disk, two sandboxed Library folders and a third
// listed but gone, a fake TMDB client.

import { Readable } from 'node:stream';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ENRICH_FIELDS, type EnrichmentRun } from '@/types';
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
  tmdbImageBytes,
  tmdbMovieDetail,
} from '../../test-support/fakeTmdb/fakeTmdb';
import { createEnrichment } from './createEnrichment';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

type Home = 'movies' | 'archive' | 'gone';

/** Five films, each fetched by the `tmdb_id` it carries — Confident — and the folder it came from. */
const FILMS = [
  { tmdbId: 501, title: 'Sundial', year: 2004, home: 'movies' },
  { tmdbId: 502, title: 'Lanternlight', year: 2011, home: 'movies' },
  { tmdbId: 503, title: 'Kettle Bay', year: 1998, home: 'archive' },
  { tmdbId: 504, title: 'Amber Road', year: 1987, home: 'archive' },
  { tmdbId: 505, title: 'Fogline', year: 2015, home: 'gone' },
] as const satisfies ReadonlyArray<{
  tmdbId: number;
  title: string;
  year: number;
  home: Home;
}>;

type Film = (typeof FILMS)[number];

const sourceFolderOf = (film: Film) => `${film.title} (${film.year})`;

function world() {
  const dir = sandboxRoot('familyflix-enrich-folders-');
  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  storage.setTmdbKey(KEY);
  const media = createMedia(join(dir, 'media'));

  /** The three Library folders: two on disk, one listed but gone. */
  const paths: Record<Home, string> = {
    movies: join(dir, 'Movies'),
    archive: join(dir, 'Archive'),
    gone: join(dir, 'Gone'),
  };
  for (const film of FILMS) {
    if (film.home === 'gone') continue;
    const folder = join(paths[film.home], sourceFolderOf(film));
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, `${film.title}.mkv`), 'source video bytes');
  }
  const ids: Record<Home, string> = {
    movies: storage.addLibraryFolder(paths.movies).id,
    archive: storage.addLibraryFolder(paths.archive).id,
    gone: storage.addLibraryFolder(paths.gone).id,
  };

  const enrichment = createEnrichment({
    storage,
    client: fakeTmdb({
      movies: FILMS.map((film) =>
        tmdbMovieDetail(film.tmdbId, film.title, film.year)
      ),
    }),
    media,
    playback: framelessPlayback(),
  });

  /** A film in the library, its video really stored, its folders recorded. */
  async function addFilm(film: Film): Promise<string> {
    const folder = media.reserveFolder(film.title, film.year);
    const videoPath = await media.storeUpload(
      folder,
      'video.mp4',
      Readable.from([Buffer.from('video bytes')])
    );
    const id = storage.addMovie({
      title: film.title,
      year: film.year,
      videoPath,
      tmdbId: film.tmdbId,
    }).id;
    storage.setSourceFolder(id, ids[film.home], sourceFolderOf(film));
    return id;
  }

  async function addAll(): Promise<void> {
    for (const film of FILMS) await addFilm(film);
  }

  return { storage, enrichment, paths, addAll };
}

type Enrichment = ReturnType<typeof world>['enrichment'];

async function syncAll(enrichment: Enrichment): Promise<EnrichmentRun> {
  const started = await enrichment.start({
    scope: 'all',
    fields: [...ENRICH_FIELDS],
  });
  expect(started).toMatchObject({ kind: 'started' });
  return reviewed(enrichment);
}

const texts = (run: EnrichmentRun) => run.log.map((line) => line.text);

const posterOf = (paths: Record<Home, string>, film: Film) =>
  join(paths[film.home], sourceFolderOf(film), 'Images', 'poster.jpg');

describe('createEnrichment over Library folders: posters', () => {
  it('lands each poster.jpg in its own Title folder’s Images', async () => {
    const { enrichment, paths, addAll } = world();
    await addAll();

    await syncAll(enrichment);

    for (const film of FILMS.filter((each) => each.home !== 'gone')) {
      expect(readFileSync(posterOf(paths, film), 'utf8')).toBe(
        tmdbImageBytes(`/poster-${film.tmdbId}.jpg`)
      );
    }
  });
});

describe('createEnrichment over Library folders: a folder that is gone', () => {
  it('writes nothing beside its titles, and still writes them into the library', async () => {
    const { storage, enrichment, paths, addAll } = world();
    await addAll();

    const run = await syncAll(enrichment);

    expect(texts(run).some((text) => text.includes(paths.gone))).toBe(false);
    expect(existsSync(paths.gone)).toBe(false);
    const fogline = storage
      .listMovies({ sort: 'a-z' })
      .find((movie) => movie.title === 'Fogline');
    expect(fogline?.synopsis).toBe('The 2015 Fogline.');
  });
});

describe('createEnrichment over Library folders: the summary', () => {
  it('lists the reachable folders’ paths, in the order added', async () => {
    const { enrichment, paths } = world();

    const summary = await enrichment.summary();

    expect(summary.libraryFolders).toEqual([paths.movies, paths.archive]);
  });
});
