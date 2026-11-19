import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useLibraryFolders } from './useLibraryFolders';
import type { LibraryFolderView } from '@/types';
import {
  conflictResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';
import { makeLibraryFolder } from '@/test-support/makeLibraryFolder/makeLibraryFolder';

/**
 * 69, Silent waits, Phase 4 (issue #658): a Folder row's ✕ and _Bring back_
 * on the **Loader timing**, keyed by the folder.
 *
 * `rowPhase(id)` is `waiting` from the press, `shown` once the request has
 * run 300ms, and `idle` again only after the 500ms hold; the row's outcome
 * (dropped, its count zeroed, or its refusal sentence) lands with it. Every
 * other folder's phase stays its own.
 */

const MOVIES: LibraryFolderView = {
  ...makeLibraryFolder({ id: 'f-movies', path: 'E:\\Movies', titleCount: 3 }),
  leftOut: 2,
};

const KIDS: LibraryFolderView = {
  ...makeLibraryFolder({ id: 'f-kids', path: 'D:\\Kids', titleCount: 1 }),
  leftOut: 0,
};

const IN_USE = 'An import is reading that folder right now.';

const { fetchMock, respond } = heldFetch((_url, init) =>
  (init?.method ?? 'GET') === 'GET' ? okResponse([MOVIES, KIDS]) : undefined
);

afterEach(() => {
  vi.useRealTimers();
});

/** The hook with its list landed, on a faked clock from here on. */
async function landed() {
  const view = renderHook(() => useLibraryFolders());
  await waitFor(() => expect(view.result.current.folders).toHaveLength(2));
  vi.useFakeTimers();
  return view;
}

describe('useLibraryFolders: rowPhase on the Loader timing', () => {
  it('is idle for every folder before a press', async () => {
    const { result } = await landed();

    expect(result.current.rowPhase(MOVIES.id)).toBe('idle');
    expect(result.current.rowPhase(KIDS.id)).toBe('idle');
  });

  it('times a remove, dropping the row only once the hold is out', async () => {
    const { result } = await landed();
    let settled = false;
    act(() => {
      void result.current.remove(KIDS.id).then(() => {
        settled = true;
      });
    });

    expect(result.current.rowPhase(KIDS.id)).toBe('waiting');
    expect(result.current.rowPhase(MOVIES.id)).toBe('idle');

    await advanceClock(300);
    expect(result.current.rowPhase(KIDS.id)).toBe('shown');

    await advanceClock(100);
    await respond(okResponse({}));
    await advanceClock(399);
    expect(result.current.rowPhase(KIDS.id)).toBe('shown');
    expect(result.current.folders).toEqual([MOVIES, KIDS]);
    expect(settled).toBe(false);

    await advanceClock(1);
    expect(result.current.rowPhase(KIDS.id)).toBe('idle');
    expect(result.current.folders).toEqual([MOVIES]);
    expect(settled).toBe(true);
  });

  it('times a Bring back, zeroing the count only once the hold is out', async () => {
    const { result } = await landed();
    act(() => {
      void result.current.bringBack(MOVIES.id);
    });

    expect(result.current.rowPhase(MOVIES.id)).toBe('waiting');
    expect(result.current.rowPhase(KIDS.id)).toBe('idle');

    await advanceClock(400);
    expect(result.current.rowPhase(MOVIES.id)).toBe('shown');
    await respond(okResponse({}));

    await advanceClock(399);
    expect(result.current.folders?.[0].leftOut).toBe(2);

    await advanceClock(1);
    expect(result.current.rowPhase(MOVIES.id)).toBe('idle');
    expect(result.current.folders?.[0].leftOut).toBe(0);
  });

  it('puts a refused remove back with its sentence once the hold is out', async () => {
    const { result } = await landed();
    act(() => {
      void result.current.remove(KIDS.id);
    });

    await advanceClock(400);
    await respond(conflictResponse(IN_USE));

    await advanceClock(399);
    expect(result.current.rowPhase(KIDS.id)).toBe('shown');
    expect(result.current.removeRefusal).toBeNull();

    await advanceClock(1);
    expect(result.current.rowPhase(KIDS.id)).toBe('idle');
    expect(result.current.folders).toEqual([MOVIES, KIDS]);
    expect(result.current.removeRefusal).toEqual({
      id: KIDS.id,
      sentence: IN_USE,
    });
  });

  it('leaves another folder pressable while one works, each on its own clock', async () => {
    const { result } = await landed();
    act(() => {
      void result.current.remove(KIDS.id);
    });
    await advanceClock(300);

    act(() => {
      void result.current.bringBack(MOVIES.id);
    });

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(
      expect.arrayContaining([
        '/api/library-folders/f-kids',
        '/api/library-folders/f-movies/left-out',
      ])
    );
    expect(result.current.rowPhase(KIDS.id)).toBe('shown');
    expect(result.current.rowPhase(MOVIES.id)).toBe('waiting');
  });
});
