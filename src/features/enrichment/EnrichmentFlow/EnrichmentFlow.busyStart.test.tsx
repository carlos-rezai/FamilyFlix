import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { EnrichmentFlow } from './EnrichmentFlow';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import type { EnrichmentRun, EnrichmentSummary } from '@/types';
import { theme } from '@/styles/theme';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  conflictResponse,
  createdResponse,
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';
import { snackbarStack } from '@/test-support/snackbarStack/snackbarStack';

/**
 * 69, Silent waits, Phase 3 (issue #655): the start buttons on the **Loader
 * timing**.
 *
 * With `POST /api/enrichment` held open, _Start sync_ and _Fetch details_
 * lock at once, so a second press sends nothing, and read _Starting…_ and
 * _Fetching…_ past 300ms. **Started on arrival** shows the same button. A
 * refused start puts the button back, pressable, with the **busy notice**
 * where a `409` over another's run raises it today.
 *
 * The clock is faked from the first render; every read is answered at once.
 */

const FILM = 'm1';
const BUSY = 'A sync is already running.';

const SUMMARY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  gaps: 12,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryFolders: ['D:\\Movies'],
};

const OWN_RUNNING = makeEnrichmentRun({
  id: 'own',
  scope: 'single',
  movieId: FILM,
  total: 1,
  currentItem: 'The Lantern Keeper',
});

const LIBRARY_RUNNING = makeEnrichmentRun({
  id: 'library',
  scope: 'all',
  total: 30,
  done: 4,
  currentItem: 'Kettle Bay',
});

const pathOf = (url: string) => new URL(url, 'http://localhost').pathname;
const verbOf = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const isStart = (url: string, init?: RequestInit) =>
  pathOf(url) === '/api/enrichment' && verbOf(init) === 'POST';

/** What `GET /api/enrichment/current` answers; `null` is a `404`. */
let current: EnrichmentRun | null = null;

/** Every read answered at once; only a start is held open. */
const { fetchMock, respond } = heldFetch((url, init) => {
  const p = pathOf(url);
  if (isStart(url, init)) return undefined;
  if (p === '/api/enrichment/current') {
    return current === null
      ? notFoundResponse('No sync is running')
      : okResponse(current);
  }
  if (p === '/api/enrichment') return okResponse(SUMMARY);
  if (p === '/api/tmdb/key') return okResponse({ key: '0123456789abcdef' });
  if (p === `/api/movies/${FILM}`) {
    return okResponse(
      makeMovie({ id: FILM, title: 'The Lantern Keeper', year: 2019 })
    );
  }
  return notFoundResponse('Not found');
});

beforeEach(() => {
  current = null;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const starts = () =>
  fetchMock.mock.calls.filter(([input, init]) => isStart(String(input), init));

/** The flow at `entry`, its reads landed on the faked clock. */
async function renderFlow(entry: string) {
  render(
    <MemoryRouter initialEntries={['/settings', entry]} initialIndex={1}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Routes>
            <Route path="/settings" element={<p>the settings hub</p>} />
            <Route path="/movie/:id" element={<p>the movie page</p>} />
            <Route path="/enrich" element={<EnrichmentFlow />} />
          </Routes>
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
  await advanceClock(0);
  await advanceClock(0);
}

const button = (name: string) =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

/** A start's button, locked and busy. */
function expectLocked(face: HTMLButtonElement) {
  expect(face.getAttribute('aria-busy')).toBe('true');
  expect(face.disabled).toBe(true);
}

describe('EnrichmentFlow: Start sync as a Busy button', () => {
  it('locks at once, so a second press sends nothing', async () => {
    await renderFlow('/enrich');

    fireEvent.click(button('Start sync'));
    expect(starts()).toHaveLength(1);
    expectLocked(button('Start sync'));

    fireEvent.click(button('Start sync'));
    await advanceClock(0);
    expect(starts()).toHaveLength(1);

    current = LIBRARY_RUNNING;
    await respond(createdResponse(LIBRARY_RUNNING));
    await advanceClock(500);
  });

  it('reads Starting… past 300ms', async () => {
    await renderFlow('/enrich');

    fireEvent.click(button('Start sync'));
    await advanceClock(299);
    expect(screen.queryByRole('button', { name: 'Starting…' })).toBeNull();
    await advanceClock(1);
    expectLocked(button('Starting…'));

    current = LIBRARY_RUNNING;
    await respond(createdResponse(LIBRARY_RUNNING));
    await advanceClock(500);
  });
});

describe('EnrichmentFlow: Fetch details as a Busy button', () => {
  it('locks at once, and reads Fetching… past 300ms', async () => {
    await renderFlow(`/enrich?movie=${FILM}`);

    fireEvent.click(button('Fetch details'));
    expect(starts()).toHaveLength(1);
    expectLocked(button('Fetch details'));
    fireEvent.click(button('Fetch details'));
    await advanceClock(0);
    expect(starts()).toHaveLength(1);

    await advanceClock(299);
    expect(screen.queryByRole('button', { name: 'Fetching…' })).toBeNull();
    await advanceClock(1);
    expectLocked(button('Fetching…'));

    current = OWN_RUNNING;
    await respond(createdResponse(OWN_RUNNING));
    await advanceClock(500);
  });

  it('shows the same button for a start on arrival', async () => {
    await renderFlow(`/enrich?movie=${FILM}&start=1`);

    expect(starts()).toHaveLength(1);
    expectLocked(button('Fetch details'));

    await advanceClock(300);
    expectLocked(button('Fetching…'));

    current = OWN_RUNNING;
    await respond(createdResponse(OWN_RUNNING));
    await advanceClock(500);
  });
});

describe('EnrichmentFlow: a refused start', () => {
  it('puts the button back, pressable, with the busy notice over another’s run', async () => {
    await renderFlow(`/enrich?movie=${FILM}`);

    fireEvent.click(button('Fetch details'));
    await advanceClock(400);
    current = LIBRARY_RUNNING;
    await respond(conflictResponse());
    await advanceClock(399);
    expectLocked(button('Fetching…'));
    await advanceClock(1);

    const face = button('Fetch details');
    expect(face.getAttribute('aria-busy')).toBeNull();
    expect(face.disabled).toBe(false);
    expect(within(snackbarStack()).getByText(BUSY)).toBeDefined();

    fireEvent.click(face);
    expect(starts()).toHaveLength(2);
  });

  it('puts the button back, pressable, with no notice on a failure', async () => {
    await renderFlow('/enrich');

    fireEvent.click(button('Start sync'));
    await advanceClock(400);
    await respond(serverErrorResponse());
    await advanceClock(399);
    expectLocked(button('Starting…'));
    await advanceClock(1);

    const face = button('Start sync');
    expect(face.getAttribute('aria-busy')).toBeNull();
    expect(face.disabled).toBe(false);
    expect(within(snackbarStack()).queryByText(BUSY)).toBeNull();

    fireEvent.click(face);
    expect(starts()).toHaveLength(2);
  });
});
