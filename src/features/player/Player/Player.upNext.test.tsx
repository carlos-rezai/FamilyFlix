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

import PlayerPage from '@/pages/PlayerPage/PlayerPage';
import { theme } from '@/styles/theme';
import type { Episode, EpisodeRead, Movie, PlaybackRead } from '@/types';
import {
  LocationProbe,
  navigationType,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';

/**
 * 22 — Series (TV), Phase 6: "Up next — the countdown and auto-play"
 * (issue #196).
 *
 * The player's only addition for an **Episode**: the **Up next card** in its
 * last 15 seconds, and what the end of the file does.
 *
 * - The card is shown while there is a **Next episode**, the family has not
 *   cancelled, and 15s or less remain; it counts the time left, rounded up.
 * - _Play now_ marks this episode watched and moves on at once; _Cancel_ hides
 *   the card for this episode.
 * - At `ended`: a next, uncancelled episode plays; no next episode is a
 *   **Leaving** to the season page; a cancelled one stays where it is.
 * - The next episode follows on across a season boundary, through
 *   `EpisodeRead.next`.
 * - Moving on is a **Sideways move** — a `replace` — so Back after a run of
 *   episodes reaches the season page in one step.
 * - A film never draws the card.
 *
 * Rendered through `PlayerPage` at `/episode/:id/play`, as the route table
 * does, so that moving on is a real change of route and of **Playable**.
 */

/** 44 minutes, as the file itself says. */
const FORTY_FOUR: PlaybackRead = { path: 'direct', durationSeconds: 2640 };

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
    subtitles: [],
    lastWatchedAt: null,
    ...overrides,
  };
}

function read(
  episode: Partial<Episode> & { id: string },
  next: EpisodeRead['next']
): EpisodeRead {
  return {
    episode: makeEpisode(episode),
    series: { id: 'harbor', title: 'Harbor & Vine' },
    next,
  };
}

/** S02E04 → S02E05 → S02E06, the last of the run. */
const RUN: Record<string, EpisodeRead> = {
  e24: read(
    { id: 'e24' },
    { id: 'e25', season: 2, number: 5, title: 'Low Tide' }
  ),
  e25: read(
    { id: 'e25', number: 5, title: 'Low Tide' },
    { id: 'e26', season: 2, number: 6, title: 'Dry Dock' }
  ),
  e26: read({ id: 'e26', number: 6, title: 'Dry Dock' }, null),
};

/** The last episode of season 2, and the first of season 3 after it. */
const ACROSS: Record<string, EpisodeRead> = {
  e30: read(
    { id: 'e30', number: 10, title: 'Slack Water' },
    { id: 'e31', season: 3, number: 1, title: 'New Moorings' }
  ),
  e31: read({ id: 'e31', season: 3, number: 1, title: 'New Moorings' }, null),
};

const FILM: Movie = {
  id: 'm1',
  tmdbId: null,
  title: 'The Long Summer',
  year: 1998,
  runtimeMinutes: 44,
  synopsis: null,
  director: null,
  cast: [],
  rating: null,
  isFavorite: false,
  watched: false,
  resumePositionSeconds: 0,
  status: 'unwatched',
  videoPath: 'the-long-summer-1998/film.mp4',
  posterPath: null,
  backdropPath: null,
  originalTitle: null,
  tmdbScore: null,
  genres: [],
  subtitles: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastWatchedAt: null,
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
  answerWith(RUN);
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Stand in for every episode in `reads`, the one film, and the settings. */
function answerWith(
  reads: Record<string, EpisodeRead>,
  playback: PlaybackRead = FORTY_FOUR
) {
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    const episode = /^\/api\/episodes\/([^/]+)(\/.*)?$/.exec(url);
    if (episode !== null && reads[episode[1]] !== undefined) {
      const rest = episode[2] ?? '';
      if (rest === '') {
        return Promise.resolve(okResponse(reads[episode[1]]));
      }
      if (rest === '/playback') {
        return Promise.resolve(okResponse(playback));
      }
      if (rest === '/resume' || rest === '/watched') {
        const body = (
          init?.body === undefined ? {} : JSON.parse(String(init.body))
        ) as { value?: unknown };
        return Promise.resolve(okResponse({ value: body.value }));
      }
    }
    if (url === '/api/movies/m1') {
      return Promise.resolve(okResponse(FILM));
    }
    if (url === '/api/movies/m1/playback') {
      return Promise.resolve(okResponse(playback));
    }
    if (url.startsWith('/api/movies/m1/')) {
      return Promise.resolve(okResponse({ value: null }));
    }
    if (url === '/api/settings') {
      return Promise.resolve(okResponse({ subtitleLanguage: 'English' }));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

/** Every watch write, as the URL and the value it carried. */
function watchWrites(): { url: string; value: unknown }[] {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method?.toUpperCase() === 'POST')
    .map(([input, init]) => {
      const body = (
        init?.body === undefined ? {} : JSON.parse(String(init.body))
      ) as { value?: unknown };
      return { url: String(input), value: body.value };
    });
}

function requested(): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}

/**
 * The player over a history: by default the season page it was opened from,
 * then the player on S02E04.
 */
function renderScreen(
  entries: string[] = ['/series/harbor/season/2', '/episode/e24/play']
) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <LocationProbe />
        <Routes>
          <Route path="/" element={<span>Browse home</span>} />
          <Route path="/movie/:id" element={<span>Movie page</span>} />
          <Route
            path="/series/:id/season/:n"
            element={<span>Season page</span>}
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

/** The picture once it points at `stream`, however it got there. */
async function pictureOn(
  container: HTMLElement,
  stream: string
): Promise<HTMLVideoElement> {
  return waitFor(() => {
    const video = container.querySelector('video');
    if (video === null || video.getAttribute('src') !== stream) {
      throw new Error(`no picture on ${stream}`);
    }
    return video;
  });
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

/** The player open and running on `id`. */
async function playing(id: string, entries?: string[]) {
  const view = renderScreen(entries);
  const video = await pictureOn(view.container, `/api/episodes/${id}/stream`);
  await started(video);
  await screen.findByRole('button', { name: 'Back' });
  return { ...view, video };
}

/** Let whatever the last event set going settle. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const upNext = () => screen.queryByText(/^Up next · in \d+s$/);

describe('Player — the Up next card appears in the last 15 seconds', () => {
  stubMediaElement();

  it('is drawn at 15 seconds left and not before, naming the next episode', async () => {
    const { video } = await playing('e24');
    moveTo(video, 2624);
    await settle();
    expect(upNext()).toBeNull();

    moveTo(video, 2625);

    expect(await screen.findByText('Up next · in 15s')).toBeDefined();
    expect(screen.getByText('S02E05')).toBeDefined();
    expect(screen.getByText('Low Tide')).toBeDefined();
  });

  it('counts down the time left, rounded up', async () => {
    const { video } = await playing('e24');

    moveTo(video, 2627.5);

    expect(await screen.findByText('Up next · in 13s')).toBeDefined();
  });

  it('keeps counting as the file runs on', async () => {
    const { video } = await playing('e24');
    moveTo(video, 2630);
    await screen.findByText('Up next · in 10s');

    moveTo(video, 2636.2);

    expect(await screen.findByText('Up next · in 4s')).toBeDefined();
  });

  it('is not drawn for the last episode, which has no next', async () => {
    const { video } = await playing('e26', [
      '/series/harbor/season/2',
      '/episode/e26/play',
    ]);

    moveTo(video, 2630);
    await settle();

    expect(upNext()).toBeNull();
  });
});

describe('Player — Play now', () => {
  stubMediaElement();

  it('marks this episode watched', async () => {
    // A 200-second file, so 15 seconds left is short of the 95% finish and
    // the watched write can only be Play now's.
    answerWith(RUN, { path: 'direct', durationSeconds: 200 });
    const { video } = await playing('e24');
    moveTo(video, 186);

    fireEvent.click(await screen.findByRole('button', { name: 'Play now' }));

    await waitFor(() =>
      expect(watchWrites()).toContainEqual({
        url: '/api/episodes/e24/watched',
        value: true,
      })
    );
  });

  it('moves to the next episode at once, by a replace', async () => {
    const { container, video } = await playing('e24');
    moveTo(video, 2630);

    fireEvent.click(await screen.findByRole('button', { name: 'Play now' }));

    await waitFor(() => expect(pathname()).toBe('/episode/e25/play'));
    expect(navigationType()).toBe('REPLACE');
    await pictureOn(container, '/api/episodes/e25/stream');
    expect(
      await screen.findByText('Harbor & Vine · S02E05 · Low Tide')
    ).toBeDefined();
  });
});

describe('Player — Cancel', () => {
  stubMediaElement();

  it('hides the card', async () => {
    const { video } = await playing('e24');
    moveTo(video, 2630);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(upNext()).toBeNull());
  });

  it('keeps it hidden for the rest of this episode', async () => {
    const { video } = await playing('e24');
    moveTo(video, 2630);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    moveTo(video, 2635);
    await settle();

    expect(upNext()).toBeNull();
  });

  it('stays where it is when the episode ends', async () => {
    const { video } = await playing('e24');
    moveTo(video, 2630);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    moveTo(video, 2640);
    emit(video, 'ended');
    await settle();

    expect(pathname()).toBe('/episode/e24/play');
    expect(requested()).not.toContain('/api/episodes/e25');
  });
});

describe('Player — when an episode ends', () => {
  stubMediaElement();

  it('plays the next episode when the family did not cancel', async () => {
    const { container, video } = await playing('e24');
    moveTo(video, 2640);

    emit(video, 'ended');

    await waitFor(() => expect(pathname()).toBe('/episode/e25/play'));
    expect(navigationType()).toBe('REPLACE');
    const next = await pictureOn(container, '/api/episodes/e25/stream');
    await started(next);
  });

  it('leaves the last episode to its season page', async () => {
    const { video } = await playing('e26', ['/episode/e26/play']);
    moveTo(video, 2640);

    emit(video, 'ended');

    await waitFor(() => expect(pathname()).toBe('/series/harbor/season/2'));
  });

  it('leaves the last episode by a step back onto the season page it came from', async () => {
    const { video } = await playing('e26', [
      '/series/harbor/season/2',
      '/episode/e26/play',
    ]);
    moveTo(video, 2640);

    emit(video, 'ended');

    await waitFor(() => expect(pathname()).toBe('/series/harbor/season/2'));
    expect(navigationType()).toBe('POP');
  });
});

describe('Player — across a season boundary', () => {
  stubMediaElement();

  beforeEach(() => {
    answerWith(ACROSS);
  });

  it('offers the first episode of the next season after the last of this one', async () => {
    const { video } = await playing('e30', [
      '/series/harbor/season/2',
      '/episode/e30/play',
    ]);

    moveTo(video, 2630);

    expect(await screen.findByText('Up next · in 10s')).toBeDefined();
    expect(screen.getByText('S03E01')).toBeDefined();
    expect(screen.getByText('New Moorings')).toBeDefined();
  });

  it('plays on into the next season when the last episode ends', async () => {
    const { container, video } = await playing('e30', [
      '/series/harbor/season/2',
      '/episode/e30/play',
    ]);
    moveTo(video, 2640);

    emit(video, 'ended');

    await waitFor(() => expect(pathname()).toBe('/episode/e31/play'));
    await pictureOn(container, '/api/episodes/e31/stream');
    expect(
      await screen.findByText('Harbor & Vine · S03E01 · New Moorings')
    ).toBeDefined();
  });
});

describe('Player — a run of episodes in history', () => {
  stubMediaElement();

  it('leaves one entry behind, so Back reaches the season page in one step', async () => {
    const { container, video } = await playing('e24');
    moveTo(video, 2640);
    emit(video, 'ended');

    const second = await pictureOn(container, '/api/episodes/e25/stream');
    await started(second);
    moveTo(second, 2640);
    emit(second, 'ended');

    const third = await pictureOn(container, '/api/episodes/e26/stream');
    await started(third);
    expect(pathname()).toBe('/episode/e26/play');

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    await waitFor(() => expect(pathname()).toBe('/series/harbor/season/2'));
    expect(navigationType()).toBe('POP');
  });
});

describe('Player — a film', () => {
  stubMediaElement();

  it('draws no Up next card in its last 15 seconds', async () => {
    const { container } = renderScreen(['/movie/m1', '/movie/m1/play']);
    const video = await pictureOn(container, '/api/movies/m1/stream');
    await started(video);

    moveTo(video, 2630);
    await settle();

    expect(upNext()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Play now' })).toBeNull();
  });
});
