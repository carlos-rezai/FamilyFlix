import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LibraryFolders } from './LibraryFolders';
import type { LibraryFolderView } from '@/types';
import { theme } from '@/styles/theme';
import {
  noContentResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 51, Library audit, Phase 12: "Bring back on Library folders" (issue #455).
 *
 * On the **Library folders page**, a folder with **Left-out videos** reads
 * _N videos left out_ with _Bring back_. A press is **Bring back**:
 * `DELETE /api/library-folders/:id/left-out`, and once it lands the line
 * goes; the row and every other folder's line stay.
 *
 * The wire is a stubbed `fetch` that keeps the list the way the routes do.
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

const MOVIES: LibraryFolderView = {
  id: 'f-movies',
  path: 'E:\\Movies',
  titleCount: 12,
  reachable: true,
  leftOut: 3,
};

const KIDS: LibraryFolderView = {
  id: 'f-kids',
  path: 'D:\\Kids',
  titleCount: 3,
  reachable: true,
  leftOut: 1,
};

/** GET answers the list; a DELETE of `…/left-out` zeroes that folder. */
function libraryWire(initial: LibraryFolderView[]) {
  let listed = [...initial];
  fetchMock.mockImplementation((input, init) => {
    const method = init?.method ?? 'GET';
    const url = String(input);
    if (method === 'DELETE' && url.endsWith('/left-out')) {
      const id = decodeURIComponent(url.split('/').at(-2) ?? '');
      listed = listed.map((folder) =>
        folder.id === id ? { ...folder, leftOut: 0 } : folder
      );
      return Promise.resolve(noContentResponse());
    }
    return Promise.resolve(okResponse(listed));
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/settings/folders']}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/settings/folders" element={<LibraryFolders />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const loaded = () =>
  waitFor(() => expect(screen.queryByText('E:\\Movies')).not.toBeNull());

describe('LibraryFolders: Bring back', () => {
  it('draws each folder’s left-out line from the list', async () => {
    libraryWire([MOVIES, KIDS]);
    renderPage();
    await loaded();

    expect(screen.getByText('3 videos left out')).toBeDefined();
    expect(screen.getByText('1 video left out')).toBeDefined();
  });

  it('calls Bring back for the folder whose button was pressed', async () => {
    libraryWire([MOVIES, KIDS]);
    renderPage();
    await loaded();

    const [first] = screen.getAllByRole('button', { name: 'Bring back' });
    await userEvent.click(first);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/library-folders/f-movies/left-out',
        expect.objectContaining({ method: 'DELETE' })
      )
    );
  });

  it('takes the line away once it lands, keeping the row and the other line', async () => {
    libraryWire([MOVIES, KIDS]);
    renderPage();
    await loaded();

    const [first] = screen.getAllByRole('button', { name: 'Bring back' });
    await userEvent.click(first);

    await waitFor(() =>
      expect(screen.queryByText('3 videos left out')).toBeNull()
    );
    expect(screen.getByText('E:\\Movies')).toBeDefined();
    expect(screen.getByText('1 video left out')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Bring back' })).toHaveLength(
      1
    );
  });
});
