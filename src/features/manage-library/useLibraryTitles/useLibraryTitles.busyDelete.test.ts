import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useLibraryTitles } from './useLibraryTitles';
import type { LibraryTitles } from '@/types';
import {
  noContentResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { makeLibraryMovie } from '@/test-support/makeLibraryTitle/makeLibraryTitle';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';

/**
 * 53 — Loading states, Phase 6 (issue #488): `deleting` is a **Busy phase**
 * on the **Loader timing**, `waiting` from the press and `shown` once the
 * delete has run 300ms; the row leaves only after the 500ms hold. A failed
 * delete raises `deleteFailed`, which the next confirm clears.
 *
 * The list is read on real timers; the clock is faked from the press on.
 */

const COCO = makeLibraryMovie({ id: 'm1', title: 'Coco' });
const LISTED: LibraryTitles = { movies: [COCO], series: [] };

const { respond } = heldFetch((url) =>
  url === '/api/library-titles' ? okResponse(LISTED) : undefined
);

afterEach(() => {
  vi.useRealTimers();
});

async function loaded() {
  const hook = renderHook(() => useLibraryTitles());
  await waitFor(() => expect(hook.result.current.titles).not.toBeNull());
  return hook;
}

describe('useLibraryTitles — a delete on the Loader timing', () => {
  it('is idle and unfailed before a press', async () => {
    const { result } = await loaded();

    expect(result.current.deleting).toBe('idle');
    expect(result.current.deleteFailed).toBe(false);
  });

  it('is waiting at once, shown at 300ms, and takes the row off only after the hold', async () => {
    const { result } = await loaded();
    vi.useFakeTimers();

    act(() => {
      void result.current.deleteTitle(COCO);
    });
    expect(result.current.deleting).toBe('waiting');

    await advanceClock(299);
    expect(result.current.deleting).toBe('waiting');
    await advanceClock(1);
    expect(result.current.deleting).toBe('shown');

    await respond(noContentResponse());
    await advanceClock(499);
    expect(result.current.deleting).toBe('shown');
    expect(result.current.titles?.movies).toEqual([COCO]);

    await advanceClock(1);
    expect(result.current.deleting).toBe('idle');
    expect(result.current.titles?.movies).toEqual([]);
    expect(result.current.deleteFailed).toBe(false);
  });

  it('raises deleteFailed on a failure, after the hold, the list as it was', async () => {
    const { result } = await loaded();
    vi.useFakeTimers();

    act(() => {
      void result.current.deleteTitle(COCO);
    });
    await advanceClock(300);
    await respond(serverErrorResponse());
    await advanceClock(499);
    expect(result.current.deleteFailed).toBe(false);

    await advanceClock(1);
    expect(result.current.deleting).toBe('idle');
    expect(result.current.deleteFailed).toBe(true);
    expect(result.current.titles).toEqual(LISTED);
  });

  it('clears deleteFailed on the next confirm, before it is answered', async () => {
    const { result } = await loaded();
    vi.useFakeTimers();

    act(() => {
      void result.current.deleteTitle(COCO);
    });
    await respond(serverErrorResponse());
    await advanceClock(0);
    expect(result.current.deleteFailed).toBe(true);

    act(() => {
      void result.current.deleteTitle(COCO);
    });
    expect(result.current.deleteFailed).toBe(false);
    expect(result.current.deleting).toBe('waiting');

    await respond(noContentResponse());
    await advanceClock(0);
  });
});
