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
  createdResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 23 — Enrichment, Phase 8: "write back into the collection" (issue #211).
 *
 * Setup's _Where it is saved_ grows the two optional **Write targets** once a
 * **Library root** is remembered, `feat.EnrichmentFlow.dc.html` 1:1: the
 * **Metadata sheet** row — _Metadata sheet in the collection root_ over the
 * root's `familyflix-metadata.csv` in mono — and the posters row — _Posters
 * into each movie folder_ over `<root>\<movie folder>\poster.jpg` — each with
 * a Toggle, both on to begin with (the prototype's `enWriteSheet` /
 * `enWritePosters`). Start sends what they say. With no root neither is drawn
 * and a run sends both `false` (log 23 Q37).
 *
 * Review's _All done_ names what landed, off `EnrichmentRun.written`:
 * _Saved to your library, the sheet in your collection root, a poster.jpg in
 * each movie folder._ — the prototype's `writtenSummary`, each optional
 * target present only when the run says it was written.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

const ROOT = 'E:\\Movies';

const SUMMARY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryRoot: ROOT,
};

function makeRun(overrides: Partial<EnrichmentRun> = {}): EnrichmentRun {
  return {
    id: 'run-1',
    phase: 'running',
    scope: 'missing',
    startedAt: '2026-09-27T12:00:00.000Z',
    total: 12,
    done: 0,
    enriched: 0,
    currentItem: null,
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
 * A ready server: a key, a connection, the summary given. The current run is
 * `404` unless `current` is given, in which case the flow re-attaches to it.
 */
function serve(
  summary: EnrichmentSummary = SUMMARY,
  current: EnrichmentRun | null = null
) {
  fetchMock.mockImplementation((input, init) => {
    const p = path(input);
    if (isStart(input, init)) {
      return Promise.resolve(createdResponse(makeRun()));
    }
    if (p === '/api/enrichment/current' && method(init) === 'GET') {
      return Promise.resolve(
        current === null
          ? notFoundResponse('No sync is running')
          : okResponse(current)
      );
    }
    if (p === '/api/enrichment' && method(init) === 'GET') {
      return Promise.resolve(okResponse(summary));
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

function renderFlow() {
  return render(
    <MemoryRouter initialEntries={['/enrich']}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Routes>
            <Route path="/enrich" element={<EnrichmentFlow />} />
          </Routes>
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

/** The card under _Where it is saved_, once setup is drawn. */
async function card(): Promise<HTMLElement> {
  const label = await screen.findByText('Where it is saved');
  const next = label.nextElementSibling;
  if (!(next instanceof HTMLElement))
    throw new Error('no card under the label');
  return next;
}

const SHEET = 'Metadata sheet in the collection root';
const POSTERS = 'Posters into each movie folder';

/** Press Start sync once it can be pressed, and answer the body it sent. */
async function startBody(): Promise<Record<string, unknown>> {
  const start = await screen.findByRole('button', { name: 'Start sync' });
  await waitFor(() => {
    expect((start as HTMLButtonElement).disabled).toBe(false);
    expect(start.getAttribute('aria-disabled')).not.toBe('true');
  });
  fireEvent.click(start);
  await waitFor(() => {
    expect(fetchMock.mock.calls.some(([i, n]) => isStart(i, n))).toBe(true);
  });
  const [, init] = fetchMock.mock.calls.find(([i, n]) => isStart(i, n)) ?? [];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

describe('EnrichmentSetup — the Write targets in the Library root', () => {
  it('gives each of the two a switch, both on to begin with', async () => {
    renderFlow();

    const saved = within(await card());
    const sheet = await saved.findByRole('switch', { name: SHEET });
    const posters = saved.getByRole('switch', { name: POSTERS });
    expect(sheet.getAttribute('aria-checked')).toBe('true');
    expect(posters.getAttribute('aria-checked')).toBe('true');
  });

  it('starts a run asking for both targets while both are on', async () => {
    renderFlow();
    await within(await card()).findByRole('switch', { name: SHEET });

    const body = await startBody();

    expect(body.writeSheet).toBe(true);
    expect(body.writePosters).toBe(true);
  });

  it('starts a run without the sheet once its switch is turned off', async () => {
    renderFlow();
    const sheet = await within(await card()).findByRole('switch', {
      name: SHEET,
    });

    fireEvent.click(sheet);
    await waitFor(() => {
      expect(sheet.getAttribute('aria-checked')).toBe('false');
    });
    const body = await startBody();

    expect(body.writeSheet).toBe(false);
    expect(body.writePosters).toBe(true);
  });

  it('starts a run without posters once their switch is turned off', async () => {
    renderFlow();
    const posters = await within(await card()).findByRole('switch', {
      name: POSTERS,
    });

    fireEvent.click(posters);
    await waitFor(() => {
      expect(posters.getAttribute('aria-checked')).toBe('false');
    });
    const body = await startBody();

    expect(body.writeSheet).toBe(true);
    expect(body.writePosters).toBe(false);
  });
});

describe('EnrichmentSetup — no Library root, no Write targets', () => {
  beforeEach(() => {
    serve({ ...SUMMARY, libraryRoot: null });
  });

  // That neither row is drawn is `EnrichmentSetup.test.tsx`'s (#210).
  // This one guards the body: the switches default on, and must not leak
  // into a run that has nowhere to write them.
  it('starts a run asking for neither target', async () => {
    renderFlow();
    await card();

    const body = await startBody();

    expect(body.writeSheet).toBe(false);
    expect(body.writePosters).toBe(false);
  });
});
