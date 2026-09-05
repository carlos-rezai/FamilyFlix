import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import type { Movie, PlaybackRead } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

import { useOpeningReads } from './useOpeningReads';

/**
 * 10 — Video player refactor, Group G (issue #94).
 *
 * The two reads the **Player** opens with, extracted from the screen because
 * they are one moment: the record — for the name, the artwork, and where the
 * film was left — and the **Playback read**, for the path and the duration.
 *
 * The rule worth its own file is the one about a film with no file behind it.
 * `GET /playback` answers 404 for that, and `fetchPlayback` resolves it as
 * `null` rather than throwing, precisely so this hook can tell it apart from a
 * request that went wrong — which is what makes the missing-file notice
 * reachable at all, and what keeps a backend hiccup from drawing it.
 */

const MOVIE: Movie = makeMovie({ id: 'm1', title: 'Northwind' });

const DIRECT: PlaybackRead = { path: 'direct', durationSeconds: 6832.5 };

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Answer each of the two endpoints with what the test says it says. */
function serve(movie: Response, playback: Response) {
  fetchMock.mockImplementation((input) =>
    Promise.resolve(String(input).endsWith('/playback') ? playback : movie)
  );
}

describe('useOpeningReads — both reads, as one moment', () => {
  it('has nothing to report before either read lands', async () => {
    serve(okResponse(MOVIE), okResponse(DIRECT));

    const { result } = renderHook(() => useOpeningReads('m1'));

    expect(result.current).toEqual({
      movie: null,
      playback: null,
      fileMissing: false,
      opened: false,
    });

    // Let the reads land before the test ends, so the state they set belongs
    // to this test rather than arriving during the next one.
    await waitFor(() => {
      expect(result.current.movie).not.toBeNull();
    });
  });

  it('reports the record and the playback read together', async () => {
    serve(okResponse(MOVIE), okResponse(DIRECT));

    const { result } = renderHook(() => useOpeningReads('m1'));

    await waitFor(() => {
      expect(result.current.movie).toEqual(MOVIE);
    });
    expect(result.current.playback).toEqual(DIRECT);
    expect(result.current.fileMissing).toBe(false);
  });

  it('asks for the film it was given, once each', async () => {
    serve(okResponse(MOVIE), okResponse(DIRECT));

    const { result } = renderHook(() => useOpeningReads('m1'));
    await waitFor(() => {
      expect(result.current.movie).not.toBeNull();
    });

    const asked = fetchMock.mock.calls.map(([input]) => String(input));
    expect(asked).toHaveLength(2);
    expect(asked.some((url) => url.endsWith('/api/movies/m1'))).toBe(true);
    expect(asked.some((url) => url.endsWith('/api/movies/m1/playback'))).toBe(
      true
    );
  });
});

describe('useOpeningReads — a film with no file behind it', () => {
  it('reports it as missing rather than as a failure', async () => {
    serve(okResponse(MOVIE), notFoundResponse('No video file for movie: m1'));

    const { result } = renderHook(() => useOpeningReads('m1'));

    await waitFor(() => {
      expect(result.current.fileMissing).toBe(true);
    });
  });

  it('still reports the record, so the screen keeps the film’s name', async () => {
    // The notice says which film cannot be played, and the chrome still has a
    // title in it.
    serve(okResponse(MOVIE), notFoundResponse('No video file for movie: m1'));

    const { result } = renderHook(() => useOpeningReads('m1'));

    await waitFor(() => {
      expect(result.current.movie).toEqual(MOVIE);
    });
  });
});

describe('useOpeningReads — a read that went wrong', () => {
  it('is not a film with no file', async () => {
    // The difference the whole `null`-for-404 arrangement exists to keep: a
    // backend hiccup must not draw the notice that says the disc is gone.
    serve(okResponse(MOVIE), serverErrorResponse());

    const { result } = renderHook(() => useOpeningReads('m1'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(result.current.fileMissing).toBe(false);
    expect(result.current.playback).toBeNull();
  });

  it('reports nothing at all rather than half of it', async () => {
    // `Promise.all`: one read failing takes the pair with it, so the screen
    // never draws a title beside a duration that belongs to nothing.
    serve(serverErrorResponse(), okResponse(DIRECT));

    const { result } = renderHook(() => useOpeningReads('m1'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(result.current.movie).toBeNull();
    expect(result.current.playback).toBeNull();
  });
});

describe('useOpeningReads — whether the screen is still waiting', () => {
  /**
   * Issue #95. The **Player** may not point an element at the stream before it
   * knows what it is pointing at: a film with no file behind it and one nothing
   * can decode are both films the element must never be given, and both are
   * only known once the **Playback read** answers.
   *
   * Neither flag can carry that on its own. Both are `false` before the read
   * lands and `false` for a film that plays, so the screen cannot tell "not
   * yet" from "fine". `opened` is the third thing: whether there is still an
   * answer coming.
   */

  /** A playback read that answers only when the test says so. */
  function servePending(): (value: Response) => void {
    let answer: (value: Response) => void = () => undefined;
    fetchMock.mockImplementation((input) =>
      String(input).endsWith('/playback')
        ? new Promise<Response>((resolve) => {
            answer = resolve;
          })
        : Promise.resolve(okResponse(MOVIE))
    );
    return (value) => answer(value);
  }

  it('is not open while an answer is still coming', async () => {
    const answer = servePending();

    const { result } = renderHook(() => useOpeningReads('m1'));

    expect(result.current.opened).toBe(false);

    // Let the pair settle before the test ends, so the state it sets belongs to
    // this test rather than arriving during the next one.
    answer(okResponse(DIRECT));
    await waitFor(() => {
      expect(result.current.opened).toBe(true);
    });
  });

  it('is open once both reads have landed', async () => {
    serve(okResponse(MOVIE), okResponse(DIRECT));

    const { result } = renderHook(() => useOpeningReads('m1'));

    await waitFor(() => {
      expect(result.current.opened).toBe(true);
    });
  });

  it('is open for a film with no file behind it', async () => {
    // The 404 is an answer. The screen has its notice and stops waiting.
    serve(okResponse(MOVIE), notFoundResponse('No video file for movie: m1'));

    const { result } = renderHook(() => useOpeningReads('m1'));

    await waitFor(() => {
      expect(result.current.opened).toBe(true);
    });
    expect(result.current.fileMissing).toBe(true);
  });

  it('is open when a read went wrong, because settled is settled', async () => {
    // The one that matters most. A read that failed outright leaves `playback`
    // null for good — the same null it holds before the read lands — so a
    // screen gated on the read having a value would wait for the rest of the
    // evening. However they settled, they have settled.
    serve(okResponse(MOVIE), serverErrorResponse());

    const { result } = renderHook(() => useOpeningReads('m1'));

    await waitFor(() => {
      expect(result.current.opened).toBe(true);
    });
    expect(result.current.playback).toBeNull();
    expect(result.current.fileMissing).toBe(false);
  });
});

describe('useOpeningReads — leaving before the answer arrives', () => {
  it('reports nothing after the screen has gone', async () => {
    // A parent who opens the player and steps straight back out. Setting state
    // on the way out is the warning nobody reads and the leak everybody keeps.
    let answer: (value: Response) => void = () => undefined;
    fetchMock.mockImplementation((input) =>
      String(input).endsWith('/playback')
        ? new Promise<Response>((resolve) => {
            answer = resolve;
          })
        : Promise.resolve(okResponse(MOVIE))
    );

    const { result, unmount } = renderHook(() => useOpeningReads('m1'));
    unmount();
    answer(okResponse(DIRECT));

    await Promise.resolve();
    expect(result.current.playback).toBeNull();
  });
});
