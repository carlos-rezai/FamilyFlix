import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ImportFlow } from './ImportFlow';
import type { ImportRun } from '@/types';
import { theme } from '@/styles/theme';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 30 — Library folders, Phase 2: "the Folder scan" (issue #269).
 *
 * The **Import flow** reads `run.source` for its heading and lede and for
 * nothing else: a **Folder scan** reads _Scan library folders_ over _Finding
 * new movies and series in your library folders._; a sheet run keeps the
 * existing _Import library_ and its lede.
 *
 * The seam is `fetch` and the router: the run is already there on arrival, as
 * it is after _Scan folders_ pushes `/import`.
 */

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

const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;

const SCAN_HEADING = 'Scan library folders';
const SCAN_LEDE = 'Finding new movies and series in your library folders.';
const SHEET_HEADING = 'Import library';
const SHEET_LEDE =
  'Bulk-migrate your spreadsheet and movie folders in one pass.';

/** A server whose Current run is `run` from the first read on. */
function serve(run: ImportRun) {
  fetchMock.mockImplementation((input) => {
    const p = path(input);
    if (p === '/api/import/current') {
      return Promise.resolve(okResponse(run));
    }
    if (p === '/api/tmdb/key') {
      return Promise.resolve(okResponse({ key: null }));
    }
    return Promise.resolve(notFoundResponse('Not found'));
  });
}

function renderFlow() {
  const history = ['/', '/settings', '/settings/folders', '/import'];
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/import" element={<ImportFlow />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const IMPORTING = {
  phase: 'importing',
  found: 4,
  total: 4,
  matched: 4,
  done: 1,
} as const;

describe('ImportFlow — the heading and lede by the run’s source', () => {
  it('draws the scan heading and lede for a folders run', async () => {
    serve(makeImportRun({ ...IMPORTING, source: 'folders' }));
    renderFlow();

    expect(await screen.findByText(SCAN_HEADING)).toBeDefined();
    expect(screen.getByText(SCAN_LEDE)).toBeDefined();
    expect(screen.queryByText(SHEET_HEADING)).toBeNull();
    expect(screen.queryByText(SHEET_LEDE)).toBeNull();
  });

  it('draws the scan heading on the Review step too', async () => {
    serve(
      makeImportRun({
        ...IMPORTING,
        phase: 'review',
        done: 4,
        source: 'folders',
      })
    );
    renderFlow();

    expect(await screen.findByText(SCAN_HEADING)).toBeDefined();
    expect(screen.getByText(SCAN_LEDE)).toBeDefined();
  });

  it('draws the existing heading and lede for a sheet run', async () => {
    serve(makeImportRun({ ...IMPORTING, source: 'sheet' }));
    renderFlow();

    // Wait for the run to have landed: the progress step is drawn.
    expect(
      await screen.findByRole('button', { name: /cancel/i })
    ).toBeDefined();
    expect(screen.getByText(SHEET_HEADING)).toBeDefined();
    expect(screen.getByText(SHEET_LEDE)).toBeDefined();
    expect(screen.queryByText(SCAN_HEADING)).toBeNull();
    expect(screen.queryByText(SCAN_LEDE)).toBeNull();
  });
});
