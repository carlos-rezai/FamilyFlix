import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useLibraryFolders } from './useLibraryFolders';
import type { LibraryFolder } from '@/types';
import {
  createdResponse,
  noContentResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 30 — Library folders, Phase 1: "a remembered list, end to end" (issue #268).
 *
 * `useLibraryFolders()` → `{ folders, add, remove, adding, refusal }`: the
 * **Library folders** the page draws, read once on mount and `null` until the
 * read lands — **Blank until it lands**, every Settings read's rule. An add
 * posts one path, appends the route's echo and clears the refusal; refused,
 * it holds the route's own sentence and keeps the list as it was. A remove
 * deletes the folder and drops its row.
 *
 * Asserted as requests against a stubbed `fetch` and what the hook hands
 * back.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const MOVIES: LibraryFolder = {
  id: 'f-movies',
  path: 'E:\\Movies',
  titleCount: 12,
  reachable: true,
};

const KIDS: LibraryFolder = {
  id: 'f-kids',
  path: 'D:\\Kids',
  titleCount: 0,
  reachable: true,
};

/** A refusal the route words: `{ error }` under its status. */
function refusedResponse(status: number, error: string): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  } as unknown as Response;
}

/** `fetch` answering by method: the list on GET, the given answers after. */
function routeFetch(
  listed: LibraryFolder[],
  answers: { post?: Response; delete?: Response } = {}
) {
  fetchMock.mockImplementation((_input, init) => {
    const method = init?.method ?? 'GET';
    if (method === 'POST' && answers.post) {
      return Promise.resolve(answers.post);
    }
    if (method === 'DELETE' && answers.delete) {
      return Promise.resolve(answers.delete);
    }
    return Promise.resolve(okResponse(listed));
  });
}

/** The calls made with `method`, as `[url, init]`. */
const callsWith = (method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method);

describe('useLibraryFolders — the read', () => {
  it('reads the list route once, on mount', async () => {
    routeFetch([MOVIES]);

    const { rerender } = renderHook(() => useLibraryFolders());
    rerender();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/library-folders');
  });

  it('holds folders null until the read lands', () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));

    const { result } = renderHook(() => useLibraryFolders());

    expect(result.current.folders).toBeNull();
    expect(result.current.refusal).toBeNull();
    expect(result.current.adding).toBe(false);
  });

  it('hands over the list once it lands', async () => {
    routeFetch([MOVIES, KIDS]);

    const { result } = renderHook(() => useLibraryFolders());

    await waitFor(() => expect(result.current.folders).toEqual([MOVIES, KIDS]));
  });
});

describe('useLibraryFolders — add', () => {
  it('posts the one path it is given', async () => {
    routeFetch([], { post: createdResponse(KIDS) });
    const { result } = renderHook(() => useLibraryFolders());
    await waitFor(() => expect(result.current.folders).toEqual([]));

    await act(async () => {
      await result.current.add('D:\\Kids');
    });

    const [post] = callsWith('POST');
    expect(String(post?.[0])).toBe('/api/library-folders');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ path: 'D:\\Kids' });
  });

  it('appends the echo to the list', async () => {
    routeFetch([MOVIES], { post: createdResponse(KIDS) });
    const { result } = renderHook(() => useLibraryFolders());
    await waitFor(() => expect(result.current.folders).toEqual([MOVIES]));

    await act(async () => {
      await result.current.add('D:\\Kids');
    });

    expect(result.current.folders).toEqual([MOVIES, KIDS]);
  });

  it('holds the route’s sentence when refused, and keeps the list', async () => {
    const sentence =
      'That folder is inside E:\\Movies, which is already a library folder.';
    routeFetch([MOVIES], { post: refusedResponse(409, sentence) });
    const { result } = renderHook(() => useLibraryFolders());
    await waitFor(() => expect(result.current.folders).toEqual([MOVIES]));

    await act(async () => {
      await result.current.add('E:\\Movies\\Kids');
    });

    expect(result.current.refusal).toBe(sentence);
    expect(result.current.folders).toEqual([MOVIES]);
  });

  it('holds a 400’s sentence the same way', async () => {
    routeFetch([], { post: refusedResponse(400, 'No folder at that path.') });
    const { result } = renderHook(() => useLibraryFolders());
    await waitFor(() => expect(result.current.folders).toEqual([]));

    await act(async () => {
      await result.current.add('Z:\\Gone');
    });

    expect(result.current.refusal).toBe('No folder at that path.');
    expect(result.current.folders).toEqual([]);
  });

  it('clears the refusal on the next add that lands', async () => {
    routeFetch([MOVIES], {
      post: refusedResponse(
        409,
        'That folder is already in your library folders.'
      ),
    });
    const { result } = renderHook(() => useLibraryFolders());
    await waitFor(() => expect(result.current.folders).toEqual([MOVIES]));
    await act(async () => {
      await result.current.add('E:\\Movies');
    });
    expect(result.current.refusal).not.toBeNull();

    routeFetch([MOVIES], { post: createdResponse(KIDS) });
    await act(async () => {
      await result.current.add('D:\\Kids');
    });

    expect(result.current.refusal).toBeNull();
    expect(result.current.folders).toEqual([MOVIES, KIDS]);
  });

  it('is adding while the post is out, and not after', async () => {
    let answer: (response: Response) => void = () => undefined;
    routeFetch([]);
    const { result } = renderHook(() => useLibraryFolders());
    await waitFor(() => expect(result.current.folders).toEqual([]));
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        })
    );

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.add('D:\\Kids');
    });
    await waitFor(() => expect(result.current.adding).toBe(true));

    await act(async () => {
      answer(createdResponse(KIDS));
      await pending;
    });

    expect(result.current.adding).toBe(false);
  });
});

describe('useLibraryFolders — remove', () => {
  it('deletes the folder by its id and drops its row', async () => {
    routeFetch([MOVIES, KIDS], { delete: noContentResponse() });
    const { result } = renderHook(() => useLibraryFolders());
    await waitFor(() => expect(result.current.folders).toEqual([MOVIES, KIDS]));

    await act(async () => {
      await result.current.remove(MOVIES.id);
    });

    const [del] = callsWith('DELETE');
    expect(String(del?.[0])).toBe('/api/library-folders/f-movies');
    expect(result.current.folders).toEqual([KIDS]);
  });
});
