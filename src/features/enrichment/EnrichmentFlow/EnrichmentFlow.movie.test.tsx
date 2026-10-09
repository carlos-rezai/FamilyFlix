import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import { EnrichmentFlow } from './EnrichmentFlow';
import type { Decision, EnrichmentRun, EnrichmentSummary } from '@/types';
import { theme } from '@/styles/theme';
import {
  LocationProbe,
  navigationType,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import { snackbarStack } from '@/test-support/snackbarStack/snackbarStack';
import {
  createdResponse,
  noContentResponse,
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 33 — Single-title Sync (issue #286): whose run it is.
 *
 * The **Enrichment flow** opened from a film's ⋯ menu, `/enrich?movie=<id>`,
 * re-attaches only to a **Current enrichment run** that belongs to that film —
 * a `single` run carrying its `movieId`. Another film's run or a library run
 * in review is the **Waiting run**: the film's setup is drawn, with the
 * **let-go line** under Start while it has Decisions. A running one is not
 * held either, and Start's `409` over it raises the **busy notice**, _A sync
 * is already running._, as a warning, the setup and its choices kept.
 *
 * Opened with no film — `/enrich`, `/enrich?scope=all` — every run is held,
 * as before. The seam is `fetch` and the router: what the maintainer sees.
 */

const FILM = 'm1';
const TITLE = 'The Lantern Keeper';

const LIBRARY_LINE = 'Starting lets go of the library sync waiting for review.';
const OTHER_FILM_LINE =
  "Starting lets go of another movie's sync waiting for review.";
const BUSY = 'A sync is already running.';

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

const SUMMARY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryFolders: [],
};

const DECISION: Decision = {
  id: 'd1',
  kind: 'missing',
  title: 'Sundial',
  reason: 'Nothing on TMDB matched this title.',
  path: null,
  query: 'Sundial',
};

const LIBRARY_REVIEW = makeEnrichmentRun({
  id: 'library',
  phase: 'review',
  scope: 'all',
  total: 30,
  done: 30,
  decisions: [DECISION],
});
const LIBRARY_RUNNING = makeEnrichmentRun({
  id: 'library',
  scope: 'all',
  total: 30,
  done: 4,
  currentItem: 'Kettle Bay',
});
const OTHER_FILM_REVIEW = makeEnrichmentRun({
  id: 'other-film',
  phase: 'review',
  scope: 'single',
  movieId: 'm9',
  total: 1,
  done: 1,
  decisions: [DECISION],
});
const OWN_RUNNING = makeEnrichmentRun({
  id: 'own',
  scope: 'single',
  movieId: FILM,
  total: 1,
  currentItem: TITLE,
});
const OWN_REVIEW = makeEnrichmentRun({
  id: 'own',
  phase: 'review',
  scope: 'single',
  movieId: FILM,
  total: 1,
  done: 1,
  decisions: [DECISION],
});

const method = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;
const isStart = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/enrichment' && method(init) === 'POST';

const busyResponse = () =>
  ({
    ok: false,
    status: 409,
    json: () => Promise.resolve({ error: 'A sync is already running' }),
  }) as unknown as Response;

/**
 * A server holding `held` as the Current run (none by default). Start answers
 * `201` with `started`, the run held from then on — or `409` with `busy`
 * (`held` read back unchanged), or `500` with `fails`. A cancel drops it.
 */
function serve({
  held = null,
  started = OWN_RUNNING,
  answer = 'created',
}: {
  held?: EnrichmentRun | null;
  started?: EnrichmentRun;
  answer?: 'created' | 'busy' | 'fails';
} = {}) {
  let current = held;
  fetchMock.mockImplementation((input, init) => {
    const p = path(input);
    if (isStart(input, init)) {
      if (answer === 'busy') return Promise.resolve(busyResponse());
      if (answer === 'fails') return Promise.resolve(serverErrorResponse());
      current = started;
      return Promise.resolve(createdResponse(started));
    }
    if (p === '/api/enrichment/current/cancel') {
      current = null;
      return Promise.resolve(noContentResponse());
    }
    if (p === '/api/enrichment/current' && method(init) === 'GET') {
      return Promise.resolve(
        current === null
          ? notFoundResponse('No sync is running')
          : okResponse(current)
      );
    }
    if (p === '/api/enrichment' && method(init) === 'GET') {
      return Promise.resolve(okResponse(SUMMARY));
    }
    if (p === '/api/tmdb/key') {
      return Promise.resolve(okResponse({ key: '0123456789abcdef' }));
    }
    if (p === `/api/movies/${FILM}`) {
      return Promise.resolve(
        okResponse(makeMovie({ id: FILM, title: TITLE, year: 2019 }))
      );
    }
    return Promise.resolve(notFoundResponse('Not found'));
  });
}

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The flow at `entry`, the film's page behind it. */
function renderFlow(entry = `/enrich?movie=${FILM}`) {
  const history = [`/movie/${FILM}`, entry];
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Routes>
            <Route path="/" element={<p>the browse home</p>} />
            <Route path="/settings" element={<p>the settings hub</p>} />
            <Route path="/movie/:id" element={<p>the movie page</p>} />
            <Route path="/enrich" element={<EnrichmentFlow />} />
          </Routes>
          <LocationProbe />
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

/** The film's setup, drawn and settled — the mount read landed. */
async function filmSetup(): Promise<HTMLElement> {
  const start = await screen.findByRole('button', { name: 'Fetch details' });
  await waitFor(() => {
    expect(
      fetchMock.mock.calls.some(
        ([i, n]) => path(i) === '/api/enrichment/current' && method(n) === 'GET'
      )
    ).toBe(true);
  });
  // One more turn, so a mount read that would take over has done so.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return start;
}

const starts = () => fetchMock.mock.calls.filter(([i, n]) => isStart(i, n));

describe('EnrichmentFlow ?movie= — over a run that is not the film’s', () => {
  it('shows the film’s setup over a library run in review, with the library line', async () => {
    serve({ held: LIBRARY_REVIEW });
    renderFlow();

    expect(await screen.findByText(LIBRARY_LINE)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Fetch details' })).toBeDefined();
    expect(screen.getByText('Just this movie')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Sync again' })).toBeNull();
  });

  it('shows the film’s setup over another film’s run in review, with its line', async () => {
    serve({ held: OTHER_FILM_REVIEW });
    renderFlow();

    expect(await screen.findByText(OTHER_FILM_LINE)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Fetch details' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Sync again' })).toBeNull();
  });

  it('draws no line over a run in review with no Decisions', async () => {
    serve({ held: { ...LIBRARY_REVIEW, decisions: [] } });
    renderFlow();

    await filmSetup();

    expect(screen.queryByText(/Starting lets go of/)).toBeNull();
    expect(screen.queryByText('All done')).toBeNull();
  });

  it('shows the film’s setup, and no line, over a library run still running', async () => {
    serve({ held: LIBRARY_RUNNING });
    renderFlow();

    await filmSetup();

    expect(screen.queryByText(/Starting lets go of/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
    expect(screen.queryByText('Kettle Bay')).toBeNull();
  });

  it('lets the Waiting run go on Start, the line gone once the film’s run is held', async () => {
    serve({ held: LIBRARY_REVIEW, started: OWN_RUNNING });
    renderFlow();
    await screen.findByText(LIBRARY_LINE);

    fireEvent.click(screen.getByRole('button', { name: 'Fetch details' }));

    expect(await screen.findByRole('button', { name: 'Stop' })).toBeDefined();
    expect(starts()).toHaveLength(1);
    expect(screen.queryByText(LIBRARY_LINE)).toBeNull();
  });

  it('steps Back to the film from the setup over a Waiting run', async () => {
    serve({ held: LIBRARY_REVIEW });
    renderFlow();
    await screen.findByText(LIBRARY_LINE);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe(`/movie/${FILM}`);
    expect(navigationType()).toBe('POP');
  });
});

describe('EnrichmentFlow ?movie= — the film’s own run', () => {
  it('re-attaches to the film’s own run while it runs', async () => {
    serve({ held: OWN_RUNNING });
    renderFlow();

    expect(await screen.findByRole('button', { name: 'Stop' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Fetch details' })).toBeNull();
  });

  it('re-attaches to the film’s own run in review, until Sync again', async () => {
    serve({ held: OWN_REVIEW });
    renderFlow();

    const again = await screen.findByRole('button', { name: 'Sync again' });
    expect(screen.getByText('Sundial')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Back to the movie' })
    ).toBeDefined();

    fireEvent.click(again);

    expect(
      await screen.findByRole('button', { name: 'Fetch details' })
    ).toBeDefined();
    expect(screen.queryByText(/Starting lets go of/)).toBeNull();
  });
});

describe('EnrichmentFlow ?movie= — Start answered 409', () => {
  it('raises the busy notice as a warning over a running library Sync, the setup and its choices kept', async () => {
    serve({ held: LIBRARY_RUNNING, answer: 'busy' });
    renderFlow();
    await filmSetup();
    fireEvent.click(screen.getByRole('button', { name: 'Synopsis' }));

    fireEvent.click(screen.getByRole('button', { name: 'Fetch details' }));

    const notice = await within(snackbarStack()).findByRole('alert');
    expect(within(notice).getByText(BUSY)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Fetch details' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
    expect(
      screen
        .getByRole('button', { name: 'Synopsis' })
        .getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('holds the film’s own running Sync, with no notice', async () => {
    serve({ answer: 'busy' });
    renderFlow();
    await filmSetup();
    // The film's own Sync was started elsewhere since the screen mounted.
    serve({ held: OWN_RUNNING, answer: 'busy' });

    fireEvent.click(screen.getByRole('button', { name: 'Fetch details' }));

    expect(await screen.findByRole('button', { name: 'Stop' })).toBeDefined();
    expect(within(snackbarStack()).queryByText(BUSY)).toBeNull();
  });

  it('raises nothing new for any other failure at Start', async () => {
    serve({ answer: 'fails' });
    renderFlow();
    await filmSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Fetch details' }));
    await waitFor(() => expect(starts()).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(within(snackbarStack()).queryByRole('alert')).toBeNull();
    expect(within(snackbarStack()).queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: 'Fetch details' })).toBeDefined();
  });
});

describe('EnrichmentFlow with no film — every run re-attaches, as before', () => {
  it.each(['/enrich', '/enrich?scope=all'])(
    '%s re-attaches to a single film’s run in review',
    async (entry) => {
      serve({ held: OTHER_FILM_REVIEW });
      renderFlow(entry);

      expect(
        await screen.findByRole('button', { name: 'Sync again' })
      ).toBeDefined();
      expect(screen.queryByText(/Starting lets go of/)).toBeNull();
    }
  );

  it('re-attaches to a running single film’s run', async () => {
    serve({ held: OWN_RUNNING });
    renderFlow('/enrich');

    expect(await screen.findByRole('button', { name: 'Stop' })).toBeDefined();
  });
});
