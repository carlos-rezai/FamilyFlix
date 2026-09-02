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
import type { Movie, PlaybackRead } from '@/types';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';

/**
 * 10 — Video player, Phase 3: "the playback read and the transport chrome"
 * (issue #85).
 *
 * The player stops being a bare element with the browser's controls on it. This
 * is the screen the family actually sees: our **Chrome** over a blurred
 * backdrop, the film starting on its own, the controls fading into **Idle**
 * three seconds after the mouse stops, and a **Player notice** where a black
 * rectangle used to be.
 *
 * Everything here is asserted from outside — what is on screen, what a click
 * does, where Back lands. The element underneath is jsdom's, driven by
 * `stubMediaElement`, because jsdom has no media of its own: without it
 * `play()` returns nothing and `paused` never moves, so not one of these
 * behaviours would be observable.
 *
 * What this slice cannot do yet is seek: the scrubber and the volume slider are
 * the next one's, which is the cost of reviewing the element binding apart from
 * the drag arithmetic.
 */
const FILM = 'Northwind';

const NORTHWIND: Movie = makeMovie({
  id: 'm1',
  title: FILM,
  year: 1994,
  runtimeMinutes: 128,
  videoPath: 'Northwind (1994)/northwind.mp4',
});

/** What the file says it runs to, which is not what the record says. */
const DIRECT_PLAY: PlaybackRead = { path: 'direct', durationSeconds: 6832.5 };

const BUFFERING = 'Getting this film ready…';
const MISSING_TITLE = 'This film’s file is missing';

/** The prototype's circle, to the pixel — the one centred element. */
const CIRCLE_SIZE = '96px';

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function notFoundResponse(error: string): Response {
  return {
    ok: false,
    status: 404,
    json: () => Promise.resolve({ error }),
  } as unknown as Response;
}

function serverErrorResponse(): Response {
  return {
    ok: false,
    status: 500,
    json: () => Promise.resolve({ error: 'boom' }),
  } as unknown as Response;
}

/** Whether the two watch writes are refused — a backend hiccup, mid-film. */
let writeFails = false;

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
  writeFails = false;
  answerWith({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Answer the two requests the screen makes — the movie record for its title and
 * artwork, and the **Playback read** for its path and duration. A `playback` of
 * `null` is the film whose file is missing, which is the 404 the notice is
 * reached through.
 */
function answerWith({
  movie = NORTHWIND,
  playback = DIRECT_PLAY as PlaybackRead | null,
}: {
  movie?: Movie;
  playback?: PlaybackRead | null;
}) {
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url === '/api/movies/m1') {
      return Promise.resolve(okResponse(movie));
    }
    if (url === '/api/movies/m1/playback') {
      return Promise.resolve(
        playback === null
          ? notFoundResponse('No video file for movie: m1')
          : okResponse(playback)
      );
    }
    // The two watch writes. They echo what they were sent, which is what the
    // real routes do; `writeFails` is the backend hiccup that must never reach
    // the film.
    if (url === '/api/movies/m1/resume' || url === '/api/movies/m1/watched') {
      if (writeFails) {
        return Promise.resolve(serverErrorResponse());
      }
      const body = (
        init?.body === undefined ? {} : JSON.parse(String(init.body))
      ) as { value?: unknown };
      return Promise.resolve(okResponse({ value: body.value }));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

/** Every watch write the screen made, as the route and the value it carried. */
function watchWrites(): {
  route: string;
  value: unknown;
  keepalive?: boolean;
}[] {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method?.toUpperCase() === 'POST')
    .map(([input, init]) => {
      const url = String(input);
      const body = (
        init?.body === undefined ? {} : JSON.parse(String(init.body))
      ) as { value?: unknown };
      return {
        route: url.slice(url.lastIndexOf('/') + 1),
        value: body.value,
        keepalive: init?.keepalive,
      };
    });
}

/**
 * The player, opened from the film's own page — which is what the Back pill has
 * to be able to step back to.
 */
function renderPlayer() {
  const view = render(
    <ThemeProvider theme={theme}>
      <MemoryRouter
        initialEntries={['/movie/m1', '/movie/m1/play']}
        initialIndex={1}
      >
        <LocationProbe />
        <Routes>
          <Route path="/" element={<span>Browse home</span>} />
          <Route path="/movie/:id" element={<span>Movie page</span>} />
          <Route path="/movie/:id/play" element={<Player movieId="m1" />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );

  return { ...view, video: picture(view.container) };
}

/** The element the film plays in. */
function picture(container: HTMLElement): HTMLVideoElement {
  const video = container.querySelector('video');
  if (video === null) {
    throw new Error('The player drew no picture');
  }
  return video;
}

const pathname = () => screen.getByTestId('pathname').textContent;

/** The one 96px circle, when the centre of the picture is showing anything. */
function circle(container: HTMLElement): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>('*')).find(
    (element) => {
      const style = window.getComputedStyle(element);
      return style.width === CIRCLE_SIZE && style.height === CIRCLE_SIZE;
    }
  );
}

/** Whatever the picture sits over that is drawn blurred — the backdrop. */
function blurredLayer(container: HTMLElement): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>('*')).find(
    (element) => window.getComputedStyle(element).filter.includes('blur')
  );
}

/** Whether the cursor has been taken off the picture along with the chrome. */
function cursorHidden(video: HTMLElement): boolean {
  for (
    let element = video.parentElement;
    element;
    element = element.parentElement
  ) {
    if (window.getComputedStyle(element).cursor === 'none') {
      return true;
    }
  }
  return false;
}

/** Fire one of the element's own events, the way a browser would. */
function emit(video: HTMLMediaElement, type: string): void {
  act(() => {
    video.dispatchEvent(new Event(type));
  });
}

describe('Player — the picture', () => {
  stubMediaElement();

  it('points the element at the film’s stream', () => {
    const { video } = renderPlayer();

    expect(video.getAttribute('src')).toBe('/api/movies/m1/stream');
  });

  it('starts the film when the screen opens, without a second press', async () => {
    const { video } = renderPlayer();

    await waitFor(() => expect(video.paused).toBe(false));
  });

  it('names the film on screen', async () => {
    renderPlayer();

    expect(await screen.findByText(FILM)).toBeDefined();
  });

  it('has the blurred backdrop behind the picture from the first frame', () => {
    // Not after the record arrives and not after the first byte of video: the
    // screen must never be a flat black rectangle, and the gradient is
    // derivable from the id the URL already carried.
    const { container, video } = renderPlayer();

    const backdrop = blurredLayer(container);
    expect(backdrop).toBeDefined();
    const order = backdrop?.compareDocumentPosition(video) ?? 0;
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('pauses when the picture is clicked, and resumes when it is clicked again', async () => {
    // Anywhere on the picture, so nobody has to aim at a small button.
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));

    fireEvent.click(video);
    await waitFor(() => expect(video.paused).toBe(true));

    fireEvent.click(video);
    await waitFor(() => expect(video.paused).toBe(false));
  });

  it('shows the big play circle exactly while the film is stopped', async () => {
    const { container, video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));
    expect(circle(container)).toBeUndefined();

    fireEvent.click(video);

    await waitFor(() => expect(circle(container)).toBeDefined());
  });
});

describe('Player — leaving', () => {
  stubMediaElement();

  it('returns to the film’s page from the Back pill', async () => {
    renderPlayer();
    expect(pathname()).toBe('/movie/m1/play');

    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/movie/m1');
  });

  it('leaves the same way on Escape, which is the keyboard way out', async () => {
    // The same handler, not a second one: two ways out that can drift apart are
    // two behaviours to keep in step forever.
    renderPlayer();
    await screen.findByRole('button', { name: 'Back' });

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(pathname()).toBe('/movie/m1'));
  });
});

describe('Player — the chrome fading', () => {
  stubMediaElement();

  beforeEach(() => {
    // Real time still runs, so the two fetches still settle while the idle
    // countdown is driven by hand.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const idleFor = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  it('takes the chrome and the cursor away after three seconds of stillness', async () => {
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));
    await screen.findByRole('button', { name: 'Back' });

    idleFor(3000);

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(cursorHidden(video)).toBe(true);
  });

  it('brings both back on a twitch of the mouse', async () => {
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));
    await screen.findByRole('button', { name: 'Back' });
    idleFor(3000);

    fireEvent.mouseMove(video);

    expect(screen.getByRole('button', { name: 'Back' })).toBeDefined();
    expect(cursorHidden(video)).toBe(false);
  });

  it('holds the chrome on screen for as long as the film is paused', async () => {
    // A paused player is someone deciding, not someone watching.
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));
    fireEvent.click(video);
    await waitFor(() => expect(video.paused).toBe(true));

    idleFor(30000);

    expect(screen.getByRole('button', { name: 'Back' })).toBeDefined();
    expect(cursorHidden(video)).toBe(false);
  });
});

describe('Player — a film that is getting ready', () => {
  stubMediaElement();

  it('says so while the element is waiting, and stops when it plays', async () => {
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));

    emit(video, 'waiting');
    expect(await screen.findByText(BUFFERING)).toBeDefined();

    emit(video, 'playing');
    await waitFor(() => expect(screen.queryByText(BUFFERING)).toBeNull());
  });
});

describe('Player — a film whose file is missing', () => {
  stubMediaElement();

  beforeEach(() => {
    answerWith({ playback: null });
  });

  it('says what has happened rather than showing a black rectangle', async () => {
    const { container } = renderPlayer();

    expect(await screen.findByText(MISSING_TITLE)).toBeDefined();
    expect(blurredLayer(container)).toBeDefined();
  });

  it('leaves a way back, so a broken film is not a screen with no exit', async () => {
    renderPlayer();
    await screen.findByText(MISSING_TITLE);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/movie/m1');
  });

  it('does not idle its own way out away', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderPlayer();
      await screen.findByText(MISSING_TITLE);

      act(() => {
        vi.advanceTimersByTime(30000);
      });

      expect(screen.getByRole('button', { name: 'Back' })).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Player — when the browser refuses to autoplay', () => {
  stubMediaElement({ autoplay: 'refused' });

  it('offers the big play circle rather than failing silently', async () => {
    const { container, video } = renderPlayer();

    await waitFor(() => expect(circle(container)).toBeDefined());
    expect(video.paused).toBe(true);
  });

  it('starts the film on one press', async () => {
    const { container, video } = renderPlayer();
    await waitFor(() => expect(circle(container)).toBeDefined());

    fireEvent.click(video);

    await waitFor(() => expect(video.paused).toBe(false));
    expect(circle(container)).toBeUndefined();
  });
});

/**
 * 10 — Video player, Phase 4 (issue #86).
 *
 * The screen can seek. What is asserted here is only what the screen adds over
 * its parts: that the duration the **Scrubber** draws and clamps against came
 * from the **Playback read** rather than from the movie record, and that a drag
 * on it reaches the element. The drag arithmetic itself belongs to
 * `useDragScalar`, and the "no seek until release" rule to `PlayerScrubber`.
 */
describe('Player — the scrubber over a real film', () => {
  stubMediaElement();

  const TRACK_LEFT = 100;
  const TRACK_WIDTH = 200;

  /** The scrubber, laid out — jsdom lays nothing out, so the rect is stubbed. */
  async function seekBar(): Promise<HTMLElement> {
    const track = await screen.findByRole('slider', { name: 'Seek' });
    track.getBoundingClientRect = () =>
      ({
        x: TRACK_LEFT,
        y: 0,
        left: TRACK_LEFT,
        right: TRACK_LEFT + TRACK_WIDTH,
        top: 0,
        bottom: 6,
        width: TRACK_WIDTH,
        height: 6,
        toJSON: () => ({}),
      }) as DOMRect;
    return track;
  }

  /** Drag the knob to a fraction along the bar and let go of it there. */
  function dragTo(track: HTMLElement, fraction: number): void {
    const clientX = TRACK_LEFT + TRACK_WIDTH * fraction;
    fireEvent.pointerDown(track, { clientX: TRACK_LEFT });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX }));
    });
  }

  it('shows the film’s length as the file reports it, not as the record rounds it', async () => {
    // The record says 128 minutes — `2:08:00`. The file says 6832.5 seconds —
    // `1:53:52`. The second one is the truth, and it is the only one the
    // scrubber is allowed to have come from.
    renderPlayer();

    expect(await screen.findByText('1:53:52')).toBeDefined();
    expect(screen.queryByText('2:08:00')).toBeNull();
  });

  it('takes the film to where the knob was let go', async () => {
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));

    dragTo(await seekBar(), 0.5);

    expect(video.currentTime).toBe(6832.5 / 2);
  });

  it('replays the last ten seconds, and clamps at the start of the film', async () => {
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));
    await screen.findByRole('button', { name: 'Back 10s' });

    dragTo(await seekBar(), 0.5);
    emit(video, 'timeupdate');
    fireEvent.click(screen.getByRole('button', { name: 'Back 10s' }));
    expect(video.currentTime).toBe(6832.5 / 2 - 10);

    video.currentTime = 4;
    emit(video, 'timeupdate');
    fireEvent.click(screen.getByRole('button', { name: 'Back 10s' }));
    expect(video.currentTime).toBe(0);
  });

  it('turns the film down, and silences it outright', async () => {
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));

    const bar = await screen.findByRole('slider', { name: 'Volume' });
    bar.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        right: 90,
        top: 0,
        bottom: 5,
        width: 90,
        height: 5,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.pointerDown(bar, { clientX: 45 });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 45 }));
    });
    expect(video.volume).toBeCloseTo(0.5);

    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(video.muted).toBe(true);
    expect(await screen.findByRole('button', { name: 'Unmute' })).toBeDefined();
  });

  it('gives a film the catalogue knows no runtime for a real, seekable scrubber', async () => {
    // User story 64. `runtimeMinutes` being blank is a metadata gap, and it
    // costs the family nothing, because the duration never came from there.
    answerWith({
      movie: makeMovie({
        id: 'm1',
        title: FILM,
        runtimeMinutes: null,
        videoPath: 'Northwind (1994)/northwind.mp4',
      }),
    });
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));

    expect(await screen.findByText('1:53:52')).toBeDefined();
    dragTo(await seekBar(), 0.25);

    expect(video.currentTime).toBe(6832.5 / 4);
  });
});

/**
 * 10 — Video player, Phase 5: "watching writes" (issue #87).
 *
 * The loop closes on screen. Everything the family gets out of this slice is
 * here: a film that starts where they left it, a position that keeps being
 * written while they watch, and — as importantly — nothing at all written when
 * they open a film and change their mind.
 *
 * The reporter's own rules are pinned in `useWatchReporter.test.ts`. What these
 * assert is the wiring: that the screen hands it the **Absolute position** and
 * the film's real length, that Back is an exit, and that a refused write is
 * something the family never sees.
 */
describe('Player — watching writes', () => {
  stubMediaElement();

  it('starts an in-progress film where the family left it', async () => {
    answerWith({
      movie: makeMovie({
        id: 'm1',
        title: FILM,
        resumePositionSeconds: 1800,
        status: 'in-progress',
      }),
    });
    const { video } = renderPlayer();

    // Silently, and with no "Resume / Start over" dialog — the prototype draws
    // none, and the film simply carries on.
    await waitFor(() => expect(video.currentTime).toBe(1800));
    expect(screen.queryByText('Start over')).toBeNull();
  });

  it('starts a film nobody has opened at the beginning', async () => {
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));

    expect(video.currentTime).toBe(0);
  });

  it('starts a finished film at the beginning rather than in the credits', async () => {
    answerWith({
      movie: makeMovie({
        id: 'm1',
        title: FILM,
        watched: true,
        resumePositionSeconds: 5400,
        status: 'watched',
      }),
    });
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));

    expect(video.currentTime).toBe(0);
  });

  it('writes nothing when a film is opened and left again straight away', async () => {
    // Three seconds is not watching. If this wrote, the film would be sitting
    // at the front of the family's Continue Watching row over a glance.
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));
    video.currentTime = 3;
    emit(video, 'timeupdate');

    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));

    expect(watchWrites()).toEqual([]);
  });

  it('writes where the film was on the way out', async () => {
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));
    video.currentTime = 1200;
    emit(video, 'timeupdate');

    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));

    expect(watchWrites()).toEqual([
      { route: 'resume', value: 1200, keepalive: true },
    ]);
  });

  it('writes where the film was when it is paused', async () => {
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));
    video.currentTime = 900;
    emit(video, 'timeupdate');

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    await waitFor(() =>
      expect(watchWrites()).toEqual([
        { route: 'resume', value: 900, keepalive: undefined },
      ])
    );
  });

  it('writes where a settled seek left the film', async () => {
    // The second the film was taken to, not the one it was at before it moved:
    // the position prop has not caught up when the seek lands, and a reporter
    // reading it would store the wrong place every time.
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));
    video.currentTime = 900;
    emit(video, 'timeupdate');

    fireEvent.click(await screen.findByRole('button', { name: 'Back 10s' }));

    await waitFor(() =>
      expect(watchWrites()).toEqual([
        { route: 'resume', value: 890, keepalive: undefined },
      ])
    );
  });

  it('marks a film watched when it reaches its end', async () => {
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));
    video.currentTime = 6832.5;
    emit(video, 'timeupdate');

    emit(video, 'ended');

    await waitFor(() =>
      expect(watchWrites()).toEqual([
        { route: 'watched', value: true, keepalive: undefined },
      ])
    );
  });

  it('leaves the film playing when the server refuses a write', async () => {
    // A backend hiccup must never interrupt the film: no notice over the
    // picture, no pause, and the position exactly where it was.
    writeFails = true;
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));
    video.currentTime = 900;
    emit(video, 'timeupdate');

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(watchWrites()).toHaveLength(1));

    expect(video.paused).toBe(false);
    expect(video.currentTime).toBe(900);
    expect(screen.queryByText(MISSING_TITLE)).toBeNull();
    expect(screen.queryByText(BUFFERING)).toBeNull();
  });
});
