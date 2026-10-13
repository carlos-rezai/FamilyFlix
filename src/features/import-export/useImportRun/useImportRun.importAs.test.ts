import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useImportRun } from './useImportRun';
import type { ImportRun } from '@/types';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  noContentResponse,
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 40 — Import review, Phase 4: "Import as on a no-row row" (issue #335).
 *
 * `importAsGuessed(id)`, _Import as “Ironwood (2018)”_ on a `no-row` row, on
 * `pick`'s prior art: `POST /api/import/current/problems/:id/import` goes,
 * with no body; the row is taken off the snapshot on a `204` — and on a `404`
 * too, because both mean the Problem is not there — and redrawn in its place
 * from a `200`'s Problem, `pick`'s answer (issue #336). Any other answer keeps
 * the row and rejects. The run is in review, so it is not polled for any of
 * it.
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
const isImportAs = ([input, init]: FetchArgs) =>
  /\/api\/import\/current\/problems\/[^/]+\/import$/.test(String(input)) &&
  init?.method?.toUpperCase() === 'POST';

async function elapse(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** A run in review: one `no-row` row between two others. */
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
        kind: 'no-folder',
        title: 'The Lantern Keeper',
        reason: 'No folder found matching this spreadsheet row.',
      },
      {
        id: 'p2',
        kind: 'no-row',
        title: 'Ironwood (2018)',
        reason: "Folder isn't in the spreadsheet.",
        guess: { title: 'Ironwood', year: 2018 },
      },
      {
        id: 'p3',
        kind: 'no-video',
        title: 'Die Hard',
        reason: 'Two videos. Pick the film.',
      },
    ],
  });

/** Mount onto a run already in review; each Import as answers `answer()`. */
async function mountInReview(answer: () => Response = noContentResponse) {
  fetchMock.mockImplementation((input, init) => {
    const call: FetchArgs = [input, init];
    if (isImportAs(call)) {
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

describe('useImportRun — importAsGuessed', () => {
  it('posts to the Problem’s import route', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.importAsGuessed('p2');
    });

    const sent = fetchMock.mock.calls.filter(isImportAs);
    expect(sent).toHaveLength(1);
    expect(String(sent[0][0])).toBe('/api/import/current/problems/p2/import');
  });

  it('encodes the id into the route', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.importAsGuessed('p 2/x');
    });

    expect(String(fetchMock.mock.calls.filter(isImportAs)[0][0])).toBe(
      '/api/import/current/problems/p%202%2Fx/import'
    );
  });

  it('takes the row off the snapshot on a 204', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.importAsGuessed('p2');
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
      await result.current.importAsGuessed('p2');
    });

    expect(result.current.run?.problems.map((problem) => problem.id)).toEqual([
      'p1',
      'p3',
    ]);
  });

  it('redraws the row in its own place from a 200’s Problem', async () => {
    const redrawn = {
      id: 'p2',
      kind: 'no-video',
      title: 'Ironwood',
      reason: 'Two videos. Pick the film.',
    } as const;
    const { result } = await mountInReview(() => okResponse(redrawn));

    await act(async () => {
      await result.current.importAsGuessed('p2');
    });

    expect(result.current.run?.problems).toEqual([
      inReview().problems[0],
      redrawn,
      inReview().problems[2],
    ]);
  });

  it('keeps the row and rejects when the import could not be made', async () => {
    const { result } = await mountInReview(() => serverErrorResponse());

    await expect(
      act(async () => {
        await result.current.importAsGuessed('p2');
      })
    ).rejects.toThrow();

    expect(fetchMock.mock.calls.filter(isImportAs)).toHaveLength(1);
    expect(result.current.run?.problems.map((problem) => problem.kind)).toEqual(
      ['no-folder', 'no-row', 'no-video']
    );
  });

  it('leaves the rest of the snapshot as it was', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.importAsGuessed('p2');
    });

    expect(result.current.run).toMatchObject({
      id: 'run-1',
      phase: 'review',
      matched: 1,
      done: 1,
    });
  });

  it('polls nothing for an import', async () => {
    const { result } = await mountInReview();
    const before = fetchMock.mock.calls.filter(isCurrent).length;

    await act(async () => {
      await result.current.importAsGuessed('p2');
    });
    await elapse(2000);

    expect(fetchMock.mock.calls.filter(isCurrent)).toHaveLength(before);
  });
});
