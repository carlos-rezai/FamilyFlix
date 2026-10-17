import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';

import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import { EnrichmentFlow } from './EnrichmentFlow';
import {
  ENRICH_FIELDS,
  type Decision,
  type EnrichmentRun,
  type EnrichmentSummary,
} from '@/types';
import { theme } from '@/styles/theme';
import {
  LocationProbe,
  navigationType,
  pathname,
  url,
} from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import { snackbarStack } from '@/test-support/snackbarStack/snackbarStack';
import {
  conflictResponse,
  createdResponse,
  noContentResponse,
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 45 — Add and sync (issue #393): **Started on arrival**.
 *
 * The **Enrichment flow** opened with `start=1` beside `movie` or `series`
 * presses its own Start once both the EnrichmentSummary and the arrival read
 * of the **Current enrichment run** have landed: nothing when the title's own
 * run was re-attached, nothing over a **Waiting run** with Decisions (its
 * **Let-go line** drawn), else its own `onStart` with setup's defaults —
 * every field chip, and the **Write targets** as setup offers them. That
 * `onStart` answers no key, offline and the **Busy notice** as a press does.
 * In every case the URL is then replaced without `start`, so a step back or a
 * reload starts no second Sync. Without `start` nothing changes.
 *
 * The seam is `fetch` and the router: what the maintainer sees.
 */

const FILM = 'm1';
const SHOW = 's1';
const TITLE = 'The Lantern Keeper';

const LIBRARY_LINE = 'Starting lets go of the library sync waiting for review.';
const BUSY = 'A sync is already running.';
const NO_KEY = 'Add your TMDB key here first.';
const OFFLINE_LINE =
  'FamilyFlix works fine offline. This is the one feature that needs the network. Everything already in your library stays available.';

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

const SUMMARY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  gaps: 12,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryFolders: ['D:\\Movies'],
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
const OWN_RUNNING = makeEnrichmentRun({
  id: 'own',
  scope: 'single',
  movieId: FILM,
  total: 1,
  currentItem: TITLE,
});
const SHOW_RUNNING = makeEnrichmentRun({
  id: 'show',
  scope: 'single',
  seriesId: SHOW,
  total: 1,
});

const method = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;
const isStart = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/enrichment' && method(init) === 'POST';
const isArrival = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/enrichment/current' && method(init) === 'GET';
const isSummary = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/enrichment' && method(init) === 'GET';

/** A response that answers only when the suite lets it go. */
function held(): {
  promise: Promise<Response>;
  release: (r: Response) => void;
} {
  let release: (r: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

/**
 * A server holding `current` as the Current run (none by default) and
 * answering the summary with `summary`. Start answers `201` with `started`,
 * the run held from then on — or `409` (`busy`), or `500` (`fails`). Either
 * read may be handed in held, to land when the suite says.
 */
function serve({
  current = null,
  summary = SUMMARY,
  started = OWN_RUNNING,
  answer = 'created',
  summaryAnswer,
  arrivalAnswer,
}: {
  current?: EnrichmentRun | null;
  summary?: EnrichmentSummary;
  started?: EnrichmentRun;
  answer?: 'created' | 'busy' | 'fails';
  summaryAnswer?: Promise<Response>;
  arrivalAnswer?: Promise<Response>;
} = {}) {
  let held = current;
  let arrived = false;
  fetchMock.mockImplementation((input, init) => {
    const p = path(input);
    if (isStart(input, init)) {
      if (answer === 'busy') return Promise.resolve(conflictResponse());
      if (answer === 'fails') return Promise.resolve(serverErrorResponse());
      held = started;
      return Promise.resolve(createdResponse(started));
    }
    if (p === '/api/enrichment/current/cancel') {
      held = null;
      return Promise.resolve(noContentResponse());
    }
    if (isArrival(input, init)) {
      if (!arrived && arrivalAnswer !== undefined) {
        arrived = true;
        return arrivalAnswer;
      }
      return Promise.resolve(
        held === null
          ? notFoundResponse('No sync is running')
          : okResponse(held)
      );
    }
    if (isSummary(input, init)) {
      return summaryAnswer ?? Promise.resolve(okResponse(summary));
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

/** A control elsewhere in the app, to leave the flow by a push. */
function Away() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/elsewhere')}>
      Go elsewhere
    </button>
  );
}

/** The flow at `entry`, the title's page behind it. */
function renderFlow(
  entry = `/enrich?movie=${FILM}&start=1`,
  behind = `/movie/${FILM}`
) {
  const history = [behind, entry];
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Routes>
            <Route path="/" element={<p>the browse home</p>} />
            <Route path="/settings" element={<p>the settings hub</p>} />
            <Route path="/elsewhere" element={<p>somewhere else</p>} />
            <Route path="/movie/:id" element={<p>the movie page</p>} />
            <Route path="/series/:id" element={<p>the series page</p>} />
            <Route
              path="/enrich"
              element={
                <>
                  <EnrichmentFlow />
                  <Away />
                </>
              }
            />
          </Routes>
          <LocationProbe withBack />
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const starts = () => fetchMock.mock.calls.filter(([i, n]) => isStart(i, n));
const startBody = (n = 0): unknown =>
  JSON.parse(String(starts()[n]?.[1]?.body));

/** A few turns, so anything that would fire has fired. */
async function settle(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < 5; turn += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

/** The probe's Back — not the flow's own, which is the first of the two. */
function probeBack(): HTMLElement {
  const backs = screen.getAllByRole('button', { name: 'Back' });
  return backs[backs.length - 1];
}

describe('EnrichmentFlow — Started on arrival, no run held', () => {
  it('posts one single-scope Sync over the film with setup’s defaults', async () => {
    serve();
    renderFlow();

    await waitFor(() => expect(starts()).toHaveLength(1));

    expect(startBody()).toEqual({
      scope: 'single',
      movieId: FILM,
      fields: [...ENRICH_FIELDS],
      writeSheet: true,
      writePosters: true,
    });
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeDefined();
  });

  it('replaces the URL without start once it has started', async () => {
    serve();
    renderFlow();

    await waitFor(() => expect(url()).toBe(`/enrich?movie=${FILM}`));
    expect(navigationType()).toBe('REPLACE');
  });

  it('posts one single-scope Sync over the series, the URL replaced', async () => {
    serve({ started: SHOW_RUNNING });
    renderFlow(`/enrich?series=${SHOW}&start=1`, `/series/${SHOW}`);

    await waitFor(() => expect(starts()).toHaveLength(1));

    expect(startBody()).toEqual({
      scope: 'single',
      seriesId: SHOW,
      fields: [...ENRICH_FIELDS],
      writeSheet: true,
      writePosters: true,
    });
    await waitFor(() => expect(url()).toBe(`/enrich?series=${SHOW}`));
    expect(navigationType()).toBe('REPLACE');
  });

  it('offers no Write target with no Library folder, as setup does', async () => {
    serve({ summary: { ...SUMMARY, libraryFolders: [] } });
    renderFlow();

    await waitFor(() => expect(starts()).toHaveLength(1));

    expect(startBody()).toMatchObject({
      writeSheet: false,
      writePosters: false,
    });
  });
});

describe('EnrichmentFlow — Started on arrival over a run already held', () => {
  it('re-attaches to the film’s own run with no POST, the URL replaced', async () => {
    serve({ current: OWN_RUNNING });
    renderFlow();

    expect(await screen.findByRole('button', { name: 'Stop' })).toBeDefined();
    await waitFor(() => expect(url()).toBe(`/enrich?movie=${FILM}`));
    await settle();

    expect(starts()).toHaveLength(0);
    expect(navigationType()).toBe('REPLACE');
  });

  it('presses nothing over a Waiting run with Decisions, its Let-go line drawn, the URL replaced', async () => {
    serve({ current: LIBRARY_REVIEW });
    renderFlow();

    expect(await screen.findByText(LIBRARY_LINE)).toBeDefined();
    await waitFor(() => expect(url()).toBe(`/enrich?movie=${FILM}`));
    await settle();

    expect(starts()).toHaveLength(0);
    expect(navigationType()).toBe('REPLACE');
    expect(screen.getByRole('button', { name: 'Fetch details' })).toBeDefined();
  });

  it('posts one Sync over a Waiting run with no Decisions', async () => {
    serve({ current: { ...LIBRARY_REVIEW, decisions: [] } });
    renderFlow();

    await waitFor(() => expect(starts()).toHaveLength(1));
    await settle();

    expect(starts()).toHaveLength(1);
    expect(startBody()).toMatchObject({ scope: 'single', movieId: FILM });
  });
});

describe('EnrichmentFlow — Started on arrival, answered as a press is', () => {
  it('pushes Settings with the key notice and posts nothing, with no key', async () => {
    serve({ summary: { ...SUMMARY, keySet: false } });
    renderFlow();

    expect(await screen.findByText('the settings hub')).toBeDefined();
    expect(pathname()).toBe('/settings');
    expect(navigationType()).toBe('PUSH');
    expect(within(snackbarStack()).getByText(NO_KEY)).toBeDefined();
    await settle();
    expect(starts()).toHaveLength(0);
  });

  it('leaves the flow behind Settings without start, so Back starts nothing', async () => {
    serve({ summary: { ...SUMMARY, keySet: false } });
    renderFlow();
    await screen.findByText('the settings hub');

    fireEvent.click(probeBack());

    await waitFor(() => expect(url()).toBe(`/enrich?movie=${FILM}`));
    await settle();
    expect(starts()).toHaveLength(0);
  });

  it('posts nothing offline, and draws the offline banner', async () => {
    serve({ summary: { ...SUMMARY, online: false } });
    renderFlow();

    expect(await screen.findByText(OFFLINE_LINE)).toBeDefined();
    await waitFor(() => expect(url()).toBe(`/enrich?movie=${FILM}`));
    await settle();

    expect(starts()).toHaveLength(0);
  });

  it('draws the Busy notice when Start is answered 409', async () => {
    serve({ current: LIBRARY_RUNNING, answer: 'busy' });
    renderFlow();

    const notice = await within(snackbarStack()).findByRole('alert');
    expect(within(notice).getByText(BUSY)).toBeDefined();
    expect(starts()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Fetch details' })).toBeDefined();
    await waitFor(() => expect(url()).toBe(`/enrich?movie=${FILM}`));
  });
});

describe('EnrichmentFlow — Started on arrival, once and only once', () => {
  it('posts nothing until the summary has landed', async () => {
    const summary = held();
    serve({ summaryAnswer: summary.promise });
    renderFlow();
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([i, n]) => isArrival(i, n))).toBe(true)
    );
    await settle();

    expect(starts()).toHaveLength(0);

    await act(async () => {
      summary.release(okResponse(SUMMARY));
    });

    await waitFor(() => expect(starts()).toHaveLength(1));
  });

  it('posts nothing until the arrival read has answered', async () => {
    const arrival = held();
    serve({ arrivalAnswer: arrival.promise });
    renderFlow();
    await screen.findByRole('button', { name: 'Fetch details' });
    await settle();

    expect(starts()).toHaveLength(0);

    await act(async () => {
      arrival.release(notFoundResponse('No sync is running'));
    });

    await waitFor(() => expect(starts()).toHaveLength(1));
  });

  it('posts at most once however often the flow re-renders', async () => {
    serve({ answer: 'fails' });
    renderFlow();
    await waitFor(() => expect(starts()).toHaveLength(1));

    for (let again = 0; again < 3; again += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Synopsis' }));
      await settle();
    }
    await settle();

    expect(starts()).toHaveLength(1);
  });

  it('starts no second Sync on stepping back onto the flow', async () => {
    serve();
    renderFlow();
    await waitFor(() => expect(url()).toBe(`/enrich?movie=${FILM}`));
    // The server has nothing running now, so a second press would post.
    serve();

    fireEvent.click(screen.getByRole('button', { name: 'Go elsewhere' }));
    await screen.findByText('somewhere else');
    fireEvent.click(probeBack());

    await waitFor(() => expect(url()).toBe(`/enrich?movie=${FILM}`));
    await screen.findByRole('button', { name: 'Fetch details' });
    await settle();

    expect(starts()).toHaveLength(1);
  });

  it('starts no second Sync on a reload', async () => {
    serve();
    renderFlow();
    await waitFor(() => expect(url()).toBe(`/enrich?movie=${FILM}`));
    const reloaded = url() ?? '';
    cleanup();
    serve();

    renderFlow(reloaded);
    await screen.findByRole('button', { name: 'Fetch details' });
    await settle();

    expect(starts()).toHaveLength(1);
  });
});

describe('EnrichmentFlow — without start', () => {
  it('presses nothing and leaves the URL as it was', async () => {
    serve();
    renderFlow(`/enrich?movie=${FILM}`);

    await screen.findByRole('button', { name: 'Fetch details' });
    await settle();

    expect(starts()).toHaveLength(0);
    expect(url()).toBe(`/enrich?movie=${FILM}`);
    expect(navigationType()).toBe('POP');
  });
});
