import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { Player } from './Player';
import { theme } from '@/styles/theme';
import type { Movie } from '@/types';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';

/**
 * 41 — Link or copy, Phase 6: "an unreachable folder" (issue #346).
 *
 * A **Linked video** plays from a **Library folder**, and a folder on a drive
 * that isn't plugged in answers the **Playback read** with a `503`. The player
 * says so — **Can’t reach this film’s folder** — in the same circle the other
 * unavailable notices are drawn in, never pointing the element at a stream
 * that would answer the same, and leaving the Back pill as the way out. A
 * `404` is still the file gone, and still the missing-file notice.
 *
 * Its own file rather than another block in `Player.test.tsx`: the harness here
 * is only the two opening reads, which is all this notice depends on.
 */
const NORTHWIND: Movie = makeMovie({
  id: 'm1',
  title: 'Northwind',
  year: 1994,
  videoPath: 'Northwind (1994)/northwind.mp4',
});

const MISSING_TITLE = 'This film’s file is missing';
const UNREACHABLE_TITLE = 'Can’t reach this film’s folder';
const UNREACHABLE_BODY =
  'It plays from one of your library folders, which can’t be reached right ' +
  'now — most likely a drive that isn’t plugged in.';

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
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The `503` the routes answer for a Library folder out of reach. */
function unreachableResponse(): Response {
  return new Response(
    JSON.stringify({ error: "The video's Library folder is out of reach: m1" }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  );
}

/** Answer the record, and the Playback read with the response given. */
function answerPlaybackWith(playback: () => Response): void {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url === '/api/movies/m1') {
      return Promise.resolve(okResponse(NORTHWIND));
    }
    if (url === '/api/movies/m1/playback') {
      return Promise.resolve(playback());
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

function renderScreen() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter
        initialEntries={['/movie/m1', '/movie/m1/play']}
        initialIndex={1}
      >
        <LocationProbe />
        <Routes>
          <Route path="/movie/:id" element={<span>Movie page</span>} />
          <Route
            path="/movie/:id/play"
            element={<Player playable={{ kind: 'movie', id: 'm1' }} />}
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('Player — a film whose folder can’t be reached', () => {
  stubMediaElement();

  beforeEach(() => {
    answerPlaybackWith(unreachableResponse);
  });

  it('says the folder can’t be reached, for a 503', async () => {
    renderScreen();

    expect(await screen.findByText(UNREACHABLE_TITLE)).toBeDefined();
    expect(screen.getByText(UNREACHABLE_BODY)).toBeDefined();
    expect(screen.queryByText(MISSING_TITLE)).toBeNull();
  });

  it('points nothing at the stream', async () => {
    const { container } = renderScreen();
    await screen.findByText(UNREACHABLE_TITLE);

    expect(container.querySelector('video')).toBeNull();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).endsWith('/stream'))
    ).toBe(false);
  });

  it('leaves the Back pill as the way out', async () => {
    renderScreen();
    await screen.findByText(UNREACHABLE_TITLE);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/movie/m1');
  });
});

describe('Player — a 404 is still a missing file', () => {
  stubMediaElement();

  it('shows the missing-file notice, not the folder out of reach', async () => {
    answerPlaybackWith(() => notFoundResponse('No video file for movie: m1'));
    renderScreen();

    expect(await screen.findByText(MISSING_TITLE)).toBeDefined();
    expect(screen.queryByText(UNREACHABLE_TITLE)).toBeNull();
  });
});
