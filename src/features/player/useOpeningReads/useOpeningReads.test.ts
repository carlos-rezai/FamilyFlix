import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import type { Movie, PlaybackRead, Settings } from '@/types';
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

const DIRECT: PlaybackRead = {
  path: 'direct',
  durationSeconds: 6832.5,
  audioTracks: [],
};

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

/** What `GET /api/settings` answers on a fresh database. */
const DEFAULT_SETTINGS: Settings = {
  subtitleLanguage: 'English',
  audioLanguage: 'English',
  ultrawideMargins: false,
  tmdbRatings: true,
  startTab: 'movies',
};

/** Answer each of the three endpoints with what the test says it says. */
function serve(
  movie: Response,
  playback: Response,
  settings: () => Promise<Response> = () =>
    Promise.resolve(okResponse(DEFAULT_SETTINGS))
) {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url === '/api/settings') {
      return settings();
    }
    return Promise.resolve(url.endsWith('/playback') ? playback : movie);
  });
}

describe('useOpeningReads — both reads, as one moment', () => {
  it('has nothing to report before either read lands', async () => {
    serve(okResponse(MOVIE), okResponse(DIRECT));

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );

    expect(result.current).toEqual({
      movie: null,
      playback: null,
      settings: null,
      unavailable: null,
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

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );

    await waitFor(() => {
      expect(result.current.movie).toEqual(MOVIE);
    });
    expect(result.current.playback).toEqual(DIRECT);
    expect(result.current.unavailable).toBeNull();
  });

  it('asks for the film it was given, once each', async () => {
    serve(okResponse(MOVIE), okResponse(DIRECT));

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );
    await waitFor(() => {
      expect(result.current.movie).not.toBeNull();
    });

    const asked = fetchMock.mock.calls.map(([input]) => String(input));
    expect(asked).toHaveLength(3);
    expect(asked.filter((url) => url === '/api/settings')).toHaveLength(1);
    expect(asked.some((url) => url.endsWith('/api/movies/m1'))).toBe(true);
    expect(asked.some((url) => url.endsWith('/api/movies/m1/playback'))).toBe(
      true
    );
  });
});

describe('useOpeningReads — a film with no file behind it', () => {
  it('reports it as missing rather than as a failure', async () => {
    serve(okResponse(MOVIE), notFoundResponse('No video file for movie: m1'));

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );

    await waitFor(() => {
      expect(result.current.unavailable).toBe('missing-file');
    });
  });

  it('still reports the record, so the screen keeps the film’s name', async () => {
    // The notice says which film cannot be played, and the chrome still has a
    // title in it.
    serve(okResponse(MOVIE), notFoundResponse('No video file for movie: m1'));

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );

    await waitFor(() => {
      expect(result.current.movie).toEqual(MOVIE);
    });
  });
});

/**
 * 41 — Link or copy, Phase 6 (issue #346). A **Linked video** whose **Library
 * folder** can't be reached answers `503` on the playback read — an answer, like
 * the 404, and a different one: the folder is away, not the file gone.
 */
function unreachableResponse(): Response {
  return new Response(
    JSON.stringify({ error: "The video's Library folder is out of reach: m1" }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  );
}

describe('useOpeningReads — a film whose folder can’t be reached', () => {
  it('reports the folder out of reach, not the file missing', async () => {
    serve(okResponse(MOVIE), unreachableResponse());

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );

    await waitFor(() => {
      expect(result.current.unavailable).toBe('unreachable');
    });
    expect(result.current.playback).toBeNull();
  });

  it('still reports the record, and is settled', async () => {
    serve(okResponse(MOVIE), unreachableResponse());

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );

    await waitFor(() => {
      expect(result.current.opened).toBe(true);
    });
    expect(result.current.movie).toEqual(MOVIE);
    expect(result.current.unavailable).toBe('unreachable');
  });

  it('keeps a 404 a missing file, with the folder not reported away', async () => {
    serve(okResponse(MOVIE), notFoundResponse('No video file for movie: m1'));

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );

    await waitFor(() => {
      expect(result.current.unavailable).toBe('missing-file');
    });
  });
});

describe('useOpeningReads — a read that went wrong', () => {
  it('is not a film with no file', async () => {
    // The difference the whole `null`-for-404 arrangement exists to keep: a
    // backend hiccup must not draw the notice that says the disc is gone.
    serve(okResponse(MOVIE), serverErrorResponse());

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    expect(result.current.unavailable).toBeNull();
    expect(result.current.playback).toBeNull();
  });

  it('reports nothing at all rather than half of it', async () => {
    // `Promise.all`: one read failing takes the pair with it, so the screen
    // never draws a title beside a duration that belongs to nothing.
    serve(serverErrorResponse(), okResponse(DIRECT));

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
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

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );

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

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );

    await waitFor(() => {
      expect(result.current.opened).toBe(true);
    });
  });

  it('is open for a film with no file behind it', async () => {
    // The 404 is an answer. The screen has its notice and stops waiting.
    serve(okResponse(MOVIE), notFoundResponse('No video file for movie: m1'));

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );

    await waitFor(() => {
      expect(result.current.opened).toBe(true);
    });
    expect(result.current.unavailable).toBe('missing-file');
  });

  it('is open when a read went wrong, because settled is settled', async () => {
    // The one that matters most. A read that failed outright leaves `playback`
    // null for good — the same null it holds before the read lands — so a
    // screen gated on the read having a value would wait for the rest of the
    // evening. However they settled, they have settled.
    serve(okResponse(MOVIE), serverErrorResponse());

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );

    await waitFor(() => {
      expect(result.current.opened).toBe(true);
    });
    expect(result.current.playback).toBeNull();
    expect(result.current.unavailable).toBeNull();
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

    const { result, unmount } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );
    unmount();
    answer(okResponse(DIRECT));

    await Promise.resolve();
    expect(result.current.playback).toBeNull();
  });
});

/**
 * 46 — Audio tracks, Phase 4: "the opening" (issue #402).
 *
 * The household's settings become the third opening read. The **Preferred
 * audio language** decides which track the element is pointed at, so the
 * element may not be pointed until that read has **settled** — landed or
 * refused. A refusal is no preference, and the film still opens. The
 * subtitles take their language from the same read, so an open asks for the
 * settings once.
 */
describe('useOpeningReads — the household’s settings', () => {
  const SPANISH_HOUSEHOLD: Settings = {
    ...DEFAULT_SETTINGS,
    subtitleLanguage: 'Spanish',
    audioLanguage: 'Spanish',
  };

  it('reports the settings beside the record and the playback read', async () => {
    serve(okResponse(MOVIE), okResponse(DIRECT), () =>
      Promise.resolve(okResponse(SPANISH_HOUSEHOLD))
    );

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );

    await waitFor(() => {
      expect(result.current.opened).toBe(true);
    });
    expect(result.current.settings).toEqual(SPANISH_HOUSEHOLD);
    expect(result.current.movie).toEqual(MOVIE);
    expect(result.current.playback).toEqual(DIRECT);
  });

  it('asks for the settings once per open', async () => {
    serve(okResponse(MOVIE), okResponse(DIRECT));

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );
    await waitFor(() => {
      expect(result.current.opened).toBe(true);
    });

    const asked = fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url === '/api/settings');
    expect(asked).toHaveLength(1);
  });

  it('is not open while the settings read is still coming', async () => {
    // The record and the playback read have both answered; the settings have
    // not. Nothing may be pointed yet — which track to point at is still
    // unknown.
    let answer: (value: Response) => void = () => undefined;
    serve(
      okResponse(MOVIE),
      okResponse(DIRECT),
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        })
    );

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.opened).toBe(false);

    answer(okResponse(SPANISH_HOUSEHOLD));
    await waitFor(() => {
      expect(result.current.opened).toBe(true);
    });
    expect(result.current.settings).toEqual(SPANISH_HOUSEHOLD);
  });

  it('still opens when the settings read is refused, with no preference', async () => {
    serve(okResponse(MOVIE), okResponse(DIRECT), () =>
      Promise.resolve(serverErrorResponse())
    );

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );

    await waitFor(() => {
      expect(result.current.opened).toBe(true);
    });
    expect(result.current.settings).toBeNull();
    // A refused preference takes nothing else with it.
    expect(result.current.movie).toEqual(MOVIE);
    expect(result.current.playback).toEqual(DIRECT);
    expect(result.current.unavailable).toBeNull();
  });

  it('still opens when the settings route cannot be reached', async () => {
    serve(okResponse(MOVIE), okResponse(DIRECT), () =>
      Promise.reject(new Error('offline'))
    );

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'movie', id: 'm1' })
    );

    await waitFor(() => {
      expect(result.current.opened).toBe(true);
    });
    expect(result.current.settings).toBeNull();
    expect(result.current.playback).toEqual(DIRECT);
  });

  it('reads the settings for an episode too', async () => {
    serve(
      okResponse({ episode: null, series: null, next: null }),
      okResponse(DIRECT),
      () => Promise.resolve(okResponse(SPANISH_HOUSEHOLD))
    );

    const { result } = renderHook(() =>
      useOpeningReads({ kind: 'episode', id: 'e1' })
    );

    await waitFor(() => {
      expect(result.current.opened).toBe(true);
    });
    expect(result.current.settings).toEqual(SPANISH_HOUSEHOLD);
  });
});
