import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import { EnrichmentFlow } from './EnrichmentFlow';
import type { EnrichmentRun, EnrichmentSummary } from '@/types';
import { theme } from '@/styles/theme';
import {
  createdResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 23 — Enrichment, Phase 9: "from the import" (issue #212).
 *
 * 54, Scan new folders, Phase 6 (issue #497): the Import flow's _Finish_ on a
 * run carrying `enrich` replaces `/import` with `/enrich?added=<startedAt>`.
 * What lands there is the **Setup step** reading the summary with `since`,
 * the library's two cards plus **Just what was added**, chosen, and nothing
 * started: the maintainer still presses _Start sync_, which posts
 * `scope: 'added'` and `since`. Back from there steps to Settings, because
 * the replace left Import out of the history. `?scope=all` is retired.
 *
 * Issue #313: the review's _Done_ there pushes `/`, the library — where the
 * import's own Finish would have landed had it not handed on to the Sync.
 */

const SUMMARY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  gaps: 12,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryFolders: [],
};

/** The run's `startedAt`, as Finish names it. */
const SINCE = '2026-10-28T09:00:00.000Z';
const ADDED_ROUTE = `/enrich?added=${encodeURIComponent(SINCE)}`;

const RUN: EnrichmentRun = {
  id: 'run-1',
  phase: 'running',
  scope: 'all',
  startedAt: new Date().toISOString(),
  total: 30,
  done: 0,
  enriched: 0,
  currentItem: '',
  log: [],
  decisions: [],
  written: { sheet: false, posters: false },
};

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

/** The run the server holds on arrival, if any. */
let arriving: EnrichmentRun | null;
/** Holds the summary's answer back while true. */
let summaryHeld: boolean;

const method = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;
const isStart = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/enrichment' && method(init) === 'POST';

const isSummary = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/enrichment' && method(init) === 'GET';
const sinceOf = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').searchParams.get('since');

beforeEach(() => {
  arriving = null;
  summaryHeld = false;
  fetchMock = vi.fn<FetchFn>();
  let held: EnrichmentRun | null = null;
  fetchMock.mockImplementation((input, init) => {
    const p = path(input);
    if (isStart(input, init)) {
      held = RUN;
      return Promise.resolve(createdResponse(RUN));
    }
    if (p === '/api/enrichment/current' && method(init) === 'GET') {
      return Promise.resolve(
        (held ?? arriving) === null
          ? notFoundResponse('No sync is running')
          : okResponse(held ?? arriving)
      );
    }
    if (isSummary(input, init)) {
      if (summaryHeld) return new Promise<Response>(() => undefined);
      const since = sinceOf(input);
      return Promise.resolve(
        okResponse(since === null ? SUMMARY : { ...SUMMARY, added: 3 })
      );
    }
    if (p === '/api/tmdb/key') {
      return Promise.resolve(okResponse({ key: '0123456789abcdef' }));
    }
    return Promise.resolve(notFoundResponse('Not found'));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Where Finish leaves the history: Settings, then the replaced entry. */
function renderFlow(history: string[] = ['/', '/settings', ADDED_ROUTE]) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Routes>
            <Route path="/" element={<p>the browse home</p>} />
            <Route path="/settings" element={<p>the settings hub</p>} />
            <Route path="/enrich" element={<EnrichmentFlow />} />
          </Routes>
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const scopeCard = (name: RegExp) => screen.findByRole('radio', { name });

const ADDED = /Just what was added/;

/** The body of the one start the screen sent. */
async function startBody(): Promise<Record<string, unknown>> {
  await waitFor(() => {
    expect(fetchMock.mock.calls.some(([i, n]) => isStart(i, n))).toBe(true);
  });
  const [, init] = fetchMock.mock.calls.find(([i, n]) => isStart(i, n)) ?? [];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

async function pressStart() {
  const start = await screen.findByRole('button', { name: 'Start sync' });
  await waitFor(() => {
    expect((start as HTMLButtonElement).disabled).toBe(false);
    expect(start.getAttribute('aria-disabled')).not.toBe('true');
  });
  fireEvent.click(start);
}

describe('EnrichmentFlow: arriving with ?added=', () => {
  it('reads the summary with since', async () => {
    renderFlow();
    await scopeCard(ADDED);

    expect(
      fetchMock.mock.calls.some(
        ([i, n]) => isSummary(i, n) && sinceOf(i) === SINCE
      )
    ).toBe(true);
  });

  it('draws the library’s two cards plus Just what was added, chosen', async () => {
    renderFlow();

    expect((await scopeCard(ADDED)).getAttribute('aria-checked')).toBe('true');
    expect(
      (await scopeCard(/Only what.s missing/)).getAttribute('aria-checked')
    ).toBe('false');
    expect((await scopeCard(/Everything/)).getAttribute('aria-checked')).toBe(
      'false'
    );
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('reads the count of titles the run brought in', async () => {
    renderFlow();

    expect(
      await screen.findByText('3 titles this run brought in')
    ).toBeDefined();
  });

  it('starts nothing unasked', async () => {
    renderFlow();
    await scopeCard(ADDED);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchMock.mock.calls.some(([i, n]) => isStart(i, n))).toBe(false);
  });

  it('posts scope added and since once Start sync is pressed', async () => {
    renderFlow();
    await scopeCard(ADDED);

    await pressStart();

    expect(await startBody()).toMatchObject({ scope: 'added', since: SINCE });
  });

  it('posts a library scope without since when another card is chosen', async () => {
    renderFlow();
    fireEvent.click(await scopeCard(/Everything/));

    await pressStart();

    const body = await startBody();
    expect(body.scope).toBe('all');
    expect(body).not.toHaveProperty('since');
  });

  it('draws nothing until the summary lands', async () => {
    summaryHeld = true;
    renderFlow();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByText(/this run brought in/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start sync' })).toBeNull();
  });
});

describe('EnrichmentFlow: arriving without ?added=', () => {
  it('draws the library’s two cards, Only what’s missing chosen, from Settings', async () => {
    renderFlow(['/', '/settings', '/enrich']);

    expect(
      (await scopeCard(/Only what.s missing/)).getAttribute('aria-checked')
    ).toBe('true');
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryByRole('radio', { name: ADDED })).toBeNull();
  });

  it('reads the summary without since', async () => {
    renderFlow(['/', '/settings', '/enrich']);
    await scopeCard(/Only what.s missing/);

    expect(
      fetchMock.mock.calls.some(
        ([i, n]) => isSummary(i, n) && sinceOf(i) !== null
      )
    ).toBe(false);
  });

  it('no longer reads the retired ?scope=all', async () => {
    renderFlow(['/', '/settings', '/enrich?scope=all']);

    expect(
      (await scopeCard(/Only what.s missing/)).getAttribute('aria-checked')
    ).toBe('true');
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('draws a single-title Sync’s one card, not the added card', async () => {
    renderFlow(['/', '/movie/m1', '/enrich?movie=m1']);

    expect(await scopeCard(/Just this movie/)).toBeDefined();
    expect(screen.queryByRole('radio', { name: ADDED })).toBeNull();
  });
});

describe('EnrichmentFlow — Done, reached from an import', () => {
  it('lands on the library', async () => {
    arriving = {
      ...RUN,
      phase: 'review',
      done: RUN.total,
      enriched: RUN.total,
      currentItem: null,
    };
    renderFlow();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Done' }, { timeout: 3000 })
    );

    expect(await screen.findByText('the browse home')).toBeDefined();
  });
});
