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
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { snackbarStack } from '@/test-support/snackbarStack/snackbarStack';
import {
  conflictResponse,
  createdResponse,
  noContentResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 38 — Title editing (issue #305): fetch a series from TMDB.
 *
 * The **Enrichment flow** opened from a series' ⋯ menu,
 * `/enrich?series=<id>`, is a `single` **Sync** over that one series: the
 * scope card reads _Just this series_ and names the show, Start posts its
 * `seriesId`, and _Back_ and the review's Finish land on the series page by
 * the **Back rule**. It re-attaches only to a `single` run carrying that
 * `seriesId`; another title's run in review is the **Waiting run**, named by
 * the **Let-go line** and let go by Start, and Start's `409` over another
 * title's running Sync raises the **Busy notice** — the film's rules, read for
 * a series. The seam is `fetch` and the router: what the maintainer sees.
 */

const SHOW = 's1';
const TITLE = 'The Hollow Coast';

const LIBRARY_LINE = 'Starting lets go of the library sync waiting for review.';
const OTHER_FILM_LINE =
  "Starting lets go of another movie's sync waiting for review.";
const OTHER_SHOW_LINE =
  "Starting lets go of another series' sync waiting for review.";
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
const OTHER_SHOW_REVIEW = makeEnrichmentRun({
  id: 'other-show',
  phase: 'review',
  scope: 'single',
  seriesId: 's9',
  total: 1,
  done: 1,
  decisions: [DECISION],
});
/** A film's run whose `movieId` happens to spell the series' id. */
const FILM_NAMED_LIKE_THE_SHOW = makeEnrichmentRun({
  id: 'film',
  phase: 'review',
  scope: 'single',
  movieId: SHOW,
  total: 1,
  done: 1,
  decisions: [DECISION],
});
const OWN_RUNNING = makeEnrichmentRun({
  id: 'own',
  scope: 'single',
  seriesId: SHOW,
  total: 1,
  currentItem: TITLE,
});
const OWN_REVIEW = makeEnrichmentRun({
  id: 'own',
  phase: 'review',
  scope: 'single',
  seriesId: SHOW,
  total: 1,
  done: 1,
  enriched: 1,
  decisions: [],
});
const OWN_REVIEW_WITH_DECISION = { ...OWN_REVIEW, decisions: [DECISION] };

const method = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;
const isStart = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/enrichment' && method(init) === 'POST';

/**
 * A server holding `held` as the Current run (none by default) and one
 * series. Start answers `201` with `started` — held from then on, and read
 * back in review once `reviewAfterStart` — or `409` with `busy`.
 */
function serve({
  held = null,
  started = OWN_RUNNING,
  answer = 'created',
  reviewAfterStart = false,
}: {
  held?: EnrichmentRun | null;
  started?: EnrichmentRun;
  answer?: 'created' | 'busy';
  reviewAfterStart?: boolean;
} = {}) {
  let current = held;
  fetchMock.mockImplementation((input, init) => {
    const p = path(input);
    if (isStart(input, init)) {
      if (answer === 'busy') return Promise.resolve(conflictResponse());
      current = reviewAfterStart ? OWN_REVIEW : started;
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
    if (p === `/api/series/${SHOW}`) {
      return Promise.resolve(
        okResponse(
          makeSeriesDetail([['unwatched']], { id: SHOW, title: TITLE })
        )
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

/** The flow at `/enrich?series=s1`, the series page behind it by default. */
function renderFlow(
  history: string[] = [`/series/${SHOW}`, `/enrich?series=${SHOW}`]
) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Routes>
            <Route path="/" element={<p>the browse home</p>} />
            <Route path="/settings" element={<p>the settings hub</p>} />
            <Route path="/movie/:id" element={<p>the movie page</p>} />
            <Route path="/series/:id" element={<p>the series page</p>} />
            <Route path="/enrich" element={<EnrichmentFlow />} />
          </Routes>
          <LocationProbe />
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

/** The series' setup, drawn and settled — the mount read landed. */
async function seriesSetup(): Promise<HTMLElement> {
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

/** Start, once the setup can be started. */
async function pressStart() {
  const start = await screen.findByRole('button', { name: 'Fetch details' });
  await waitFor(() => {
    expect((start as HTMLButtonElement).disabled).toBe(false);
    expect(start.getAttribute('aria-disabled')).not.toBe('true');
  });
  fireEvent.click(start);
}

const starts = () => fetchMock.mock.calls.filter(([i, n]) => isStart(i, n));

describe('EnrichmentFlow — setup for one series', () => {
  it('offers Just this series, naming the show', async () => {
    serve();
    renderFlow();

    expect(await screen.findByText('Just this series')).toBeDefined();
    expect(await screen.findByText(TITLE)).toBeDefined();
    expect(screen.queryByText('Just this movie')).toBeNull();
  });

  it('shows Just this series alone — neither library scope', async () => {
    serve();
    renderFlow();

    await screen.findByText('Just this series');

    expect(screen.queryByText(/Only what.s missing/)).toBeNull();
    expect(screen.queryByText('Everything')).toBeNull();
  });

  it('starts a single-scope run naming the series and no movie', async () => {
    serve();
    renderFlow();

    await pressStart();

    await waitFor(() => expect(starts()).toHaveLength(1));
    const [, init] = starts()[0] ?? [];
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.scope).toBe('single');
    expect(body.seriesId).toBe(SHOW);
    expect(body).not.toHaveProperty('movieId');
  });

  it('steps Back to the series it was opened from', async () => {
    serve();
    renderFlow();
    await seriesSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe(`/series/${SHOW}`);
    expect(navigationType()).toBe('POP');
    expect(screen.getByText('the series page')).toBeDefined();
  });
});

describe('EnrichmentFlow — Back to the series', () => {
  it('finishes with Back to the series, stepping back onto the series page', async () => {
    serve({ reviewAfterStart: true });
    renderFlow();
    await pressStart();
    await screen.findByText('All done', undefined, { timeout: 3000 });

    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the series' }));

    expect(pathname()).toBe(`/series/${SHOW}`);
    expect(navigationType()).toBe('POP');
    expect(screen.getByText('the series page')).toBeDefined();
  });

  it('lands on the series from a deep link, with nothing behind it', async () => {
    serve({ reviewAfterStart: true });
    renderFlow([`/enrich?series=${SHOW}`]);
    await pressStart();
    await screen.findByText('All done', undefined, { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: 'Back to the series' }));

    expect(pathname()).toBe(`/series/${SHOW}`);
    expect(navigationType()).toBe('PUSH');
    expect(screen.getByText('the series page')).toBeDefined();
  });
});

describe('EnrichmentFlow — the series’ own run', () => {
  it('re-attaches to the series’ own run while it runs', async () => {
    serve({ held: OWN_RUNNING });
    renderFlow();

    expect(await screen.findByRole('button', { name: 'Stop' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Fetch details' })).toBeNull();
  });

  it('re-attaches to the series’ own run in review', async () => {
    serve({ held: OWN_REVIEW_WITH_DECISION });
    renderFlow();

    expect(
      await screen.findByRole('button', { name: 'Sync again' })
    ).toBeDefined();
    expect(screen.getByText('Sundial')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Back to the series' })
    ).toBeDefined();
  });
});

describe('EnrichmentFlow — over a run that is not the series’', () => {
  it.each([
    ['a library run', LIBRARY_REVIEW, LIBRARY_LINE],
    ['a film’s run', OTHER_FILM_REVIEW, OTHER_FILM_LINE],
    [
      'a film’s run whose id spells the series’',
      FILM_NAMED_LIKE_THE_SHOW,
      OTHER_FILM_LINE,
    ],
    ['another series’ run', OTHER_SHOW_REVIEW, OTHER_SHOW_LINE],
  ] as const)(
    'shows the series’ setup over %s in review, with its Let-go line',
    async (_name, held, line) => {
      serve({ held });
      renderFlow();

      expect(await screen.findByText(line)).toBeDefined();
      expect(
        screen.getByRole('button', { name: 'Fetch details' })
      ).toBeDefined();
      expect(screen.getByText('Just this series')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Sync again' })).toBeNull();
    }
  );

  it('lets the Waiting run go on Start, the line gone once the series’ run is held', async () => {
    serve({ held: OTHER_SHOW_REVIEW, started: OWN_RUNNING });
    renderFlow();
    await screen.findByText(OTHER_SHOW_LINE);

    fireEvent.click(screen.getByRole('button', { name: 'Fetch details' }));

    expect(await screen.findByRole('button', { name: 'Stop' })).toBeDefined();
    expect(starts()).toHaveLength(1);
    expect(screen.queryByText(OTHER_SHOW_LINE)).toBeNull();
  });

  it('raises the Busy notice over another title’s running Sync, the setup kept', async () => {
    serve({ held: LIBRARY_RUNNING, answer: 'busy' });
    renderFlow();
    await seriesSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Fetch details' }));

    const notice = await within(snackbarStack()).findByRole('alert');
    expect(within(notice).getByText(BUSY)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Fetch details' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });
});
