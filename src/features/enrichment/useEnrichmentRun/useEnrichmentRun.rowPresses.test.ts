import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useEnrichmentRun, type EnrichmentRunState } from './useEnrichmentRun';
import type { Decision, EnrichmentRun, SeasonChoice } from '@/types';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';
import {
  noContentResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 69, Silent waits, Phase 2 (issue #654): the Sync review's other row presses
 * on the **Loader timing**.
 *
 * _Apply choices_ (`apply`), _Skip_ and _Keep all mine_ (both `dismiss`) and
 * _Search_ (`search`) each run inside the hook's keyed timing, as the pick
 * does: `rowPhase(id)` is `waiting` the moment the press is sent and `shown`
 * at 300ms, and the row is settled (dropped, counted, or redrawn with the
 * search's answer) only once the 500ms hold is out. A refusal settles the
 * row back to `idle`, the run as it was, and the method still rejects.
 *
 * A **Season choice** runs the same way through `seasonPhase(season)`: one
 * season locked, every other season and every row `idle`.
 *
 * The run in review is read on mount at once; only the press is held open.
 */

const HARBOR: Decision = {
  id: 'd1',
  kind: 'ambiguous',
  title: 'Harbor Lights',
  reason: 'Two releases share this title. Pick the right one.',
  path: null,
  query: 'Harbor Lights',
  candidates: [
    {
      tmdbId: 101,
      title: 'Harbor Lights',
      year: 1963,
      genre: 'Drama',
      language: 'en',
      posterUrl: null,
      score: 100,
    },
  ],
};

const LANTERN: Decision = {
  id: 'd2',
  kind: 'conflict',
  title: 'The Lantern Keeper',
  reason: 'TMDB has different values for fields you already filled in.',
  path: null,
  query: 'The Lantern Keeper',
  fields: [{ field: 'year', label: 'Year', mine: '2019', tmdb: '2018' }],
};

const SUNDIAL: Decision = {
  id: 'd3',
  kind: 'missing',
  title: 'Sundial',
  reason: 'Nothing on TMDB matched this title.',
  path: null,
  query: 'Sundial',
};

/** What a search for Sundial answers: candidates in place of the box. */
const SUNDIAL_FOUND: Decision = {
  id: 'd3',
  kind: 'ambiguous',
  title: 'Sundial',
  reason: 'One release shares this title. Pick the right one.',
  path: null,
  query: 'Sundial 2004',
  candidates: [
    {
      tmdbId: 601,
      title: 'Sundial',
      year: 2004,
      genre: 'Drama',
      language: 'en',
      posterUrl: null,
      score: 82,
    },
  ],
};

const tmdb = (path: string) => `https://image.tmdb.org/t/p/w342${path}`;

const seasonOf = (season: number, posterUrl: string | null): SeasonChoice => ({
  season,
  posterUrl,
  choices: [
    {
      path: `/s0${season}-a.jpg`,
      url: tmdb(`/s0${season}-a.jpg`),
      source: 'season',
    },
    { path: '/show-1.jpg', url: tmdb('/show-1.jpg'), source: 'series' },
  ],
});

const SEASON_ECHO = seasonOf(
  2,
  '/api/images/the-hollow-coast-2018/S02-poster.jpg'
);

/** A single-series run in review: three Decisions and two seasons. */
const inReview = (): EnrichmentRun =>
  makeEnrichmentRun({
    phase: 'review',
    scope: 'single',
    seriesId: 's1',
    total: 6,
    done: 6,
    enriched: 4,
    decisions: [HARBOR, LANTERN, SUNDIAL],
    seasons: [seasonOf(1, null), seasonOf(2, null)],
  });

const { fetchMock, respond } = heldFetch((url, init) =>
  (init?.method ?? 'GET').toUpperCase() === 'GET' &&
  url.endsWith('/api/enrichment/current')
    ? okResponse(inReview())
    : undefined
);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** The hook re-attached to the series' run in review. */
async function mountInReview() {
  const rendered = renderHook(() =>
    useEnrichmentRun({ kind: 'series', id: 's1' })
  );
  await advanceClock(0);
  expect(rendered.result.current.run).toEqual(inReview());
  return rendered;
}

/** A press's promise, watched: still running, or settled with what. */
function watch(promise: Promise<void>) {
  const state: { settled: boolean; error?: unknown } = { settled: false };
  promise.then(
    () => {
      state.settled = true;
    },
    (error: unknown) => {
      state.settled = true;
      state.error = error;
    }
  );
  return state;
}

const ids = (run: EnrichmentRun | null) =>
  run?.decisions.map(({ id }) => id) ?? [];

interface RowPress {
  name: string;
  id: string;
  /** The route the press is sent to, and its verb. */
  route: string;
  verb: string;
  press: (hook: EnrichmentRunState) => Promise<void>;
  /** What the route answers when it takes the press. */
  answer: () => Response;
  /** The run once the press has settled. */
  after: () => EnrichmentRun;
}

const PRESSES: RowPress[] = [
  {
    name: 'Apply choices',
    id: 'd2',
    route: '/api/enrichment/current/decisions/d2/apply',
    verb: 'POST',
    press: (hook) => hook.apply('d2', { year: 'tmdb' }),
    answer: noContentResponse,
    after: () => ({
      ...inReview(),
      enriched: 5,
      decisions: [HARBOR, SUNDIAL],
    }),
  },
  {
    name: 'Skip',
    id: 'd1',
    route: '/api/enrichment/current/decisions/d1',
    verb: 'DELETE',
    press: (hook) => hook.dismiss('d1'),
    answer: noContentResponse,
    after: () => ({ ...inReview(), decisions: [LANTERN, SUNDIAL] }),
  },
  {
    // Keep all mine is a Skip on a conflict row: `dismiss` too.
    name: 'Keep all mine',
    id: 'd2',
    route: '/api/enrichment/current/decisions/d2',
    verb: 'DELETE',
    press: (hook) => hook.dismiss('d2'),
    answer: noContentResponse,
    after: () => ({ ...inReview(), decisions: [HARBOR, SUNDIAL] }),
  },
  {
    name: 'Search',
    id: 'd3',
    route: '/api/enrichment/current/decisions/d3/search',
    verb: 'POST',
    press: (hook) => hook.search('d3', 'Sundial 2004'),
    answer: () => okResponse(SUNDIAL_FOUND),
    after: () => ({
      ...inReview(),
      decisions: [HARBOR, LANTERN, SUNDIAL_FOUND],
    }),
  },
];

const OTHERS = ['d1', 'd2', 'd3'];

describe.each(PRESSES)(
  'useEnrichmentRun: rowPhase across $name',
  ({ id, route, verb, press, answer, after }) => {
    const sentToRoute = () =>
      fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith(route) &&
          (init?.method ?? 'GET').toUpperCase() === verb
      );

    it('is waiting the moment the press is sent, and shown at 300ms, on its row alone', async () => {
      const { result } = await mountInReview();

      act(() => {
        void press(result.current).catch(() => undefined);
      });

      expect(sentToRoute()).toHaveLength(1);
      expect(result.current.rowPhase(id)).toBe('waiting');
      for (const other of OTHERS.filter((each) => each !== id)) {
        expect(result.current.rowPhase(other)).toBe('idle');
      }

      await advanceClock(299);
      expect(result.current.rowPhase(id)).toBe('waiting');

      await advanceClock(1);
      expect(result.current.rowPhase(id)).toBe('shown');
      for (const other of OTHERS.filter((each) => each !== id)) {
        expect(result.current.rowPhase(other)).toBe('idle');
      }

      await respond(answer());
      await advanceClock(500);
    });

    it('keeps the row as it was until the hold is out, then settles it', async () => {
      const { result } = await mountInReview();

      let pressing!: ReturnType<typeof watch>;
      act(() => {
        pressing = watch(press(result.current));
      });
      // Shown at 300; the route answers at 400; the hold runs to 800.
      await advanceClock(400);
      await respond(answer());

      await advanceClock(399);
      expect(pressing.settled).toBe(false);
      expect(result.current.rowPhase(id)).toBe('shown');
      expect(result.current.run).toEqual(inReview());

      await advanceClock(1);
      expect(pressing.settled).toBe(true);
      expect(pressing.error).toBeUndefined();
      expect(result.current.rowPhase(id)).toBe('idle');
      expect(result.current.run).toEqual(after());
    });

    it('returns a refusal to idle, the run unchanged, and still rejects', async () => {
      const { result } = await mountInReview();

      let pressing!: ReturnType<typeof watch>;
      act(() => {
        pressing = watch(press(result.current));
      });
      await advanceClock(400);
      await respond(serverErrorResponse());

      await advanceClock(399);
      expect(pressing.settled).toBe(false);
      expect(result.current.rowPhase(id)).toBe('shown');

      await advanceClock(1);
      expect(pressing.settled).toBe(true);
      expect(pressing.error).toBeInstanceOf(Error);
      expect(result.current.rowPhase(id)).toBe('idle');
      expect(ids(result.current.run)).toEqual(['d1', 'd2', 'd3']);
      expect(result.current.run).toEqual(inReview());
    });
  }
);

describe('useEnrichmentRun: seasonPhase across a Season choice', () => {
  const posterSends = () =>
    fetchMock.mock.calls.filter(
      ([input, init]) =>
        /\/api\/enrichment\/current\/seasons\/\d+\/poster$/.test(
          String(input)
        ) && init?.method?.toUpperCase() === 'POST'
    );

  it('answers idle for every season before anything is pressed', async () => {
    const { result } = await mountInReview();

    expect(result.current.seasonPhase(1)).toBe('idle');
    expect(result.current.seasonPhase(2)).toBe('idle');
  });

  it('locks the one season: waiting at once, shown at 300ms, every other season and row idle', async () => {
    const { result } = await mountInReview();

    act(() => {
      void result.current
        .chooseSeasonPoster(2, '/show-1.jpg')
        .catch(() => undefined);
    });

    expect(posterSends()).toHaveLength(1);
    expect(result.current.seasonPhase(2)).toBe('waiting');
    expect(result.current.seasonPhase(1)).toBe('idle');

    await advanceClock(299);
    expect(result.current.seasonPhase(2)).toBe('waiting');

    await advanceClock(1);
    expect(result.current.seasonPhase(2)).toBe('shown');
    expect(result.current.seasonPhase(1)).toBe('idle');
    for (const row of OTHERS) {
      expect(result.current.rowPhase(row)).toBe('idle');
    }

    await respond(okResponse(SEASON_ECHO));
    await advanceClock(500);
  });

  it('holds the echo only once the hold is out', async () => {
    const { result } = await mountInReview();

    let choosing!: ReturnType<typeof watch>;
    act(() => {
      choosing = watch(result.current.chooseSeasonPoster(2, '/show-1.jpg'));
    });
    await advanceClock(400);
    await respond(okResponse(SEASON_ECHO));

    await advanceClock(399);
    expect(choosing.settled).toBe(false);
    expect(result.current.seasonPhase(2)).toBe('shown');
    expect(result.current.run).toEqual(inReview());

    await advanceClock(1);
    expect(choosing.settled).toBe(true);
    expect(choosing.error).toBeUndefined();
    expect(result.current.seasonPhase(2)).toBe('idle');
    expect(result.current.run).toEqual({
      ...inReview(),
      seasons: [seasonOf(1, null), SEASON_ECHO],
    });
  });

  it('returns a refusal to idle, the run unchanged, and still rejects', async () => {
    const { result } = await mountInReview();

    let choosing!: ReturnType<typeof watch>;
    act(() => {
      choosing = watch(result.current.chooseSeasonPoster(2, '/show-1.jpg'));
    });
    await advanceClock(400);
    await respond(serverErrorResponse());

    await advanceClock(399);
    expect(choosing.settled).toBe(false);
    expect(result.current.seasonPhase(2)).toBe('shown');

    await advanceClock(1);
    expect(choosing.settled).toBe(true);
    expect(choosing.error).toBeInstanceOf(Error);
    expect(result.current.seasonPhase(2)).toBe('idle');
    expect(result.current.run).toEqual(inReview());
  });
});
