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
import type { Cue, Movie, PlaybackRead } from '@/types';
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
  cues = [] as Cue[] | null,
}: {
  movie?: Movie;
  playback?: PlaybackRead | null;
  cues?: Cue[] | null;
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
    // The **Cue list**, which is asked for only once subtitles are switched on.
    // `null` is the subtitle row whose file has gone; `[]` is the file that
    // would not parse. Both leave the film playing with no box.
    if (url.startsWith('/api/movies/m1/subtitles/')) {
      return Promise.resolve(
        cues === null
          ? notFoundResponse('No subtitle file for movie: m1')
          : okResponse(cues)
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

/**
 * 10 — Video player, Phase 6: "subtitles" (issue #88).
 *
 * Subtitles end to end, which for this screen means four questions: whether the
 * CC pill is there at all, what pressing it does, which line is on screen, and
 * what happens when the file behind it is no good.
 *
 * The seam is unchanged — what is on screen and what a click does — and
 * everything underneath is asserted where it belongs: which format the file was
 * is `parseSubtitle`'s, which track was picked is `preferredSubtitle`'s, which
 * cue covers a second is `cueAt`'s, and what the box looks like is
 * `SubtitleOverlay`'s. What is left here is the wiring those four hang off, and
 * the two states only this screen can show: **off when the film opens**, and
 * **still playing** when the subtitle file is unreadable.
 */

/** Two lines of the film, as the cue route hands them over. */
const CUES: Cue[] = [
  { start: 1, end: 4, text: '— You can see the whole coast from up here.' },
  { start: 3600, end: 3604, text: 'An hour later.' },
];

const FIRST_LINE = CUES[0].text;
const LATER_LINE = CUES[1].text;

/** The film with subtitle files beside it — two, so a track has to be chosen. */
const SUBTITLED: Movie = makeMovie({
  id: 'm1',
  title: FILM,
  year: 1994,
  runtimeMinutes: 128,
  videoPath: 'Northwind (1994)/northwind.mp4',
  subtitles: [
    {
      id: 'sub-pt',
      path: 'Northwind (1994)/pt.srt',
      language: 'pt',
      position: 1,
    },
    {
      id: 'sub-en',
      path: 'Northwind (1994)/en.srt',
      language: 'en',
      position: 0,
    },
  ],
});

/** Every cue list this screen asked for, as the subtitle id it asked under. */
function cueRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/subtitles/'))
    .map((url) => url.slice(url.lastIndexOf('/') + 1));
}

describe('Player — the CC pill', () => {
  stubMediaElement();

  it('is drawn for a film with subtitle files beside it', async () => {
    answerWith({ movie: SUBTITLED, cues: CUES });
    renderPlayer();

    expect(
      await screen.findByRole('button', { name: 'Subtitles' })
    ).toBeDefined();
  });

  it('is not drawn at all for a film with none', async () => {
    // `NORTHWIND` has no subtitle rows. Nothing to press, and nothing to
    // explain to a parent who pressed it and saw no change.
    //
    // Stated against the subtitled film in the same test, because an absence on
    // its own is equally satisfied by a pill that was never built.
    answerWith({ movie: SUBTITLED, cues: CUES });
    const subtitled = renderPlayer();
    expect(
      await screen.findByRole('button', { name: 'Subtitles' })
    ).toBeDefined();
    subtitled.unmount();

    answerWith({ movie: NORTHWIND });
    renderPlayer();

    await screen.findByRole('button', { name: 'Back' });
    expect(screen.queryByRole('button', { name: 'Subtitles' })).toBeNull();
  });
});

describe('Player — turning subtitles on and off', () => {
  stubMediaElement();

  it('opens the film with subtitles off', async () => {
    // The prototype's `playMovie()` sets `subsOn:true`; we ship them off. That
    // is a recorded divergence, not an oversight — auto-on subtitles are a
    // roadmap item, and defaulting them on would implement it by accident.
    answerWith({ movie: SUBTITLED, cues: CUES });
    renderPlayer();

    const pill = await screen.findByRole('button', { name: 'Subtitles' });
    expect(pill.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText(FIRST_LINE)).toBeNull();
  });

  it('asks for no cue list until someone presses CC', async () => {
    // A film watched without subtitles should not fetch a file it will never
    // draw.
    answerWith({ movie: SUBTITLED, cues: CUES });
    renderPlayer();

    await screen.findByRole('button', { name: 'Subtitles' });
    expect(cueRequests()).toEqual([]);
  });

  it('puts the line for where the film is on screen when CC is pressed', async () => {
    answerWith({ movie: SUBTITLED, cues: CUES });
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));
    video.currentTime = 2;
    emit(video, 'timeupdate');

    fireEvent.click(await screen.findByRole('button', { name: 'Subtitles' }));

    expect(await screen.findByText(FIRST_LINE)).toBeDefined();
  });

  it('reads as switched on while they are showing', async () => {
    answerWith({ movie: SUBTITLED, cues: CUES });
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));

    fireEvent.click(await screen.findByRole('button', { name: 'Subtitles' }));

    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'Subtitles' })
          .getAttribute('aria-pressed')
      ).toBe('true')
    );
  });

  it('takes them away again on a second press', async () => {
    answerWith({ movie: SUBTITLED, cues: CUES });
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));
    video.currentTime = 2;
    emit(video, 'timeupdate');
    const pill = await screen.findByRole('button', { name: 'Subtitles' });

    fireEvent.click(pill);
    await screen.findByText(FIRST_LINE);
    fireEvent.click(pill);

    await waitFor(() => expect(screen.queryByText(FIRST_LINE)).toBeNull());
    expect(pill.getAttribute('aria-pressed')).toBe('false');
  });

  it('fetches the cue list once, not again on every press', async () => {
    // Cues are stamped in absolute position, so there is nothing about turning
    // them off and on again — or about a seek — for them to be re-fetched
    // against.
    answerWith({ movie: SUBTITLED, cues: CUES });
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));
    const pill = await screen.findByRole('button', { name: 'Subtitles' });

    fireEvent.click(pill);
    await screen.findByText(FIRST_LINE);
    fireEvent.click(pill);
    fireEvent.click(pill);
    await screen.findByText(FIRST_LINE);

    expect(cueRequests()).toHaveLength(1);
  });

  it('reads the track preferredSubtitle picked, not whichever row came back first', async () => {
    // The rows arrive Portuguese-first; `position` says English is track one.
    // Nobody chooses, so the choice has to be the deterministic one.
    answerWith({ movie: SUBTITLED, cues: CUES });
    const { video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));

    fireEvent.click(await screen.findByRole('button', { name: 'Subtitles' }));

    await waitFor(() => expect(cueRequests()).toEqual(['sub-en']));
  });
});

describe('Player — which line is on screen', () => {
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

  /** Open the film, start it, and switch subtitles on. */
  async function withSubtitlesOn() {
    answerWith({ movie: SUBTITLED, cues: CUES });
    const view = renderPlayer();
    await waitFor(() => expect(view.video.paused).toBe(false));
    fireEvent.click(await screen.findByRole('button', { name: 'Subtitles' }));
    await waitFor(() => expect(cueRequests()).toHaveLength(1));
    return view;
  }

  it('follows the film from one line to the next', async () => {
    const { video } = await withSubtitlesOn();

    video.currentTime = 2;
    emit(video, 'timeupdate');
    expect(await screen.findByText(FIRST_LINE)).toBeDefined();

    video.currentTime = 3601;
    emit(video, 'timeupdate');
    expect(await screen.findByText(LATER_LINE)).toBeDefined();
    expect(screen.queryByText(FIRST_LINE)).toBeNull();
  });

  it('draws no box at all through a stretch with no dialogue', async () => {
    // Not an empty plate hovering over the picture — nothing.
    const { video } = await withSubtitlesOn();
    video.currentTime = 2;
    emit(video, 'timeupdate');
    await screen.findByText(FIRST_LINE);

    video.currentTime = 600;
    emit(video, 'timeupdate');

    await waitFor(() => expect(screen.queryByText(FIRST_LINE)).toBeNull());
    expect(screen.queryByText(LATER_LINE)).toBeNull();
  });

  it('has the right line immediately after a scrub, not the one from before it', async () => {
    // The property the whole design exists for, and the cheapest place to
    // assert it. A native `<track>` is timed against **Element time**, so once a
    // stream path starts at a non-zero **Stream offset** its cues run late by
    // exactly the seek distance. Ours are stamped in **Absolute position** and
    // read by absolute position, so a jump cannot desync them.
    const { video } = await withSubtitlesOn();
    video.currentTime = 2;
    emit(video, 'timeupdate');
    await screen.findByText(FIRST_LINE);

    // 3601 seconds along a 6832.5-second film.
    dragTo(await seekBar(), 3601 / 6832.5);
    emit(video, 'timeupdate');

    expect(await screen.findByText(LATER_LINE)).toBeDefined();
    expect(screen.queryByText(FIRST_LINE)).toBeNull();
  });

  it('uses no native captions machinery to do it', async () => {
    // No `<track>`, in the document or on the element. The box is ours, so
    // there is nothing native to hide, style around, or keep in step.
    const { container, video } = await withSubtitlesOn();
    video.currentTime = 2;
    emit(video, 'timeupdate');
    await screen.findByText(FIRST_LINE);

    expect(container.querySelector('track')).toBeNull();
    expect(video.querySelector('track')).toBeNull();
    expect(video.textTracks?.length ?? 0).toBe(0);
  });
});

describe('Player — the subtitle box and the chrome', () => {
  stubMediaElement();

  /** The band the line is centred in — what positions the box up the picture. */
  function band(): HTMLElement {
    const parent = screen.getByText(FIRST_LINE).parentElement;
    if (parent === null) {
      throw new Error('The subtitle box was drawn outside anything');
    }
    return parent;
  }

  /** The stacking order of the element, walked up until one is declared. */
  function stackingOrder(from: HTMLElement): number {
    for (
      let element: HTMLElement | null = from;
      element;
      element = element.parentElement
    ) {
      const index = window.getComputedStyle(element).zIndex;
      if (index !== '' && index !== 'auto') {
        return Number(index);
      }
    }
    return 0;
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function withSubtitlesOn() {
    answerWith({ movie: SUBTITLED, cues: CUES });
    const view = renderPlayer();
    await waitFor(() => expect(view.video.paused).toBe(false));
    fireEvent.click(await screen.findByRole('button', { name: 'Subtitles' }));
    view.video.currentTime = 2;
    emit(view.video, 'timeupdate');
    await screen.findByText(FIRST_LINE);
    return view;
  }

  it('lifts out of the chrome’s way while the chrome is on screen', async () => {
    const { container } = await withSubtitlesOn();
    const lifted = parseFloat(window.getComputedStyle(band()).bottom);

    // Three seconds of stillness, and the chrome goes.
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    await waitFor(() =>
      expect(container.querySelector('[aria-hidden="true"]')).toBeDefined()
    );

    await waitFor(() =>
      expect(parseFloat(window.getComputedStyle(band()).bottom)).toBeLessThan(
        lifted
      )
    );
  });

  it('never sits under the chrome, whichever is drawn first', async () => {
    // "Above the controls" is a stacking claim, not only a vertical one: the
    // last line of a film must not end up behind the transport row.
    await withSubtitlesOn();
    const bottomBar = screen.getByRole('slider', { name: 'Seek' });

    expect(stackingOrder(band())).toBeGreaterThanOrEqual(
      stackingOrder(bottomBar)
    );
  });
});

describe('Player — a subtitle file that is no good', () => {
  stubMediaElement();

  it('keeps the film playing when the file would not parse', async () => {
    // The route answers `200 []` for a malformed `.ass`. The film runs on, the
    // box never appears, and no notice is drawn — a bad subtitle file is not a
    // broken film.
    answerWith({ movie: SUBTITLED, cues: [] });
    const { container, video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));

    fireEvent.click(await screen.findByRole('button', { name: 'Subtitles' }));
    video.currentTime = 2;
    emit(video, 'timeupdate');

    await waitFor(() => expect(cueRequests()).toHaveLength(1));
    expect(video.paused).toBe(false);
    expect(screen.queryByText(FIRST_LINE)).toBeNull();
    expect(circle(container)).toBeUndefined();
    expect(screen.queryByText(MISSING_TITLE)).toBeNull();
  });

  it('keeps the film playing when the subtitle file has gone entirely', async () => {
    // A 404 on the cue route: the row is in the database, the file is not on
    // disk. Same silence, same running film.
    answerWith({ movie: SUBTITLED, cues: null });
    const { container, video } = renderPlayer();
    await waitFor(() => expect(video.paused).toBe(false));

    fireEvent.click(await screen.findByRole('button', { name: 'Subtitles' }));
    video.currentTime = 2;
    emit(video, 'timeupdate');

    await waitFor(() => expect(cueRequests()).toHaveLength(1));
    expect(video.paused).toBe(false);
    expect(screen.queryByText(FIRST_LINE)).toBeNull();
    expect(circle(container)).toBeUndefined();
    expect(screen.queryByText(MISSING_TITLE)).toBeNull();
  });
});
