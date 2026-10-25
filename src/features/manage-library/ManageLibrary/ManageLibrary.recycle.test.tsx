import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ManageLibrary } from './ManageLibrary';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import type { LibraryTitles } from '@/types';
import { theme } from '@/styles/theme';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import {
  noContentResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import {
  makeLibraryMovie,
  makeLibrarySeries,
} from '@/test-support/makeLibraryTitle/makeLibraryTitle';

/**
 * 51 — Library audit, Phase 9: "the Recycle choice in the Delete dialog"
 * (issue #452, log 51 Q6), on Manage library.
 *
 * The delete a linked title's dialog sends carries `?files=trash` only when
 * **Move them to the Recycle Bin** was chosen; **Keep the files** sends the
 * plain `DELETE`, which keeps them (#451). **Keep the files** is chosen on
 * every open, even after a Recycle Bin pick last time. A browser draws no
 * cards and sends the plain `DELETE`.
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

const LINKED: LibraryTitles = {
  movies: [
    makeLibraryMovie({
      id: 'm1',
      title: 'Coco',
      linkedFiles: 'folder',
      path: 'E:\\Movies\\Coco (2017)',
    }),
  ],
  series: [
    makeLibrarySeries({
      id: 's1',
      title: 'Bluey',
      linkedFiles: 'folder',
      path: 'E:\\Series\\Bluey',
    }),
  ],
};

/** The list read answered with LINKED, every write with a `204`. */
function serve() {
  fetchMock.mockImplementation((input) =>
    String(input) === '/api/library-titles'
      ? Promise.resolve(okResponse(LINKED))
      : Promise.resolve(noContentResponse())
  );
}

const writes = () =>
  fetchMock.mock.calls.filter(
    ([input]) => String(input) !== '/api/library-titles'
  );

function renderPage(path = '/settings/library') {
  return render(
    <MemoryRouter initialEntries={['/settings', path]} initialIndex={1}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Routes>
            <Route path="/settings" element={<p>the settings hub</p>} />
            <Route path="/settings/library" element={<ManageLibrary />} />
          </Routes>
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const loaded = () =>
  waitFor(() =>
    expect(screen.queryByRole('button', { name: /^Movies/ })).not.toBeNull()
  );

const deleteDialog = (title: string) =>
  screen.getByRole('dialog', { name: `Delete “${title}”?` });

function openDeleteOn(title: string) {
  const more = screen.getByRole('button', {
    name: `More actions for “${title}”`,
  });
  more.focus();
  fireEvent.click(more);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }));
}

const card = (title: string, label: RegExp) =>
  within(deleteDialog(title)).getByRole('radio', { name: label });
const KEEP = /^Keep the files/;
const TRASH = /^Move them to the Recycle Bin/;

function confirmDelete(title: string) {
  fireEvent.click(
    within(deleteDialog(title)).getByRole('button', {
      name: /^Delete (movie|series)$/,
    })
  );
}

describe('ManageLibrary — the Recycle choice, in the shell', () => {
  fakeFolderBridge();

  it('sends the plain delete on Keep the files', async () => {
    serve();
    renderPage();
    await loaded();
    openDeleteOn('Coco');
    expect(card('Coco', KEEP).getAttribute('aria-checked')).toBe('true');

    confirmDelete('Coco');

    await waitFor(() => expect(writes()).toHaveLength(1));
    const [input, init] = writes()[0];
    expect(String(input)).toBe('/api/movies/m1');
    expect(init?.method?.toUpperCase()).toBe('DELETE');
  });

  it('sends files=trash on the Recycle Bin card', async () => {
    serve();
    renderPage();
    await loaded();
    openDeleteOn('Coco');

    fireEvent.click(card('Coco', TRASH));
    confirmDelete('Coco');

    await waitFor(() => expect(writes()).toHaveLength(1));
    const [input, init] = writes()[0];
    expect(String(input)).toBe('/api/movies/m1?files=trash');
    expect(init?.method?.toUpperCase()).toBe('DELETE');
  });

  it('sends a show’s files=trash on the series tab', async () => {
    serve();
    renderPage('/settings/library?tab=series');
    await loaded();
    openDeleteOn('Bluey');

    fireEvent.click(card('Bluey', TRASH));
    confirmDelete('Bluey');

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(String(writes()[0][0])).toBe('/api/series/s1?files=trash');
  });

  it('chooses Keep the files on every open, even after a Recycle Bin pick', async () => {
    serve();
    renderPage();
    await loaded();
    openDeleteOn('Coco');
    fireEvent.click(card('Coco', TRASH));
    fireEvent.click(
      within(deleteDialog('Coco')).getByRole('button', { name: 'Cancel' })
    );

    openDeleteOn('Coco');

    expect(card('Coco', KEEP).getAttribute('aria-checked')).toBe('true');
    expect(card('Coco', TRASH).getAttribute('aria-checked')).toBe('false');
  });
});

describe('ManageLibrary — the Recycle choice, in a browser', () => {
  it('draws no cards, keeps the files and sends the plain delete for a linked title', async () => {
    serve();
    renderPage();
    await loaded();
    openDeleteOn('Coco');

    expect(within(deleteDialog('Coco')).queryAllByRole('radio')).toEqual([]);
    expect(
      within(deleteDialog('Coco')).getByText(
        'Its folder, in your library folder'
      )
    ).toBeDefined();
    confirmDelete('Coco');

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(String(writes()[0][0])).toBe('/api/movies/m1');
  });
});
