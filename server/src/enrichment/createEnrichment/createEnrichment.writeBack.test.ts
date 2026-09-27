// @vitest-environment node
//
// 23 — Enrichment, Phase 8: "write back into the collection" (issue #211).
//
// A **Sync** with the two **Write targets** switched on, over a real SQLite
// library and a real **Library root** in a sandbox, with a fake TMDB client —
// the `createEnrichment` suites' precedent. The domain composes the real
// `writeBack` when it is given none, which is what these tests run through.
//
// - Before the first TMDB request the run checks the root and logs its
//   dry-run line; a root it cannot write to skips both targets and the Sync
//   runs into the library regardless.
// - With posters on, each written title's poster is added to its **Source
//   folder** as `poster.jpg` only when none is there; a title with no source
//   folder on record — or one whose folder is gone — logs _– Title — no source
//   folder on record, poster skipped_ and raises no **Decision**.
// - At review, with the sheet on, `familyflix-metadata.csv` — the **Export
//   file**, films A–Z — is added to the root only when none is there.
// - An existing file is left byte-identical and logged as left alone; nothing
//   else is ever written into the root; `EnrichmentRun.written` records what
//   landed.

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
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EnrichField, EnrichmentRun } from '@/types';
import { openDatabase } from '../../db';
import { readSheet } from '../../import-export/readSheet/readSheet';
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
  TmdbOutcome,
} from '../tmdbClient/tmdbClient';
import { createEnrichment } from './createEnrichment';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const KEY = '0123456789abcdef0123456789abcdef';
const SHEET = 'familyflix-metadata.csv';

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

/** Three films, each fetched by the `tmdb_id` it already carries: Confident. */
const FILMS = [
  { tmdbId: 501, title: 'Sundial', year: 2004 },
  { tmdbId: 502, title: 'Lanternlight', year: 2011 },
  { tmdbId: 503, title: 'Kettle Bay', year: 1998 },
] as const;

const DETAILS = FILMS.map((film) => detail(film.tmdbId, film.title, film.year));

const ok = <T>(value: T): Promise<TmdbOutcome<T>> =>
  Promise.resolve({ kind: 'ok', value });

/** The bytes TMDB answers for an image path. */
const imageBytes = (path: string) => `image bytes of ${path}`;

/**
 * A fake TMDB. `onLookup` is told before every request that looks a title up
 * or fetches an image — the reachability probe is not one.
 */
function fakeTmdb(onLookup: () => void) {
  return {
    authenticate: vi.fn<TmdbClient['authenticate']>(() =>
      Promise.resolve('accepted')
    ),
    searchMovie: vi.fn<TmdbClient['searchMovie']>(() => {
      onLookup();
      return ok([]);
    }),
    movie: vi.fn<TmdbClient['movie']>((_key, id) => {
      onLookup();
      const found = DETAILS.find((each) => each.id === id);
      return found ? ok(found) : Promise.resolve({ kind: 'unreachable' });
    }),
    image: vi.fn<TmdbClient['image']>((path: string) => {
      onLookup();
      return ok(Readable.from([Buffer.from(imageBytes(path))]));
    }),
    reachable: vi.fn<TmdbClient['reachable']>(() => Promise.resolve(true)),
  };
}

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

function world() {
  const dir = sandboxRoot('familyflix-enrich-writeback-');
  const dbPath = join(dir, 'familyflix.db');
  const storage = track(createSqliteStorage(dbPath));
  const db = track(openDatabase(dbPath));
  storage.setTmdbKey(KEY);
  const media = createMedia(join(dir, 'media'));

  /** The Library root: a Source folder per film, each holding its video. */
  const root = join(dir, 'collection');
  mkdirSync(root);
  for (const film of FILMS) {
    const folder = join(root, `${film.title} (${film.year})`);
    mkdirSync(folder);
    writeFileSync(join(folder, `${film.title}.mkv`), 'source video bytes');
  }

  /** The run's log as it stood when TMDB was first asked for anything. */
  let logAtFirstLookup: string[] | null = null;
  const client = fakeTmdb(() => {
    if (logAtFirstLookup !== null) return;
    logAtFirstLookup = (enrichment.current()?.log ?? []).map(
      (line) => line.text
    );
  });

  const enrichment = createEnrichment({
    storage,
    client: client as unknown as TmdbClient,
    media,
  });

  /** A film in the library, its video really stored, its source folder recorded. */
  async function addFilm(
    film: (typeof FILMS)[number],
    sourceFolder: string | null = `${film.title} (${film.year})`
  ): Promise<string> {
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
    if (sourceFolder !== null) {
      db.prepare('UPDATE movies SET source_folder = ? WHERE id = ?').run(
        sourceFolder,
        id
      );
    }
    return id;
  }

  return {
    storage,
    enrichment,
    root,
    addFilm,
    logAtFirstLookup: () => logAtFirstLookup,
  };
}

type Enrichment = ReturnType<typeof world>['enrichment'];

async function sync(
  enrichment: Enrichment,
  targets: { writeSheet: boolean; writePosters: boolean }
): Promise<EnrichmentRun> {
  const started = await enrichment.start({
    scope: 'all',
    fields: ALL_FIELDS,
    ...targets,
  });
  expect(started).toMatchObject({ kind: 'started' });
  await vi.waitFor(() => {
    expect(enrichment.current()?.phase).toBe('review');
  });
  const run = enrichment.current();
  if (run === null) throw new Error('no Current enrichment run');
  return run;
}

const BOTH = { writeSheet: true, writePosters: true };
const texts = (run: EnrichmentRun) => run.log.map((line) => line.text);

describe('createEnrichment: the permission check comes first', () => {
  it('logs that it will write the sheet before any TMDB request', async () => {
    const { storage, enrichment, root, addFilm, logAtFirstLookup } = world();
    storage.setLibraryRoot(root);
    await addFilm(FILMS[0]);

    await sync(enrichment, BOTH);

    expect(logAtFirstLookup()).toContain(`Will write ${SHEET} to ${root}`);
  });

  it('warns before any TMDB request that an unwritable root will be skipped', async () => {
    const { storage, enrichment, root, addFilm, logAtFirstLookup } = world();
    const gone = join(root, 'not-there');
    storage.setLibraryRoot(gone);
    await addFilm(FILMS[0]);

    await sync(enrichment, BOTH);

    expect(logAtFirstLookup()).toContain(
      `Can't write to ${gone} — the sheet and posters will be skipped`
    );
  });

  it('runs into the library all the same when the root cannot be written', async () => {
    const { storage, enrichment, root, addFilm } = world();
    storage.setLibraryRoot(join(root, 'not-there'));
    const id = await addFilm(FILMS[0]);

    const run = await sync(enrichment, BOTH);

    expect(run.enriched).toBe(1);
    expect(storage.getMovie(id)?.synopsis).toBe('The 2004 Sundial.');
  });

  it('skips both targets when the root cannot be written', async () => {
    const { storage, enrichment, root, addFilm } = world();
    const before = filesUnder(root);
    const gone = join(root, 'not-there');
    storage.setLibraryRoot(gone);
    await addFilm(FILMS[0]);

    const run = await sync(enrichment, BOTH);

    expect(run.written).toEqual({ sheet: false, posters: false });
    expect(existsSync(gone)).toBe(false);
    expect(filesUnder(root)).toEqual(before);
  });
});

describe('createEnrichment: poster.jpg into each Source folder', () => {
  it('adds the fetched poster as poster.jpg in the title’s Source folder', async () => {
    const { storage, enrichment, root, addFilm } = world();
    storage.setLibraryRoot(root);
    await addFilm(FILMS[1]);

    const run = await sync(enrichment, BOTH);

    expect(
      readFileSync(join(root, 'Lanternlight (2011)', 'poster.jpg'), 'utf8')
    ).toBe(imageBytes('/poster-502.jpg'));
    expect(run.written.posters).toBe(true);
  });

  it('leaves an existing poster.jpg byte-identical, with its log line', async () => {
    const { storage, enrichment, root, addFilm } = world();
    storage.setLibraryRoot(root);
    const ours = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 7, 7, 7]);
    const poster = join(root, 'Lanternlight (2011)', 'poster.jpg');
    writeFileSync(poster, ours);
    await addFilm(FILMS[1]);

    const run = await sync(enrichment, BOTH);

    expect(readFileSync(poster).equals(ours)).toBe(true);
    expect(
      texts(run).some((text) => text.includes('poster.jpg exists, left alone'))
    ).toBe(true);
    expect(run.written.posters).toBe(false);
  });

  it('logs a title with no source folder on record and raises no Decision', async () => {
    const { storage, enrichment, root, addFilm } = world();
    storage.setLibraryRoot(root);
    const id = await addFilm(FILMS[0], null);

    const run = await sync(enrichment, BOTH);

    expect(texts(run)).toContain(
      '– Sundial — no source folder on record, poster skipped'
    );
    expect(run.decisions).toEqual([]);
    expect(storage.getMovie(id)?.synopsis).toBe('The 2004 Sundial.');
  });

  it('treats a source folder that is gone as none on record, and does not make it', async () => {
    const { storage, enrichment, root, addFilm } = world();
    storage.setLibraryRoot(root);
    await addFilm(FILMS[0], 'Moved Away (2004)');

    const run = await sync(enrichment, BOTH);

    expect(texts(run)).toContain(
      '– Sundial — no source folder on record, poster skipped'
    );
    expect(run.decisions).toEqual([]);
    expect(existsSync(join(root, 'Moved Away (2004)'))).toBe(false);
  });

  it('writes no poster.jpg with posters switched off', async () => {
    const { storage, enrichment, root, addFilm } = world();
    storage.setLibraryRoot(root);
    await addFilm(FILMS[1]);

    const run = await sync(enrichment, {
      writeSheet: true,
      writePosters: false,
    });

    expect(existsSync(join(root, 'Lanternlight (2011)', 'poster.jpg'))).toBe(
      false
    );
    expect(run.written.posters).toBe(false);
  });
});

describe('createEnrichment: the Metadata sheet in the root', () => {
  it('adds familyflix-metadata.csv at review, the films A–Z', async () => {
    const { storage, enrichment, root, addFilm } = world();
    storage.setLibraryRoot(root);
    for (const film of FILMS) await addFilm(film);

    const run = await sync(enrichment, BOTH);

    expect(run.written.sheet).toBe(true);
    const rows = await readSheet(readFileSync(join(root, SHEET)), SHEET);
    expect(rows.map((row) => row.title)).toEqual([
      'Kettle Bay',
      'Lanternlight',
      'Sundial',
    ]);
  });

  it('reads back through Bulk import carrying what the Sync fetched', async () => {
    const { storage, enrichment, root, addFilm } = world();
    storage.setLibraryRoot(root);
    await addFilm(FILMS[1]);

    await sync(enrichment, BOTH);

    const [row] = await readSheet(readFileSync(join(root, SHEET)), SHEET);
    expect(row).toMatchObject({
      title: 'Lanternlight',
      year: 2011,
      genres: ['Drama'],
      director: 'Director of 502',
      cast: ['Lead of 502'],
    });
  });

  it('leaves an existing sheet byte-identical, with its log line', async () => {
    const { storage, enrichment, root, addFilm } = world();
    storage.setLibraryRoot(root);
    const ours = Buffer.from('Title,Year\nOur own list,1999\n');
    writeFileSync(join(root, SHEET), ours);
    await addFilm(FILMS[1]);

    const run = await sync(enrichment, BOTH);

    expect(readFileSync(join(root, SHEET)).equals(ours)).toBe(true);
    expect(
      texts(run).some((text) => text.includes(`${SHEET} exists, left alone`))
    ).toBe(true);
    expect(run.written.sheet).toBe(false);
  });

  it('writes no sheet with the sheet switched off', async () => {
    const { storage, enrichment, root, addFilm } = world();
    storage.setLibraryRoot(root);
    await addFilm(FILMS[1]);

    const run = await sync(enrichment, {
      writeSheet: false,
      writePosters: true,
    });

    expect(existsSync(join(root, SHEET))).toBe(false);
    expect(run.written.sheet).toBe(false);
  });
});

describe('createEnrichment: nothing else is ever written into the root', () => {
  it('adds the sheet and one poster.jpg per Source folder, and nothing more', async () => {
    const { storage, enrichment, root, addFilm } = world();
    storage.setLibraryRoot(root);
    const before = filesUnder(root);
    for (const film of FILMS) await addFilm(film);

    const run = await sync(enrichment, BOTH);

    expect(run.written).toEqual({ sheet: true, posters: true });
    expect(filesUnder(root)).toEqual(
      [
        ...before,
        SHEET,
        ...FILMS.map((film) =>
          join(`${film.title} (${film.year})`, 'poster.jpg')
        ),
      ].sort()
    );
  });
});
