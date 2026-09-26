// @vitest-environment node
//
// 23 — Enrichment, Phase 4: "ambiguous and missing Decisions" (issue #207).
//
// `createEnrichment` leaving a title it cannot settle alone to the review as
// a **Decision**, and the three ways one leaves it. Composed over a real
// in-memory SQLite library, a real `Media` over a sandbox media root, and a
// **fake TMDB client**: no test here goes online.
//
// - A search with more than one **Candidate**, or one that is not
//   **Confident**, is an `ambiguous` Decision carrying the top three by
//   **Match score**, its reason the count spelled out; a search with none is
//   `missing`, _Nothing on TMDB matched this title._ A yearless title needs
//   only its Title key to be Confident.
// - `search(id, query)` puts the new answer on the Decision: candidates in
//   the picker, or the box kept with _Nothing on TMDB matched “{query}”._
// - `pick(id, tmdbId)` writes the film as a Confident one would, counts it
//   into `enriched`, and takes the row off the list.
// - `dismiss(id)` — _Skip_ — takes the row off and writes nothing.

import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import type { Decision, EnrichField, EnrichmentRun } from '@/types';
import { createMedia } from '../../media/createMedia/createMedia';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type {
  TmdbClient,
  TmdbMovieDetail,
  TmdbMovieResult,
  TmdbOutcome,
} from '../tmdbClient/tmdbClient';
import { createEnrichment } from './createEnrichment';

const KEY = '0123456789abcdef0123456789abcdef';

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
  // Two releases share the title — one of them exact, which is not enough.
  'Harbor Lights': [
    result(101, 'Harbor Lights', 1963),
    result(102, 'Harbor Lights', 2019),
  ],
  // Five answers: 100, 85, 70, then two far below.
  'The Quiet Coast': [
    result(301, 'The Quiet Coast', 2004),
    result(302, 'Quiet Coast Road', 1990),
    result(303, 'The Quiet Coast', 2005),
    result(304, 'Quiet', 1971),
    result(305, 'The Quiet Coast', 1980),
  ],
  // One answer, its year off: not Confident.
  Driftwood: [result(401, 'Driftwood', 1999)],
  // One answer for a yearless title with an equal key: Confident.
  Lanternlight: [result(501, 'Lanternlight', 2011)],
  // Nothing at all.
  Sundial: [],
  // What a search from the review finds.
  'Sundial 2004': [result(601, 'Sundial', 2004), result(602, 'Sundials', 2006)],
  Sundal: [],
};

const DETAILS: TmdbMovieDetail[] = [
  detail(101, 'Harbor Lights', 1963),
  detail(102, 'Harbor Lights', 2019),
  detail(501, 'Lanternlight', 2011),
  detail(601, 'Sundial', 2004),
];

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
  const storage = freshStorage();
  storage.setTmdbKey(KEY);
  const media = createMedia(sandboxRoot('familyflix-enrich-decisions-'));
  const client = fakeTmdb();
  const enrichment = createEnrichment({
    storage,
    client: client as unknown as TmdbClient,
    media,
  });

  async function addFilm(title: string, year: number | null) {
    const folder = media.reserveFolder(title, year);
    const videoPath = await media.storeUpload(
      folder,
      'video.mp4',
      Readable.from([Buffer.from('video bytes')])
    );
    return storage.addMovie({ title, year, videoPath }).id;
  }

  return { storage, client, enrichment, addFilm };
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

function decisionFor(run: EnrichmentRun | null, title: string): Decision {
  const found = run?.decisions.find((each) => each.title === title);
  if (found === undefined) throw new Error(`no Decision for ${title}`);
  return found;
}

describe('createEnrichment: an ambiguous Decision', () => {
  it('is made by a search with several candidates, one of them exact', async () => {
    const { enrichment, storage, addFilm } = world();
    const id = await addFilm('Harbor Lights', 1963);

    const run = await syncEverything(enrichment);

    const decision = decisionFor(run, 'Harbor Lights');
    expect(decision.kind).toBe('ambiguous');
    expect(decision.reason).toBe(
      'Two releases share this title — pick the right one.'
    );
    expect(storage.getMovie(id)?.tmdbId).toBeNull();
    expect(run.enriched).toBe(0);
  });

  it('carries each candidate’s id, title, year, poster and % match', async () => {
    const { enrichment, addFilm } = world();
    await addFilm('Harbor Lights', 1963);

    const run = await syncEverything(enrichment);

    const decision = decisionFor(run, 'Harbor Lights');
    if (decision.kind !== 'ambiguous') throw new Error('not ambiguous');
    expect(decision.query).toBe('Harbor Lights');
    expect(decision.candidates).toEqual([
      expect.objectContaining({
        tmdbId: 101,
        title: 'Harbor Lights',
        year: 1963,
        language: 'en',
        posterUrl: 'https://image.tmdb.org/t/p/w185/poster-101.jpg',
        score: 100,
      }),
      expect.objectContaining({
        tmdbId: 102,
        title: 'Harbor Lights',
        year: 2019,
        posterUrl: 'https://image.tmdb.org/t/p/w185/poster-102.jpg',
        score: 70,
      }),
    ]);
  });

  it('carries at most three candidates, the best three by score', async () => {
    const { enrichment, addFilm } = world();
    await addFilm('The Quiet Coast', 2004);

    const run = await syncEverything(enrichment);

    const decision = decisionFor(run, 'The Quiet Coast');
    if (decision.kind !== 'ambiguous') throw new Error('not ambiguous');
    expect(decision.candidates.map((each) => each.tmdbId)).toEqual([
      301, 303, 305,
    ]);
  });

  it('is made by one candidate that is not Confident', async () => {
    const { enrichment, storage, addFilm } = world();
    const id = await addFilm('Driftwood', 2000);

    const run = await syncEverything(enrichment);

    const decision = decisionFor(run, 'Driftwood');
    expect(decision.kind).toBe('ambiguous');
    if (decision.kind !== 'ambiguous') return;
    expect(decision.candidates.map((each) => each.tmdbId)).toEqual([401]);
    expect(decision.candidates[0].score).toBe(85);
    expect(storage.getMovie(id)?.tmdbId).toBeNull();
  });

  it('is not made for a yearless title whose one candidate shares its key', async () => {
    const { enrichment, storage, addFilm } = world();
    const id = await addFilm('Lanternlight', null);

    const run = await syncEverything(enrichment);

    expect(run.decisions).toEqual([]);
    expect(storage.getMovie(id)?.tmdbId).toBe(501);
    expect(run.enriched).toBe(1);
  });
});

describe('createEnrichment: a missing Decision', () => {
  it('is made by a search with no candidate', async () => {
    const { enrichment, addFilm } = world();
    await addFilm('Sundial', null);

    const run = await syncEverything(enrichment);

    const decision = decisionFor(run, 'Sundial');
    expect(decision).toEqual(
      expect.objectContaining({
        kind: 'missing',
        title: 'Sundial',
        query: 'Sundial',
        reason: 'Nothing on TMDB matched this title.',
      })
    );
  });

  it('is counted in the sync-complete line', async () => {
    const { enrichment, addFilm } = world();
    await addFilm('Sundial', null);
    await addFilm('Harbor Lights', 1963);
    await addFilm('Lanternlight', null);

    const run = await syncEverything(enrichment);

    expect(run.log.map((line) => line.text)).toContain(
      '✓ Sync complete — 1 enriched, 2 need a decision.'
    );
  });
});

describe('createEnrichment: search', () => {
  it('answers candidates onto a missing Decision, as an ambiguous one', async () => {
    const { enrichment, addFilm } = world();
    await addFilm('Sundial', null);
    const { id } = decisionFor(await syncEverything(enrichment), 'Sundial');

    await enrichment.search(id, 'Sundial 2004');

    const decision = decisionFor(enrichment.current(), 'Sundial');
    expect(decision.kind).toBe('ambiguous');
    if (decision.kind !== 'ambiguous') return;
    expect(decision.query).toBe('Sundial 2004');
    expect(decision.candidates.map((each) => each.tmdbId)).toEqual([601, 602]);
  });

  it('asks TMDB for the query as typed', async () => {
    const { enrichment, client, addFilm } = world();
    await addFilm('Sundial', null);
    const { id } = decisionFor(await syncEverything(enrichment), 'Sundial');

    await enrichment.search(id, 'Sundial 2004');

    expect(client.searchMovie.mock.calls.map(([, title]) => title)).toContain(
      'Sundial 2004'
    );
  });

  it('keeps the box, with its line, when nothing matched', async () => {
    const { enrichment, addFilm } = world();
    await addFilm('Harbor Lights', 1963);
    const { id } = decisionFor(
      await syncEverything(enrichment),
      'Harbor Lights'
    );

    await enrichment.search(id, 'Sundal');

    const decision = decisionFor(enrichment.current(), 'Harbor Lights');
    expect(decision).toEqual(
      expect.objectContaining({
        kind: 'missing',
        query: 'Sundal',
        reason: 'Nothing on TMDB matched “Sundal”.',
      })
    );
  });

  it('keeps the row on the list and counts nothing', async () => {
    const { enrichment, addFilm } = world();
    await addFilm('Sundial', null);
    const { id } = decisionFor(await syncEverything(enrichment), 'Sundial');

    await enrichment.search(id, 'Sundial 2004');

    expect(enrichment.current()?.decisions).toHaveLength(1);
    expect(enrichment.current()?.enriched).toBe(0);
  });
});

describe('createEnrichment: pick', () => {
  it('writes the picked film as a Confident one would', async () => {
    const { enrichment, storage, addFilm } = world();
    const movieId = await addFilm('Harbor Lights', 1963);
    const { id } = decisionFor(
      await syncEverything(enrichment),
      'Harbor Lights'
    );

    await enrichment.pick(id, 102);

    const movie = storage.getMovie(movieId);
    expect(movie?.tmdbId).toBe(102);
    expect(movie?.synopsis).toBe('The 2019 Harbor Lights.');
    expect(movie?.director).toBe('Director of 102');
    expect(movie?.cast).toEqual(['Lead of 102']);
    expect(movie?.posterPath).toMatch(/poster\.jpg$/);
    expect(movie?.backdropPath).toMatch(/backdrop\.jpg$/);
  });

  it('never touches the rating or the watch columns', async () => {
    const { enrichment, storage, addFilm } = world();
    const movieId = await addFilm('Harbor Lights', 1963);
    storage.setRating(movieId, 9);
    storage.setResumePosition(movieId, 1234);
    const before = storage.getMovie(movieId);
    const { id } = decisionFor(
      await syncEverything(enrichment),
      'Harbor Lights'
    );

    await enrichment.pick(id, 101);

    const after = storage.getMovie(movieId);
    expect(after?.rating).toBe(before?.rating);
    expect(after?.watched).toBe(before?.watched);
    expect(after?.resumePositionSeconds).toBe(before?.resumePositionSeconds);
  });

  it('takes the row off the list and counts it as enriched', async () => {
    const { enrichment, addFilm } = world();
    await addFilm('Harbor Lights', 1963);
    await addFilm('Sundial', null);
    const { id } = decisionFor(
      await syncEverything(enrichment),
      'Harbor Lights'
    );

    await enrichment.pick(id, 101);

    const run = enrichment.current();
    expect(run?.decisions.map((each) => each.title)).toEqual(['Sundial']);
    expect(run?.enriched).toBe(1);
  });

  it('settles a missing Decision after a search found it', async () => {
    const { enrichment, storage, addFilm } = world();
    const movieId = await addFilm('Sundial', null);
    const { id } = decisionFor(await syncEverything(enrichment), 'Sundial');

    await enrichment.search(id, 'Sundial 2004');
    await enrichment.pick(id, 601);

    expect(storage.getMovie(movieId)?.tmdbId).toBe(601);
    expect(enrichment.current()?.decisions).toEqual([]);
    expect(enrichment.current()?.enriched).toBe(1);
  });
});

describe('createEnrichment: dismiss — Skip', () => {
  it('takes the row off the list and writes nothing', async () => {
    const { enrichment, storage, addFilm } = world();
    const movieId = await addFilm('Harbor Lights', 1963);
    const { id } = decisionFor(
      await syncEverything(enrichment),
      'Harbor Lights'
    );

    enrichment.dismiss(id);

    expect(enrichment.current()?.decisions).toEqual([]);
    expect(enrichment.current()?.enriched).toBe(0);
    expect(storage.getMovie(movieId)?.tmdbId).toBeNull();
  });
});
