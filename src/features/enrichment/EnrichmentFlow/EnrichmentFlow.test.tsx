import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { EnrichmentFlow } from './EnrichmentFlow';
import type { EnrichmentRun, EnrichmentSummary } from '@/types';
import { theme } from '@/styles/theme';
import {
  LocationProbe,
  navigationType,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  createdResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 23 — Enrichment, Phase 2: "the tracer — Just this movie" (issue #204).
 *
 * The **Enrichment flow** organism opened from a movie's ⋯ menu —
 * `/enrich?movie=<id>`, the `single` **Enrichment scope**. The seam is `fetch`
 * and the router, `ImportFlow`'s precedent: what the maintainer sees, presses
 * and where the screen lands.
 *
 * - **Setup** shows the _Just this movie_ card, naming the film, **in place
 *   of** the two library scopes (`feat.EnrichmentFlow.dc.html`'s
 *   `scopeDefs`), and Start reads _Fetch details_.
 * - Start sends `POST /api/enrichment` with `scope: 'single'` and the movie.
 * - The flow polls the **Current enrichment run** until it reaches review,
 *   which shows _All done_ with _Back to the movie_ — and that follows the
 *   **Back rule** to the movie: a **History step** when the movie is behind
 *   it, the movie (its **Landing**) pushed on a deep link.
 *
 * Polling is real time, 500 ms a poll, so reaching review takes about a
 * second of wall clock.
 */

const MOVIE_ID = 'm1';
const TITLE = 'The Lantern Keeper';

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

const SUMMARY: EnrichmentSummary = {
  total: 1,
  complete: 0,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryRoot: null,
};

function makeRun(overrides: Partial<EnrichmentRun> = {}): EnrichmentRun {
  return {
    id: 'run-1',
    phase: 'running',
    scope: 'single',
    startedAt: '2026-09-26T12:00:00.000Z',
    total: 1,
    done: 0,
    enriched: 0,
    currentItem: TITLE,
    log: [],
    decisions: [],
    written: { sheet: false, posters: false },
    ...overrides,
  };
}

const method = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;

const isStart = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/enrichment' && method(init) === 'POST';

/**
 * A server with one film, a key and a connection. The current run is `404`
 * until Start answers `201` with a running run; every read after that answers
 * the run in review.
 */
function serve() {
  let started = false;
  fetchMock.mockImplementation((input, init) => {
    const p = path(input);
    if (isStart(input, init)) {
      started = true;
      return Promise.resolve(createdResponse(makeRun()));
    }
    if (p === '/api/enrichment/current' && method(init) === 'GET') {
      return Promise.resolve(
        started
          ? okResponse(
              makeRun({
                phase: 'review',
                done: 1,
                enriched: 1,
                currentItem: null,
              })
            )
          : notFoundResponse('No sync is running')
      );
    }
    if (p === '/api/enrichment' && method(init) === 'GET') {
      return Promise.resolve(okResponse(SUMMARY));
    }
    if (p === '/api/tmdb/key') {
      return Promise.resolve(okResponse({ key: '0123456789abcdef' }));
    }
    if (p === `/api/movies/${MOVIE_ID}`) {
      return Promise.resolve(
        okResponse(makeMovie({ id: MOVIE_ID, title: TITLE, year: 2019 }))
      );
    }
    return Promise.resolve(notFoundResponse('Not found'));
  });
}

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>();
  vi.stubGlobal('fetch', fetchMock);
  serve();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The flow at `/enrich?movie=m1`, with the movie's page behind it or not. */
function renderFlow(
  history: string[] = [`/movie/${MOVIE_ID}`, `/enrich?movie=${MOVIE_ID}`]
) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<p>the browse home</p>} />
          <Route path="/settings" element={<p>the settings hub</p>} />
          <Route path="/movie/:id" element={<p>the movie page</p>} />
          <Route path="/enrich" element={<EnrichmentFlow />} />
        </Routes>
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
}

/** Start, once the setup can be started. */
async function pressStart() {
  const start = await screen.findByRole('button', { name: 'Fetch details' });
  await waitFor(() => {
    expect((start as HTMLButtonElement).disabled).toBe(false);
    expect(start.getAttribute('aria-disabled')).not.toBe('true');
  });
  fireEvent.click(start);
}

/** Start, then wait for the review the poll brings. */
async function reachReview() {
  await pressStart();
  await screen.findByText('All done', undefined, { timeout: 3000 });
}

describe('EnrichmentFlow — setup for one movie', () => {
  it('heads the screen Sync with TMDB', () => {
    renderFlow();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Sync with TMDB' })
    ).toBeDefined();
  });

  it('offers Just this movie, naming the film', async () => {
    renderFlow();

    expect(await screen.findByText('Just this movie')).toBeDefined();
    expect(await screen.findByText(TITLE)).toBeDefined();
  });

  it('shows Just this movie alone — neither library scope', async () => {
    renderFlow();

    await screen.findByText('Just this movie');

    expect(screen.queryByText(/Only what.s missing/)).toBeNull();
    expect(screen.queryByText('Everything')).toBeNull();
  });

  it('names Start Fetch details, not Start sync', async () => {
    renderFlow();

    expect(
      await screen.findByRole('button', { name: 'Fetch details' })
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Start sync' })).toBeNull();
  });
});

describe('EnrichmentFlow — the single-title Sync', () => {
  it('starts a single-scope run for this movie', async () => {
    renderFlow();

    await pressStart();

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([i, n]) => isStart(i, n))).toBe(true);
    });
    const [, init] = fetchMock.mock.calls.find(([i, n]) => isStart(i, n)) ?? [];
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.scope).toBe('single');
    expect(body.movieId).toBe(MOVIE_ID);
  });

  it('polls to review and shows All done with Back to the movie', async () => {
    renderFlow();

    await reachReview();

    expect(screen.getByText('All done')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Back to the movie' })
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  });
});

describe('EnrichmentFlow — Back to the movie', () => {
  it('steps back to the movie it was opened from', async () => {
    renderFlow();
    await reachReview();

    fireEvent.click(screen.getByRole('button', { name: 'Back to the movie' }));

    expect(pathname()).toBe(`/movie/${MOVIE_ID}`);
    expect(navigationType()).toBe('POP');
    expect(screen.getByText('the movie page')).toBeDefined();
  });

  it('lands on the movie from a deep link, with nothing behind it', async () => {
    renderFlow([`/enrich?movie=${MOVIE_ID}`]);
    await reachReview();

    fireEvent.click(screen.getByRole('button', { name: 'Back to the movie' }));

    expect(pathname()).toBe(`/movie/${MOVIE_ID}`);
    expect(navigationType()).toBe('PUSH');
    expect(screen.getByText('the movie page')).toBeDefined();
  });
});
