import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';

import App from './App';
import type { HomePayload, Movie, Settings } from '@/types';
import {
  LocationProbe,
  navigationType,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';

/**
 * 27 — Ultrawide margins, Phase 1 (issue #249): the route table's shape,
 * through `App` on a `MemoryRouter`. The frame's own rule — capped on,
 * uncapped off or `null` — is `ContentFrame.test.tsx`'s (refactor 252).
 *
 * While **Ultrawide margins** is on, every route but the player's two renders
 * inside one frame capped at the **Content measure**; `/movie/:id/play` and
 * `/episode/:id/play` render outside it whatever the preference says. The
 * frame follows the provider's read as it lands, and flipping the Toggle on
 * `/settings` re-frames the page at once, with no navigation.
 *
 * The frame is found the way a user would meet it — as the box around what is
 * on screen that resolves the measure — not by name or nesting.
 */

const NORTHWIND: Movie = makeMovie({ id: 'a1', title: 'Northwind' });

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

/**
 * What the settings read answers this test: `'held'` answers only when the
 * test calls `landRead`.
 */
let settingsRead: Settings | 'held';
let landRead: (settings: Settings) => void = () => undefined;

beforeEach(() => {
  settingsRead = { subtitleLanguage: 'English', ultrawideMargins: true };
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  // The settings pair answers as the test says; the home and the one movie
  // answer what the screens need; anything else is refused, and every screen
  // here keeps what it had on a refusal.
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url === '/api/settings') {
      return settingsRead === 'held'
        ? new Promise<Response>((resolve) => {
            landRead = (settings) => resolve(okResponse(settings));
          })
        : Promise.resolve(okResponse(settingsRead));
    }
    if (url === '/api/settings/ultrawide-margins' && init?.method === 'POST') {
      const { value } = JSON.parse(String(init.body)) as { value: boolean };
      return Promise.resolve(okResponse({ value }));
    }
    if (url.includes('/api/home')) {
      const payload: HomePayload = {
        continueWatching: [],
        favorites: [],
        rows: [{ genre: 'Action', count: 1, movies: [NORTHWIND] }],
      };
      return Promise.resolve(okResponse(payload));
    }
    if (url === '/api/movies/a1') {
      return Promise.resolve(okResponse(NORTHWIND));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The browser's own Back button: one history step, outside the chrome. */
function HistoryProbe() {
  const navigate = useNavigate();

  return (
    <button type="button" onClick={() => navigate(-1)}>
      history step
    </button>
  );
}

function renderApp(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
      <LocationProbe />
    </MemoryRouter>
  );
}

/** Every ancestor of `element` resolving the Content measure as its cap. */
function framesAround(element: Element): HTMLElement[] {
  const frames: HTMLElement[] = [];
  for (
    let node = element.parentElement;
    node !== null;
    node = node.parentElement
  ) {
    if (getComputedStyle(node).maxWidth === '1920px') {
      frames.push(node);
    }
  }
  return frames;
}

/** The one frame around `element`, asserting there is exactly one. */
function frameAround(element: Element): HTMLElement {
  const frames = framesAround(element);
  expect(frames).toHaveLength(1);
  return frames[0];
}

describe('App — the Content frame on a framed route', () => {
  it('caps the library at 1920px with auto side margins while the preference is on', async () => {
    renderApp('/');
    const title = (await screen.findAllByText('Northwind'))[0];

    await waitFor(() => expect(framesAround(title)).toHaveLength(1));
    const frame = frameAround(title);
    expect(getComputedStyle(frame).maxWidth).toBe('1920px');
    expect(getComputedStyle(frame).marginLeft).toBe('auto');
    expect(getComputedStyle(frame).marginRight).toBe('auto');
  });

  it('caps the movie page too — framed is every route but the player', async () => {
    renderApp('/movie/a1');
    const title = (await screen.findAllByText('Northwind'))[0];

    await waitFor(() => expect(framesAround(title)).toHaveLength(1));
  });

  it('draws no cap while the read has not landed, and the cap once it lands on', async () => {
    settingsRead = 'held';
    renderApp('/');
    const title = (await screen.findAllByText('Northwind'))[0];

    expect(framesAround(title)).toEqual([]);

    await act(async () => {
      landRead({ subtitleLanguage: 'English', ultrawideMargins: true });
    });

    await waitFor(() => expect(framesAround(title)).toHaveLength(1));
  });
});

describe('App — the player outside the frame', () => {
  // The player drives a media element, and jsdom has none.
  stubMediaElement();

  /**
   * The player opened over the library, so a **History step** leaves it for a
   * framed route: the frame there is the proof the preference was on while
   * the player drew none.
   */
  function renderPlayerOverLibrary(player: string) {
    return render(
      <MemoryRouter initialEntries={['/', player]} initialIndex={1}>
        <App />
        <LocationProbe />
        <HistoryProbe />
      </MemoryRouter>
    );
  }

  /** After the player's assertion: step back and find the library framed. */
  async function libraryIsFramed() {
    fireEvent.click(screen.getByRole('button', { name: 'history step' }));
    const title = (await screen.findAllByText('Northwind'))[0];
    expect(pathname()).toBe('/');
    expect(framesAround(title)).toHaveLength(1);
  }

  /** Waits until the settings read has been asked and answered. */
  async function preferenceIsOn() {
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input]) => String(input) === '/api/settings'
        )
      ).toBe(true)
    );
    await act(async () => {
      await Promise.resolve();
    });
  }

  it('renders the movie player outside the frame while the preference is on', async () => {
    const { container } = renderPlayerOverLibrary('/movie/a1/play');
    await waitFor(() =>
      expect(container.querySelector('video')).not.toBeNull()
    );
    await preferenceIsOn();

    expect(framesAround(container.querySelector('video') as Element)).toEqual(
      []
    );
    await libraryIsFramed();
  });

  it('renders the episode player outside the frame while the preference is on', async () => {
    const fallThrough = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url === '/api/episodes/e24/playback') {
        return Promise.resolve(
          okResponse({ path: 'direct', durationSeconds: 2640 })
        );
      }
      if (url === '/api/episodes/e24') {
        return Promise.resolve(
          okResponse({
            episode: {
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
              videoPath: 'harbor/S02E04.mp4',
              subtitles: [],
              lastWatchedAt: null,
            },
            series: { id: 'harbor', title: 'Harbor & Vine' },
            next: null,
          })
        );
      }
      return fallThrough
        ? fallThrough(input, init)
        : Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    const { container } = renderPlayerOverLibrary('/episode/e24/play');
    await waitFor(() =>
      expect(container.querySelector('video')).not.toBeNull()
    );
    await preferenceIsOn();

    expect(framesAround(container.querySelector('video') as Element)).toEqual(
      []
    );
    await libraryIsFramed();
  });
});

describe('App — the Toggle on /settings', () => {
  it('re-frames the page at once when pressed, with no navigation', async () => {
    settingsRead = { subtitleLanguage: 'English', ultrawideMargins: false };
    const user = userEvent.setup();
    renderApp('/settings');
    const toggle = await screen.findByRole('switch', {
      name: 'Ultrawide margins',
    });
    const heading = screen.getByRole('heading', { name: 'Settings' });
    expect(framesAround(heading)).toEqual([]);

    await user.click(toggle);

    expect(framesAround(heading)).toHaveLength(1);
    expect(pathname()).toBe('/settings');
    expect(navigationType()).toBe('POP');
  });

  it('takes the cap off again when pressed a second time', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    const toggle = await screen.findByRole('switch', {
      name: 'Ultrawide margins',
    });
    const heading = screen.getByRole('heading', { name: 'Settings' });
    await waitFor(() => expect(framesAround(heading)).toHaveLength(1));

    await user.click(toggle);

    expect(framesAround(heading)).toEqual([]);
    expect(pathname()).toBe('/settings');
  });
});
