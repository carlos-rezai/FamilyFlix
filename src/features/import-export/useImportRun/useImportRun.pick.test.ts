import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useImportRun } from './useImportRun';
import type { ImportProblem, ImportRun } from '@/types';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  noContentResponse,
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 40 — Import review, Phase 4: "the Folder picker" (issue #334).
 *
 * `pick(id, folder)`, a press on an `ambiguous` row's **Folder picker**, on
 * `apply`'s prior art: `POST /api/import/current/problems/:id/pick { folder }`
 * goes; the row is taken off the snapshot on a `204` — and on a `404` too,
 * because both mean the Problem is not there — and redrawn in place from a
 * `200`'s `ImportProblem`, that folder's `no-video` Problem. Any other answer
 * (a `400` among them) keeps the row and rejects. The run is in review, so it
 * is not polled for any of it.
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
const isPick = ([input, init]: FetchArgs) =>
  /\/api\/import\/current\/problems\/[^/]+\/pick$/.test(String(input)) &&
  init?.method?.toUpperCase() === 'POST';

async function elapse(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** A run in review: one `ambiguous` row between two others. */
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
        kind: 'ambiguous',
        title: 'Die Hard',
        reason: 'Two folders look like plausible matches. Pick one.',
        candidates: [
          {
            path: 'D:/Films/Die.Hard.1988.1080p',
            name: 'Die.Hard.1988.1080p',
            videos: 1,
          },
          {
            path: 'D:/Films/Die Hard (1988)',
            name: 'Die Hard (1988)',
            videos: 2,
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

/** What a `200` redraws the row as: that folder's `no-video` Problem. */
const REDRAWN: ImportProblem = {
  id: 'p2',
  kind: 'no-video',
  title: 'Die Hard',
  reason: 'Two videos. Pick the film.',
};

const refused = (): Response =>
  new Response(
    JSON.stringify({ error: 'That folder is not one of the candidates.' }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );

/** Mount onto a run already in review; each pick answers `answer()`. */
async function mountInReview(answer: () => Response = noContentResponse) {
  fetchMock.mockImplementation((input, init) => {
    const call: FetchArgs = [input, init];
    if (isPick(call)) {
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

const FOLDER = 'D:/Films/Die Hard (1988)';

describe('useImportRun — pick', () => {
  it('posts the folder to the Problem’s pick route', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.pick('p2', FOLDER);
    });

    const sent = fetchMock.mock.calls.filter(isPick);
    expect(sent).toHaveLength(1);
    expect(String(sent[0][0])).toBe('/api/import/current/problems/p2/pick');
    expect(JSON.parse(String(sent[0][1]?.body))).toEqual({ folder: FOLDER });
  });

  it('encodes the id into the route', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.pick('p 2/x', FOLDER);
    });

    expect(String(fetchMock.mock.calls.filter(isPick)[0][0])).toBe(
      '/api/import/current/problems/p%202%2Fx/pick'
    );
  });

  it('takes the row off the snapshot on a 204', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.pick('p2', FOLDER);
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
      await result.current.pick('p2', FOLDER);
    });

    expect(result.current.run?.problems.map((problem) => problem.id)).toEqual([
      'p1',
      'p3',
    ]);
  });

  it('redraws the row in place from a 200', async () => {
    const { result } = await mountInReview(() => okResponse(REDRAWN));

    await act(async () => {
      await result.current.pick('p2', FOLDER);
    });

    const problems = result.current.run?.problems ?? [];
    expect(problems.map((problem) => problem.id)).toEqual(['p1', 'p2', 'p3']);
    expect(problems[1]).toEqual(REDRAWN);
  });

  it('keeps the row and rejects on a 400', async () => {
    const { result } = await mountInReview(refused);

    await expect(
      act(async () => {
        await result.current.pick('p2', FOLDER);
      })
    ).rejects.toThrow();

    expect(fetchMock.mock.calls.filter(isPick)).toHaveLength(1);
    expect(result.current.run?.problems.map((problem) => problem.kind)).toEqual(
      ['no-row', 'ambiguous', 'no-folder']
    );
  });

  it('keeps the row and rejects when the pick could not be made', async () => {
    const { result } = await mountInReview(() => serverErrorResponse());

    await expect(
      act(async () => {
        await result.current.pick('p2', FOLDER);
      })
    ).rejects.toThrow();

    expect(fetchMock.mock.calls.filter(isPick)).toHaveLength(1);
    expect(result.current.run?.problems).toHaveLength(3);
  });

  it('leaves the rest of the snapshot as it was', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.pick('p2', FOLDER);
    });

    expect(result.current.run).toMatchObject({
      id: 'run-1',
      phase: 'review',
      matched: 1,
      done: 1,
    });
  });

  it('polls nothing for a pick', async () => {
    const { result } = await mountInReview(() => okResponse(REDRAWN));
    const before = fetchMock.mock.calls.filter(isCurrent).length;

    await act(async () => {
      await result.current.pick('p2', FOLDER);
    });
    await elapse(2000);

    expect(fetchMock.mock.calls.filter(isCurrent)).toHaveLength(before);
  });
});
