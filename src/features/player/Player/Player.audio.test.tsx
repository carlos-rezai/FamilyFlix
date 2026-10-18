import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { PlayerScreen } from '../PlayerScreen/PlayerScreen';
import { theme } from '@/styles/theme';
import type {
  AudioTrack,
  Cue,
  EpisodeRead,
  Movie,
  PlaybackRead,
  Playable,
  Settings,
  Subtitle,
} from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeEpisode } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';

/**
 * 46 — Audio tracks, Phase 4: "the opening" (issue #402).
 *
 * The player opens a film or an episode already on the right **Audio track**.
 * The household's settings are the third opening read; the element is pointed
 * once, after that read has settled, at the track `preferredAudio` chose —
 * the **Preferred audio language**, else the file's default, else the first.
 * The source carries `?a=` only when the index is not nought, so a single-track
 * film, a silent one, and an English-first MP4 opened in English all open on
 * exactly the URL they always did.
 *
 * Asserted from outside, as `Player.test.tsx` is: the requests made, and the
 * `src` the element is given — including that it is given it once.
 */

const MOVIE_ID = 'm1';
const EPISODE_ID = 'e24';

const SUBTITLE_EN: Subtitle = {
  id: 's-en',
  language: 'English',
  position: 0,
  path: 'Northwind (1994)/northwind.en.srt',
};

const SUBTITLE_ES: Subtitle = {
  id: 's-es',
  language: 'Spanish',
  position: 1,
  path: 'Northwind (1994)/northwind.es.srt',
};

const CUES: Cue[] = [{ start: 0, end: 30, text: 'Buenas noches.' }];

const NORTHWIND: Movie = makeMovie({
  id: MOVIE_ID,
  title: 'Northwind',
  year: 1994,
  videoPath: 'Northwind (1994)/northwind.mp4',
  subtitles: [SUBTITLE_EN, SUBTITLE_ES],
});

function track(overrides: Partial<AudioTrack>): AudioTrack {
  return {
    index: 0,
    language: 'English',
    label: 'English',
    fileDefault: false,
    path: 'direct',
    ...overrides,
  };
}

const ENGLISH = track({ index: 0, fileDefault: true });
const SPANISH = track({
  index: 1,
  language: 'Spanish',
  label: 'Spanish',
  path: 'remux',
});

/** A native MP4 in English first and Spanish second. */
const ENGLISH_SPANISH: PlaybackRead = {
  path: 'direct',
  durationSeconds: 6832.5,
  audioTracks: [ENGLISH, SPANISH],
};

function household(overrides: Partial<Settings> = {}): Settings {
  return {
    subtitleLanguage: 'English',
    audioLanguage: 'English',
    ultrawideMargins: false,
    tmdbRatings: true,
    ...overrides,
  };
}

const SPANISH_HOUSEHOLD = household({
  subtitleLanguage: 'Spanish',
  audioLanguage: 'Spanish',
});

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  releaseSettings = () => undefined;
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
  answerWith({});
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Stand in for the routes an open touches, on whichever wire the playable
 * takes. `settings` is how the settings read answers — a thunk, so a test can
 * refuse it. The settings read is **held** until {@link releaseSettings} is
 * called, so every open can be asked whether it pointed anything first.
 */
/** Lets the held settings read answer, as `answerWith` was told it would. */
let releaseSettings: () => void = () => undefined;

function answerWith({
  movie = NORTHWIND,
  episode = makeRead(),
  playback = ENGLISH_SPANISH,
  settings = () => Promise.resolve(okResponse(household())),
}: {
  movie?: Movie;
  episode?: EpisodeRead;
  playback?: PlaybackRead;
  settings?: () => Promise<Response>;
}) {
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url === '/api/settings') {
      return new Promise<Response>((resolve, reject) => {
        releaseSettings = () => {
          settings().then(resolve, reject);
        };
      });
    }
    if (url === `/api/movies/${MOVIE_ID}`) {
      return Promise.resolve(okResponse(movie));
    }
    if (url === `/api/episodes/${EPISODE_ID}`) {
      return Promise.resolve(okResponse(episode));
    }
    if (url.endsWith('/playback')) {
      return Promise.resolve(okResponse(playback));
    }
    if (url.includes('/subtitles/')) {
      return Promise.resolve(okResponse(CUES));
    }
    if (url.endsWith('/resume') || url.endsWith('/watched')) {
      const body = (
        init?.body === undefined ? {} : JSON.parse(String(init.body))
      ) as { value?: unknown };
      return Promise.resolve(okResponse({ value: body.value }));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

function makeRead(): EpisodeRead {
  return {
    episode: {
      ...makeEpisode(2, 4),
      id: EPISODE_ID,
      seriesId: 'harbor',
      title: 'The Auction',
      videoPath: 'harbor-vine-2019/season-02/S02E04.mkv',
      watched: false,
      resumePositionSeconds: 0,
    },
    series: { id: 'harbor', title: 'Harbor & Vine' },
    next: null,
  };
}

/** Every time the screen asked for the household's settings. */
function settingsRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url === '/api/settings');
}

/** The query a source carries, read as parameters rather than spelled. */
function queryOf(src: string | null): URLSearchParams {
  return new URLSearchParams(src?.includes('?') ? src.split('?')[1] : '');
}

/**
 * The screen, with a watch kept over every `src` the element is ever given
 * after it mounts. The observer is attached before anything has loaded, so a
 * second load — the element pointed at the plain stream and then re-pointed at
 * the chosen track — leaves an attribute record behind it.
 */
function renderScreen(playable: Playable = { kind: 'movie', id: MOVIE_ID }) {
  const path =
    playable.kind === 'movie'
      ? `/movie/${playable.id}/play`
      : `/episode/${playable.id}/play`;
  const view = render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/', path]} initialIndex={1}>
        <Routes>
          <Route path="/" element={<span>Browse home</span>} />
          <Route
            path="/movie/:id/play"
            element={<PlayerScreen playable={playable} />}
          />
          <Route
            path="/episode/:id/play"
            element={<PlayerScreen playable={playable} />}
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );

  const repoints: MutationRecord[] = [];
  const observer = new MutationObserver((records) => {
    repoints.push(
      ...records.filter(
        (record) =>
          record.type === 'attributes' &&
          record.attributeName === 'src' &&
          record.target instanceof HTMLVideoElement
      )
    );
  });
  observer.observe(view.container, {
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
    attributeOldValue: true,
  });

  return { ...view, repoints, observer };
}

function pointedPicture(container: HTMLElement): HTMLVideoElement {
  const video = container.querySelector('video');
  if (video === null || !video.hasAttribute('src')) {
    throw new Error('The player pointed no picture');
  }
  return video;
}

/**
 * The player opened over a held settings read: the record and the playback
 * read land first, and the element must not be pointed at anything until the
 * settings read has settled too — the track it points at depends on it. Then
 * the read is let go, and the picture waited for.
 */
async function renderPlayer(playable?: Playable) {
  const view = renderScreen(playable);
  await settled();
  await settled();
  expect(view.container.querySelector('video[src]')).toBeNull();

  releaseSettings();
  const video = await waitFor(() => pointedPicture(view.container));
  return { ...view, video };
}

/** Lets every read in flight land — a macrotask drains the whole chain. */
async function settled(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('Player — nothing pointed before the settings settle', () => {
  stubMediaElement();

  it('points nothing while the settings read is still coming', async () => {
    answerWith({
      settings: () => Promise.resolve(okResponse(SPANISH_HOUSEHOLD)),
    });
    const { container } = renderScreen();
    await settled();
    await settled();

    // The record and the playback read have landed; which track to point at
    // has not.
    expect(container.querySelector('video[src]')).toBeNull();

    releaseSettings();

    const video = await waitFor(() => pointedPicture(container));
    expect(video.getAttribute('src')).toBe(
      `/api/movies/${MOVIE_ID}/stream?a=1`
    );
  });

  it('still opens when the settings read is refused, on the file’s default', async () => {
    // A refusal is no preference — not English. The file marks Spanish its
    // default here, so Spanish it is.
    answerWith({
      playback: {
        ...ENGLISH_SPANISH,
        audioTracks: [
          { ...ENGLISH, fileDefault: false },
          { ...SPANISH, fileDefault: true },
        ],
      },
      settings: () => Promise.resolve(serverErrorResponse()),
    });

    const { video } = await renderPlayer();

    expect(video.getAttribute('src')).toBe(
      `/api/movies/${MOVIE_ID}/stream?a=1`
    );
  });

  it('still opens when the settings read is refused, on the first track with no default', async () => {
    answerWith({
      playback: {
        ...ENGLISH_SPANISH,
        audioTracks: [{ ...ENGLISH, fileDefault: false }, SPANISH],
      },
      settings: () => Promise.reject(new Error('offline')),
    });

    const { video } = await renderPlayer();

    expect(video.getAttribute('src')).toBe(`/api/movies/${MOVIE_ID}/stream`);
  });
});

describe('Player — one settings read per open', () => {
  stubMediaElement();

  it('asks for the settings once, and the subtitles honour them', async () => {
    answerWith({
      settings: () => Promise.resolve(okResponse(SPANISH_HOUSEHOLD)),
    });
    const { video } = await renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));

    fireEvent.click(await screen.findByRole('button', { name: 'Subtitles' }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls
          .map(([input]) => String(input))
          .filter((url) => url.includes('/subtitles/'))
      ).toEqual([`/api/movies/${MOVIE_ID}/subtitles/${SUBTITLE_ES.id}`]);
    });
    await settled();
    expect(settingsRequests()).toHaveLength(1);
  });
});

describe('Player — the track it opens on', () => {
  stubMediaElement();

  it('opens an English/Spanish film on the Spanish track for a Spanish household, loaded once', async () => {
    answerWith({
      settings: () => Promise.resolve(okResponse(SPANISH_HOUSEHOLD)),
    });

    const { video, repoints } = await renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));
    await settled();

    expect(video.getAttribute('src')).toBe(
      `/api/movies/${MOVIE_ID}/stream?a=1`
    );
    // Pointed once, at the Spanish track: never at the plain stream first.
    expect(repoints).toEqual([]);
  });

  it('keeps an English-first MP4 opened in English on Direct play, with no a', async () => {
    answerWith({ settings: () => Promise.resolve(okResponse(household())) });

    const { video, repoints } = await renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));

    expect(video.getAttribute('src')).toBe(`/api/movies/${MOVIE_ID}/stream`);

    // Direct play: a seek winds the element and never re-points it.
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await settled();
    expect(video.getAttribute('src')).toBe(`/api/movies/${MOVIE_ID}/stream`);
    expect(repoints).toEqual([]);
  });

  it('opens a single-track film exactly as today', async () => {
    answerWith({
      playback: {
        path: 'transcode',
        durationSeconds: 5391.2,
        audioTracks: [
          track({ index: 0, language: 'Swedish', path: 'transcode' }),
        ],
      },
      settings: () => Promise.resolve(okResponse(SPANISH_HOUSEHOLD)),
    });

    const { video, repoints } = await renderPlayer();
    await settled();

    expect(video.getAttribute('src')).toBe(`/api/movies/${MOVIE_ID}/stream`);
    expect(repoints).toEqual([]);
  });

  it('opens a silent film exactly as today', async () => {
    answerWith({
      playback: { path: 'remux', durationSeconds: 5391.2, audioTracks: [] },
      settings: () => Promise.resolve(okResponse(SPANISH_HOUSEHOLD)),
    });

    const { video, repoints } = await renderPlayer();
    await settled();

    expect(video.getAttribute('src')).toBe(`/api/movies/${MOVIE_ID}/stream`);
    expect(repoints).toEqual([]);
  });

  it('resumes at the saved position on the preferred track', async () => {
    answerWith({
      movie: { ...NORTHWIND, resumePositionSeconds: 1800, watched: false },
      settings: () => Promise.resolve(okResponse(SPANISH_HOUSEHOLD)),
    });

    const { video } = await renderPlayer();

    await waitFor(() =>
      expect(queryOf(video.getAttribute('src')).get('t')).toBe('1800')
    );
    const src = video.getAttribute('src') ?? '';
    expect(src.split('?')[0]).toBe(`/api/movies/${MOVIE_ID}/stream`);
    expect(queryOf(src).get('a')).toBe('1');
  });
});

describe('Player — an episode, by the same rule', () => {
  stubMediaElement();

  it('opens an English/Spanish episode on the Spanish track for a Spanish household', async () => {
    answerWith({
      settings: () => Promise.resolve(okResponse(SPANISH_HOUSEHOLD)),
    });

    const { video, repoints } = await renderPlayer({
      kind: 'episode',
      id: EPISODE_ID,
    });
    await settled();

    expect(video.getAttribute('src')).toBe(
      `/api/episodes/${EPISODE_ID}/stream?a=1`
    );
    expect(repoints).toEqual([]);
    expect(settingsRequests()).toHaveLength(1);
  });

  it('opens an episode in English on the plain stream', async () => {
    answerWith({ settings: () => Promise.resolve(okResponse(household())) });

    const { video } = await renderPlayer({ kind: 'episode', id: EPISODE_ID });

    expect(video.getAttribute('src')).toBe(
      `/api/episodes/${EPISODE_ID}/stream`
    );
  });
});
