import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { NetworkSection } from './NetworkSection';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import type { EnrichmentSummary } from '@/types';
import { theme } from '@/styles/theme';
import {
  LocationProbe,
  navigationType,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import {
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 23 — Enrichment, Phase 3: "setup's readiness" (issue #206).
 *
 * The Network group's second row, _Sync metadata & posters_, from
 * `page.SettingsPage.dc.html`: pressed, it pushes `/enrich`. Its line is read
 * off `GET /api/enrichment` through the shared `fetchEnrichmentSummary` —
 * `Last synced {relative} · N of M titles have full details.`, or the second
 * half alone before any **Sync**. The relative half's four faces are
 * `syncLine`'s own suite; here, that the row draws what the summary says.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

function summary(lastSyncedAt: string | null): EnrichmentSummary {
  return {
    total: 480,
    complete: 412,
    lastSyncedAt,
    keySet: true,
    online: true,
    libraryRoot: null,
  };
}

function serve(answer: EnrichmentSummary) {
  fetchMock.mockImplementation((input) => {
    const path = new URL(String(input), 'http://localhost').pathname;
    if (path === '/api/enrichment') {
      return Promise.resolve(okResponse(answer));
    }
    if (path === '/api/tmdb/key') {
      return Promise.resolve(okResponse({ key: null }));
    }
    return Promise.resolve(notFoundResponse('Not found'));
  });
}

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>();
  vi.stubGlobal('fetch', fetchMock);
  serve(summary(null));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderSection() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Routes>
            <Route path="/settings" element={<NetworkSection />} />
            <Route path="/enrich" element={<p>the enrichment flow</p>} />
          </Routes>
          <LocationProbe />
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const syncRow = () =>
  screen.findByRole('button', { name: /Sync metadata & posters/ });

describe('NetworkSection — the Sync metadata & posters row', () => {
  it('draws the row', async () => {
    renderSection();

    expect(await syncRow()).toBeDefined();
  });

  it('pushes /enrich when pressed', async () => {
    renderSection();

    fireEvent.click(await syncRow());

    expect(await screen.findByText('the enrichment flow')).toBeDefined();
    expect(pathname()).toBe('/enrich');
    expect(navigationType()).toBe('PUSH');
  });

  it('reads the full-details count alone before any Sync', async () => {
    renderSection();

    expect(
      await screen.findByText('412 of 480 titles have full details.')
    ).toBeDefined();
    expect(screen.queryByText(/Last synced/)).toBeNull();
  });

  it('reads when the last Sync was, beside the count', async () => {
    serve(summary(new Date(Date.now() - 2 * 60 * 1000).toISOString()));
    renderSection();

    expect(
      await screen.findByText(
        'Last synced 2 minutes ago · 412 of 480 titles have full details.'
      )
    ).toBeDefined();
  });

  it('asks the summary of GET /api/enrichment', async () => {
    renderSection();

    await screen.findByText('412 of 480 titles have full details.');
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          new URL(String(input), 'http://localhost').pathname ===
            '/api/enrichment' && (init?.method ?? 'GET').toUpperCase() === 'GET'
      )
    ).toBe(true);
  });
});
