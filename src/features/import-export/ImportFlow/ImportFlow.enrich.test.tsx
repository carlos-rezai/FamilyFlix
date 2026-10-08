import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ImportFlow } from './ImportFlow';
import type { ImportRun } from '@/types';
import { theme } from '@/styles/theme';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import {
  LocationProbe,
  navigationType,
  pathname,
  search,
} from '@/test-support/LocationProbe/LocationProbe';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  createdResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 23 — Enrichment, Phase 9: "from the import" (issue #212).
 *
 * The third way into an **Enrichment run**: the **Import flow**'s setup draws
 * the _Also fetch metadata and posters from TMDB_ card, its hint chosen by
 * `GET /api/tmdb/key`; the box travels on the run as `enrich` in
 * `POST /api/import`, and comes back on `ImportRun.enrich`, so a run
 * re-attached on arrival still knows it. _Finish_ on such a run **replaces**
 * `/import` with `/enrich?scope=all` — nothing starts unasked — and Back from
 * there steps to Settings. _Finish_ on a run without it is the push to `/` it
 * always was.
 *
 * The seam is `fetch` and the router, as in `ImportFlow.test.tsx`.
 */

const SHEET = 'C:\\Movies\\library.xlsx';
const ROOT = 'C:\\Movies';
const LABEL = /Also fetch metadata and posters from TMDB/;
const HINT_WITH_KEY =
  'Runs straight after the import, over everything it brings in. Needs the internet.';
const HINT_WITHOUT_KEY =
  'Needs a TMDB key — add one under Settings → Network first.';

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const method = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;

const isStart = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/import' && method(init) === 'POST';

/**
 * A server with one import at a time and a stored key (or none). `current`
 * answers `404` until a run exists — from a `201` start, or `onArrival` for
 * one already there — then each read answers the next snapshot in `then`,
 * holding the last.
 */
function serve({
  key = '0123456789abcdef',
  started = makeImportRun(),
  then = [],
  onArrival = false,
}: {
  key?: string | null;
  started?: ImportRun;
  then?: ImportRun[];
  onArrival?: boolean;
} = {}) {
  let read = 0;
  let running = onArrival;
  fetchMock.mockImplementation((input, init) => {
    const p = path(input);
    if (p === '/api/tmdb/key' && method(init) === 'GET') {
      return Promise.resolve(okResponse({ key }));
    }
    if (isStart(input, init)) {
      running = true;
      return Promise.resolve(createdResponse(started));
    }
    if (p === '/api/import/current' && method(init) === 'GET') {
      if (!running) {
        return Promise.resolve(notFoundResponse('No import is running'));
      }
      const snapshot = then[Math.min(read, then.length - 1)] ?? started;
      read += 1;
      return Promise.resolve(okResponse(snapshot));
    }
    return Promise.resolve(notFoundResponse('Not found'));
  });
}

/** The enrichment screen, with the app's one Back rule and nothing else. */
function EnrichStub() {
  const goBack = useGoBack('/settings');
  return (
    <>
      <p>the enrichment setup</p>
      <button type="button" onClick={goBack}>
        Back from enrichment
      </button>
    </>
  );
}

function renderFlow(history: string[] = ['/', '/settings', '/import']) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<p>the browse home</p>} />
          <Route path="/settings" element={<p>the settings hub</p>} />
          <Route path="/import" element={<ImportFlow />} />
          <Route path="/enrich" element={<EnrichStub />} />
        </Routes>
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const POLLING = { timeout: 3000 };

const setupStep = () => screen.findByRole('textbox', { name: 'Spreadsheet' });
const enrichCard = () => screen.findByRole('checkbox', { name: LABEL });

function startRun() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Spreadsheet' }), {
    target: { value: SHEET },
  });
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Movies root folder' }),
    { target: { value: ROOT } }
  );
  fireEvent.click(screen.getByRole('button', { name: 'Start import' }));
}

/** The body of the one start the screen sent. */
async function startBody(): Promise<Record<string, unknown>> {
  await waitFor(() => {
    expect(fetchMock.mock.calls.some(([i, n]) => isStart(i, n))).toBe(true);
  });
  const [, init] = fetchMock.mock.calls.find(([i, n]) => isStart(i, n)) ?? [];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

const REVIEW = { found: 2, total: 2, done: 2, matched: 2 };
const finish = () =>
  screen.findByRole('button', { name: 'Finish — go to library' }, POLLING);

describe('ImportFlow — the Also fetch from TMDB card', () => {
  it('offers the card on setup, unticked', async () => {
    serve();
    renderFlow();
    await setupStep();

    expect(((await enrichCard()) as HTMLInputElement).checked).toBe(false);
  });

  it('reads the with-key hint when GET /api/tmdb/key answers a key', async () => {
    serve({ key: '0123456789abcdef' });
    renderFlow();

    expect(await screen.findByText(HINT_WITH_KEY)).toBeDefined();
    expect(screen.queryByText(HINT_WITHOUT_KEY)).toBeNull();
  });

  it('reads the without-key hint when it answers none', async () => {
    serve({ key: null });
    renderFlow();

    expect(await screen.findByText(HINT_WITHOUT_KEY)).toBeDefined();
    expect(screen.queryByText(HINT_WITH_KEY)).toBeNull();
  });

  it('ticks and unticks on a press', async () => {
    serve();
    renderFlow();
    await setupStep();

    fireEvent.click(await enrichCard());
    expect(((await enrichCard()) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(await enrichCard());
    expect(((await enrichCard()) as HTMLInputElement).checked).toBe(false);
  });
});

describe('ImportFlow — the box travels on the run', () => {
  it('posts enrich: true with the two paths when the box is ticked', async () => {
    serve({ started: makeImportRun({ enrich: true }) });
    renderFlow();
    await setupStep();

    fireEvent.click(await enrichCard());
    startRun();

    expect(await startBody()).toEqual({
      sheetPath: SHEET,
      rootPath: ROOT,
      enrich: true,
    });
  });
});

describe('ImportFlow — Finish on a run carrying enrich', () => {
  it('replaces /import with /enrich?scope=all', async () => {
    serve({
      started: makeImportRun({ enrich: true }),
      then: [makeImportRun({ ...REVIEW, phase: 'review', enrich: true })],
    });
    renderFlow();
    await setupStep();
    fireEvent.click(await enrichCard());
    startRun();

    fireEvent.click(await finish());

    expect(pathname()).toBe('/enrich');
    expect(search()).toBe('?scope=all');
    expect(navigationType()).toBe('REPLACE');
    expect(screen.getByText('the enrichment setup')).toBeDefined();
    // Nothing starts unasked: no enrichment is posted on the way.
    expect(
      fetchMock.mock.calls.some(
        ([i, n]) => path(i).startsWith('/api/enrichment') && method(n) !== 'GET'
      )
    ).toBe(false);
  });

  it('knows it from a run re-attached on arrival, ticked by nobody on this visit', async () => {
    serve({
      onArrival: true,
      then: [makeImportRun({ ...REVIEW, phase: 'review', enrich: true })],
    });
    renderFlow();

    fireEvent.click(await finish());

    expect(pathname()).toBe('/enrich');
    expect(search()).toBe('?scope=all');
    expect(navigationType()).toBe('REPLACE');
  });

  it('steps back onto Settings from the enrichment screen, not back onto Import', async () => {
    serve({
      onArrival: true,
      then: [makeImportRun({ ...REVIEW, phase: 'review', enrich: true })],
    });
    renderFlow();
    fireEvent.click(await finish());

    fireEvent.click(
      screen.getByRole('button', { name: 'Back from enrichment' })
    );

    expect(pathname()).toBe('/settings');
    expect(navigationType()).toBe('POP');
  });
});

describe('ImportFlow — Finish on a run without enrich', () => {
  it('goes home even when the box was ticked on setup but the run says otherwise', async () => {
    // The run is the truth: what the server carries is what Finish reads.
    serve({
      started: makeImportRun({ enrich: false }),
      then: [makeImportRun({ ...REVIEW, phase: 'review', enrich: false })],
    });
    renderFlow();
    await setupStep();
    fireEvent.click(await enrichCard());
    startRun();

    fireEvent.click(await finish());

    expect(pathname()).toBe('/');
    expect(navigationType()).toBe('PUSH');
  });
});

// 30 — Library folders, Phase 4 (issue #271): a **Folder scan** carries the
// box from the Library folders page on the same `ImportRun.enrich`, so its
// _Finish_ reads it exactly as a sheet run's does.
describe('ImportFlow — Finish on a Folder scan', () => {
  const FROM_FOLDERS = ['/', '/settings', '/settings/folders', '/import'];

  it('replaces /import with /enrich?scope=all when the scan was ticked', async () => {
    serve({
      onArrival: true,
      then: [
        makeImportRun({
          ...REVIEW,
          phase: 'review',
          source: 'folders',
          enrich: true,
        }),
      ],
    });
    renderFlow(FROM_FOLDERS);

    fireEvent.click(await finish());

    expect(pathname()).toBe('/enrich');
    expect(search()).toBe('?scope=all');
    expect(navigationType()).toBe('REPLACE');
  });

  it('lands on the library when the scan was not ticked', async () => {
    serve({
      onArrival: true,
      then: [
        makeImportRun({
          ...REVIEW,
          phase: 'review',
          source: 'folders',
          enrich: false,
        }),
      ],
    });
    renderFlow(FROM_FOLDERS);

    fireEvent.click(await finish());

    expect(pathname()).toBe('/');
    expect(screen.getByText('the browse home')).toBeDefined();
  });
});
