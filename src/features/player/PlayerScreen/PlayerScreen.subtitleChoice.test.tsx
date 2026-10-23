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
  Cue,
  Episode,
  EpisodeRead,
  PlaybackRead,
  Settings,
  Subtitle,
} from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';
import { makeSettings } from '@/test-support/makeSettings/makeSettings';

/**
 * 50, Subtitle picker, Phase 7: "the sitting" (issue #441).
 *
 * The **Subtitle choice** (the showing Subtitle's language after a hand pick,
 * the pill or `c`, or `null` for off) held by the **Fullscreen surface** and
 * handed to each player it keys, so _Play now_ and the end-of-file advance
 * open the next episode on, in that language. Leaving the player forgets it,
 * and it is never posted.
 *
 * Asserted from outside, through the route: the line drawn on each episode
 * and the requests the screen makes.
 */

/** A Subtitle row of episode `episodeId` in `language`, at `position`. */
function subtitle(
  episodeId: string,
  language: string,
  position: number
): Subtitle {
  return {
    id: `${episodeId}-${language.toLowerCase()}`,
    language,
    position,
    path: `harbor-vine-2019/season-02/${episodeId}.${language}.srt`,
  };
}

/** The one line a Subtitle draws: its episode and language, all file long. */
function lineOf(episodeId: string, language: string): string {
  return `${episodeId} in ${language}.`;
}

/** English and Spanish, in that order. */
const bilingual = (id: string) => [
  subtitle(id, 'English', 0),
  subtitle(id, 'Spanish', 1),
];

/** One plain English audio track, so no Audio picker draws. */
const PLAYBACK: PlaybackRead = {
  path: 'direct',
  durationSeconds: 2640,
  audioTracks: [
    {
      index: 0,
      language: 'English',
      label: 'English',
      fileDefault: true,
      path: 'direct',
    },
  ],
};

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

type Shelf = Record<'e24' | 'e25' | 'e26', Subtitle[]>;

function readsOf(shelf: Shelf): Record<string, EpisodeRead> {
  return {
    e24: {
      episode: makeEpisode({ id: 'e24', subtitles: shelf.e24 }),
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
      episode: makeEpisode({
        id: 'e25',
        number: 5,
        title: 'Low Tide',
        subtitles: shelf.e25,
      }),
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
      episode: makeEpisode({
        id: 'e26',
        number: 6,
        title: 'Dry Dock',
        subtitles: shelf.e26,
      }),
      series: { id: 'harbor', title: 'Harbor & Vine' },
      next: null,
    },
  };
}

/** The film opened after leaving, with English and Spanish files. */
const FILM_SUBTITLES: Subtitle[] = [
  { id: 'm1-english', language: 'English', position: 0, path: 'm1.en.srt' },
  { id: 'm1-spanish', language: 'Spanish', position: 1, path: 'm1.es.srt' },
];

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

function cuesFor(id: string, subtitles: Subtitle[]): Cue[] | undefined {
  const row = subtitles.find((candidate) => candidate.id === id);
  if (row === undefined) {
    return undefined;
  }
  const owner = id.split('-')[0];
  return [{ start: 0, end: 2640, text: lineOf(owner, row.language) }];
}

function answerWith({
  shelf = {
    e24: bilingual('e24'),
    e25: [
      subtitle('e25', 'English', 0),
      subtitle('e25', 'French', 1),
      subtitle('e25', 'Spanish', 2),
    ],
    e26: bilingual('e26'),
  },
  settings = makeSettings(),
}: {
  shelf?: Shelf;
  settings?: Settings;
} = {}) {
  const reads = readsOf(shelf);
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
    if (episode !== null && reads[episode[1]] !== undefined) {
      const rest = episode[2] ?? '';
      if (rest === '') {
        return Promise.resolve(okResponse(reads[episode[1]]));
      }
      if (rest === '/playback') {
        return Promise.resolve(okResponse(PLAYBACK));
      }
      const cue = /^\/subtitles\/([^/]+)$/.exec(rest);
      if (cue !== null) {
        const cues = cuesFor(
          decodeURIComponent(cue[1]),
          reads[episode[1]].episode.subtitles
        );
        if (cues !== undefined) {
          return Promise.resolve(okResponse(cues));
        }
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
        okResponse(
          makeMovie({
            id: 'm1',
            title: 'The Long Summer',
            subtitles: FILM_SUBTITLES,
          })
        )
      );
    }
    if (url === '/api/movies/m1/playback') {
      return Promise.resolve(okResponse(PLAYBACK));
    }
    const filmCue = /^\/api\/movies\/m1\/subtitles\/([^/]+)$/.exec(url);
    if (filmCue !== null) {
      const cues = cuesFor(decodeURIComponent(filmCue[1]), FILM_SUBTITLES);
      if (cues !== undefined) {
        return Promise.resolve(okResponse(cues));
      }
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

/** The picture once it points exactly at `stream`. */
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

/** The player open and running on `id`, every opening read landed. */
async function runningOn(container: HTMLElement, stream: string) {
  const video = await pictureOn(container, stream);
  await waitFor(() => expect(video.paused).toBe(false));
  await screen.findByRole('button', { name: 'Back' });
  await settled();
}

async function playingE24() {
  const view = renderScreen();
  await runningOn(view.container, '/api/episodes/e24/stream');
  return view;
}

/** Arrives on episode `id` and waits for it to be running. */
async function arrivedAt(container: HTMLElement, id: string): Promise<void> {
  await waitFor(() => expect(pathname()).toBe(`/episode/${id}/play`));
  await runningOn(container, `/api/episodes/${id}/stream`);
}

async function chooseSubtitle(label: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
  fireEvent.click(
    within(screen.getByRole('menu')).getByRole('menuitem', { name: label })
  );
  await settled();
}

/** _Play now_ on the Up next card, ten seconds from the end. */
async function playNow(container: HTMLElement): Promise<void> {
  const video = currentVideo(container);
  video.currentTime = 2630;
  emit(video, 'timeupdate');
  fireEvent.click(await screen.findByRole('button', { name: 'Play now' }));
}

/** The countdown run out: the file ends with Up next left alone. */
function endOfFile(container: HTMLElement): void {
  emit(currentVideo(container), 'ended');
}

/** No line of episode `id` is drawn, in any language. */
function noLineOf(id: string): void {
  expect(screen.queryByText(new RegExp(`^${id} in `))).toBeNull();
}

describe('PlayerScreen: the Subtitle choice lasts the sitting', () => {
  stubMediaElement();

  it('opens the next episode on, in Spanish, after a Spanish pick, through Play now', async () => {
    const { container } = await playingE24();

    await chooseSubtitle('Spanish');
    expect(await screen.findByText(lineOf('e24', 'Spanish'))).toBeDefined();
    await playNow(container);

    await arrivedAt(container, 'e25');
    expect(await screen.findByText(lineOf('e25', 'Spanish'))).toBeDefined();
  });

  it('opens the next episode on, in Spanish, after a Spanish pick, when the countdown runs out', async () => {
    const { container } = await playingE24();

    await chooseSubtitle('Spanish');
    endOfFile(container);

    await arrivedAt(container, 'e25');
    expect(await screen.findByText(lineOf('e25', 'Spanish'))).toBeDefined();
  });

  it('opens an episode with no file in the carried language on, on its rule’s track', async () => {
    // A French household, so the rule (French) and a stray fall-back to the
    // first in track order (English) are told apart.
    answerWith({
      settings: makeSettings({ subtitleLanguage: 'French' }),
      shelf: {
        e24: bilingual('e24'),
        e25: [subtitle('e25', 'English', 0), subtitle('e25', 'French', 1)],
        e26: [],
      },
    });
    const { container } = await playingE24();

    await chooseSubtitle('Spanish');
    await playNow(container);

    await arrivedAt(container, 'e25');
    expect(await screen.findByText(lineOf('e25', 'French'))).toBeDefined();
    expect(screen.queryByText(lineOf('e25', 'English'))).toBeNull();
  });

  it('carries off as off: turned off in one episode, the next opens off', async () => {
    const { container } = await playingE24();

    await chooseSubtitle('Spanish');
    await playNow(container);
    await arrivedAt(container, 'e25');
    expect(await screen.findByText(lineOf('e25', 'Spanish'))).toBeDefined();

    await chooseSubtitle('Off');
    await playNow(container);

    await arrivedAt(container, 'e26');
    noLineOf('e26');
  });

  it('carries on as on when the pill turned subtitles on', async () => {
    answerWith({
      shelf: {
        e24: [subtitle('e24', 'English', 0)],
        e25: bilingual('e25'),
        e26: [],
      },
    });
    const { container } = await playingE24();

    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    expect(await screen.findByText(lineOf('e24', 'English'))).toBeDefined();
    await playNow(container);

    await arrivedAt(container, 'e25');
    expect(await screen.findByText(lineOf('e25', 'English'))).toBeDefined();
  });

  it('carries on as on when c turned subtitles on', async () => {
    const { container } = await playingE24();

    fireEvent.keyDown(window, { key: 'c' });
    expect(await screen.findByText(lineOf('e24', 'English'))).toBeDefined();
    await playNow(container);

    await arrivedAt(container, 'e25');
    expect(await screen.findByText(lineOf('e25', 'English'))).toBeDefined();
  });

  it('passes the choice through an episode with no subtitle files to the one after', async () => {
    answerWith({
      shelf: {
        e24: bilingual('e24'),
        e25: [],
        e26: bilingual('e26'),
      },
    });
    const { container } = await playingE24();

    await chooseSubtitle('Spanish');
    await playNow(container);
    await arrivedAt(container, 'e25');
    await playNow(container);

    await arrivedAt(container, 'e26');
    expect(await screen.findByText(lineOf('e26', 'Spanish'))).toBeDefined();
  });

  it('forgets the choice on leaving: a fresh open from the library starts off', async () => {
    const { container } = await playingE24();

    await chooseSubtitle('Spanish');
    await playNow(container);
    await arrivedAt(container, 'e25');
    expect(await screen.findByText(lineOf('e25', 'Spanish'))).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Play the film' }));

    await waitFor(() => expect(pathname()).toBe('/movie/m1/play'));
    await runningOn(container, '/api/movies/m1/stream');
    noLineOf('m1');
  });

  it('writes no setting and makes no request of its own for the choice', async () => {
    const { container } = await playingE24();

    await chooseSubtitle('Spanish');
    await playNow(container);
    await arrivedAt(container, 'e25');
    expect(await screen.findByText(lineOf('e25', 'Spanish'))).toBeDefined();
    await settled();

    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls.filter((url) => url.startsWith('/api/settings/'))).toEqual([]);
    const known =
      /^\/api\/(settings|episodes\/e2[45](|\/playback|\/resume|\/watched|\/subtitles\/[^/]+))$/;
    expect(urls.filter((url) => !known.test(url))).toEqual([]);
  });
});
