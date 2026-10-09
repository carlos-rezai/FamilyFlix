// @vitest-environment node
//
// 23 — Enrichment, Phase 3: "the whole library" (issue #205).
//
// `createEnrichment` running a library-wide **Sync**: the `missing` scope
// (_Only what's missing_ — every film without **Full details**, a synopsis
// and a poster) and the `all` scope (_Everything_). Composed over a real
// in-memory SQLite library, a real `Media` over a sandbox media root, and a
// **fake TMDB client**: no test here goes online.
//
// - The run snapshots its titles, so `total` is known in the start's own
//   answer, and works one title at a time, writing the prototype's log lines.
// - _Only what's missing_ fills empty fields and never questions a filled one.
// - A chip switched off means that column is never written.
// - `cancel()` aborts the request in flight and drops the run; every row
//   already written stays.
// - A dropped connection, or a `401`, ends the run into review with its line.
// - A second start while one runs is refused as busy.
// - Reaching review stamps `enrichment-last-synced-at`.

import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import {
  ENRICH_FIELDS,
  type EnrichField,
  type EnrichmentRun,
  type EnrichScope,
} from '@/types';
import { createMedia } from '../../media/createMedia/createMedia';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  fakeTmdb,
  reviewed,
  TMDB_KEY as KEY,
  tmdbMovieDetail,
  tmdbMovieResult,
  type FakeTmdb,
} from '../../test-support/fakeTmdb/fakeTmdb';
import type {
  TmdbMovieDetail,
  TmdbMovieResult,
} from '../tmdbClient/tmdbClient';
import { createEnrichment } from './createEnrichment';

const ALL_FIELDS: EnrichField[] = [...ENRICH_FIELDS];

const LOST_LINE =
  'Lost the connection — stopped. Anything already fetched is kept.';
const REFUSED_LINE = 'TMDB refused the key.';

interface Film {
  title: string;
  year: number;
  result: TmdbMovieResult;
  detail: TmdbMovieDetail;
}

function film(id: number, title: string, year: number, overview: string): Film {
  const slug = title.toLowerCase().replace(/\s+/g, '-');
  const poster = `/${slug}-poster.jpg`;
  return {
    title,
    year,
    result: tmdbMovieResult(id, title, year, {
      poster_path: poster,
      vote_average: 7.4,
    }),
    detail: tmdbMovieDetail(id, title, year, {
      overview,
      runtime: 101,
      vote_average: 7.4,
      poster_path: poster,
      backdrop_path: `/${slug}-backdrop.jpg`,
      credits: {
        cast: [{ name: 'Ada Brennan', order: 0 }],
        crew: [{ name: 'Paul Verhoek', job: 'Director' }],
      },
    }),
  };
}

const LANTERN = film(
  550123,
  'The Lantern Keeper',
  2019,
  'A keeper tends a light nobody needs any more.'
);
const HARBOR = film(
  660001,
  'Harbor Lights',
  1963,
  'A harbour town waits for a ship that never comes.'
);
const FILMS = [LANTERN, HARBOR];

/** A TMDB that knows both films, and answers every image with fake bytes. */
function knowsBoth(): FakeTmdb {
  return fakeTmdb({
    searches: Object.fromEntries(FILMS.map((f) => [f.title, [f.result]])),
    movies: FILMS.map((f) => f.detail),
  });
}

interface FilmValues {
  synopsis?: string;
  posterPath?: string;
}

/** A library with a key, a sandbox media root, and the domain over both. */
function world(client: FakeTmdb = knowsBoth()) {
  const storage = freshStorage();
  storage.setTmdbKey(KEY);
  const media = createMedia(sandboxRoot('familyflix-enrich-library-'));
  const enrichment = createEnrichment({
    storage,
    client,
    media,
  });

  /** A film in the library, its video really in its Movie folder. */
  async function addFilm(which: Film, values: FilmValues = {}) {
    const folder = media.reserveFolder(which.title, which.year);
    const videoPath = await media.storeUpload(
      folder,
      'video.mp4',
      Readable.from([Buffer.from('video bytes')])
    );
    return storage.addMovie({
      title: which.title,
      year: which.year,
      videoPath,
      ...values,
    }).id;
  }

  return { storage, client, enrichment, addFilm };
}

type Enrichment = ReturnType<typeof world>['enrichment'];

function startSync(
  enrichment: Enrichment,
  scope: Exclude<EnrichScope, 'single'>,
  fields: EnrichField[] = ALL_FIELDS
) {
  return enrichment.start({
    scope,
    fields,
    writeSheet: false,
    writePosters: false,
  });
}

const lines = (run: EnrichmentRun) => run.log.map((line) => line.text);

const searchedTitles = (client: FakeTmdb) =>
  client.searchMovie.mock.calls.map(([, title]) => title).sort();

describe('createEnrichment: Only what’s missing', () => {
  it('covers the films with no synopsis or no poster, and no other', async () => {
    const { enrichment, client, addFilm } = world();
    await addFilm(LANTERN);
    await addFilm(HARBOR, {
      synopsis: 'Our own words.',
      posterPath: 'harbor-lights-1963/poster.jpg',
    });

    const outcome = await startSync(enrichment, 'missing');
    await reviewed(enrichment);

    expect(outcome.kind).toBe('started');
    if (outcome.kind !== 'started') return;
    expect(outcome.run.scope).toBe('missing');
    expect(outcome.run.total).toBe(1);
    expect(searchedTitles(client)).toEqual(['The Lantern Keeper']);
  });

  it('covers a film with a synopsis but no poster', async () => {
    const { enrichment, client, addFilm } = world();
    await addFilm(HARBOR, { synopsis: 'Our own words.' });

    const outcome = await startSync(enrichment, 'missing');
    await reviewed(enrichment);

    expect(outcome.kind === 'started' && outcome.run.total).toBe(1);
    expect(searchedTitles(client)).toEqual(['Harbor Lights']);
  });

  it('fills the empty fields and never questions a filled one', async () => {
    const { enrichment, storage, addFilm } = world();
    const id = await addFilm(HARBOR, { synopsis: 'Our own words.' });

    await startSync(enrichment, 'missing');
    const run = await reviewed(enrichment);

    const movie = storage.getMovie(id);
    expect(movie?.synopsis).toBe('Our own words.');
    expect(movie?.posterPath).toBe('harbor-lights-1963/poster.jpg');
    expect(movie?.director).toBe('Paul Verhoek');
    expect(run.decisions).toEqual([]);
    expect(run.enriched).toBe(1);
  });
});

describe('createEnrichment: Everything', () => {
  it('covers every film, complete or not', async () => {
    const { enrichment, client, addFilm } = world();
    await addFilm(LANTERN);
    await addFilm(HARBOR, {
      synopsis: 'Our own words.',
      posterPath: 'harbor-lights-1963/poster.jpg',
    });

    const outcome = await startSync(enrichment, 'all');
    const run = await reviewed(enrichment);

    expect(outcome.kind === 'started' && outcome.run.total).toBe(2);
    expect(run.done).toBe(2);
    expect(searchedTitles(client)).toEqual([
      'Harbor Lights',
      'The Lantern Keeper',
    ]);
  });

  it('writes every film it matched', async () => {
    const { enrichment, storage, addFilm } = world();
    const lantern = await addFilm(LANTERN);
    const harbor = await addFilm(HARBOR);

    await startSync(enrichment, 'all');
    const run = await reviewed(enrichment);

    expect(run.enriched).toBe(2);
    expect(storage.getMovie(lantern)?.tmdbId).toBe(550123);
    expect(storage.getMovie(harbor)?.tmdbId).toBe(660001);
  });
});

describe('createEnrichment: a chip off', () => {
  it('is never written, on any film in the run', async () => {
    const { enrichment, storage, client, addFilm } = world();
    const lantern = await addFilm(LANTERN);
    const harbor = await addFilm(HARBOR);

    await startSync(
      enrichment,
      'all',
      ALL_FIELDS.filter((field) => field !== 'synopsis' && field !== 'poster')
    );
    await reviewed(enrichment);

    for (const id of [lantern, harbor]) {
      const movie = storage.getMovie(id);
      expect(movie?.synopsis).toBeNull();
      expect(movie?.posterPath).toBeNull();
      expect(movie?.director).toBe('Paul Verhoek');
    }
    const images = client.image.mock.calls.map(([path]) => path);
    expect(images.some((path) => path.endsWith('-poster.jpg'))).toBe(false);
  });

  it('is never written in Only what’s missing either', async () => {
    const { enrichment, storage, addFilm } = world();
    const id = await addFilm(LANTERN);

    await startSync(
      enrichment,
      'missing',
      ALL_FIELDS.filter((field) => field !== 'cast')
    );
    await reviewed(enrichment);

    expect(storage.getMovie(id)?.cast).toEqual([]);
    expect(storage.getMovie(id)?.synopsis).toBe(LANTERN.detail.overview);
  });
});

describe('createEnrichment: the log', () => {
  it('opens with the prototype’s two lines, before any request', async () => {
    const { enrichment, addFilm } = world();
    await addFilm(LANTERN);
    await addFilm(HARBOR);

    const outcome = await startSync(enrichment, 'all');

    expect(outcome.kind).toBe('started');
    if (outcome.kind !== 'started') return;
    expect(lines(outcome.run).slice(0, 2)).toEqual([
      'Contacting api.themoviedb.org …',
      'Looking up 2 titles by name and year.',
    ]);
  });

  it('writes a Matched line naming each film and its year', async () => {
    const { enrichment, addFilm } = world();
    await addFilm(LANTERN);
    await addFilm(HARBOR);

    await startSync(enrichment, 'all');
    const run = await reviewed(enrichment);

    const text = lines(run);
    expect(
      text.some((line) =>
        /^✓ Matched\s+The Lantern Keeper \(2019\)$/.test(line)
      )
    ).toBe(true);
    expect(
      text.some((line) => /^✓ Matched\s+Harbor Lights \(1963\)$/.test(line))
    ).toBe(true);
  });

  it('ends with the sync-complete line', async () => {
    const { enrichment, addFilm } = world();
    await addFilm(LANTERN);
    await addFilm(HARBOR);

    await startSync(enrichment, 'all');
    const run = await reviewed(enrichment);

    expect(lines(run).at(-1)).toBe(
      '✓ Sync complete — 2 enriched, 0 need a decision.'
    );
  });
});

describe('createEnrichment: one title at a time', () => {
  it('does not ask about the next film while one is in flight', async () => {
    const client = knowsBoth();
    client.hold('movie');
    const { enrichment, addFilm } = world(client);
    await addFilm(LANTERN);
    await addFilm(HARBOR);

    await startSync(enrichment, 'all');
    await vi.waitFor(() => {
      expect(client.movie).toHaveBeenCalledTimes(1);
    });

    expect(client.searchMovie).toHaveBeenCalledTimes(1);
    expect(enrichment.current()?.done).toBe(0);
  });
});

describe('createEnrichment: cancel — Stop', () => {
  /** A run over both films, the second film's detail request held. */
  async function heldOnSecond() {
    const client = knowsBoth();
    const second = client.hold('movie', 2);
    const w = world(client);
    const ids = [await w.addFilm(LANTERN), await w.addFilm(HARBOR)];
    await startSync(w.enrichment, 'all');
    await vi.waitFor(() => {
      expect(client.movie).toHaveBeenCalledTimes(2);
    });
    return { ...w, ids, second };
  }

  it('drops the run', async () => {
    const { enrichment } = await heldOnSecond();

    enrichment.cancel();

    expect(enrichment.current()).toBeNull();
  });

  it('keeps every row already written', async () => {
    const { enrichment, storage, ids } = await heldOnSecond();

    enrichment.cancel();

    const written = ids.filter((id) => storage.getMovie(id)?.tmdbId !== null);
    expect(written).toHaveLength(1);
  });

  it('aborts the request in flight', async () => {
    const { enrichment, client } = await heldOnSecond();

    enrichment.cancel();

    const signal = client.movie.mock.calls[1]?.[2];
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(true);
  });

  it('writes nothing more when the held request answers after all', async () => {
    const { enrichment, storage, ids, second } = await heldOnSecond();
    const before = ids.map((id) => storage.getMovie(id)?.tmdbId ?? null);

    enrichment.cancel();
    second.release({
      kind: 'ok',
      value:
        FILMS.find((f) => !before.includes(f.detail.id))?.detail ??
        HARBOR.detail,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(ids.map((id) => storage.getMovie(id)?.tmdbId ?? null)).toEqual(
      before
    );
    expect(enrichment.current()).toBeNull();
  });

  it('leaves the way clear for a new start', async () => {
    const { enrichment } = await heldOnSecond();

    enrichment.cancel();
    const outcome = await startSync(enrichment, 'all');

    expect(outcome.kind).toBe('started');
  });

  it('is harmless with no run held', () => {
    const { enrichment } = world();

    expect(() => enrichment.cancel()).not.toThrow();
    expect(enrichment.current()).toBeNull();
  });
});

describe('createEnrichment: the run ending early, into review', () => {
  /** The second search answers `outcome`; the first answers as TMDB would. */
  function failingSecondSearch(outcome: 'unreachable' | 'refused') {
    const client = knowsBoth();
    client.fail('searchMovie', 2, outcome);
    return client;
  }

  it('ends a lost connection into review, with its line', async () => {
    const { enrichment, addFilm } = world(failingSecondSearch('unreachable'));
    await addFilm(LANTERN);
    await addFilm(HARBOR);

    await startSync(enrichment, 'all');
    const run = await reviewed(enrichment);

    expect(lines(run)).toContain(LOST_LINE);
  });

  it('keeps what was fetched before the connection went', async () => {
    const { enrichment, storage, addFilm } = world(
      failingSecondSearch('unreachable')
    );
    const ids = [await addFilm(LANTERN), await addFilm(HARBOR)];

    await startSync(enrichment, 'all');
    const run = await reviewed(enrichment);

    expect(run.enriched).toBe(1);
    const written = ids.filter((id) => storage.getMovie(id)?.tmdbId !== null);
    expect(written).toHaveLength(1);
  });

  it('ends a refused key into review, with its line', async () => {
    const { enrichment, storage, addFilm } = world(
      failingSecondSearch('refused')
    );
    const ids = [await addFilm(LANTERN), await addFilm(HARBOR)];

    await startSync(enrichment, 'all');
    const run = await reviewed(enrichment);

    expect(lines(run)).toContain(REFUSED_LINE);
    expect(lines(run)).not.toContain(LOST_LINE);
    const written = ids.filter((id) => storage.getMovie(id)?.tmdbId !== null);
    expect(written).toHaveLength(1);
  });
});

describe('createEnrichment: a second start while one runs', () => {
  it('is refused as busy, the first run untouched', async () => {
    const client = knowsBoth();
    client.hold('searchMovie');
    const { enrichment, addFilm } = world(client);
    await addFilm(LANTERN);

    const started = await startSync(enrichment, 'all');
    const again = await startSync(enrichment, 'missing');

    expect(again.kind).toBe('busy');
    expect(started.kind === 'started' && enrichment.current()?.id).toBe(
      started.kind === 'started' ? started.run.id : undefined
    );
    expect(enrichment.current()?.scope).toBe('all');
  });
});

describe('createEnrichment: reaching review', () => {
  it('stamps enrichment-last-synced-at as an ISO string', async () => {
    const { enrichment, storage, addFilm } = world();
    await addFilm(LANTERN);
    const before = Date.now();

    await startSync(enrichment, 'all');
    await reviewed(enrichment);

    const stamp = storage.enrichmentLastSyncedAt();
    expect(stamp).not.toBeNull();
    expect(new Date(stamp ?? '').toISOString()).toBe(stamp);
    expect(Date.parse(stamp ?? '')).toBeGreaterThanOrEqual(before);
    expect(Date.parse(stamp ?? '')).toBeLessThanOrEqual(Date.now());
  });

  it('stamps nothing while the run is still going', async () => {
    const client = knowsBoth();
    client.hold('searchMovie');
    const { enrichment, storage, addFilm } = world(client);
    await addFilm(LANTERN);

    await startSync(enrichment, 'all');

    expect(storage.enrichmentLastSyncedAt()).toBeNull();
  });
});

// 33 — Single-title Sync (issue #286): a library run belongs to no one film,
// so neither its snapshot nor a read of it carries a `movieId`.
describe('createEnrichment: a library run records no film', () => {
  it.each(['missing', 'all'] as const)(
    'carries no movieId on a %s run, started or read',
    async (scope) => {
      const { enrichment, addFilm } = world();
      await addFilm(LANTERN);

      const outcome = await startSync(enrichment, scope);

      expect(outcome.kind).toBe('started');
      if (outcome.kind !== 'started') return;
      expect('movieId' in outcome.run).toBe(false);
      expect(enrichment.current()).not.toHaveProperty('movieId');
      const run = await reviewed(enrichment);
      expect(run).not.toHaveProperty('movieId');
    }
  );
});
