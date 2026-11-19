import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useImportRun, type ImportRunState } from './useImportRun';
import type { ImportProblem, ImportRun } from '@/types';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';
import {
  noContentResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 69, Silent waits, Phase 3 (issue #656): the Import review's row presses on
 * the **Loader timing**.
 *
 * _Import as “…”_ (`importAsGuessed`), a picked **Candidate folder**
 * (`pick`), _Take out of library_ (`takeOut`), _Apply choices_ (`apply`),
 * and _Skip_ and _Keep all mine_ (both `skip`) each run inside the hook's
 * keyed timing: `rowPhase(id)` is `waiting` the moment the press is sent and
 * `shown` at 300ms, and the row is settled (taken off, or redrawn in place)
 * only once the 500ms hold is out. A refusal settles the row back to `idle`,
 * the run as it was, and the method still rejects.
 *
 * The run in review is read on mount at once; only the press is held open.
 */

const IRONWOOD: ImportProblem = {
  id: 'p1',
  kind: 'no-row',
  title: 'Ironwood (2018)',
  reason: "Folder isn't in the spreadsheet.",
  guess: 'Ironwood (2018)',
};

const DIE_HARD: ImportProblem = {
  id: 'p2',
  kind: 'ambiguous',
  title: 'Die Hard',
  reason: 'Two folders look like plausible matches. Pick one.',
  candidates: [
    {
      path: 'D:/Films/Die.Hard.1988.1080p',
      name: 'Die.Hard.1988.1080p',
      videos: 1,
    },
    { path: 'D:/Films/Die Hard (1988)', name: 'Die Hard (1988)', videos: 2 },
  ],
};

const HEAT: ImportProblem = {
  id: 'p3',
  kind: 'differs',
  title: 'Heat',
  reason: 'The spreadsheet differs from the library.',
  movieId: 'm-heat',
  differences: [
    { field: 'director', label: 'Director', mine: 'Mann', sheet: 'M. Mann' },
  ],
};

const SUNDIAL: ImportProblem = {
  id: 'p4',
  kind: 'missing',
  title: 'Sundial',
  reason: 'Its video is gone from the folder.',
  movieId: 'm-sundial',
  takeOut: 'Take out of library',
};

const LANTERN: ImportProblem = {
  id: 'p5',
  kind: 'no-folder',
  title: 'The Lantern Keeper',
  reason: 'No folder found matching this spreadsheet row.',
};

/** What a pick's `200` redraws Die Hard as: that folder's `no-video` row. */
const DIE_HARD_REDRAWN: ImportProblem = {
  id: 'p2',
  kind: 'no-video',
  title: 'Die Hard',
  reason: 'Two videos. Pick the film.',
};

const ALL = [IRONWOOD, DIE_HARD, HEAT, SUNDIAL, LANTERN];

/** A run in review: one row of every kind a press settles, and a Resolve. */
const inReview = (): ImportRun =>
  makeImportRun({
    phase: 'review',
    found: 9,
    total: 2,
    done: 2,
    matched: 2,
    problems: ALL,
  });

const { fetchMock, respond } = heldFetch((url, init) =>
  (init?.method ?? 'GET').toUpperCase() === 'GET' &&
  url.endsWith('/api/import/current')
    ? okResponse(inReview())
    : undefined
);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** The hook re-attached to the run in review. */
async function mountInReview() {
  const rendered = renderHook(() => useImportRun());
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

const without = (id: string): ImportRun => ({
  ...inReview(),
  problems: ALL.filter((problem) => problem.id !== id),
});

interface RowPress {
  name: string;
  id: string;
  /** The route the press is sent to, and its verb. */
  route: string;
  verb: string;
  press: (hook: ImportRunState) => Promise<void>;
  /** What the route answers when it takes the press. */
  answer: () => Response;
  /** The run once the press has settled. */
  after: () => ImportRun;
}

const PROBLEMS = '/api/import/current/problems';

const PRESSES: RowPress[] = [
  {
    name: 'Import as',
    id: 'p1',
    route: `${PROBLEMS}/p1/import`,
    verb: 'POST',
    press: (hook) => hook.importAsGuessed('p1'),
    answer: noContentResponse,
    after: () => without('p1'),
  },
  {
    name: 'a picked Candidate folder',
    id: 'p2',
    route: `${PROBLEMS}/p2/pick`,
    verb: 'POST',
    press: (hook) => hook.pick('p2', 'D:/Films/Die Hard (1988)'),
    answer: () => okResponse(DIE_HARD_REDRAWN),
    after: () => ({
      ...inReview(),
      problems: [IRONWOOD, DIE_HARD_REDRAWN, HEAT, SUNDIAL, LANTERN],
    }),
  },
  {
    name: 'Take out of library',
    id: 'p4',
    route: `${PROBLEMS}/p4/take-out`,
    verb: 'POST',
    press: (hook) => hook.takeOut('p4'),
    answer: noContentResponse,
    after: () => without('p4'),
  },
  {
    name: 'Apply choices',
    id: 'p3',
    route: `${PROBLEMS}/p3/apply`,
    verb: 'POST',
    press: (hook) => hook.apply('p3', { director: 'sheet' }),
    answer: noContentResponse,
    after: () => without('p3'),
  },
  {
    name: 'Skip',
    id: 'p5',
    route: `${PROBLEMS}/p5`,
    verb: 'DELETE',
    press: (hook) => hook.skip('p5'),
    answer: noContentResponse,
    after: () => without('p5'),
  },
  {
    // Keep all mine is a Skip on a differs row: `skip` too.
    name: 'Keep all mine',
    id: 'p3',
    route: `${PROBLEMS}/p3`,
    verb: 'DELETE',
    press: (hook) => hook.skip('p3'),
    answer: noContentResponse,
    after: () => without('p3'),
  },
];

const IDS = ALL.map(({ id }) => id);

describe('useImportRun: rowPhase before any press', () => {
  it('answers idle for every row', async () => {
    const { result } = await mountInReview();

    for (const id of IDS) {
      expect(result.current.rowPhase(id)).toBe('idle');
    }
  });
});

describe.each(PRESSES)(
  'useImportRun: rowPhase across $name',
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
      for (const other of IDS.filter((each) => each !== id)) {
        expect(result.current.rowPhase(other)).toBe('idle');
      }

      await advanceClock(299);
      expect(result.current.rowPhase(id)).toBe('waiting');

      await advanceClock(1);
      expect(result.current.rowPhase(id)).toBe('shown');
      for (const other of IDS.filter((each) => each !== id)) {
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
      expect(result.current.run).toEqual(inReview());
    });
  }
);
