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
  conflictResponse,
  createdResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 30 — Library folders refactor (issue 274), commit 15.
 *
 * `useFolderScan()` — the _Scan new folders_ and _Scan all folders_ presses,
 * out of the `LibraryFolders` organism: `POST /api/library-folders/scan` with
 * the box, then a push to `/import` on a `201` and on a `409` alike, and
 * `scanning` let go on any other failure. What it does is move the router, so
 * that is what is read.
 *
 * 54: Scan new folders (issue #495): the press carries its **Scan scope**,
 * `new` for _Scan new folders_ and `all` for _Scan all folders_, sent beside
 * the box and the mode.
 */

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

/**
 * A screen whose controls are the hook's press in each scope, the box ticked,
 * Copy chosen (#343).
 */
function Screen() {
  const { scanning, scan } = useFolderScan();

  return (
    <>
      <span data-testid="scanning">{String(scanning)}</span>
      <button type="button" onClick={() => void scan(true, 'copy', 'new')}>
        Scan new folders
      </button>
      <button type="button" onClick={() => void scan(true, 'copy', 'all')}>
        Scan all folders
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

describe('useFolderScan', () => {
  it.each([
    ['Scan new folders', 'new'],
    ['Scan all folders', 'all'],
  ])(
    '%s posts the scan with the box, the mode and scope %s, held while it is asked',
    async (name, scope) => {
      fetchMock.mockReturnValue(new Promise<Response>(() => undefined));
      renderAtFolders();

      fireEvent.click(screen.getByRole('button', { name }));

      expect(screen.getByTestId('scanning').textContent).toBe('true');
      const [input, init] = fetchMock.mock.calls[0];
      expect(input).toBe('/api/library-folders/scan');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({
        enrich: true,
        mode: 'copy',
        scope,
      });
    }
  );

  it('pushes /import once the scan has started', async () => {
    fetchMock.mockResolvedValue(
      createdResponse(makeImportRun({ source: 'folders' }))
    );
    renderAtFolders();

    fireEvent.click(screen.getByRole('button', { name: 'Scan all folders' }));

    await waitFor(() => expect(pathname()).toBe('/import'));
    expect(navigationType()).toBe('PUSH');
  });

  it('pushes /import on a 409, to the run already in flight', async () => {
    fetchMock.mockResolvedValue(
      conflictResponse('An import is already running.')
    );
    renderAtFolders();

    fireEvent.click(screen.getByRole('button', { name: 'Scan all folders' }));

    await waitFor(() => expect(pathname()).toBe('/import'));
    expect(navigationType()).toBe('PUSH');
  });

  it('stays and lets go of the press on any other failure', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());
    renderAtFolders();

    fireEvent.click(screen.getByRole('button', { name: 'Scan all folders' }));

    await waitFor(() =>
      expect(screen.getByTestId('scanning').textContent).toBe('false')
    );
    expect(pathname()).toBe('/settings/folders');
  });
});
