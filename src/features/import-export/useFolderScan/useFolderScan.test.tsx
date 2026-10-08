import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { useFolderScan } from './useFolderScan';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  LocationProbe,
  navigationType,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import {
  createdResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 30 — Library folders refactor (issue 274), commit 15.
 *
 * `useFolderScan()` — the _Scan folders_ press, out of the `LibraryFolders`
 * organism: `POST /api/library-folders/scan` with the box, then a push to
 * `/import` on a `201` and on a `409` alike, and `scanning` let go on any
 * other failure. What it does is move the router, so that is what is read.
 */

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

/** A screen whose one control is the hook's press, with the box ticked. */
function Screen() {
  const { scanning, scan } = useFolderScan();

  return (
    <>
      <span data-testid="scanning">{String(scanning)}</span>
      <button type="button" onClick={() => void scan(true)}>
        Scan folders
      </button>
    </>
  );
}

function renderAtFolders() {
  return render(
    <MemoryRouter initialEntries={['/settings/folders']}>
      <LocationProbe />
      <Routes>
        <Route path="/settings/folders" element={<Screen />} />
        <Route path="/import" element={<span>Import screen</span>} />
      </Routes>
    </MemoryRouter>
  );
}

function busyResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'An import is already running.' }),
    { status: 409, headers: { 'Content-Type': 'application/json' } }
  );
}

describe('useFolderScan', () => {
  it('posts the scan with the box, held while it is asked', async () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));
    renderAtFolders();

    fireEvent.click(screen.getByRole('button', { name: 'Scan folders' }));

    expect(screen.getByTestId('scanning').textContent).toBe('true');
    const [input, init] = fetchMock.mock.calls[0];
    expect(input).toBe('/api/library-folders/scan');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ enrich: true });
  });

  it('pushes /import once the scan has started', async () => {
    fetchMock.mockResolvedValue(
      createdResponse(makeImportRun({ source: 'folders' }))
    );
    renderAtFolders();

    fireEvent.click(screen.getByRole('button', { name: 'Scan folders' }));

    await waitFor(() => expect(pathname()).toBe('/import'));
    expect(navigationType()).toBe('PUSH');
  });

  it('pushes /import on a 409, to the run already in flight', async () => {
    fetchMock.mockResolvedValue(busyResponse());
    renderAtFolders();

    fireEvent.click(screen.getByRole('button', { name: 'Scan folders' }));

    await waitFor(() => expect(pathname()).toBe('/import'));
    expect(navigationType()).toBe('PUSH');
  });

  it('stays and lets go of the press on any other failure', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());
    renderAtFolders();

    fireEvent.click(screen.getByRole('button', { name: 'Scan folders' }));

    await waitFor(() =>
      expect(screen.getByTestId('scanning').textContent).toBe('false')
    );
    expect(pathname()).toBe('/settings/folders');
  });
});
