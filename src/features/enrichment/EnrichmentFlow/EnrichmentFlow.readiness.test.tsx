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

import { EnrichmentFlow } from './EnrichmentFlow';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import type { EnrichmentRun, EnrichmentSummary } from '@/types';
import { theme } from '@/styles/theme';
import {
  LocationProbe,
  navigationType,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import {
  createdResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { snackbarStack } from '@/test-support/snackbarStack/snackbarStack';

/**
 * 23 — Enrichment, Phase 3: "setup's readiness" (issue #206).
 *
 * The setup draws in full off `useEnrichmentSummary` — the summary read
 * through the shared `fetchEnrichmentSummary`, `GET /api/enrichment` — and
 * draws nothing of itself until that read lands:
 *
 * - the header's key badge beside _Sync with TMDB_: _TMDB connected_ with a
 *   key, _No key yet_ without;
 * - the offline banner, _No internet connection_, in a danger tint with
 *   _Retry_ (which reads the summary again), when the server's probe did not
 *   answer;
 * - the key banner, _A TMDB API key is needed first_, with _Open Network
 *   settings_ — a push to `/settings` — when no key is set;
 * - the counts on both scope cards: `N titles have no synopsis or artwork`
 *   (the titles without **Full details**) and `M titles — re-checks ones
 *   already filled in`;
 * - the estimate beside Start, in its three faces.
 *
 * Start's three behaviours, the prototype's `startEnrich`: with a key and
 * TMDB answering it runs; with no key it pushes `/settings` and raises _Add
 * your TMDB key here first._ (info); offline it does nothing.
 *
 * The seam is `fetch` and the router; the notice is read off the real
 * `SnackbarProvider`.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

const READY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryRoot: null,
};

const OFFLINE: EnrichmentSummary = { ...READY, online: false };
const NO_KEY: EnrichmentSummary = { ...READY, keySet: false };

const STARTED: EnrichmentRun = {
  id: 'run-1',
  phase: 'running',
  scope: 'missing',
  startedAt: new Date().toISOString(),
  total: 12,
  done: 0,
  enriched: 0,
  currentItem: null,
  log: [{ text: 'Contacting api.themoviedb.org …', kind: 'info' }],
  decisions: [],
  written: { sheet: false, posters: false },
};

const method = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;

const isSummaryRead = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/enrichment' && method(init) === 'GET';
const isStart = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/enrichment' && method(init) === 'POST';

/**
 * A server with no run held, whose summary reads answer `summaries` in turn
 * (the last one repeated) — each a summary, or a promise the test settles.
 */
function serve(
  ...summaries: Array<EnrichmentSummary | Promise<EnrichmentSummary>>
) {
  let reads = 0;
  let held: EnrichmentRun | null = null;
  fetchMock.mockImplementation((input, init) => {
    if (isSummaryRead(input, init)) {
      const answer = summaries[Math.min(reads, summaries.length - 1)];
      reads += 1;
      return Promise.resolve(answer).then((body) => okResponse(body));
    }
    if (isStart(input, init)) {
      held = STARTED;
      return Promise.resolve(createdResponse(STARTED));
    }
    if (path(input) === '/api/enrichment/current') {
      return Promise.resolve(
        held === null
          ? notFoundResponse('No sync is running')
          : okResponse(held)
      );
    }
    if (path(input) === '/api/tmdb/key') {
      return Promise.resolve(okResponse({ key: null }));
    }
    return Promise.resolve(notFoundResponse('Not found'));
  });
}

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>();
  vi.stubGlobal('fetch', fetchMock);
  serve(READY);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderFlow(history: string[] = ['/enrich']) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Routes>
            <Route path="/settings" element={<p>the settings hub</p>} />
            <Route path="/enrich" element={<EnrichmentFlow />} />
          </Routes>
          <LocationProbe />
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const startButton = () => screen.findByRole('button', { name: 'Start sync' });
const summaryReads = () =>
  fetchMock.mock.calls.filter(([i, n]) => isSummaryRead(i, n)).length;
const startsSent = () =>
  fetchMock.mock.calls.filter(([i, n]) => isStart(i, n)).length;

/** A summary read that answers only when the test says so. */
function heldSummary() {
  let release: (summary: EnrichmentSummary) => void = () => undefined;
  const promise = new Promise<EnrichmentSummary>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe('EnrichmentFlow — nothing is drawn until the summary lands', () => {
  it('draws no scope card, no Start, no badge and no banner while the read is out', async () => {
    const summary = heldSummary();
    serve(summary.promise);
    renderFlow();

    await waitFor(() => expect(summaryReads()).toBeGreaterThan(0));
    expect(screen.getByText('Sync with TMDB')).toBeDefined();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Start sync' })).toBeNull();
    expect(screen.queryByText('TMDB connected')).toBeNull();
    expect(screen.queryByText('No key yet')).toBeNull();
    expect(screen.queryByText('No internet connection')).toBeNull();
    expect(screen.queryByText('A TMDB API key is needed first')).toBeNull();

    summary.release(READY);

    expect(await startButton()).toBeDefined();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('asks the summary of GET /api/enrichment', async () => {
    renderFlow();

    await startButton();
    expect(summaryReads()).toBeGreaterThan(0);
  });
});

describe('EnrichmentFlow — the header', () => {
  it('reads TMDB connected beside the heading with a key', async () => {
    renderFlow();

    expect(await screen.findByText('TMDB connected')).toBeDefined();
    expect(screen.getByText('Sync with TMDB')).toBeDefined();
    expect(
      screen.getByText(
        'Fetch synopses, artwork, and credits for movies already in your library. Your own ratings and watched marks are never touched.'
      )
    ).toBeDefined();
  });

  it('reads No key yet without one', async () => {
    serve(NO_KEY);
    renderFlow();

    expect(await screen.findByText('No key yet')).toBeDefined();
    expect(screen.queryByText('TMDB connected')).toBeNull();
  });
});

describe('EnrichmentFlow — the offline banner', () => {
  it('says there is no internet connection, and that the library stays', async () => {
    serve(OFFLINE);
    renderFlow();

    expect(await screen.findByText('No internet connection')).toBeDefined();
    expect(
      screen.getByText(
        'FamilyFlix works fine offline — this is the one feature that needs the network. Everything already in your library stays available.'
      )
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('is not drawn when TMDB answered', async () => {
    renderFlow();

    await screen.findByText('About 5s for 12 titles');
    expect(screen.queryByText('No internet connection')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('reads the summary again on Retry, and goes once TMDB answers', async () => {
    serve(OFFLINE, READY);
    renderFlow();

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    await waitFor(() =>
      expect(screen.queryByText('No internet connection')).toBeNull()
    );
    expect(summaryReads()).toBe(2);
    expect(screen.getByText('About 5s for 12 titles')).toBeDefined();
  });
});

describe('EnrichmentFlow — the key banner', () => {
  it('says a key is needed first, and where it goes', async () => {
    serve(NO_KEY);
    renderFlow();

    expect(
      await screen.findByText('A TMDB API key is needed first')
    ).toBeDefined();
    expect(
      screen.getByText(
        'It’s free and takes a minute. Paste it under Settings → Network, and it stays on this machine.'
      )
    ).toBeDefined();
  });

  it('is not drawn with a key', async () => {
    renderFlow();

    await screen.findByText('TMDB connected');
    expect(screen.queryByText('A TMDB API key is needed first')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Open Network settings' })
    ).toBeNull();
  });

  it('pushes /settings on Open Network settings', async () => {
    serve(NO_KEY);
    renderFlow();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Open Network settings' })
    );

    expect(await screen.findByText('the settings hub')).toBeDefined();
    expect(pathname()).toBe('/settings');
    expect(navigationType()).toBe('PUSH');
  });

  it('draws both banners when there is neither a key nor a connection', async () => {
    serve({ ...READY, keySet: false, online: false });
    renderFlow();

    expect(await screen.findByText('No internet connection')).toBeDefined();
    expect(screen.getByText('A TMDB API key is needed first')).toBeDefined();
  });
});

describe('EnrichmentFlow — the scope cards’ counts', () => {
  it('counts the titles without Full details on Only what’s missing', async () => {
    renderFlow();

    const card = await screen.findByRole('radio', {
      name: /Only what.s missing/,
    });
    expect(
      within(card).getByText('12 titles have no synopsis or artwork')
    ).toBeDefined();
  });

  it('counts every title on Everything', async () => {
    renderFlow();

    const card = await screen.findByRole('radio', { name: /Everything/ });
    expect(
      within(card).getByText('30 titles — re-checks ones already filled in')
    ).toBeDefined();
  });
});

describe('EnrichmentFlow — the estimate', () => {
  it('estimates Only what’s missing to begin with', async () => {
    renderFlow();

    expect(await screen.findByText('About 5s for 12 titles')).toBeDefined();
  });

  it('estimates Everything once it is chosen', async () => {
    renderFlow();

    fireEvent.click(await screen.findByRole('radio', { name: /Everything/ }));

    expect(await screen.findByText('About 12s for 30 titles')).toBeDefined();
  });

  it('waits for a connection when offline', async () => {
    serve(OFFLINE);
    renderFlow();

    expect(await screen.findByText('Waiting for a connection')).toBeDefined();
  });

  it('asks for a key when none is set', async () => {
    serve(NO_KEY);
    renderFlow();

    expect(
      await screen.findByText('A key is needed before this can run')
    ).toBeDefined();
  });
});

describe('EnrichmentFlow — Start’s three behaviours', () => {
  it('runs with a key and TMDB answering', async () => {
    renderFlow();

    // Ready: the estimate names the run Start is about to begin.
    await screen.findByText('About 5s for 12 titles');
    fireEvent.click(await startButton());

    await waitFor(() => expect(startsSent()).toBe(1));
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeDefined();
  });

  it('with no key, pushes /settings and raises Add your TMDB key here first.', async () => {
    serve(NO_KEY);
    renderFlow();

    fireEvent.click(await startButton());

    expect(await screen.findByText('the settings hub')).toBeDefined();
    expect(pathname()).toBe('/settings');
    expect(navigationType()).toBe('PUSH');
    expect(
      within(snackbarStack()).getByText('Add your TMDB key here first.')
    ).toBeDefined();
    expect(startsSent()).toBe(0);
  });

  it('offline, does nothing', async () => {
    serve(OFFLINE);
    renderFlow();

    fireEvent.click(await startButton());

    // Give a start every chance to have been sent.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(startsSent()).toBe(0);
    expect(pathname()).toBe('/enrich');
    expect(within(snackbarStack()).queryByRole('status')).toBeNull();
  });
});
