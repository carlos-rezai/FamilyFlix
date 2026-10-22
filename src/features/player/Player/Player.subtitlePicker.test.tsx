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
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { PlayerScreen } from '../PlayerScreen/PlayerScreen';
import { theme } from '@/styles/theme';
import type { AudioTrack, Cue, Movie, PlaybackRead, Subtitle } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';
import { makeSettings } from '@/test-support/makeSettings/makeSettings';

/**
 * 50 — Subtitle picker, Phase 5: "the picker in the player" (issue #439).
 *
 * A film with an English and a Spanish subtitle file: the CC pill is the
 * **Subtitle picker**, and a pick mid-film changes the lines on screen. An open
 * Subtitle menu holds the **Chrome** up as the Audio menu does, keys pressed in
 * it are the menu's, and `c` toggles over the picked track.
 */

const MOVIE_ID = 'm1';

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

/** One line each, stamped in **Absolute position**, covering 1800. */
const ENGLISH_CUES: Cue[] = [{ start: 1790, end: 1850, text: 'Good evening.' }];
const SPANISH_CUES: Cue[] = [
  { start: 1790, end: 1850, text: 'Buenas noches.' },
];

const NORTHWIND: Movie = makeMovie({
  id: MOVIE_ID,
  title: 'Northwind',
  year: 1994,
  videoPath: 'Northwind (1994)/northwind.mp4',
  subtitles: [SUBTITLE_EN, SUBTITLE_ES],
  watched: false,
  resumePositionSeconds: 1800,
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

/** A native MP4 in English first and Spanish second, so both pickers draw. */
const PLAYBACK: PlaybackRead = {
  path: 'direct',
  durationSeconds: 6832.5,
  audioTracks: [
    track({ index: 0, fileDefault: true }),
    track({ index: 1, language: 'Spanish', label: 'Spanish', path: 'remux' }),
  ],
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
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url === '/api/settings') {
      return Promise.resolve(okResponse(makeSettings()));
    }
    if (url === `/api/movies/${MOVIE_ID}`) {
      return Promise.resolve(okResponse(NORTHWIND));
    }
    if (url.endsWith('/playback')) {
      return Promise.resolve(okResponse(PLAYBACK));
    }
    if (url.endsWith(`/subtitles/${SUBTITLE_EN.id}`)) {
      return Promise.resolve(okResponse(ENGLISH_CUES));
    }
    if (url.endsWith(`/subtitles/${SUBTITLE_ES.id}`)) {
      return Promise.resolve(okResponse(SPANISH_CUES));
    }
    if (url.endsWith('/resume') || url.endsWith('/watched')) {
      const body = (
        init?.body === undefined ? {} : JSON.parse(String(init.body))
      ) as { value?: unknown };
      return Promise.resolve(okResponse({ value: body.value }));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderScreen() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter
        initialEntries={['/', `/movie/${MOVIE_ID}/play`]}
        initialIndex={1}
      >
        <Routes>
          <Route path="/" element={<span>Browse home</span>} />
          <Route
            path="/movie/:id/play"
            element={
              <PlayerScreen playable={{ kind: 'movie', id: MOVIE_ID }} />
            }
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

function pointedPicture(container: HTMLElement): HTMLVideoElement {
  const video = container.querySelector('video');
  if (video === null || !video.hasAttribute('src')) {
    throw new Error('The player pointed no picture');
  }
  return video;
}

/** Lets every read in flight land: a macrotask drains the whole chain. */
async function settled(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** The player opened, the film running at the resume position. */
async function renderPlaying() {
  const view = renderScreen();
  const video = await waitFor(() => pointedPicture(view.container));
  await waitFor(() => expect(video.paused).toBe(false));
  await waitFor(() => expect(video.currentTime).toBe(1800));
  await screen.findByRole('button', { name: 'Back' });
  await settled();
  return { ...view, video };
}

function openSubtitleMenu(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
  return screen.getByRole('menu');
}

async function chooseSubtitle(label: string): Promise<void> {
  const menu = openSubtitleMenu();
  fireEvent.click(within(menu).getByRole('menuitem', { name: label }));
  await settled();
}

describe('Player — picking a subtitle', () => {
  stubMediaElement();

  it('draws the Spanish lines once Spanish is picked, and no box once Off is', async () => {
    await renderPlaying();
    expect(screen.queryByText('Good evening.')).toBeNull();

    await chooseSubtitle('Spanish');

    expect(await screen.findByText('Buenas noches.')).toBeDefined();
    expect(screen.queryByText('Good evening.')).toBeNull();

    await chooseSubtitle('Off');

    expect(screen.queryByText('Buenas noches.')).toBeNull();
    expect(screen.queryByText('Good evening.')).toBeNull();
  });

  it('gives back the picked track on c after a pick and two presses', async () => {
    await renderPlaying();
    await chooseSubtitle('Spanish');
    await screen.findByText('Buenas noches.');

    fireEvent.keyDown(window, { key: 'c' });
    await settled();
    expect(screen.queryByText('Buenas noches.')).toBeNull();

    fireEvent.keyDown(window, { key: 'c' });
    await settled();

    expect(await screen.findByText('Buenas noches.')).toBeDefined();
    expect(screen.queryByText('Good evening.')).toBeNull();
  });
});

describe('Player — keys inside the open Subtitle menu', () => {
  stubMediaElement();

  it('neither seeks nor pauses the film', async () => {
    const { video } = await renderPlaying();
    const src = video.getAttribute('src');
    const menu = openSubtitleMenu();

    fireEvent.keyDown(menu, { key: ' ' });
    fireEvent.keyDown(menu, { key: 'k' });
    fireEvent.keyDown(menu, { key: 'ArrowRight' });
    fireEvent.keyDown(menu, { key: 'ArrowLeft' });

    expect(video.paused).toBe(false);
    expect(video.currentTime).toBe(1800);
    expect(video.getAttribute('src')).toBe(src);
  });
});

describe('Player — the chrome while a menu is open', () => {
  stubMediaElement();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const idleFor = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  it('stays up while the Subtitle menu is open, however long it is left', async () => {
    await renderPlaying();

    openSubtitleMenu();
    idleFor(10_000);

    expect(screen.getByRole('menu')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDefined();
  });

  it('fades again once the Subtitle menu shuts', async () => {
    await renderPlaying();
    const menu = openSubtitleMenu();

    fireEvent.keyDown(menu, { key: 'Escape' });
    await settled();

    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByText('Browse home')).toBeNull();

    idleFor(3000);

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('stays up from the Subtitle menu straight into the Audio menu', async () => {
    await renderPlaying();
    openSubtitleMenu();

    const audio = screen.getByRole('button', { name: 'Audio' });
    fireEvent.pointerDown(audio);
    fireEvent.click(audio);
    idleFor(10_000);

    const menu = screen.getByRole('menu');
    expect(
      within(menu).getByRole('menuitem', { name: 'Spanish' })
    ).toBeDefined();
    expect(within(menu).queryByRole('menuitem', { name: 'Off' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDefined();
  });
});
