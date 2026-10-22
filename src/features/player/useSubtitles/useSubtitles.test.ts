import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import type { Cue, Subtitle } from '@/types';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { makeSettings } from '@/test-support/makeSettings/makeSettings';

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
 *
 * 15 — Settings hub, Phase 3: "the player honours the preference" (issue
 * #145) closes the slot log 10 left: the hook reads the household's
 * **Preferred subtitle language** through the shared `fetchSettings` when a
 * film opens and hands it to `preferredSubtitle`, which has known what to do
 * with one since it was written. The preference chooses; nobody picks — no
 * track picker ships. Never in the way of a film: until the settings land,
 * and if they never do, track order as before. The track is chosen once per
 * open, so a preference changed mid-film applies to the next film rather than
 * switching tracks under the family.
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

const SPANISH: Subtitle = {
  id: 's3',
  language: 'Spanish',
  position: 3,
  path: 'Northwind (2018)/northwind.es.srt',
};

const CUES: Cue[] = [
  { start: 1, end: 3, text: 'Good evening.' },
  { start: 5, end: 8, text: 'The light is out.' },
];

/** What `GET /api/settings` answers on a fresh database. */
const DEFAULT_SETTINGS = makeSettings();

let fetchMock: ReturnType<
  typeof vi.fn<(input: RequestInfo | URL) => Promise<Response>>
>;

/**
 * What the settings route answers this test — the household's preference. The
 * default is the server's own default, so a test with nothing to say about the
 * preference says nothing; one that has swaps the answer before rendering.
 */
let settingsAnswer: () => Promise<Response>;

beforeEach(() => {
  settingsAnswer = () => Promise.resolve(okResponse(DEFAULT_SETTINGS));
  fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();
  fetchMock.mockImplementation((input) =>
    String(input) === '/api/settings'
      ? settingsAnswer()
      : Promise.resolve(okResponse(CUES))
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Every **Cue list** the hook has asked for, by URL, in order. */
function cueRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/subtitles/'));
}

/** Every time the hook has asked for the household's settings. */
function settingsRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url === '/api/settings');
}

/** Lets every read in flight land — a macrotask drains the whole chain. */
async function settled(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/**
 * The hook, over a film's rows, at a position the test can move, under the
 * **Preferred subtitle language** the player's opening read handed it —
 * `undefined` for a read that was refused, or has not landed.
 */
function renderSubtitles(
  subtitles: Subtitle[] = [ENGLISH],
  position = 0,
  language: string | undefined = undefined
) {
  return renderHook(
    ({ at }) =>
      useSubtitles({
        playable: { kind: 'movie', id: 'm1' },
        subtitles,
        position: at,
        language,
      }),
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

    expect(cueRequests()).toHaveLength(0);
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

    expect(cueRequests()).toHaveLength(0);
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
    expect(cueRequests()).toHaveLength(1);
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
    expect(cueRequests()).toHaveLength(1);
  });

  it('asks for the chosen track of the film it was given, never the first row', async () => {
    const { result } = renderSubtitles([SWEDISH, ENGLISH]);

    act(() => result.current.toggleSubtitles());
    await waitFor(() => {
      expect(cueRequests()).toHaveLength(1);
    });

    expect(cueRequests()).toEqual(['/api/movies/m1/subtitles/s1']);
  });

  it('holds an empty list as a real answer and does not ask again', async () => {
    // `[]` is the file that would not parse, or the row whose file has gone.
    // It must not read as "not fetched yet" — that is a request per frame.
    fetchMock.mockResolvedValue(okResponse([]));
    const { result, rerender } = renderSubtitles([ENGLISH], 2);

    act(() => result.current.toggleSubtitles());
    await waitFor(() => {
      expect(cueRequests()).toHaveLength(1);
    });
    rerender({ at: 3 });
    rerender({ at: 4 });

    expect(result.current.line).toBeNull();
    expect(cueRequests()).toHaveLength(1);
  });
});

describe('useSubtitles — a fetch that goes wrong', () => {
  it('plays on with no box rather than throwing', async () => {
    // A bad subtitle file must never be able to interrupt the film.
    fetchMock.mockRejectedValue(new Error('boom'));
    const { result } = renderSubtitles([ENGLISH], 2);

    act(() => result.current.toggleSubtitles());
    await waitFor(() => {
      expect(cueRequests()).toHaveLength(1);
    });

    expect(result.current.subtitlesOn).toBe(true);
    expect(result.current.line).toBeNull();
  });
});

/**
 * 46 — Audio tracks, Phase 4: "the opening" (issue #402).
 *
 * The settings read moved into `useOpeningReads`, the player's third opening
 * read, so one open makes one `GET /api/settings`. The hook is handed the
 * **Preferred subtitle language** from it and asks for nothing of its own.
 * What the preference does is unchanged from issue #145: it chooses; nobody
 * picks; track order when there is none.
 */
describe('useSubtitles — the Preferred subtitle language', () => {
  it('opens on the Spanish row when the household prefers Spanish', () => {
    const { result } = renderSubtitles([ENGLISH, SPANISH], 0, 'Spanish');

    expect(result.current.track).toEqual(SPANISH);
  });

  it('shows the Spanish cues when CC is pressed', async () => {
    const { result } = renderSubtitles([ENGLISH, SPANISH], 2, 'Spanish');

    act(() => result.current.toggleSubtitles());

    await waitFor(() => {
      expect(result.current.line).toBe('Good evening.');
    });
    expect(cueRequests()).toEqual(['/api/movies/m1/subtitles/s3']);
  });

  it('opens on the first track when no row is in the preferred language', async () => {
    // A preference never hides subtitles that exist. English sits last here,
    // so a language from anywhere but the option would show.
    const englishLast: Subtitle = { ...ENGLISH, position: 9 };
    const { result } = renderSubtitles([englishLast, SWEDISH], 0, 'Spanish');
    await settled();

    expect(result.current.track).toEqual(SWEDISH);
  });

  it('treats Spanish and spanish as one language', () => {
    const taggedLower: Subtitle = { ...SPANISH, language: 'spanish' };
    const { result } = renderSubtitles([ENGLISH, taggedLower], 0, 'Spanish');

    expect(result.current.track).toEqual(taggedLower);
  });

  it('is track order with no preference, and CC still works', async () => {
    // The opening read was refused: no preference — not English — and the
    // film plays on.
    const englishLast: Subtitle = { ...ENGLISH, position: 9 };
    const { result } = renderSubtitles([englishLast, SWEDISH], 2, undefined);
    await settled();

    expect(result.current.track).toEqual(SWEDISH);

    act(() => result.current.toggleSubtitles());

    await waitFor(() => {
      expect(result.current.line).toBe('Good evening.');
    });
  });

  it('makes no settings read of its own', async () => {
    // The player's opening read is the one `GET /api/settings` an open makes.
    const { result } = renderSubtitles([ENGLISH, SPANISH], 2, 'Spanish');
    act(() => result.current.toggleSubtitles());
    await settled();

    expect(settingsRequests()).toEqual([]);
  });

  it('makes no settings read of its own without a preference either', async () => {
    renderSubtitles([ENGLISH, SPANISH], 0, undefined);
    await settled();

    expect(settingsRequests()).toEqual([]);
  });
});
