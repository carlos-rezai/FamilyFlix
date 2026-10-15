import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { loadFormRecord } from './loadFormRecord';
import { formJob } from '../formJob/formJob';
import type { ImportProblemDetail } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import {
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 38 — Title editing, the refactor (issue #311): the **Movie form**'s reads in
 * one place. Each **Form job** is opened on the URL it is opened on, the wire
 * answered by route, and what the form would fill itself with is checked —
 * never how the hook seeds it, which `MovieForm`'s suites press.
 */
const FOLDER = 'E:\\Movies\\Paper Moons (2014)';
const FIRST = `${FOLDER}\\paper.moons.2014.1080p.mkv`;
const SECOND = `${FOLDER}\\paper.moons.2014.extras.mkv`;

const PAPER_MOONS = makeMovie({ id: 'm1', title: 'Paper Moons', year: 2014 });

const HELD = makeSeriesDetail([['watched', 'unwatched']], {
  id: 's1',
  title: 'The Night Ferry',
  year: 2019,
  endYear: null,
});

/** A film's Problem whose folder holds two videos. */
const NO_VIDEO: ImportProblemDetail = {
  id: 'p1',
  kind: 'no-video',
  title: 'Paper Moons',
  reason: 'Two videos',
  row: { title: 'Paper Moons', year: 2014, genres: [] },
  folder: FOLDER,
  files: { videos: [FIRST, SECOND], subtitles: [] },
};

/** A show's `unplaced` Problem with one video. */
const UNPLACED: ImportProblemDetail = {
  id: 'p5',
  kind: 'unplaced',
  title: 'The Night Ferry',
  reason: '1 episode needs a number',
  row: { title: 'The Night Ferry', year: 2021, genres: [] },
  folder: 'E:\\Series\\The Night Ferry',
  candidates: [],
  files: {
    videos: ['E:\\Series\\The Night Ferry\\Season 2\\departure.mov'],
    subtitles: [],
  },
};

let routes: Record<string, () => Response>;

beforeEach(() => {
  routes = {};
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const answer = routes[String(input)];
      return Promise.resolve(
        answer === undefined ? notFoundResponse('Not here') : answer()
      );
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const load = (query: string) =>
  loadFormRecord(formJob(new URLSearchParams(query)));

describe('loadFormRecord — one leaf per job', () => {
  it('reads nothing for a plain add', async () => {
    expect(await load('?kind=series')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('opens an edit on the movie, its fields and its id', async () => {
    routes['/api/movies/m1'] = () => okResponse(PAPER_MOONS);

    const record = await load('?movie=m1');

    expect(record?.editing).toBe('m1');
    expect(record?.values?.title).toBe('Paper Moons');
    expect(record?.resolving).toBeNull();
  });

  it('opens a series edit on the series, its fields and its episodes', async () => {
    routes['/api/series/s1'] = () => okResponse(HELD);

    const record = await load('?series=s1');

    expect(record?.editingSeries).toBe('s1');
    expect(record?.values?.title).toBe('The Night Ferry');
    expect(record?.values?.year).toBe('2019–');
    expect(record?.episodes?.rows).toHaveLength(2);
  });

  it('opens a film Resolve on the detail, its found videos and its banner', async () => {
    routes['/api/import/current/problems/p1'] = () => okResponse(NO_VIDEO);

    const record = await load('?problem=p1');

    expect(record?.values?.title).toBe('Paper Moons');
    expect(record?.foundVideos.map((video) => video.filename)).toEqual([
      'paper.moons.2014.1080p.mkv',
      'paper.moons.2014.extras.mkv',
    ]);
    expect(record?.resolving).toMatchObject({ id: 'p1', title: 'Paper Moons' });
    expect(record?.unplaced).toBe(false);
  });

  it('opens a Resolve over an edit on the movie’s fields, the problem its banner', async () => {
    routes['/api/movies/m1'] = () => okResponse(PAPER_MOONS);
    routes['/api/import/current/problems/p1'] = () =>
      okResponse({ ...NO_VIDEO, kind: 'missing-meta' });

    const record = await load('?movie=m1&problem=p1');

    expect(record?.editing).toBe('m1');
    expect(record?.values?.year).toBe('2014');
    expect(record?.foundVideos).toEqual([]);
    expect(record?.resolving?.id).toBe('p1');
  });

  it('opens a Series Resolve on its rows, unplaced', async () => {
    routes['/api/import/current/problems/p5'] = () => okResponse(UNPLACED);

    const record = await load('?kind=series&problem=p5');

    expect(record?.unplaced).toBe(true);
    expect(record?.values?.title).toBe('The Night Ferry');
    expect(record?.episodes?.rows).toHaveLength(1);
    expect(record?.episodes?.taken).toEqual([]);
  });

  it('opens a Series Resolve that joins a held series on its fields and taken pairs', async () => {
    routes['/api/import/current/problems/p5'] = () => okResponse(UNPLACED);
    routes['/api/series/s1'] = () => okResponse(HELD);

    const record = await load('?kind=series&problem=p5&series=s1');

    expect(record?.values?.year).toBe('2019–');
    expect(record?.episodes?.taken).toEqual(['1x1', '1x2']);
  });
});

describe('loadFormRecord — nothing to open on', () => {
  it('answers null for a movie that is gone', async () => {
    expect(await load('?movie=m9')).toBeNull();
  });

  it('answers null for a problem that is gone', async () => {
    expect(await load('?problem=p9')).toBeNull();
  });

  it('answers null, never rejecting, for a read that was refused', async () => {
    routes['/api/series/s1'] = () => serverErrorResponse();

    await expect(load('?series=s1')).resolves.toBeNull();
  });

  it('keeps the edit standing when the problem beside it is gone', async () => {
    routes['/api/movies/m1'] = () => okResponse(PAPER_MOONS);

    const record = await load('?movie=m1&problem=p9');

    expect(record?.editing).toBe('m1');
    expect(record?.resolving).toBeNull();
  });
});

/**
 * 42 — Review at scale, Slice 4 (issue #357): a show's one `failed` row, its
 * detail listing the episodes whose copies threw. With the series held, its
 * _Resolve_ is the **Series Resolve**: one row per failed episode, joining the
 * held series.
 */
describe('loadFormRecord — a show’s failed row', () => {
  const FAILED_SHOW: ImportProblemDetail = {
    id: 'p6',
    kind: 'failed',
    title: 'The Night Ferry',
    reason: "3 episodes couldn't be copied: no space left on device.",
    seriesId: 's1',
    row: { title: 'The Night Ferry', year: 2019, genres: [] },
    folder: 'E:\Series\The Night Ferry',
    files: {
      videos: [
        'E:\Series\The Night Ferry\Season 01\The.Night.Ferry.S01E03.mkv',
        'E:\Series\The Night Ferry\Season 01\The.Night.Ferry.S01E04.mkv',
        'E:\Series\The Night Ferry\Season 01\The.Night.Ferry.S01E05.mkv',
      ],
      subtitles: [],
    },
  };

  it('opens the Series Resolve on one row per failed episode, joining the held series', async () => {
    routes['/api/import/current/problems/p6'] = () => okResponse(FAILED_SHOW);
    routes['/api/series/s1'] = () => okResponse(HELD);

    const record = await load('?kind=series&problem=p6&series=s1');

    expect(record?.episodes?.rows).toHaveLength(3);
    expect(record?.episodes?.taken).toEqual(['1x1', '1x2']);
    expect(record?.values?.title).toBe('The Night Ferry');
    expect(record?.foundVideos).toEqual([]);
    expect(record?.resolving).toMatchObject({ id: 'p6' });
  });
});
