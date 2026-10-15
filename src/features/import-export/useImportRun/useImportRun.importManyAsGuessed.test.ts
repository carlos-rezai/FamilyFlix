import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useImportRun } from './useImportRun';
import type { ImportRun } from '@/types';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 41 — Review at scale, Phase 6: "Import all as guessed" (issue #361).
 *
 * `importManyAsGuessed(ids)`, behind _Import all as guessed_ beside a chosen
 * `no-row`: one `POST /api/import/current/problems/import-guessed` with
 * `{ ids }` as JSON, and the run held is the route's `200` echo — the whole
 * snapshot, a row that could not be settled redrawn in it as its new
 * problem. Any other answer rejects and keeps the run as it was. The run is
 * in review, so it is not polled for any of it.
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

const isCurrent = ([input, init]: FetchArgs) =>
  String(input).endsWith('/api/import/current') &&
  (init?.method ?? 'GET').toUpperCase() === 'GET';
const isImportGuessed = ([input, init]: FetchArgs) =>
  String(input).endsWith('/api/import/current/problems/import-guessed') &&
  init?.method?.toUpperCase() === 'POST';

async function elapse(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** A run in review: three rows, two of them `no-row`. */
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
        kind: 'no-folder',
        title: 'The Lantern Keeper',
        reason: 'No folder found matching this spreadsheet row.',
      },
      {
        id: 'p3',
        kind: 'no-row',
        title: 'Quarry Lane (2004)',
        reason: "Folder isn't in the spreadsheet.",
      },
    ],
  });

/**
 * The route's echo: `p1` imported, `p3` redrawn as its `no-video` Problem
 * under a new id, and a `matched` the old run never had — so a hook that
 * filtered its own copy instead of holding the echo would show.
 */
const ECHO: ImportRun = {
  ...inReview(),
  matched: 5,
  problems: [
    inReview().problems[1],
    {
      id: 'p4',
      kind: 'no-video',
      title: 'Quarry Lane (2004)',
      reason: 'Two videos. Pick the film.',
    },
  ],
};

/** Mount onto a run already in review; each import-guessed answers `answer()`. */
async function mountInReview(answer: () => Response = () => okResponse(ECHO)) {
  fetchMock.mockImplementation((input, init) => {
    const call: FetchArgs = [input, init];
    if (isImportGuessed(call)) {
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

describe('useImportRun — importManyAsGuessed', () => {
  it('posts the ids, as JSON, to the import-guessed route once', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.importManyAsGuessed(['p1', 'p3']);
    });

    const sent = fetchMock.mock.calls.filter(isImportGuessed);
    expect(sent).toHaveLength(1);
    const [input, init] = sent[0];
    expect(String(input)).toBe('/api/import/current/problems/import-guessed');
    expect(new Headers(init?.headers).get('Content-Type')).toMatch(
      /application\/json/
    );
    expect(JSON.parse(String(init?.body))).toEqual({ ids: ['p1', 'p3'] });
  });

  it('holds the route’s echo as the run', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.importManyAsGuessed(['p1', 'p3']);
    });

    expect(result.current.run).toEqual(ECHO);
  });

  it('rejects on any other answer, and keeps the run as it was', async () => {
    const { result } = await mountInReview(() => serverErrorResponse());

    await act(async () => {
      await expect(
        result.current.importManyAsGuessed(['p1', 'p3'])
      ).rejects.toThrow();
    });

    expect(result.current.run).toEqual(inReview());
  });

  it('reads the current run no more for it — review is not polled', async () => {
    const { result } = await mountInReview();
    const before = fetchMock.mock.calls.filter(isCurrent).length;

    await act(async () => {
      await result.current.importManyAsGuessed(['p1']);
    });
    await elapse(2_000);

    expect(fetchMock.mock.calls.filter(isCurrent)).toHaveLength(before);
  });
});
