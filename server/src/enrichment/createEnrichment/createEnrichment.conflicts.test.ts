// @vitest-environment node
//
// 23 — Enrichment, Phase 5: "conflict Decisions" (issue #208).
//
// `createEnrichment` leaving a title TMDB disagrees with to the review as a
// `conflict` **Decision**, and the two ways one leaves it. Composed over a
// real in-memory SQLite library, a real `Media` over a sandbox media root,
// and a **fake TMDB client**: no test here goes online.
//
// - Outside _Only what's missing_, a filled Synopsis, Year, Genres, Director
//   or Cast that TMDB answers differently is a **Field conflict**; the title
//   waits as a `conflict` Decision carrying them, and its empty fields are
//   written during the run all the same.
// - _Only what's missing_ never produces a conflict.
// - `apply(id, choices)` — _Apply choices_ — writes the side chosen for each
//   field, counts the title into `enriched`, and takes the row off.
// - _Keep all mine_ is **Dismiss**: nothing on the title changes, the row goes.

import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import {
  ENRICH_FIELDS,
  type Decision,
  type EnrichField,
  type EnrichScope,
  type EnrichmentRun,
  type FieldConflict,
} from '@/types';
import { createMedia } from '../../media/createMedia/createMedia';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  fakeTmdb,
  reviewed,
  TMDB_KEY as KEY,
} from '../../test-support/fakeTmdb/fakeTmdb';
import type { TmdbMovieDetail } from '../tmdbClient/tmdbClient';
import { createEnrichment } from './createEnrichment';

const ALL_FIELDS: EnrichField[] = [...ENRICH_FIELDS];

const OURS = 'A lighthouse keeper on a fading coast takes in a runaway girl…';
const THEIRS =
  'On a storm-battered coast, a solitary lighthouse keeper shelters a runaway and finds a family in the wreckage of winter.';

/** TMDB's _The Lantern Keeper_: a year, a director and a synopsis of its own. */
const LANTERN: TmdbMovieDetail = {
  id: 201,
  title: 'The Lantern Keeper',
  original_title: 'Le Gardien du phare',
  overview: THEIRS,
  release_date: '2018-10-02',
  runtime: 104,
  genres: [{ id: 18, name: 'Drama' }],
  vote_average: 7.46,
  poster_path: '/lantern-poster.jpg',
  backdrop_path: '/lantern-backdrop.jpg',
  credits: {
    cast: [
      { name: 'Mara Quill', order: 0 },
      { name: 'Tobias Lund', order: 1 },
    ],
    crew: [{ name: 'Eleanor Past-Whitlock', job: 'Director' }],
  },
};

/** TMDB's _Harbor Lights_: what the family filled, but spelled otherwise. */
const HARBOR: TmdbMovieDetail = {
  id: 301,
  title: 'Harbor Lights',
  original_title: 'Harbor Lights',
  overview: 'A town waits for a ship.',
  release_date: '1963-06-14',
  runtime: 92,
  genres: [
    { id: 18, name: 'Drama' },
    { id: 10749, name: 'Romance' },
  ],
  vote_average: 6.9,
  poster_path: '/harbor-poster.jpg',
  backdrop_path: null,
  credits: {
    cast: [
      { name: 'June Hale', order: 0 },
      { name: 'Oren Vey', order: 1 },
    ],
    crew: [{ name: 'Wim Oster', job: 'Director' }],
  },
};

function world() {
  const storage = freshStorage();
  storage.setTmdbKey(KEY);
  const media = createMedia(sandboxRoot('familyflix-enrich-conflicts-'));
  const client = fakeTmdb({ movies: [LANTERN, HARBOR] });
  const enrichment = createEnrichment({
    storage,
    client,
    media,
  });

  async function storedVideo(title: string, year: number) {
    const folder = media.reserveFolder(title, year);
    return media.storeUpload(
      folder,
      'video.mp4',
      Readable.from([Buffer.from('video bytes')])
    );
  }

  /**
   * _The Lantern Keeper_ as the family filled it: our year, director and
   * synopsis, a genre TMDB agrees with — and no cast, poster or runtime.
   */
  async function addLantern() {
    return storage.addMovie({
      title: 'The Lantern Keeper',
      year: 2019,
      tmdbId: 201,
      synopsis: OURS,
      director: 'Eleanor Past',
      genres: ['Drama'],
      videoPath: await storedVideo('The Lantern Keeper', 2019),
    }).id;
  }

  /** _Harbor Lights_ filled as TMDB has it, bar case, spacing and order. */
  async function addHarbor() {
    return storage.addMovie({
      title: 'Harbor Lights',
      year: 1963,
      tmdbId: 301,
      synopsis: '  a town WAITS for a ship. ',
      director: 'wim oster',
      genres: ['Romance', 'Drama'],
      cast: ['oren vey', 'June Hale '],
      videoPath: await storedVideo('Harbor Lights', 1963),
    }).id;
  }

  return { storage, client, enrichment, addLantern, addHarbor };
}

type Enrichment = ReturnType<typeof world>['enrichment'];

async function sync(
  enrichment: Enrichment,
  scope: EnrichScope = 'all'
): Promise<EnrichmentRun> {
  await enrichment.start({
    scope,
    fields: ALL_FIELDS,
    writeSheet: false,
    writePosters: false,
  });
  return reviewed(enrichment);
}

function conflictFor(
  run: EnrichmentRun | null,
  title: string
): Decision & { kind: 'conflict' } {
  const found = run?.decisions.find((each) => each.title === title);
  if (found === undefined) throw new Error(`no Decision for ${title}`);
  if (found.kind !== 'conflict') throw new Error(`${title} is ${found.kind}`);
  return found;
}

const byField = (fields: FieldConflict[]) =>
  [...fields].sort((a, b) => a.field.localeCompare(b.field));

describe('createEnrichment: a conflict Decision', () => {
  it('is made by filled fields TMDB answers differently', async () => {
    const { enrichment, addLantern } = world();
    await addLantern();

    const run = await sync(enrichment);

    const decision = conflictFor(run, 'The Lantern Keeper');
    expect(decision.reason).toBe(
      'TMDB has different values for fields you already filled in.'
    );
    expect(byField(decision.fields)).toEqual([
      {
        field: 'director',
        label: 'Director',
        mine: 'Eleanor Past',
        tmdb: 'Eleanor Past-Whitlock',
      },
      { field: 'synopsis', label: 'Synopsis', mine: OURS, tmdb: THEIRS },
      { field: 'year', label: 'Year', mine: '2019', tmdb: '2018' },
    ]);
  });

  it('counts under need a decision, not under enriched', async () => {
    const { enrichment, addLantern } = world();
    await addLantern();

    const run = await sync(enrichment);

    expect(run.enriched).toBe(0);
    expect(run.log.map((line) => line.text)).toContain(
      '✓ Sync complete — 0 enriched, 1 need a decision.'
    );
  });

  it('is not made by case, spacing or the order of genres and cast', async () => {
    const { enrichment, storage, addLantern, addHarbor } = world();
    await addLantern();
    const harborId = await addHarbor();

    const run = await sync(enrichment);

    expect(run.decisions.map((each) => each.title)).toEqual([
      'The Lantern Keeper',
    ]);
    expect(run.enriched).toBe(1);
    expect(storage.getMovie(harborId)?.posterPath).toMatch(/poster\.jpg$/);
  });
});

describe('createEnrichment: a conflicting title’s empty fields', () => {
  it('are written during the run, the disagreements left as they were', async () => {
    const { enrichment, storage, addLantern } = world();
    const movieId = await addLantern();

    const run = await sync(enrichment);

    conflictFor(run, 'The Lantern Keeper');
    const movie = storage.getMovie(movieId);
    expect(movie?.cast).toEqual(['Mara Quill', 'Tobias Lund']);
    expect(movie?.runtimeMinutes).toBe(104);
    expect(movie?.posterPath).toMatch(/poster\.jpg$/);
    expect(movie?.backdropPath).toMatch(/backdrop\.jpg$/);
    expect(movie?.synopsis).toBe(OURS);
    expect(movie?.year).toBe(2019);
    expect(movie?.director).toBe('Eleanor Past');
  });
});

describe('createEnrichment: Only what’s missing never conflicts', () => {
  it('fills the gaps of a title Everything would ask about, and asks nothing', async () => {
    const everything = world();
    await everything.addLantern();
    conflictFor(await sync(everything.enrichment), 'The Lantern Keeper');

    const { enrichment, storage, addLantern } = world();
    const movieId = await addLantern();

    const run = await sync(enrichment, 'missing');

    expect(run.decisions).toEqual([]);
    expect(run.enriched).toBe(1);
    const movie = storage.getMovie(movieId);
    expect(movie?.cast).toEqual(['Mara Quill', 'Tobias Lund']);
    expect(movie?.synopsis).toBe(OURS);
    expect(movie?.director).toBe('Eleanor Past');
  });
});

describe('createEnrichment: apply — Apply choices', () => {
  it('writes the side chosen for each field', async () => {
    const { enrichment, storage, addLantern } = world();
    const movieId = await addLantern();
    const { id } = conflictFor(await sync(enrichment), 'The Lantern Keeper');

    await enrichment.apply(id, {
      synopsis: 'tmdb',
      year: 'mine',
      director: 'tmdb',
    });

    const movie = storage.getMovie(movieId);
    expect(movie?.synopsis).toBe(THEIRS);
    expect(movie?.year).toBe(2019);
    expect(movie?.director).toBe('Eleanor Past-Whitlock');
  });

  it('keeps every field chosen as mine', async () => {
    const { enrichment, storage, addLantern } = world();
    const movieId = await addLantern();
    const { id } = conflictFor(await sync(enrichment), 'The Lantern Keeper');

    await enrichment.apply(id, {
      synopsis: 'mine',
      year: 'tmdb',
      director: 'mine',
    });

    const movie = storage.getMovie(movieId);
    expect(movie?.synopsis).toBe(OURS);
    expect(movie?.year).toBe(2018);
    expect(movie?.director).toBe('Eleanor Past');
  });

  it('never touches the rating or the watch columns', async () => {
    const { enrichment, storage, addLantern } = world();
    const movieId = await addLantern();
    storage.setRating(movieId, 9);
    storage.setResumePosition(movieId, 1234);
    const before = storage.getMovie(movieId);
    const { id } = conflictFor(await sync(enrichment), 'The Lantern Keeper');

    await enrichment.apply(id, {
      synopsis: 'tmdb',
      year: 'tmdb',
      director: 'tmdb',
    });

    const after = storage.getMovie(movieId);
    expect(after?.rating).toBe(before?.rating);
    expect(after?.watched).toBe(before?.watched);
    expect(after?.resumePositionSeconds).toBe(before?.resumePositionSeconds);
  });

  it('takes the row off the list and counts it as enriched', async () => {
    const { enrichment, addLantern } = world();
    await addLantern();
    const { id } = conflictFor(await sync(enrichment), 'The Lantern Keeper');

    await enrichment.apply(id, {
      synopsis: 'tmdb',
      year: 'tmdb',
      director: 'tmdb',
    });

    expect(enrichment.current()?.decisions).toEqual([]);
    expect(enrichment.current()?.enriched).toBe(1);
  });
});

describe('createEnrichment: Keep all mine', () => {
  it('changes nothing on the title and takes the row off', async () => {
    const { enrichment, storage, addLantern } = world();
    const movieId = await addLantern();
    const { id } = conflictFor(await sync(enrichment), 'The Lantern Keeper');
    const before = storage.getMovie(movieId);

    enrichment.dismiss(id);

    expect(storage.getMovie(movieId)).toEqual(before);
    expect(before?.synopsis).toBe(OURS);
    expect(enrichment.current()?.decisions).toEqual([]);
    expect(enrichment.current()?.enriched).toBe(0);
  });
});
