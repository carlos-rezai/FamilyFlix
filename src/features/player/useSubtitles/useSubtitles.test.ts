import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import type { Cue, Settings, Subtitle } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

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
const DEFAULT_SETTINGS: Settings = { subtitleLanguage: 'English' };

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
 * 15 — Settings hub, Phase 3 (issue #145).
 *
 * The slot log 10 left closes: the hook reads the household's **Preferred
 * subtitle language** through the shared `fetchSettings` when a film opens and
 * hands it to `preferredSubtitle`, which has known what to do with one since it
 * was written. The preference chooses; nobody picks — no track picker ships.
 *
 * Never in the way of a film: until the settings land, and if they never do,
 * track order as before. The track is chosen once per open, so a preference
 * changed mid-film applies to the next film rather than switching tracks under
 * the family.
 */
describe('useSubtitles — the Preferred subtitle language', () => {
  it('opens on the Spanish row when the household prefers Spanish', async () => {
    settingsAnswer = () =>
      Promise.resolve(okResponse({ subtitleLanguage: 'Spanish' }));
    const { result } = renderSubtitles([ENGLISH, SPANISH]);

    await waitFor(() => {
      expect(result.current.track).toEqual(SPANISH);
    });
  });

  it('shows the Spanish cues when CC is pressed', async () => {
    // The dropdown on Settings changes what pressing CC shows — which is the
    // cue list of the chosen row, not the first one.
    settingsAnswer = () =>
      Promise.resolve(okResponse({ subtitleLanguage: 'Spanish' }));
    const { result } = renderSubtitles([ENGLISH, SPANISH], 2);
    await waitFor(() => {
      expect(result.current.track).toEqual(SPANISH);
    });

    act(() => result.current.toggleSubtitles());

    await waitFor(() => {
      expect(result.current.line).toBe('Good evening.');
    });
    expect(cueRequests()).toEqual(['/api/movies/m1/subtitles/s3']);
  });

  it('opens on the first track when no row is in the preferred language', async () => {
    // A preference never hides subtitles that exist.
    settingsAnswer = () =>
      Promise.resolve(okResponse({ subtitleLanguage: 'Spanish' }));
    const { result } = renderSubtitles([SWEDISH, ENGLISH]);
    await settled();

    expect(settingsRequests()).toHaveLength(1);
    expect(result.current.track).toEqual(ENGLISH);
  });

  it('treats Spanish and spanish as one language', async () => {
    // A track the importer tagged in another case still counts.
    settingsAnswer = () =>
      Promise.resolve(okResponse({ subtitleLanguage: 'Spanish' }));
    const taggedLower: Subtitle = { ...SPANISH, language: 'spanish' };
    const { result } = renderSubtitles([ENGLISH, taggedLower]);

    await waitFor(() => {
      expect(result.current.track).toEqual(taggedLower);
    });
  });

  it('is track order before the settings land, and the film does not wait', () => {
    // The read goes out on open; the film opens on it landing or not.
    settingsAnswer = () => new Promise<Response>(() => undefined);
    const { result } = renderSubtitles([SPANISH, ENGLISH]);

    expect(settingsRequests()).toHaveLength(1);
    expect(result.current.track).toEqual(ENGLISH);
  });

  it('is track order when the read is refused, and CC still works', async () => {
    settingsAnswer = () => Promise.resolve(serverErrorResponse());
    const { result } = renderSubtitles([SPANISH, ENGLISH], 2);
    await settled();

    expect(settingsRequests()).toHaveLength(1);
    expect(result.current.track).toEqual(ENGLISH);

    act(() => result.current.toggleSubtitles());

    await waitFor(() => {
      expect(result.current.line).toBe('Good evening.');
    });
  });

  it('is track order when the settings route is unreachable', async () => {
    // The player behaves exactly as it does now: no delay, no throw, no box
    // that was not asked for.
    settingsAnswer = () => Promise.reject(new Error('offline'));
    const { result } = renderSubtitles([SPANISH, ENGLISH]);
    await settled();

    expect(settingsRequests()).toHaveLength(1);
    expect(result.current.track).toEqual(ENGLISH);
    expect(result.current.subtitlesOn).toBe(false);
  });

  it('does not re-choose the track when the preference changes mid-film', async () => {
    settingsAnswer = () =>
      Promise.resolve(okResponse({ subtitleLanguage: 'Spanish' }));
    const { result, rerender, unmount } = renderSubtitles(
      [ENGLISH, SWEDISH, SPANISH],
      2
    );
    await waitFor(() => {
      expect(result.current.track).toEqual(SPANISH);
    });

    // The household changes its mind while the film plays: a seek, the box
    // pressed on and off — nothing about the film asks again.
    settingsAnswer = () =>
      Promise.resolve(okResponse({ subtitleLanguage: 'Swedish' }));
    rerender({ at: 40 });
    act(() => result.current.toggleSubtitles());
    act(() => result.current.toggleSubtitles());
    await settled();

    expect(result.current.track).toEqual(SPANISH);
    expect(settingsRequests()).toHaveLength(1);

    // The next film opens on the new preference.
    unmount();
    const next = renderSubtitles([ENGLISH, SWEDISH, SPANISH]);

    await waitFor(() => {
      expect(next.result.current.track).toEqual(SWEDISH);
    });
  });
});
