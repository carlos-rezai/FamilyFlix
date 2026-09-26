import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { EnrichmentFlow } from './EnrichmentFlow';
import type { EnrichField, EnrichmentRun, EnrichmentSummary } from '@/types';
import { theme } from '@/styles/theme';
import {
  LocationProbe,
  navigationType,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import {
  createdResponse,
  noContentResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 23 — Enrichment, Phase 3: "the whole library" (issue #205).
 *
 * The **Enrichment flow** opened at `/enrich` with no movie — a library-wide
 * **Sync**. The seam is `fetch` and the router, `ImportFlow`'s precedent.
 *
 * - **Setup** offers the two scope cards, _Only what's missing_ (the default)
 *   and _Everything_, in place of _Just this movie_; the ten field chips, a
 *   chip switched off leaving its field out of the start; and the line that
 *   ★ ratings are never touched. Start reads _Start sync_.
 * - **The running card** draws the headline, elapsed, the stat line, the
 *   determinate bar, the current item, the ETA, the Activity log and _Stop_
 *   with _Anything already fetched is kept._ beside it — polled every 500 ms,
 *   and re-attached when the screen is opened on a run already going.
 * - _Stop_ sends `POST /api/enrichment/current/cancel` and shows setup.
 * - _Sync again_ drops the finished run the same way and shows setup.
 * - Back with nothing behind `/enrich` lands on Settings, its **Landing**.
 *
 * Polling is real time, 500 ms a poll.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

const ALL_FIELDS: EnrichField[] = [
  'synopsis',
  'poster',
  'backdrop',
  'runtime',
  'year',
  'genres',
  'director',
  'cast',
  'originalTitle',
  'tmdbScore',
];

const CHIP_LABELS = [
  'Synopsis',
  'Poster',
  'Backdrop',
  'Runtime',
  'Year',
  'Genres',
  'Director',
  'Cast',
  'Original title',
  'TMDB score',
];

const SUMMARY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryRoot: null,
};

/** A run six seconds old, three of thirty looked up. */
function makeRun(overrides: Partial<EnrichmentRun> = {}): EnrichmentRun {
  return {
    id: 'run-1',
    phase: 'running',
    scope: 'missing',
    startedAt: new Date(Date.now() - 6000).toISOString(),
    total: 30,
    done: 3,
    enriched: 3,
    currentItem: 'Harbor Lights (1963)',
    log: [
      { text: 'Contacting api.themoviedb.org …', kind: 'info' },
      { text: 'Looking up 30 titles by name and year.', kind: 'info' },
      { text: '✓ Matched   The Lantern Keeper (2019)', kind: 'success' },
    ],
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
const isCancel = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/enrichment/current/cancel' && method(init) === 'POST';

/**
 * A server holding `current` as the Current enrichment run (`null` for none).
 * Start answers `201` with `started` and holds it; every read after that
 * answers `next(run)` of whatever is held; cancel answers `204` and drops it.
 */
function serve({
  current = null,
  started = makeRun(),
  next = (run: EnrichmentRun) => run,
}: {
  current?: EnrichmentRun | null;
  started?: EnrichmentRun;
  next?: (run: EnrichmentRun) => EnrichmentRun;
} = {}) {
  let held = current;
  fetchMock.mockImplementation((input, init) => {
    const p = path(input);
    if (isStart(input, init)) {
      held = started;
      return Promise.resolve(createdResponse(started));
    }
    if (isCancel(input, init)) {
      held = null;
      return Promise.resolve(noContentResponse());
    }
    if (p === '/api/enrichment/current' && method(init) === 'GET') {
      if (held === null) {
        return Promise.resolve(notFoundResponse('No sync is running'));
      }
      held = next(held);
      return Promise.resolve(okResponse(held));
    }
    if (p === '/api/enrichment' && method(init) === 'GET') {
      return Promise.resolve(okResponse(SUMMARY));
    }
    if (p === '/api/tmdb/key') {
      return Promise.resolve(okResponse({ key: '0123456789abcdef' }));
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

function renderFlow(history: string[] = ['/settings', '/enrich']) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<p>the browse home</p>} />
          <Route path="/settings" element={<p>the settings hub</p>} />
          <Route path="/enrich" element={<EnrichmentFlow />} />
        </Routes>
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const scopeCard = (name: RegExp | string) =>
  screen.findByRole('radio', { name });

async function pressStart() {
  const start = await screen.findByRole('button', { name: 'Start sync' });
  await waitFor(() => {
    expect((start as HTMLButtonElement).disabled).toBe(false);
    expect(start.getAttribute('aria-disabled')).not.toBe('true');
  });
  fireEvent.click(start);
}

/** The body of the one start the screen sent. */
async function startBody(): Promise<Record<string, unknown>> {
  await waitFor(() => {
    expect(fetchMock.mock.calls.some(([i, n]) => isStart(i, n))).toBe(true);
  });
  const [, init] = fetchMock.mock.calls.find(([i, n]) => isStart(i, n)) ?? [];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

const cancelsSent = () =>
  fetchMock.mock.calls.filter(([i, n]) => isCancel(i, n)).length;

describe('EnrichmentFlow — setup for the whole library', () => {
  it('offers Only what’s missing and Everything, and not Just this movie', async () => {
    renderFlow();

    expect(await scopeCard(/Only what.s missing/)).toBeDefined();
    expect(await scopeCard(/Everything/)).toBeDefined();
    expect(screen.queryByText('Just this movie')).toBeNull();
  });

  it('selects Only what’s missing to begin with', async () => {
    renderFlow();

    expect(
      (await scopeCard(/Only what.s missing/)).getAttribute('aria-checked')
    ).toBe('true');
    expect((await scopeCard(/Everything/)).getAttribute('aria-checked')).toBe(
      'false'
    );
  });

  it('moves the selection to Everything when it is pressed', async () => {
    renderFlow();

    fireEvent.click(await scopeCard(/Everything/));

    expect((await scopeCard(/Everything/)).getAttribute('aria-checked')).toBe(
      'true'
    );
    expect(
      (await scopeCard(/Only what.s missing/)).getAttribute('aria-checked')
    ).toBe('false');
  });

  it('draws the ten field chips in the prototype’s order, every one on', async () => {
    renderFlow();
    await scopeCard(/Everything/);

    const chips = CHIP_LABELS.map((label) =>
      screen.getByRole('button', { name: label })
    );
    for (const chip of chips) {
      expect(chip.getAttribute('aria-pressed')).toBe('true');
    }
    for (let i = 1; i < chips.length; i += 1) {
      expect(
        chips[i - 1].compareDocumentPosition(chips[i]) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  });

  it('says the household rating is never touched', async () => {
    renderFlow();

    expect(
      await screen.findByText(
        /Your household rating is yours — TMDB’s score is stored beside it, never over it\./
      )
    ).toBeDefined();
  });

  it('names Start Start sync', async () => {
    renderFlow();

    expect(
      await screen.findByRole('button', { name: 'Start sync' })
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Fetch details' })).toBeNull();
  });
});

describe('EnrichmentFlow — what Start sends', () => {
  it('starts Only what’s missing with every chip, naming no movie', async () => {
    renderFlow();

    await pressStart();

    const body = await startBody();
    expect(body.scope).toBe('missing');
    expect(body.fields).toEqual(ALL_FIELDS);
    expect(body.movieId).toBeUndefined();
  });

  it('starts Everything when Everything is chosen', async () => {
    renderFlow();
    fireEvent.click(await scopeCard(/Everything/));

    await pressStart();

    expect((await startBody()).scope).toBe('all');
  });

  it('leaves a chip switched off out of the fields', async () => {
    renderFlow();
    await scopeCard(/Everything/);
    fireEvent.click(screen.getByRole('button', { name: 'Synopsis' }));
    fireEvent.click(screen.getByRole('button', { name: 'TMDB score' }));

    await pressStart();

    expect((await startBody()).fields).toEqual(
      ALL_FIELDS.filter((f) => f !== 'synopsis' && f !== 'tmdbScore')
    );
  });
});

describe('EnrichmentFlow — the running card', () => {
  it('shows the headline, the stat line and the determinate bar', async () => {
    renderFlow();
    await pressStart();

    expect(await screen.findByText('Fetching from TMDB…')).toBeDefined();
    expect(screen.getByText('3 of 30 looked up')).toBeDefined();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '10'
    );
  });

  it('shows the current item and the Activity log', async () => {
    renderFlow();
    await pressStart();

    expect(await screen.findByText('Harbor Lights (1963)')).toBeDefined();
    expect(
      screen.getByText('✓ Matched   The Lantern Keeper (2019)', {
        normalizer: (text) => text,
      })
    ).toBeDefined();
  });

  it('shows elapsed and the ETA', async () => {
    renderFlow();
    await pressStart();

    expect(await screen.findByText(/^Elapsed \d+:\d\d$/)).toBeDefined();
    expect(screen.getByText(/^About \d+:\d\d left$/)).toBeDefined();
  });

  it('offers Stop, with the line that fetched details are kept', async () => {
    renderFlow();
    await pressStart();

    expect(await screen.findByRole('button', { name: 'Stop' })).toBeDefined();
    expect(screen.getByText('Anything already fetched is kept.')).toBeDefined();
  });

  it('polls, and draws the progress each read brings', async () => {
    serve({
      next: (run) => ({
        ...run,
        done: Math.min(run.total, run.done + 1),
        currentItem: `Title ${run.done + 1}`,
      }),
    });
    renderFlow();
    await pressStart();
    await screen.findByText('3 of 30 looked up');

    expect(
      await screen.findByText('5 of 30 looked up', undefined, {
        timeout: 3000,
      })
    ).toBeDefined();
  });
});

describe('EnrichmentFlow — re-attaching', () => {
  it('shows the run already going when the screen is opened again', async () => {
    serve({ current: makeRun({ done: 7 }) });

    renderFlow();

    expect(await screen.findByText('7 of 30 looked up')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeDefined();
    expect(fetchMock.mock.calls.some(([i, n]) => isStart(i, n))).toBe(false);
  });

  it('keeps polling the run it re-attached to', async () => {
    serve({
      current: makeRun({ done: 7 }),
      next: (run) => ({ ...run, done: run.done + 1 }),
    });

    renderFlow();

    expect(
      await screen.findByText(/^(9|10|11) of 30 looked up$/, undefined, {
        timeout: 3000,
      })
    ).toBeDefined();
  });

  it('shows setup when no run is held', async () => {
    renderFlow();

    expect(
      await screen.findByRole('button', { name: 'Start sync' })
    ).toBeDefined();
    expect(screen.queryByText('Fetching from TMDB…')).toBeNull();
  });
});

describe('EnrichmentFlow — Stop', () => {
  it('cancels the run and returns to setup', async () => {
    renderFlow();
    await pressStart();

    fireEvent.click(await screen.findByRole('button', { name: 'Stop' }));

    await waitFor(() => {
      expect(cancelsSent()).toBe(1);
    });
    expect(
      await screen.findByRole('button', { name: 'Start sync' })
    ).toBeDefined();
    expect(screen.queryByText('Fetching from TMDB…')).toBeNull();
  });

  it('does not bring the stopped run back on the next poll', async () => {
    renderFlow();
    await pressStart();
    fireEvent.click(await screen.findByRole('button', { name: 'Stop' }));
    await screen.findByRole('button', { name: 'Start sync' });

    await new Promise((resolve) => setTimeout(resolve, 1200));

    expect(screen.queryByText('Fetching from TMDB…')).toBeNull();
  });
});

describe('EnrichmentFlow — review and Sync again', () => {
  const inReview = () =>
    serve({
      next: (run) => ({
        ...run,
        phase: 'review',
        done: run.total,
        enriched: run.total,
        currentItem: null,
      }),
    });

  it('reaches review with Done', async () => {
    inReview();
    renderFlow();
    await pressStart();

    expect(
      await screen.findByRole('button', { name: 'Done' }, { timeout: 3000 })
    ).toBeDefined();
  });

  it('drops the finished run and shows setup on Sync again', async () => {
    inReview();
    renderFlow();
    await pressStart();

    fireEvent.click(
      await screen.findByRole(
        'button',
        { name: 'Sync again' },
        { timeout: 3000 }
      )
    );

    await waitFor(() => {
      expect(cancelsSent()).toBe(1);
    });
    expect(
      await screen.findByRole('button', { name: 'Start sync' })
    ).toBeDefined();
  });
});

describe('EnrichmentFlow — Back', () => {
  it('steps back to Settings when Settings is behind it', async () => {
    renderFlow(['/settings', '/enrich']);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/settings');
    expect(navigationType()).toBe('POP');
  });

  it('lands on Settings with nothing behind it', async () => {
    renderFlow(['/enrich']);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/settings');
    expect(navigationType()).toBe('PUSH');
    expect(screen.getByText('the settings hub')).toBeDefined();
  });
});
