import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LibraryFolders } from './LibraryFolders';
import type { LibraryFolderView, TidyPlan } from '@/types';
import { theme } from '@/styles/theme';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { makeLibraryFolder } from '@/test-support/makeLibraryFolder/makeLibraryFolder';

/**
 * 57 — Tidy into folders, Phase 6: "the Folder row reads the plan" (issue #529).
 *
 * On the **Library folders page**, a folder with **Loose videos** reads
 * _N loose videos_ with **Tidy**; a press opens the **Tidy dialog** over
 * that folder, which reads its **Tidy plan**.
 *
 * The wire is a stubbed `fetch`: the list, and each folder's plan.
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
  ...makeLibraryFolder({ id: 'f-movies', path: 'E:\\Movies', titleCount: 12 }),
  leftOut: 0,
  loose: 1,
};

const KIDS: LibraryFolderView = {
  ...makeLibraryFolder({ id: 'f-kids', path: 'D:\\Kids', titleCount: 3 }),
  leftOut: 0,
  loose: 0,
};

const PLAN: TidyPlan = {
  path: 'E:\\Movies',
  tidies: [
    {
      id: 'apex.2026.1080p.mp4',
      kind: 'film',
      folder: 'Apex (2026)',
      videos: ['Apex.2026.1080p.mp4'],
      companions: [],
    },
  ],
  kept: [],
};

function libraryWire() {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.endsWith('/loose')) {
      return Promise.resolve(okResponse(PLAN));
    }
    return Promise.resolve(okResponse([MOVIES, KIDS]));
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/settings/folders']}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Routes>
            <Route path="/settings/folders" element={<LibraryFolders />} />
          </Routes>
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const loaded = () =>
  waitFor(() => expect(screen.queryByText('E:\\Movies')).not.toBeNull());

describe('LibraryFolders: Tidy', () => {
  it('draws the loose line only on the folder with some', async () => {
    libraryWire();
    renderPage();
    await loaded();

    expect(screen.getByText('1 loose video')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Tidy' })).toHaveLength(1);
  });

  it('opens the Tidy dialog over that folder, reading its plan', async () => {
    libraryWire();
    renderPage();
    await loaded();

    await userEvent.click(screen.getByRole('button', { name: 'Tidy' }));

    expect(await screen.findByText('Tidy into folders')).toBeDefined();
    expect(await screen.findByText('→ Apex (2026)\\')).toBeDefined();
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      '/api/library-folders/f-movies/loose'
    );
  });
});
