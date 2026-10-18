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
import type {
  AudioTrack,
  Cue,
  Movie,
  PlaybackRead,
  Settings,
  Subtitle,
} from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

/**
 * 46 — Audio tracks, Phase 5: "the picker" (issue #403).
 *
 * The switch mid-film, asserted from outside as `Player.audio.test.tsx` is:
 * the **Audio picker** drawn or not, the menu it opens, the `src` the element
 * is re-pointed at, where the element is wound to, and what the rest of the
 * screen — the subtitles, the **Watch tick**, a seek, the buffering circle,
 * the chrome — makes of it.
 *
 * jsdom loads nothing, so the browser's half of a re-point is played here by
 * hand: giving a playing element a new `src` starts it again at its own
 * beginning, paused, as the media load algorithm does — and then
 * {@link loaded} delivers the events a browser would as the new source comes
 * in.
 */

const MOVIE_ID = 'm1';
const STREAM = `/api/movies/${MOVIE_ID}/stream`;
const BUFFERING = 'Getting this film ready…';

const SUBTITLE_EN: Subtitle = {
  id: 's-en',
  language: 'English',
  position: 0,
  path: 'Northwind (1994)/northwind.en.srt',
};

/** Two lines, stamped in **Absolute position**, either side of 1800. */
const CUES: Cue[] = [
  { start: 1790, end: 1850, text: 'Good evening.' },
  { start: 1900, end: 1950, text: 'Until tomorrow.' },
];

const NORTHWIND: Movie = makeMovie({
  id: MOVIE_ID,
  title: 'Northwind',
  year: 1994,
  videoPath: 'Northwind (1994)/northwind.mp4',
  subtitles: [SUBTITLE_EN],
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

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

function answerWith({
  movie = NORTHWIND,
  playback = ENGLISH_SPANISH,
  settings = household(),
}: {
  movie?: Movie;
  playback?: PlaybackRead;
  settings?: Settings;
} = {}) {
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url === '/api/settings') {
      return Promise.resolve(okResponse(settings));
    }
    if (url === `/api/movies/${MOVIE_ID}`) {
      return Promise.resolve(okResponse(movie));
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

/**
 * The browser's half of a re-point: a new `src` on an element that already had
 * one restarts it at nought and paused, the moment it is set — which is during
 * React's commit, before any effect of the hook's has run.
 *
 * Armed only once the film is open and running ({@link renderPlaying}), so the
 * opening — a resume re-pointing a stream at its `t` — is left exactly as
 * every other suite sees it, and only the switch is played against it.
 */
let reloadArmed = false;

function reloadOnNewSource() {
  beforeEach(() => {
    reloadArmed = false;
    Object.defineProperty(HTMLVideoElement.prototype, 'setAttribute', {
      configurable: true,
      writable: true,
      value: function setAttribute(
        this: HTMLVideoElement,
        name: string,
        value: string
      ): void {
        const before = this.getAttribute('src');
        Element.prototype.setAttribute.call(this, name, value);
        if (
          reloadArmed &&
          name === 'src' &&
          before !== null &&
          before !== value
        ) {
          this.currentTime = 0;
          if (!this.paused) {
            this.pause();
          }
        }
      },
    });
  });

  afterEach(() => {
    delete (HTMLVideoElement.prototype as Partial<HTMLVideoElement>)
      .setAttribute;
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

/** The player opened, the film running at the resume position. */
async function renderPlaying() {
  const view = renderScreen();
  const video = await waitFor(() => pointedPicture(view.container));
  await waitFor(() => expect(video.paused).toBe(false));
  await waitFor(() => expect(video.currentTime).toBe(1800));
  await screen.findByRole('button', { name: 'Back' });
  await settled();
  reloadArmed = true;
  return { ...view, video };
}

/** Lets every read in flight land — a macrotask drains the whole chain. */
async function settled(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function emit(video: HTMLMediaElement, type: string): void {
  act(() => {
    video.dispatchEvent(new Event(type));
  });
}

/** The new source arriving, as a browser reports it: `playing` only if it is. */
function loaded(video: HTMLVideoElement): void {
  emit(video, 'loadedmetadata');
  emit(video, 'loadeddata');
  emit(video, 'canplay');
  if (!video.paused) {
    emit(video, 'playing');
  }
}

function queryOf(src: string | null): URLSearchParams {
  return new URLSearchParams(src?.includes('?') ? src.split('?')[1] : '');
}

function chooseTrack(label: string): void {
  fireEvent.click(screen.getByRole('button', { name: 'Audio' }));
  fireEvent.click(
    within(screen.getByRole('menu')).getByRole('menuitem', { name: label })
  );
}

describe('Player — the Audio picker drawn', () => {
  stubMediaElement();

  it('sits before CC for a film with two tracks, the playing one marked', async () => {
    await renderPlaying();

    const audio = screen.getByRole('button', { name: 'Audio' });
    expect(
      comesBefore(audio, screen.getByRole('button', { name: 'Subtitles' }))
    ).toBe(true);

    fireEvent.click(audio);
    const marked = within(screen.getByRole('menu'))
      .getAllByRole('menuitem')
      .filter((item) => item.getAttribute('aria-current') === 'true')
      .map((item) => item.textContent);
    expect(marked).toEqual(['English']);
  });
});

describe('Player — switching track', () => {
  stubMediaElement();
  reloadOnNewSource();

  it('re-points the stream at the Absolute position with the new a, onto a streaming track', async () => {
    const { video } = await renderPlaying();

    chooseTrack('Spanish');

    const src = video.getAttribute('src');
    expect(src?.split('?')[0]).toBe(STREAM);
    expect(queryOf(src).get('t')).toBe('1800');
    expect(queryOf(src).get('a')).toBe('1');
  });

  it('marks the new track playing once chosen', async () => {
    await renderPlaying();

    chooseTrack('Spanish');
    fireEvent.click(screen.getByRole('button', { name: 'Audio' }));

    const marked = within(screen.getByRole('menu'))
      .getAllByRole('menuitem')
      .filter((item) => item.getAttribute('aria-current') === 'true')
      .map((item) => item.textContent);
    expect(marked).toEqual(['Spanish']);
  });

  it('drops the offset onto the first track of a native file, and winds the element once metadata lands', async () => {
    answerWith({
      settings: household({ audioLanguage: 'Spanish' }),
    });
    const view = renderScreen();
    const video = await waitFor(() => pointedPicture(view.container));
    await waitFor(() =>
      expect(queryOf(video.getAttribute('src')).get('t')).toBe('1800')
    );
    expect(queryOf(video.getAttribute('src')).get('a')).toBe('1');
    await waitFor(() => expect(video.paused).toBe(false));
    video.currentTime = 30;
    emit(video, 'timeupdate');
    await screen.findByRole('button', { name: 'Back' });
    await settled();
    reloadArmed = true;

    chooseTrack('English');

    expect(video.getAttribute('src')).toBe(STREAM);
    loaded(video);
    expect(video.currentTime).toBe(1830);
  });

  it('keeps playing across a switch made while playing', async () => {
    const { video } = await renderPlaying();

    chooseTrack('Spanish');
    loaded(video);
    await settled();

    expect(video.paused).toBe(false);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined();
  });

  it('stays paused across a switch made while paused', async () => {
    const { video } = await renderPlaying();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(video.paused).toBe(true);

    chooseTrack('Spanish');
    loaded(video);
    await settled();

    expect(video.paused).toBe(true);
    expect(queryOf(video.getAttribute('src')).get('a')).toBe('1');
    expect(screen.getByRole('button', { name: 'Play' })).toBeDefined();
  });

  it('shows the buffering circle while the switch loads, and takes it away once it plays', async () => {
    const { video } = await renderPlaying();
    expect(screen.queryByText(BUFFERING)).toBeNull();

    chooseTrack('Spanish');

    expect(screen.getByText(BUFFERING)).toBeDefined();

    loaded(video);
    await settled();

    expect(screen.queryByText(BUFFERING)).toBeNull();
  });

  it('keeps the subtitles on and in step across the switch', async () => {
    const { video } = await renderPlaying();
    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));
    await screen.findByText('Good evening.');

    chooseTrack('Spanish');
    loaded(video);
    await settled();

    // Still on, still at 1800 — the new stream's own nought is the old 1800.
    expect(screen.getByText('Good evening.')).toBeDefined();

    video.currentTime = 105;
    emit(video, 'timeupdate');

    expect(screen.getByText('Until tomorrow.')).toBeDefined();
  });

  it('seeks after the switch by re-pointing, still on the chosen track', async () => {
    const { video } = await renderPlaying();
    chooseTrack('Spanish');
    loaded(video);
    video.currentTime = 105;
    emit(video, 'timeupdate');

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    const query = queryOf(video.getAttribute('src'));
    expect(query.get('t')).toBe('1915');
    expect(query.get('a')).toBe('1');
  });
});

describe('Player — the Watch tick after a switch', () => {
  stubMediaElement();
  reloadOnNewSource();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function resumeWrites(): number[] {
    return fetchMock.mock.calls
      .filter(([input]) => String(input).endsWith('/resume'))
      .map(([, init]) => {
        const body = JSON.parse(String(init?.body)) as { value: number };
        return body.value;
      });
  }

  it('keeps reporting the Absolute position, not the new stream’s own time', async () => {
    const { video } = await renderPlaying();
    chooseTrack('Spanish');
    loaded(video);
    await settled();
    video.currentTime = 105;
    emit(video, 'timeupdate');

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    await settled();

    const writes = resumeWrites();
    expect(writes.at(-1)).toBe(1905);
    expect(writes).not.toContain(105);
  });
});

describe('Player — the chrome while the menu is open', () => {
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

  it('stays up while the menu is open, however long it is left', async () => {
    await renderPlaying();

    fireEvent.click(screen.getByRole('button', { name: 'Audio' }));
    idleFor(10_000);

    expect(screen.getByRole('menu')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDefined();
  });

  it('closes on Escape without leaving the player, and fades again after', async () => {
    await renderPlaying();
    fireEvent.click(screen.getByRole('button', { name: 'Audio' }));

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await settled();

    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByText('Browse home')).toBeNull();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDefined();

    idleFor(3000);

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('closes on a press outside it, and fades again after', async () => {
    await renderPlaying();
    fireEvent.click(screen.getByRole('button', { name: 'Audio' }));

    fireEvent.pointerDown(screen.getByText('Northwind'));

    expect(screen.queryByRole('menu')).toBeNull();

    idleFor(3000);

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });
});

describe('Player — the a key', () => {
  stubMediaElement();
  reloadOnNewSource();

  it('moves to the next track on a, and wraps back to the first', async () => {
    const { video } = await renderPlaying();

    fireEvent.keyDown(window, { key: 'a' });
    expect(queryOf(video.getAttribute('src')).get('a')).toBe('1');
    loaded(video);
    await settled();

    fireEvent.keyDown(window, { key: 'A', shiftKey: true });

    expect(video.getAttribute('src')).toBe(STREAM);
  });
});
