import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';

import PlayerPage from '@/pages/PlayerPage/PlayerPage';
import { theme } from '@/styles/theme';
import type {
  AudioTrack,
  Episode,
  EpisodeRead,
  PlaybackRead,
  Settings,
} from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';

/**
 * 46 — Audio tracks, Phase 6: "the sitting" (issue #404).
 *
 * The **Audio choice** — the language of the track last picked by hand — held
 * by the **Fullscreen surface** and handed to each player it keys, so _Play
 * now_ and the end-of-file advance open the next episode on its own track in
 * that language. Leaving the player forgets it, and it is never posted.
 *
 * Asserted from outside, through the route: the `src` each episode's element
 * is pointed at, and the requests the screen makes.
 */

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
const spanishAt = (index: number) =>
  track({ index, language: 'Spanish', label: 'Spanish', path: 'remux' });
const frenchAt = (index: number) =>
  track({ index, language: 'French', label: 'French', path: 'remux' });

function playbackOf(audioTracks: AudioTrack[]): PlaybackRead {
  return { path: 'direct', durationSeconds: 2640, audioTracks };
}

/** S02E04: English first, Spanish second. */
const E24_TRACKS = playbackOf([ENGLISH, spanishAt(1)]);
/** S02E05: English, French, then Spanish third — its Spanish sits elsewhere. */
const E25_TRACKS = playbackOf([ENGLISH, frenchAt(1), spanishAt(2)]);
/** S02E06, with no Spanish dub at all. */
const E26_NO_SPANISH = playbackOf([ENGLISH, frenchAt(1)]);
/** The film opened after leaving: English first, Spanish second. */
const FILM_TRACKS = playbackOf([ENGLISH, spanishAt(1)]);

function makeEpisode(overrides: Partial<Episode>): Episode {
  return {
    id: 'e24',
    seriesId: 'harbor',
    season: 2,
    number: 4,
    title: 'The Auction',
    airDate: null,
    runtimeMinutes: 44,
    watched: false,
    resumePositionSeconds: 0,
    status: 'unwatched',
    videoPath: 'harbor-vine-2019/season-02/S02E04.mp4',
    videoFolderId: null,
    stillPath: null,
    sourceFile: null,
    subtitles: [],
    lastWatchedAt: null,
    ...overrides,
  };
}

const READS: Record<string, EpisodeRead> = {
  e24: {
    episode: makeEpisode({ id: 'e24' }),
    series: { id: 'harbor', title: 'Harbor & Vine' },
    next: {
      id: 'e25',
      season: 2,
      number: 5,
      title: 'Low Tide',
      stillPath: null,
    },
  },
  e25: {
    episode: makeEpisode({ id: 'e25', number: 5, title: 'Low Tide' }),
    series: { id: 'harbor', title: 'Harbor & Vine' },
    next: {
      id: 'e26',
      season: 2,
      number: 6,
      title: 'Dry Dock',
      stillPath: null,
    },
  },
  e26: {
    episode: makeEpisode({ id: 'e26', number: 6, title: 'Dry Dock' }),
    series: { id: 'harbor', title: 'Harbor & Vine' },
    next: null,
  },
};

function household(overrides: Partial<Settings> = {}): Settings {
  return {
    subtitleLanguage: 'English',
    audioLanguage: 'English',
    ultrawideMargins: false,
    tmdbRatings: true,
    startTab: 'movies',
    ...overrides,
  };
}

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

function answerWith({
  playback = { e24: E24_TRACKS, e25: E25_TRACKS, e26: E26_NO_SPANISH },
  settings = household(),
}: {
  playback?: Record<string, PlaybackRead>;
  settings?: Settings;
} = {}) {
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url === '/api/settings') {
      return Promise.resolve(okResponse(settings));
    }
    if (url.startsWith('/api/settings/')) {
      const body = (
        init?.body === undefined ? {} : JSON.parse(String(init.body))
      ) as { value?: unknown };
      return Promise.resolve(okResponse({ value: body.value }));
    }
    const episode = /^\/api\/episodes\/([^/]+)(\/.*)?$/.exec(url);
    if (episode !== null && READS[episode[1]] !== undefined) {
      const rest = episode[2] ?? '';
      if (rest === '') {
        return Promise.resolve(okResponse(READS[episode[1]]));
      }
      if (rest === '/playback') {
        return Promise.resolve(okResponse(playback[episode[1]]));
      }
      if (rest === '/resume' || rest === '/watched') {
        const body = (
          init?.body === undefined ? {} : JSON.parse(String(init.body))
        ) as { value?: unknown };
        return Promise.resolve(okResponse({ value: body.value }));
      }
    }
    if (url === '/api/movies/m1') {
      return Promise.resolve(
        okResponse(makeMovie({ id: 'm1', title: 'The Long Summer' }))
      );
    }
    if (url === '/api/movies/m1/playback') {
      return Promise.resolve(okResponse(FILM_TRACKS));
    }
    if (url.startsWith('/api/movies/m1/')) {
      return Promise.resolve(okResponse({ value: null }));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
  answerWith();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The season page it was opened from, then the player on S02E04. */
function renderScreen() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter
        initialEntries={['/series/harbor/season/2', '/episode/e24/play']}
        initialIndex={1}
      >
        <LocationProbe />
        <Routes>
          <Route
            path="/series/:id/season/:n"
            element={<Link to="/movie/m1/play">Play the film</Link>}
          />
          <Route path="/movie/:id/play" element={<PlayerPage />} />
          <Route
            path="/episode/:id/play"
            element={<PlayerPage kind="episode" />}
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

/** The picture once it points exactly at `stream`, however it got there. */
async function pictureOn(
  container: HTMLElement,
  stream: string
): Promise<HTMLVideoElement> {
  return waitFor(() => {
    const video = container.querySelector('video');
    if (video === null || video.getAttribute('src') !== stream) {
      throw new Error(
        `no picture on ${stream}: ${video?.getAttribute('src') ?? 'none'}`
      );
    }
    return video;
  });
}

function emit(video: HTMLMediaElement, type: string): void {
  act(() => {
    video.dispatchEvent(new Event(type));
  });
}

async function settled(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function currentVideo(container: HTMLElement): HTMLVideoElement {
  const video = container.querySelector('video');
  if (video === null) {
    throw new Error('no video');
  }
  return video;
}

/** The player open and running on S02E04, on the plain stream. */
async function playingE24() {
  const view = renderScreen();
  const video = await pictureOn(view.container, '/api/episodes/e24/stream');
  await waitFor(() => expect(video.paused).toBe(false));
  await screen.findByRole('button', { name: 'Back' });
  await settled();
  return view;
}

function chooseTrack(label: string): void {
  fireEvent.click(screen.getByRole('button', { name: 'Audio' }));
  fireEvent.click(
    within(screen.getByRole('menu')).getByRole('menuitem', { name: label })
  );
}

/** _Play now_ on the Up next card, ten seconds from the end. */
async function playNow(container: HTMLElement): Promise<void> {
  const video = currentVideo(container);
  video.currentTime = 2630;
  emit(video, 'timeupdate');
  fireEvent.click(await screen.findByRole('button', { name: 'Play now' }));
}

/** The file running out with Up next left alone. */
function endOfFile(container: HTMLElement): void {
  emit(currentVideo(container), 'ended');
}

function audioLanguagePosts(): unknown[] {
  return fetchMock.mock.calls
    .filter(([input]) => String(input) === '/api/settings/audio-language')
    .map(([, init]) => init?.body);
}

describe('PlayerScreen — the Audio choice lasts the sitting', () => {
  stubMediaElement();

  it('opens the next episode on its own Spanish track after a Spanish pick, through Play now', async () => {
    const { container } = await playingE24();

    chooseTrack('Spanish');
    await playNow(container);

    await waitFor(() => expect(pathname()).toBe('/episode/e25/play'));
    await pictureOn(container, '/api/episodes/e25/stream?a=2');
  });

  it('opens the next episode on its own Spanish track after a Spanish pick, at the end of the file', async () => {
    const { container } = await playingE24();

    chooseTrack('Spanish');
    endOfFile(container);

    await waitFor(() => expect(pathname()).toBe('/episode/e25/play'));
    await pictureOn(container, '/api/episodes/e25/stream?a=2');
  });

  it('opens an episode with no track in the carried language by the usual rule', async () => {
    // A French household, so the usual rule (French) and a stray fall-back to
    // the file's default (English) are told apart.
    answerWith({ settings: household({ audioLanguage: 'French' }) });
    const { container } = await playingE24();

    chooseTrack('Spanish');
    await playNow(container);
    await pictureOn(container, '/api/episodes/e25/stream?a=2');
    await settled();
    await playNow(container);

    await waitFor(() => expect(pathname()).toBe('/episode/e26/play'));
    await pictureOn(container, '/api/episodes/e26/stream?a=1');
  });

  it('carries nothing without a hand pick: the household preference decides the next episode', async () => {
    // A French household over an episode with no French: it opens on the
    // file's default, English — which nobody picked, so nothing is carried.
    answerWith({ settings: household({ audioLanguage: 'French' }) });
    const { container } = await playingE24();

    await playNow(container);

    await waitFor(() => expect(pathname()).toBe('/episode/e25/play'));
    await pictureOn(container, '/api/episodes/e25/stream?a=1');
  });

  it('forgets the pick on leaving: the next title opens in the household’s language', async () => {
    const { container } = await playingE24();

    chooseTrack('Spanish');
    await playNow(container);
    await pictureOn(container, '/api/episodes/e25/stream?a=2');

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Play the film' }));

    await waitFor(() => expect(pathname()).toBe('/movie/m1/play'));
    await pictureOn(container, '/api/movies/m1/stream');
  });

  it('never posts a pick to the household preference', async () => {
    const { container } = await playingE24();

    chooseTrack('Spanish');
    await playNow(container);
    await pictureOn(container, '/api/episodes/e25/stream?a=2');
    await settled();

    expect(audioLanguagePosts()).toEqual([]);
  });
});
