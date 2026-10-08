// @vitest-environment node
//
// 30 — Library folders, Phase 4: "the Sync over folders" (issue #271).
//
// A **Sync** with both **Write targets** on, over a library whose titles came
// from several **Library folders**:
//
// - A title's on-disk folder is `sourcePath(id)` — its own Library folder
//   joined to its **Source folder** — so each `poster.jpg` lands beside that
//   title's files, whichever folder holds it.
// - The write check runs once per reachable folder, one dry-run line each:
//   `Will write familyflix-metadata.csv to <path>`, or `Can't write to <path>
//   — the sheet and posters will be skipped`. A folder that fails it loses
//   only its own targets.
// - Each writable folder gets one **Metadata sheet**, holding that folder's
//   films only.
// - A title whose folder cannot be reached gets the _no source folder on
//   record, poster skipped_ line, and its folder no check at all.
// - The summary lists the reachable folders' paths.
//
// A real SQLite library on disk, two sandboxed Library folders and a third
// listed but gone, a fake TMDB client — `createEnrichment.writeBack`'s
// precedent. Windows answers every directory writable to `access`, so the
// read-only folder is the real Write targets behind a check that refuses it.

import { Readable } from 'node:stream';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ENRICH_FIELDS, type EnrichmentRun } from '@/types';
import { readSheet } from '../../import-export/readSheet/readSheet';
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
import {
  writeBack as realWriteBack,
  type WriteBack,
} from '../writeBack/writeBack';
import { createEnrichment } from './createEnrichment';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const SHEET = 'familyflix-metadata.csv';

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

/** Every file under a directory, relative to it, sorted. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  const walk = (at: string) => {
    for (const name of readdirSync(at)) {
      const full = join(at, name);
      if (statSync(full).isDirectory()) walk(full);
      else found.push(relative(dir, full));
    }
  };
  walk(dir);
  return found.sort();
}

/** The real Write targets, with a permission check that refuses `readOnly`. */
function refusing(readOnly: string): WriteBack {
  return {
    ...realWriteBack,
    check: async (root, targets) =>
      root === readOnly
        ? {
            writable: { sheet: false, posters: false },
            lines: [
              {
                text: `Can't write to ${root} — the sheet and posters will be skipped`,
                kind: 'warning',
              },
            ],
          }
        : realWriteBack.check(root, targets),
  };
}

function world({ readOnly }: { readOnly?: Home } = {}) {
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
    ...(readOnly === undefined ? {} : { writeBack: refusing(paths[readOnly]) }),
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

async function syncBoth(enrichment: Enrichment): Promise<EnrichmentRun> {
  const started = await enrichment.start({
    scope: 'all',
    fields: [...ENRICH_FIELDS],
    writeSheet: true,
    writePosters: true,
  });
  expect(started).toMatchObject({ kind: 'started' });
  return reviewed(enrichment);
}

const texts = (run: EnrichmentRun) => run.log.map((line) => line.text);

const posterOf = (paths: Record<Home, string>, film: Film) =>
  join(paths[film.home], sourceFolderOf(film), 'poster.jpg');

async function sheetTitles(folder: string): Promise<string[]> {
  const rows = await readSheet(readFileSync(join(folder, SHEET)), SHEET);
  return rows.map((row) => row.title);
}

describe('createEnrichment over Library folders: the write check', () => {
  it('logs one dry-run line per reachable folder, and none for a folder that is gone', async () => {
    const { enrichment, paths, addAll } = world();
    await addAll();

    const run = await syncBoth(enrichment);

    const lines = texts(run);
    for (const path of [paths.movies, paths.archive]) {
      expect(
        lines.filter((text) => text === `Will write ${SHEET} to ${path}`)
      ).toHaveLength(1);
    }
    expect(lines.some((text) => text.includes(paths.gone))).toBe(false);
  });
});

describe('createEnrichment over Library folders: posters', () => {
  it('lands each poster.jpg in its own title’s Source folder', async () => {
    const { enrichment, paths, addAll } = world();
    await addAll();

    const run = await syncBoth(enrichment);

    for (const film of FILMS.filter((each) => each.home !== 'gone')) {
      expect(readFileSync(posterOf(paths, film), 'utf8')).toBe(
        tmdbImageBytes(`/poster-${film.tmdbId}.jpg`)
      );
    }
    expect(run.written.posters).toBe(true);
  });
});

describe('createEnrichment over Library folders: the Metadata sheets', () => {
  it('writes one sheet into each folder, holding only that folder’s films A–Z', async () => {
    const { enrichment, paths, addAll } = world();
    await addAll();

    const run = await syncBoth(enrichment);

    expect(await sheetTitles(paths.movies)).toEqual([
      'Lanternlight',
      'Sundial',
    ]);
    expect(await sheetTitles(paths.archive)).toEqual([
      'Amber Road',
      'Kettle Bay',
    ]);
    expect(run.written.sheet).toBe(true);
  });

  it('leaves one folder’s existing sheet alone and still writes the other’s', async () => {
    const { enrichment, paths, addAll } = world();
    const ours = Buffer.from('Title,Year\nOur own list,1999\n');
    writeFileSync(join(paths.archive, SHEET), ours);
    await addAll();

    await syncBoth(enrichment);

    expect(readFileSync(join(paths.archive, SHEET)).equals(ours)).toBe(true);
    expect(await sheetTitles(paths.movies)).toEqual([
      'Lanternlight',
      'Sundial',
    ]);
  });
});

describe('createEnrichment over Library folders: a read-only folder', () => {
  it('logs its Can’t write line, and the other folder’s Will write line', async () => {
    const { enrichment, paths, addAll } = world({ readOnly: 'archive' });
    await addAll();

    const run = await syncBoth(enrichment);

    expect(texts(run)).toContain(
      `Can't write to ${paths.archive} — the sheet and posters will be skipped`
    );
    expect(texts(run)).toContain(`Will write ${SHEET} to ${paths.movies}`);
  });

  it('loses only its own targets — the other folder is still written', async () => {
    const { enrichment, paths, addAll } = world({ readOnly: 'archive' });
    const archiveBefore = filesUnder(paths.archive);
    await addAll();

    const run = await syncBoth(enrichment);

    expect(filesUnder(paths.archive)).toEqual(archiveBefore);
    expect(await sheetTitles(paths.movies)).toEqual([
      'Lanternlight',
      'Sundial',
    ]);
    for (const film of FILMS.filter((each) => each.home === 'movies')) {
      expect(existsSync(posterOf(paths, film))).toBe(true);
    }
    expect(run.written).toEqual({ sheet: true, posters: true });
  });
});

describe('createEnrichment over Library folders: a folder that is gone', () => {
  it('logs its titles’ skip line, and still writes them into the library', async () => {
    const { storage, enrichment, paths, addAll } = world();
    await addAll();

    const run = await syncBoth(enrichment);

    expect(texts(run)).toContain(
      '– Fogline — no source folder on record, poster skipped'
    );
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
