import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LibraryFolders } from './LibraryFolders';
import type { LibraryFolder } from '@/types';
import { theme } from '@/styles/theme';
import {
  LocationProbe,
  navigationType,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';

/**
 * 30 — Library folders, Phase 2: "the Folder scan" (issue #269).
 *
 * The page's group **Scan**: _What the scanner accepts_ (`FolderShapes`),
 * then **Scan folders** — `primary`, `lg` — disabled while no folder is
 * listed. A press posts `POST /api/library-folders/scan { enrich: false }`
 * (the box is Phase 4's) and pushes `/import`; a `409` pushes too, so the
 * run already in flight is the one shown.
 *
 * The wire is a stubbed `fetch`: the list on GET, the scan's answer on its
 * POST.
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

const MOVIES: LibraryFolder = {
  id: 'f-movies',
  path: 'E:\\Movies',
  titleCount: 12,
  reachable: true,
};

const method = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;

const isScan = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/library-folders/scan' && method(init) === 'POST';

/** A run already in flight: the scan route's `409`. */
function busyResponse(): Response {
  return {
    ok: false,
    status: 409,
    json: () => Promise.resolve({ error: 'An import is already running.' }),
  } as unknown as Response;
}

/** The list on GET; the scan answered `201` with a run, or `409`. */
function serve(listed: LibraryFolder[], scan: 'created' | 'busy' = 'created') {
  fetchMock.mockImplementation((input, init) => {
    if (isScan(input, init)) {
      return Promise.resolve(
        scan === 'created'
          ? createdResponse(makeImportRun({ source: 'folders' }))
          : busyResponse()
      );
    }
    return Promise.resolve(okResponse(listed));
  });
}

function renderPage(
  history: string[] = ['/', '/settings', '/settings/folders']
) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<p>the browse home</p>} />
          <Route path="/settings" element={<p>the settings hub</p>} />
          <Route path="/settings/folders" element={<LibraryFolders />} />
          <Route path="/import" element={<p>the import screen</p>} />
        </Routes>
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const scanButton = () => screen.findByRole('button', { name: 'Scan folders' });

const scanCalls = () =>
  fetchMock.mock.calls.filter(([input, init]) => isScan(input, init));

describe('LibraryFolders — the group Scan', () => {
  it('draws Scan, What the scanner accepts, then Scan folders', async () => {
    serve([MOVIES]);
    renderPage();

    const button = await scanButton();
    expect(screen.getByText('Scan')).toBeDefined();
    expect(screen.getByText('What the scanner accepts')).toBeDefined();
    expect(
      screen
        .getByText('What the scanner accepts')
        .compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('disables Scan folders while no folder is listed', async () => {
    serve([]);
    renderPage();

    const button = (await scanButton()) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(scanCalls()).toHaveLength(0);
  });

  it('enables Scan folders once a folder is listed', async () => {
    serve([MOVIES]);
    renderPage();

    const button = (await scanButton()) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});

describe('LibraryFolders — Scan folders', () => {
  it('posts the scan with enrich false and pushes /import on 201', async () => {
    serve([MOVIES]);
    renderPage();

    await userEvent.click(await scanButton());

    await waitFor(() => expect(pathname()).toBe('/import'));
    expect(navigationType()).toBe('PUSH');
    expect(scanCalls()).toHaveLength(1);
    const [, init] = scanCalls()[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ enrich: false });
    expect(screen.getByText('the import screen')).toBeDefined();
  });

  it('pushes /import on 409 too, to show the run already in flight', async () => {
    serve([MOVIES], 'busy');
    renderPage();

    await userEvent.click(await scanButton());

    await waitFor(() => expect(pathname()).toBe('/import'));
    expect(scanCalls()).toHaveLength(1);
  });
});
