import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useImportRun } from './useImportRun';
import type { ImportProblem, ImportRun } from '@/types';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 57 — Tidy into folders, Phase 4: "Tidy all, failures and Resolve" (issue
 * #527).
 *
 * `tidyMany(ids)`, behind _Tidy all_ on the _Loose_ filter: one `POST
 * /api/import/current/problems/tidy` with `{ ids }` as JSON, and the run held
 * is the route's `200` echo, the whole snapshot: a row whose move failed
 * redrawn in it, the rest after an unreachable folder still listed. Any other
 * answer rejects and keeps the run as it was. The `importManyAsGuessed`
 * precedent.
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
const isTidyMany = ([input, init]: FetchArgs) =>
  String(input).endsWith('/api/import/current/problems/tidy') &&
  init?.method?.toUpperCase() === 'POST';

async function elapse(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const loose = (id: string, folder: string): ImportProblem => ({
  id,
  kind: 'loose',
  title: folder,
  reason: 'Lies loose at the top of D:\\Films, with no folder of its own.',
  tidy: {
    id: `${folder.toLowerCase()}.mp4`,
    kind: 'film',
    folder,
    videos: [`${folder}.mp4`],
    companions: [],
  },
});

/** A run in review: two loose films. */
const inReview = (): ImportRun =>
  makeImportRun({
    phase: 'review',
    found: 2,
    total: 0,
    done: 0,
    matched: 0,
    problems: [loose('a1', 'Apex (2026)'), loose('q1', 'Quarry Lane (2004)')],
  });

/** The route's echo: `a1` redrawn with why its move failed, `q1` left listed. */
const ECHO: ImportRun = {
  ...inReview(),
  problems: [
    {
      ...inReview().problems[0],
      reason:
        "Couldn't move it: The folder can't be reached right now. Nothing was moved.",
    },
    inReview().problems[1],
  ],
};

/** Mount onto a run already in review; each tidy-many answers `answer()`. */
async function mountInReview(answer: () => Response = () => okResponse(ECHO)) {
  fetchMock.mockImplementation((input, init) => {
    const call: FetchArgs = [input, init];
    if (isTidyMany(call)) {
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

describe('useImportRun — tidyMany', () => {
  it('posts the ids, as JSON, to the bulk tidy route once', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.tidyMany(['a1', 'q1']);
    });

    const sent = fetchMock.mock.calls.filter(isTidyMany);
    expect(sent).toHaveLength(1);
    const [input, init] = sent[0];
    expect(String(input)).toBe('/api/import/current/problems/tidy');
    expect(new Headers(init?.headers).get('Content-Type')).toMatch(
      /application\/json/
    );
    expect(JSON.parse(String(init?.body))).toEqual({ ids: ['a1', 'q1'] });
  });

  it('holds the route’s echo as the run', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.tidyMany(['a1', 'q1']);
    });

    expect(result.current.run).toEqual(ECHO);
  });

  it('rejects on any other answer, and keeps the run as it was', async () => {
    const { result } = await mountInReview(() => serverErrorResponse());

    await act(async () => {
      await expect(result.current.tidyMany(['a1', 'q1'])).rejects.toThrow();
    });

    expect(result.current.run).toEqual(inReview());
  });
});
