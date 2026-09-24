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

import { Player } from './Player';
import { theme } from '@/styles/theme';
import type {
  Cue,
  Episode,
  EpisodeRead,
  PlaybackRead,
  Playable,
  Subtitle,
} from '@/types';
import {
  LocationProbe,
  navigationType,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import {
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';

/**
 * 22 — Series (TV), Phase 4: "episode playback — the player takes a Playable"
 * (issue #194).
 *
 * The same `Player`, given a **Playable** of kind `episode` rather than a movie
 * id. Everything the movie suite (`Player.test.tsx`) asserts of a film carries
 * over unchanged — that file is the proof and is not edited — so this one
 * asserts only what an episode changes, and that what carries over does so on
 * the episode's own wire:
 *
 * - the reads and writes go to `/api/episodes/:id/*`, never `/api/movies/*`;
 * - the title line reads `Harbor & Vine · S02E04 · The Auction`, or
 *   `Harbor & Vine · S02E04` for an episode with no title;
 * - resume, the **Watch reporter**'s ticks and 95% finish, the missing-file
 *   notice and the **Preferred subtitle language** all apply;
 * - the **Landing** is the episode's season page, and a Back after a push is a
 *   history step onto whatever the player was opened from.
 */

const EPISODE_ID = 'e24';
const PLAYABLE: Playable = { kind: 'episode', id: EPISODE_ID };

/** 44 minutes, as the file itself says. */
const DIRECT_PLAY: PlaybackRead = { path: 'direct', durationSeconds: 2640 };

const MISSING_TITLE = 'This film’s file is missing';

const ENGLISH: Subtitle = {
  id: 'sub-en',
  path: 'harbor-vine-2019/season-02/S02E04.en.srt',
  language: 'English',
  position: 0,
};

const SPANISH: Subtitle = {
  id: 'sub-es',
  path: 'harbor-vine-2019/season-02/S02E04.es.srt',
  language: 'Spanish',
  position: 1,
};

const CUES: Cue[] = [{ start: 1, end: 4, text: 'La subasta empieza.' }];

function makeEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: EPISODE_ID,
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
    subtitles: [],
    lastWatchedAt: null,
    ...overrides,
  };
}

function makeRead(episode: Partial<Episode> = {}): EpisodeRead {
  return {
    episode: makeEpisode(episode),
    series: { id: 'harbor', title: 'Harbor & Vine' },
    next: { id: 'e25', season: 2, number: 5, title: 'Low Tide' },
  };
}

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
  answerWith({});
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Stand in for the episode's routes. Anything under `/api/movies/` is refused
 * outright — an episode that asks the movie wire for anything has chosen the
 * wrong wire, and the screen must not quietly survive it.
 */
function answerWith({
  read = makeRead(),
  playback = DIRECT_PLAY as PlaybackRead | null,
  subtitleLanguage = 'English',
}: {
  read?: EpisodeRead;
  playback?: PlaybackRead | null;
  subtitleLanguage?: string;
}) {
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    const base = `/api/episodes/${EPISODE_ID}`;
    if (url === base) {
      return Promise.resolve(okResponse(read));
    }
    if (url === `${base}/playback`) {
      return Promise.resolve(
        playback === null
          ? notFoundResponse(`No video file for episode: ${EPISODE_ID}`)
          : okResponse(playback)
      );
    }
    if (url.startsWith(`${base}/subtitles/`)) {
      return Promise.resolve(okResponse(CUES));
    }
    if (url === `${base}/resume` || url === `${base}/watched`) {
      const body = (
        init?.body === undefined ? {} : JSON.parse(String(init.body))
      ) as { value?: unknown };
      return Promise.resolve(okResponse({ value: body.value }));
    }
    if (url === '/api/settings') {
      return Promise.resolve(okResponse({ subtitleLanguage }));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

/** Every watch write, as the full URL and the value and keepalive it carried. */
function watchWrites(): { url: string; value: unknown; keepalive?: boolean }[] {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method?.toUpperCase() === 'POST')
    .map(([input, init]) => {
      const body = (
        init?.body === undefined ? {} : JSON.parse(String(init.body))
      ) as { value?: unknown };
      return {
        url: String(input),
        value: body.value,
        keepalive: init?.keepalive,
      };
    });
}

/** Every URL the screen asked for, in order. */
function requested(): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}

/**
 * The player on the episode, over a history: by default the season page it
 * was opened from, then the player — a push, which is how every button that
 * opens it arrives.
 */
function renderScreen(
  entries: string[] = ['/series/harbor/season/2', `/episode/${EPISODE_ID}/play`]
) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <LocationProbe />
        <Routes>
          <Route path="/" element={<span>Browse home</span>} />
          <Route path="/series/:id" element={<span>Series page</span>} />
          <Route
            path="/series/:id/season/:n"
            element={<span>Season page</span>}
          />
          <Route
            path="/episode/:id/play"
            element={<Player playable={PLAYABLE} />}
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

function picture(container: HTMLElement): HTMLVideoElement {
  const video = container.querySelector('video');
  if (video === null) {
    throw new Error('The player drew no picture');
  }
  return video;
}

async function renderPlayer(entries?: string[]) {
  const view = renderScreen(entries);
  const video = await waitFor(() => picture(view.container));
  return { ...view, video };
}

function emit(video: HTMLMediaElement, type: string): void {
  act(() => {
    video.dispatchEvent(new Event(type));
  });
}

async function started(video: HTMLVideoElement) {
  await waitFor(() => expect(video.paused).toBe(false));
}

function moveTo(video: HTMLVideoElement, seconds: number) {
  video.currentTime = seconds;
  emit(video, 'timeupdate');
}

describe('Player — an episode, on the episode wire', () => {
  stubMediaElement();

  it('points the picture at the episode’s own stream', async () => {
    const { video } = await renderPlayer();

    expect(video.getAttribute('src')).toBe(
      `/api/episodes/${EPISODE_ID}/stream`
    );
  });

  it('reads the episode and its playback, and asks the movie wire for nothing', async () => {
    await renderPlayer();

    expect(requested()).toContain(`/api/episodes/${EPISODE_ID}`);
    expect(requested()).toContain(`/api/episodes/${EPISODE_ID}/playback`);
    expect(requested().filter((url) => url.startsWith('/api/movies'))).toEqual(
      []
    );
  });
});

describe('Player — an episode’s title line', () => {
  stubMediaElement();

  it('reads the show, the episode code and the episode’s title', async () => {
    await renderPlayer();

    expect(
      await screen.findByText('Harbor & Vine · S02E04 · The Auction')
    ).toBeDefined();
  });

  it('drops the title segment for an episode with no title', async () => {
    answerWith({ read: makeRead({ title: null }) });
    await renderPlayer();

    expect(await screen.findByText('Harbor & Vine · S02E04')).toBeDefined();
    expect(screen.queryByText(/S02E04 ·/)).toBeNull();
  });

  it('pads a single-digit season and episode to two digits', async () => {
    answerWith({ read: makeRead({ season: 1, number: 3, title: 'Low Tide' }) });
    await renderPlayer();

    expect(
      await screen.findByText('Harbor & Vine · S01E03 · Low Tide')
    ).toBeDefined();
  });
});

describe('Player — an episode’s watching', () => {
  stubMediaElement();

  it('starts a part-watched episode where the family left it', async () => {
    answerWith({
      read: makeRead({ resumePositionSeconds: 660, status: 'in-progress' }),
    });
    const { video } = await renderPlayer();

    await waitFor(() => expect(video.currentTime).toBe(660));
  });

  it('starts a watched episode at the beginning rather than in the credits', async () => {
    answerWith({
      read: makeRead({
        watched: true,
        resumePositionSeconds: 2500,
        status: 'watched',
      }),
    });
    const { video } = await renderPlayer();
    await started(video);

    expect(video.currentTime).toBe(0);
  });

  it('writes where the episode was to its own resume route on the way out', async () => {
    const { video } = await renderPlayer();
    await started(video);
    moveTo(video, 1200);

    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));

    expect(watchWrites()).toEqual([
      {
        url: `/api/episodes/${EPISODE_ID}/resume`,
        value: 1200,
        keepalive: true,
      },
    ]);
  });

  it('writes where the episode was when it is paused', async () => {
    const { video } = await renderPlayer();
    await started(video);
    moveTo(video, 900);

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    await waitFor(() =>
      expect(watchWrites()).toEqual([
        {
          url: `/api/episodes/${EPISODE_ID}/resume`,
          value: 900,
          keepalive: undefined,
        },
      ])
    );
  });

  it('reports the position on the reporter’s tick while the episode runs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { video } = await renderPlayer();
      await started(video);
      moveTo(video, 300);

      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      await waitFor(() =>
        expect(watchWrites()).toContainEqual({
          url: `/api/episodes/${EPISODE_ID}/resume`,
          value: 300,
          keepalive: undefined,
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks the episode watched when it is left past 95%', async () => {
    const { video } = await renderPlayer();
    await started(video);
    moveTo(video, 2520);

    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));

    expect(watchWrites()).toEqual([
      {
        url: `/api/episodes/${EPISODE_ID}/watched`,
        value: true,
        keepalive: true,
      },
    ]);
  });

  it('marks the episode watched when it reaches its end', async () => {
    const { video } = await renderPlayer();
    await started(video);
    moveTo(video, 2640);

    emit(video, 'ended');

    await waitFor(() =>
      expect(watchWrites()).toEqual([
        {
          url: `/api/episodes/${EPISODE_ID}/watched`,
          value: true,
          keepalive: undefined,
        },
      ])
    );
  });
});

describe('Player — an episode whose file is missing', () => {
  stubMediaElement();

  it('shows the missing-file notice and points nothing at the stream', async () => {
    answerWith({ playback: null });
    const { container } = renderScreen();

    expect(await screen.findByText(MISSING_TITLE)).toBeDefined();
    expect(container.querySelector('video')).toBeNull();
  });
});

describe('Player — an episode’s subtitles', () => {
  stubMediaElement();

  it('opens on the household’s Preferred subtitle language, from the episode’s own cue route', async () => {
    answerWith({
      read: makeRead({ subtitles: [ENGLISH, SPANISH] }),
      subtitleLanguage: 'Spanish',
    });
    const { video } = await renderPlayer();
    await started(video);
    moveTo(video, 2);

    fireEvent.click(await screen.findByRole('button', { name: 'Subtitles' }));

    expect(await screen.findByText(CUES[0].text)).toBeDefined();
    expect(requested().filter((url) => url.includes('/subtitles/'))).toEqual([
      `/api/episodes/${EPISODE_ID}/subtitles/sub-es`,
    ]);
  });
});

describe('Player — leaving an episode', () => {
  stubMediaElement();

  it('steps back onto the page it was opened from, rather than pushing one', async () => {
    await renderPlayer(['/series/harbor', `/episode/${EPISODE_ID}/play`]);

    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/series/harbor');
    expect(navigationType()).toBe('POP');
  });

  it('lands on the episode’s season page when opened by deep link', async () => {
    await renderPlayer([`/episode/${EPISODE_ID}/play`]);

    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/series/harbor/season/2');
    expect(navigationType()).toBe('PUSH');
  });

  it('lands on the season page on Escape by the very same rule', async () => {
    await renderPlayer([`/episode/${EPISODE_ID}/play`]);
    await screen.findByRole('button', { name: 'Back' });

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(pathname()).toBe('/series/harbor/season/2'));
  });

  it('leaves a missing episode by the same Landing', async () => {
    answerWith({ playback: null });
    renderScreen([`/episode/${EPISODE_ID}/play`]);
    await screen.findByText(MISSING_TITLE);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/series/harbor/season/2');
  });
});
