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
 * The Import flow's _Finish_ on a run carrying `enrich` replaces `/import`
 * with `/enrich?scope=all`. What lands there is the **Setup step** with
 * _Everything_ selected — the prototype's `setState({ enScope: 'all' })` —
 * and nothing started: the maintainer still presses _Start sync_. Back from
 * there steps to Settings, because the replace left Import out of the
 * history.
 */

const SUMMARY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryRoot: null,
};

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

const method = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;
const isStart = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/enrichment' && method(init) === 'POST';

beforeEach(() => {
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
        held === null
          ? notFoundResponse('No sync is running')
          : okResponse(held)
      );
    }
    if (p === '/api/enrichment' && method(init) === 'GET') {
      return Promise.resolve(okResponse(SUMMARY));
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
function renderFlow(
  history: string[] = ['/', '/settings', '/enrich?scope=all']
) {
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

describe('EnrichmentFlow — arriving with ?scope=all', () => {
  it('shows setup with Everything selected and Only what’s missing not', async () => {
    renderFlow();

    expect((await scopeCard(/Everything/)).getAttribute('aria-checked')).toBe(
      'true'
    );
    expect(
      (await scopeCard(/Only what.s missing/)).getAttribute('aria-checked')
    ).toBe('false');
    expect(screen.getByRole('button', { name: 'Start sync' })).toBeDefined();
    // Nothing starts unasked: the maintainer still presses Start sync.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchMock.mock.calls.some(([i, n]) => isStart(i, n))).toBe(false);
  });

  it('starts the whole library once Start sync is pressed', async () => {
    renderFlow();
    await scopeCard(/Everything/);
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
    expect(
      (JSON.parse(String(init?.body)) as Record<string, unknown>).scope
    ).toBe('all');
  });
});
