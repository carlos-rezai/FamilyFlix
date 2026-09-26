// @vitest-environment node
//
// 23 — Enrichment, Phase 2: "the tracer — Just this movie" (issue #204).
//
// `createEnrichment` — the fifth server domain — starting a `single`-scope
// **Sync** over one **Movie**, the **Current enrichment run** held in memory
// and read through `current()`. Composed over a real in-memory SQLite library,
// a real `Media` over a sandbox media root, and a **fake TMDB client** whose
// image streams are fakes too: no test here goes online.
//
// The run, for one movie: a movie holding a `tmdb_id` is fetched by that id
// and never searched; any other is searched by title and year, and a
// **Confident** answer — exactly one candidate with an equal **Title key**
// and, when the title has a year, an equal year — is fetched, planned and
// written: its columns, its `tmdb_id`, and `poster.jpg` / `backdrop.jpg`
// streamed into its **Movie folder**, stored as relative paths. Then the run
// reaches review. The household's `rating`, `watched`, resume position and
// `last_watched_at` are never touched.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import type { EnrichField, EnrichmentRun } from '@/types';
import type { LibraryStorage } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type {
  TmdbClient,
  TmdbMovieDetail,
  TmdbMovieResult,
} from '../tmdbClient/tmdbClient';
import { createEnrichment } from './createEnrichment';

const KEY = '0123456789abcdef0123456789abcdef';

/** The ten chips, every one on — the setup's default. */
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

const RESULT: TmdbMovieResult = {
  id: 550123,
  title: 'The Lantern Keeper',
  original_title: 'Le Gardien du phare',
  release_date: '2019-06-14',
  genre_ids: [18, 878],
  original_language: 'fr',
  poster_path: '/lantern-poster.jpg',
  vote_average: 7.4,
};

const DETAIL: TmdbMovieDetail = {
  id: 550123,
  title: 'The Lantern Keeper',
  original_title: 'Le Gardien du phare',
  overview: 'A keeper tends a light nobody needs any more.',
  release_date: '2019-06-14',
  runtime: 112,
  genres: [
    { id: 18, name: 'Drama' },
    { id: 878, name: 'Science Fiction' },
    { id: 14, name: 'Fantasy' },
  ],
  vote_average: 7.456,
  poster_path: '/lantern-poster.jpg',
  backdrop_path: '/lantern-backdrop.jpg',
  credits: {
    cast: [
      { name: 'Ada Brennan', order: 0 },
      { name: 'Tomas Ekholm', order: 1 },
    ],
    crew: [
      { name: 'Ines Marlowe', job: 'Screenplay' },
      { name: 'Paul Verhoek', job: 'Director' },
    ],
  },
};

/** The bytes the fake image stream yields for a TMDB image path. */
const imageBytes = (path: string) => `image bytes of ${path}`;

/** A TMDB that knows one film, and answers every image with fake bytes. */
function fakeTmdb(results: TmdbMovieResult[] = [RESULT]) {
  return {
    authenticate: vi.fn<TmdbClient['authenticate']>(() =>
      Promise.resolve('accepted')
    ),
    searchMovie: vi.fn<TmdbClient['searchMovie']>(() =>
      Promise.resolve({ kind: 'ok', value: results })
    ),
    movie: vi.fn<TmdbClient['movie']>(() =>
      Promise.resolve({ kind: 'ok', value: DETAIL })
    ),
    image: vi.fn<TmdbClient['image']>((path: string) =>
      Promise.resolve({
        kind: 'ok',
        value: Readable.from([Buffer.from(imageBytes(path))]),
      })
    ),
  };
}

type FakeTmdb = ReturnType<typeof fakeTmdb>;

interface FilmOverrides {
  tmdbId?: number;
}

/** A library with a key, a sandbox media root, and the domain over both. */
function world(client: FakeTmdb = fakeTmdb()) {
  const storage = freshStorage();
  storage.setTmdbKey(KEY);
  const mediaRoot = sandboxRoot('familyflix-enrich-');
  const media = createMedia(mediaRoot);
  const enrichment = createEnrichment({
    storage,
    client: client as unknown as TmdbClient,
    media,
  });

  /** A movie in the library, its video really in its Movie folder. */
  async function addFilm(overrides: FilmOverrides = {}): Promise<string> {
    const folder = media.reserveFolder('The Lantern Keeper', 2019);
    const videoPath = await media.storeUpload(
      folder,
      'lantern.mp4',
      Readable.from([Buffer.from('video bytes')])
    );
    return storage.addMovie({
      title: 'The Lantern Keeper',
      year: 2019,
      videoPath,
      ...(overrides.tmdbId === undefined ? {} : { tmdbId: overrides.tmdbId }),
    }).id;
  }

  return { storage, mediaRoot, client, enrichment, addFilm };
}

type Enrichment = ReturnType<typeof world>['enrichment'];

/** Start a `single` Sync over `movieId`, with the chips given. */
function startSingle(
  enrichment: Enrichment,
  movieId: string,
  fields: EnrichField[] = ALL_FIELDS
) {
  return enrichment.start({
    scope: 'single',
    movieId,
    fields,
    writeSheet: false,
    writePosters: false,
  });
}

/** The Current enrichment run, once it has reached review. */
async function reviewed(enrichment: Enrichment): Promise<EnrichmentRun> {
  await vi.waitFor(() => {
    expect(enrichment.current()?.phase).toBe('review');
  });
  const run = enrichment.current();
  if (run === null) {
    throw new Error('no Current enrichment run');
  }
  return run;
}

/** The TMDB image paths the run asked the fake for. */
const imagesAskedFor = (client: FakeTmdb) =>
  client.image.mock.calls.map(([path]) => path);

describe('createEnrichment: starting a single-title Sync', () => {
  it('holds no run before one is started', () => {
    const { enrichment } = world();

    expect(enrichment.current()).toBeNull();
  });

  it('starts a run over the one movie, its total known up front', async () => {
    const { enrichment, addFilm } = world();
    const movieId = await addFilm();

    const outcome = await startSingle(enrichment, movieId);

    expect(outcome.kind).toBe('started');
    if (outcome.kind !== 'started') return;
    expect(outcome.run.scope).toBe('single');
    expect(outcome.run.total).toBe(1);
    expect(typeof outcome.run.id).toBe('string');
    expect(enrichment.current()?.id).toBe(outcome.run.id);
  });

  it('reaches review with the one title enriched and nothing to decide', async () => {
    const { enrichment, addFilm } = world();
    const movieId = await addFilm();

    await startSingle(enrichment, movieId);
    const run = await reviewed(enrichment);

    expect(run.done).toBe(1);
    expect(run.enriched).toBe(1);
    expect(run.decisions).toEqual([]);
  });
});

describe('createEnrichment: a Confident movie is written', () => {
  it('searches by the movie’s title and year under the stored key, then fetches the one it found', async () => {
    const { enrichment, client, addFilm } = world();
    const movieId = await addFilm();

    await startSingle(enrichment, movieId);
    await reviewed(enrichment);

    expect(client.searchMovie).toHaveBeenCalledTimes(1);
    expect(client.searchMovie.mock.calls[0]?.slice(0, 3)).toEqual([
      KEY,
      'The Lantern Keeper',
      2019,
    ]);
    expect(client.movie.mock.calls[0]?.slice(0, 2)).toEqual([KEY, 550123]);
  });

  it('writes its columns and its tmdb_id', async () => {
    const { enrichment, storage, addFilm } = world();
    const movieId = await addFilm();

    await startSingle(enrichment, movieId);
    await reviewed(enrichment);

    const movie = storage.getMovie(movieId);
    expect(movie).toMatchObject({
      tmdbId: 550123,
      synopsis: 'A keeper tends a light nobody needs any more.',
      runtimeMinutes: 112,
      year: 2019,
      director: 'Paul Verhoek',
      cast: ['Ada Brennan', 'Tomas Ekholm'],
      originalTitle: 'Le Gardien du phare',
      tmdbScore: 7.5,
    });
    expect(movie?.genres.map((genre) => genre.name)).toEqual([
      'Drama',
      'Sci-Fi',
    ]);
  });

  it('stores both images in its Movie folder, as relative paths', async () => {
    const { enrichment, storage, mediaRoot, addFilm } = world();
    const movieId = await addFilm();

    await startSingle(enrichment, movieId);
    await reviewed(enrichment);

    const movie = storage.getMovie(movieId);
    expect(movie?.posterPath).toBe('the-lantern-keeper-2019/poster.jpg');
    expect(movie?.backdropPath).toBe('the-lantern-keeper-2019/backdrop.jpg');
    const folder = join(mediaRoot, 'the-lantern-keeper-2019');
    expect(readFileSync(join(folder, 'poster.jpg'), 'utf8')).toBe(
      imageBytes('/lantern-poster.jpg')
    );
    expect(readFileSync(join(folder, 'backdrop.jpg'), 'utf8')).toBe(
      imageBytes('/lantern-backdrop.jpg')
    );
  });

  it('writes only the chips that are on', async () => {
    const { enrichment, storage, mediaRoot, client, addFilm } = world();
    const movieId = await addFilm();

    await startSingle(
      enrichment,
      movieId,
      ALL_FIELDS.filter((field) => field !== 'poster' && field !== 'cast')
    );
    await reviewed(enrichment);

    const movie = storage.getMovie(movieId);
    expect(movie?.synopsis).toBe(
      'A keeper tends a light nobody needs any more.'
    );
    expect(movie?.backdropPath).toBe('the-lantern-keeper-2019/backdrop.jpg');
    expect(movie?.posterPath).toBeNull();
    expect(movie?.cast).toEqual([]);
    expect(imagesAskedFor(client)).not.toContain('/lantern-poster.jpg');
    expect(
      existsSync(join(mediaRoot, 'the-lantern-keeper-2019', 'poster.jpg'))
    ).toBe(false);
  });
});

describe('createEnrichment: a movie holding a tmdb_id', () => {
  it('is fetched by that id with no search', async () => {
    const { enrichment, storage, client, addFilm } = world();
    const movieId = await addFilm({ tmdbId: 550123 });

    await startSingle(enrichment, movieId);
    await reviewed(enrichment);

    expect(client.searchMovie).not.toHaveBeenCalled();
    expect(client.movie.mock.calls[0]?.slice(0, 2)).toEqual([KEY, 550123]);
    expect(storage.getMovie(movieId)?.synopsis).toBe(
      'A keeper tends a light nobody needs any more.'
    );
  });
});

describe('createEnrichment: the household’s own signals', () => {
  /** The columns no Sync reads or writes, off the Movie. */
  function signals(storage: LibraryStorage, id: string) {
    const movie = storage.getMovie(id);
    return {
      rating: movie?.rating,
      watched: movie?.watched,
      resumePositionSeconds: movie?.resumePositionSeconds,
      lastWatchedAt: movie?.lastWatchedAt,
    };
  }

  it('leaves the rating and a resume position exactly as they were', async () => {
    const { enrichment, storage, addFilm } = world();
    const movieId = await addFilm();
    storage.setRating(movieId, 7);
    storage.setResumePosition(movieId, 1234);
    const before = signals(storage, movieId);

    await startSingle(enrichment, movieId);
    await reviewed(enrichment);

    expect(storage.getMovie(movieId)?.tmdbId).toBe(550123);
    expect(signals(storage, movieId)).toEqual(before);
  });

  it('leaves a watched film watched, its last watch as it was', async () => {
    const { enrichment, storage, addFilm } = world();
    const movieId = await addFilm();
    storage.markWatched(movieId);
    const before = signals(storage, movieId);

    await startSingle(enrichment, movieId);
    await reviewed(enrichment);

    expect(storage.getMovie(movieId)?.tmdbScore).toBe(7.5);
    expect(signals(storage, movieId)).toEqual(before);
  });
});
