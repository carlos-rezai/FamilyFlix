import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useImportRun } from './useImportRun';
import type { ImportRun } from '@/types';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  noContentResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 66, Missing videos, Phase 2: "take out a film" (issue #635).
 *
 * `takeOut(id)`, the `missing` row's _Take out of library_, on `apply`'s
 * prior art: `POST /api/import/current/problems/:id/take-out` goes, and the
 * row is taken off the snapshot on a `204`. A `404`, the Problem not there or
 * not `missing`, does nothing. The run is in review, so it is not polled for
 * any of it.
 */

type FetchArgs = [RequestInfo | URL, RequestInit?];

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const isCurrent = ([input]: FetchArgs) =>
  String(input).endsWith('/api/import/current');
const isTakeOut = ([input, init]: FetchArgs) =>
  /\/api\/import\/current\/problems\/[^/]+\/take-out$/.test(String(input)) &&
  init?.method?.toUpperCase() === 'POST';

async function elapse(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** A run in review: one `missing` row between two others. */
const inReview = (): ImportRun =>
  makeImportRun({
    phase: 'review',
    found: 4,
    total: 1,
    done: 1,
    matched: 1,
    problems: [
      {
        id: 'p1',
        kind: 'no-row',
        title: 'Ironwood (2018)',
        reason: "Folder isn't in the spreadsheet.",
      },
      {
        id: 'p2',
        kind: 'missing',
        title: 'Die Hard',
        reason: 'Its video, Die.Hard.1988.1080p.mp4, is no longer on disk.',
        movieId: 'm1',
        takeOut: 'Take out of library',
      },
      {
        id: 'p3',
        kind: 'no-folder',
        title: 'The Lantern Keeper',
        reason: 'No folder found matching this spreadsheet row.',
      },
    ],
  });

/** Mount onto a run already in review; each take-out answers `answer()`. */
async function mountInReview(answer: () => Response = noContentResponse) {
  fetchMock.mockImplementation((input, init) => {
    const call: FetchArgs = [input, init];
    if (isTakeOut(call)) {
      return Promise.resolve(answer());
    }
    if (isCurrent(call)) {
      return Promise.resolve(okResponse(inReview()));
    }
    return Promise.reject(new Error(`Unexpected request: ${String(input)}`));
  });
  const rendered = renderHook(() => useImportRun());
  await elapse(0);
  return rendered;
}

describe('useImportRun: takeOut', () => {
  it('posts to the Problem’s take-out route, the id encoded', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.takeOut('p 2/x');
    });

    const sent = fetchMock.mock.calls.filter(isTakeOut);
    expect(sent).toHaveLength(1);
    expect(String(sent[0][0])).toBe(
      '/api/import/current/problems/p%202%2Fx/take-out'
    );
  });

  it('takes the row off the snapshot on a 204', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.takeOut('p2');
    });

    expect(result.current.run?.problems.map((problem) => problem.id)).toEqual([
      'p1',
      'p3',
    ]);
  });

  it('does nothing on a 404: the rows stay and nothing rejects', async () => {
    const { result } = await mountInReview(() =>
      notFoundResponse('No such problem: p2')
    );

    await act(async () => {
      await result.current.takeOut('p2');
    });

    expect(fetchMock.mock.calls.filter(isTakeOut)).toHaveLength(1);
    expect(result.current.run?.problems.map((problem) => problem.id)).toEqual([
      'p1',
      'p2',
      'p3',
    ]);
  });

  it('leaves the rest of the snapshot as it was', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.takeOut('p2');
    });

    expect(result.current.run).toMatchObject({
      id: 'run-1',
      phase: 'review',
      matched: 1,
      done: 1,
    });
  });

  it('polls nothing for a take-out', async () => {
    const { result } = await mountInReview();
    const before = fetchMock.mock.calls.filter(isCurrent).length;

    await act(async () => {
      await result.current.takeOut('p2');
    });
    await elapse(2000);

    expect(fetchMock.mock.calls.filter(isCurrent)).toHaveLength(before);
  });
});
