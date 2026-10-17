import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useEnrichmentRun } from './useEnrichmentRun';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import {
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 45 — Add and sync (issue #393): **Started on arrival** waits on the arrival
 * read, so the hook says when it is still `attaching` — `useImportRun`'s
 * name. `true` from mount until the read of the **Current enrichment run**
 * answers, whether with a held run, a `404` or a failure; `false` after.
 */

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

async function elapse(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Every read of the Current run answered by `answer`. */
function serve(answer: () => Promise<Response>) {
  fetchMock.mockImplementation(() => answer());
}

describe('useEnrichmentRun — attaching', () => {
  it('is attaching on mount, before the arrival read answers', () => {
    serve(() => new Promise<Response>(() => undefined));

    const { result } = renderHook(() => useEnrichmentRun(null));

    expect(result.current.attaching).toBe(true);
    expect(result.current.run).toBeNull();
  });

  it('stays attaching while the arrival read has not answered', async () => {
    serve(() => new Promise<Response>(() => undefined));

    const { result } = renderHook(() =>
      useEnrichmentRun({ kind: 'movie', id: 'm1' })
    );
    await elapse(5000);

    expect(result.current.attaching).toBe(true);
  });

  it('is no longer attaching once the read answers with a run', async () => {
    const held = makeEnrichmentRun({ scope: 'single', movieId: 'm1' });
    serve(() => Promise.resolve(okResponse(held)));

    const { result } = renderHook(() =>
      useEnrichmentRun({ kind: 'movie', id: 'm1' })
    );
    await elapse(0);

    expect(result.current.attaching).toBe(false);
    expect(result.current.run).toEqual(held);
  });

  it('is no longer attaching once the read answers with a Waiting run', async () => {
    const other = makeEnrichmentRun({ phase: 'review', scope: 'all' });
    serve(() => Promise.resolve(okResponse(other)));

    const { result } = renderHook(() =>
      useEnrichmentRun({ kind: 'movie', id: 'm1' })
    );
    await elapse(0);

    expect(result.current.attaching).toBe(false);
    expect(result.current.waiting).toEqual(other);
  });

  it('is no longer attaching once the read answers 404', async () => {
    serve(() => Promise.resolve(notFoundResponse('No sync is running')));

    const { result } = renderHook(() => useEnrichmentRun(null));
    await elapse(0);

    expect(result.current.attaching).toBe(false);
    expect(result.current.run).toBeNull();
  });

  it('is no longer attaching once the read fails', async () => {
    serve(() => Promise.resolve(serverErrorResponse()));

    const { result } = renderHook(() => useEnrichmentRun(null));
    await elapse(0);

    expect(result.current.attaching).toBe(false);
    expect(result.current.run).toBeNull();
  });

  it('is no longer attaching once the read rejects outright', async () => {
    serve(() => Promise.reject(new TypeError('Failed to fetch')));

    const { result } = renderHook(() => useEnrichmentRun(null));
    await elapse(0);

    expect(result.current.attaching).toBe(false);
  });
});
