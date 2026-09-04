import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import type { Cue, Subtitle } from '@/types';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';

import { useSubtitles } from './useSubtitles';

/**
 * 10 — Video player refactor, Group G (issue #94).
 *
 * The whole of the **Player**'s subtitles, extracted from the screen: which
 * **Subtitle track**, whether the box is showing, and the line on it.
 *
 * The two rules worth their own file are the ones a screen test can only reach
 * sideways — that the **Cue list** is asked for **once** and held for the
 * session, however many times the pill is pressed and however far the film is
 * scrubbed; and that a film with no rows has no track, which is what the
 * pill's absence and the C key's are decided from.
 */

const ENGLISH: Subtitle = {
  id: 's1',
  language: 'English',
  position: 1,
  path: 'Northwind (2018)/northwind.en.srt',
};

const SWEDISH: Subtitle = {
  id: 's2',
  language: 'Swedish',
  position: 2,
  path: 'Northwind (2018)/northwind.sv.srt',
};

const CUES: Cue[] = [
  { start: 1, end: 3, text: 'Good evening.' },
  { start: 5, end: 8, text: 'The light is out.' },
];

let fetchMock: ReturnType<
  typeof vi.fn<(input: RequestInfo | URL) => Promise<Response>>
>;

beforeEach(() => {
  fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();
  fetchMock.mockResolvedValue(okResponse(CUES));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The hook, over a film's rows, at a position the test can move. */
function renderSubtitles(subtitles: Subtitle[] = [ENGLISH], position = 0) {
  return renderHook(
    ({ at }) => useSubtitles({ movieId: 'm1', subtitles, position: at }),
    { initialProps: { at: position } }
  );
}

describe('useSubtitles — which track', () => {
  it('chooses by track order, not by the order the rows arrived in', () => {
    // Determinism is the property that matters: a film that opened in Swedish
    // yesterday and English today is something the family cannot correct.
    const { result } = renderSubtitles([SWEDISH, ENGLISH]);

    expect(result.current.track).toEqual(ENGLISH);
  });

  it('has no track for a film with no subtitles', () => {
    // Which is what the CC pill's absence, and the C key's, are decided from.
    const { result } = renderSubtitles([]);

    expect(result.current.track).toBeNull();
  });
});

describe('useSubtitles — the box, off until it is asked for', () => {
  it('starts off on every film', () => {
    // The prototype's `playMovie()` sets `subsOn: true`. Shipping them off is a
    // recorded divergence: auto-on subtitles are a roadmap item, and defaulting
    // them on would implement it by accident.
    const { result } = renderSubtitles();

    expect(result.current.subtitlesOn).toBe(false);
    expect(result.current.line).toBeNull();
  });

  it('asks for nothing until the box is switched on', () => {
    renderSubtitles();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('draws the line covering the position once it is on', async () => {
    const { result } = renderSubtitles([ENGLISH], 2);

    act(() => result.current.toggleSubtitles());

    await waitFor(() => {
      expect(result.current.line).toBe('Good evening.');
    });
  });

  it('draws no box where no cue covers the position', async () => {
    const { result, rerender } = renderSubtitles([ENGLISH], 2);

    act(() => result.current.toggleSubtitles());
    await waitFor(() => {
      expect(result.current.line).toBe('Good evening.');
    });
    rerender({ at: 4 });

    expect(result.current.line).toBeNull();
  });

  it('draws nothing again when the box is switched off', async () => {
    const { result } = renderSubtitles([ENGLISH], 2);

    act(() => result.current.toggleSubtitles());
    await waitFor(() => {
      expect(result.current.line).toBe('Good evening.');
    });
    act(() => result.current.toggleSubtitles());

    expect(result.current.line).toBeNull();
  });

  it('never asks for a film that has no track to ask about', () => {
    const { result } = renderSubtitles([]);

    act(() => result.current.toggleSubtitles());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.line).toBeNull();
  });
});

describe('useSubtitles — the cue list is asked for once', () => {
  it('does not re-ask when the box is switched off and on again', async () => {
    const { result } = renderSubtitles([ENGLISH], 2);

    act(() => result.current.toggleSubtitles());
    await waitFor(() => {
      expect(result.current.line).toBe('Good evening.');
    });
    act(() => result.current.toggleSubtitles());
    act(() => result.current.toggleSubtitles());

    await waitFor(() => {
      expect(result.current.line).toBe('Good evening.');
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not re-ask on a seek', async () => {
    // Cues are stamped in **Absolute position**, so there is nothing about a
    // jump for them to be re-stamped against.
    const { result, rerender } = renderSubtitles([ENGLISH], 2);

    act(() => result.current.toggleSubtitles());
    await waitFor(() => {
      expect(result.current.line).toBe('Good evening.');
    });
    rerender({ at: 6 });

    expect(result.current.line).toBe('The light is out.');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('asks for the chosen track of the film it was given, never the first row', async () => {
    const { result } = renderSubtitles([SWEDISH, ENGLISH]);

    act(() => result.current.toggleSubtitles());
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      '/api/movies/m1/subtitles/s1'
    );
  });

  it('holds an empty list as a real answer and does not ask again', async () => {
    // `[]` is the file that would not parse, or the row whose file has gone.
    // It must not read as "not fetched yet" — that is a request per frame.
    fetchMock.mockResolvedValue(okResponse([]));
    const { result, rerender } = renderSubtitles([ENGLISH], 2);

    act(() => result.current.toggleSubtitles());
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });
    rerender({ at: 3 });
    rerender({ at: 4 });

    expect(result.current.line).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('useSubtitles — a fetch that goes wrong', () => {
  it('plays on with no box rather than throwing', async () => {
    // A bad subtitle file must never be able to interrupt the film.
    fetchMock.mockRejectedValue(new Error('boom'));
    const { result } = renderSubtitles([ENGLISH], 2);

    act(() => result.current.toggleSubtitles());
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(result.current.subtitlesOn).toBe(true);
    expect(result.current.line).toBeNull();
  });
});
