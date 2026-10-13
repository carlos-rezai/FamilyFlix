import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useImportRun } from './useImportRun';
import type { ImportRun, SheetChoices } from '@/types';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  noContentResponse,
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 40 — Import review, Phase 3: "Sheet differences" (issue #333).
 *
 * `apply(id, choices)`, the `differs` row's _Apply choices_, on `skip`'s
 * prior art: `POST /api/import/current/problems/:id/apply { choices }` goes,
 * and the row is taken off the snapshot on a `204` — and on a `404` too,
 * because both mean the Problem is not there. Any other answer keeps the row
 * and rejects. The run is in review, so it is not polled for any of it.
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
const isApply = ([input, init]: FetchArgs) =>
  /\/api\/import\/current\/problems\/[^/]+\/apply$/.test(String(input)) &&
  init?.method?.toUpperCase() === 'POST';

async function elapse(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** A run in review: one `differs` row between two others. */
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
        kind: 'differs',
        title: 'Die Hard',
        reason:
          'The spreadsheet has different values for fields you already filled in.',
        movieId: 'm1',
        differences: [
          {
            field: 'director',
            label: 'Director',
            mine: 'Renny Harlin',
            sheet: 'John McTiernan',
          },
        ],
      },
      {
        id: 'p3',
        kind: 'no-folder',
        title: 'The Lantern Keeper',
        reason: 'No folder found matching this spreadsheet row.',
      },
    ],
  });

/** Mount onto a run already in review; each apply answers `answer()`. */
async function mountInReview(answer: () => Response = noContentResponse) {
  fetchMock.mockImplementation((input, init) => {
    const call: FetchArgs = [input, init];
    if (isApply(call)) {
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

const CHOICES: SheetChoices = { director: 'sheet' };

describe('useImportRun — apply', () => {
  it('posts the choices to the Problem’s apply route', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.apply('p2', CHOICES);
    });

    const sent = fetchMock.mock.calls.filter(isApply);
    expect(sent).toHaveLength(1);
    expect(String(sent[0][0])).toBe('/api/import/current/problems/p2/apply');
    expect(JSON.parse(String(sent[0][1]?.body))).toEqual({
      choices: { director: 'sheet' },
    });
  });

  it('encodes the id into the route', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.apply('p 2/x', { director: 'mine' });
    });

    expect(String(fetchMock.mock.calls.filter(isApply)[0][0])).toBe(
      '/api/import/current/problems/p%202%2Fx/apply'
    );
  });

  it('takes the row off the snapshot on a 204', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.apply('p2', CHOICES);
    });

    expect(result.current.run?.problems.map((problem) => problem.id)).toEqual([
      'p1',
      'p3',
    ]);
  });

  it('takes the row off on a 404 just the same — gone is gone', async () => {
    const { result } = await mountInReview(() =>
      notFoundResponse('No such problem')
    );

    await act(async () => {
      await result.current.apply('p2', CHOICES);
    });

    expect(result.current.run?.problems.map((problem) => problem.id)).toEqual([
      'p1',
      'p3',
    ]);
  });

  it('keeps the row and rejects when the apply could not be made', async () => {
    const { result } = await mountInReview(() => serverErrorResponse());

    await expect(
      act(async () => {
        await result.current.apply('p2', CHOICES);
      })
    ).rejects.toThrow();

    expect(fetchMock.mock.calls.filter(isApply)).toHaveLength(1);
    expect(result.current.run?.problems).toHaveLength(3);
  });

  it('leaves the rest of the snapshot as it was', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.apply('p2', CHOICES);
    });

    expect(result.current.run).toMatchObject({
      id: 'run-1',
      phase: 'review',
      matched: 1,
      done: 1,
    });
  });

  it('polls nothing for an apply', async () => {
    const { result } = await mountInReview();
    const before = fetchMock.mock.calls.filter(isCurrent).length;

    await act(async () => {
      await result.current.apply('p2', CHOICES);
    });
    await elapse(2000);

    expect(fetchMock.mock.calls.filter(isCurrent)).toHaveLength(before);
  });
});
