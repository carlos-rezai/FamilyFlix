import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LibraryFolders } from './LibraryFolders';
import type { LibraryFolder } from '@/types';
import { theme } from '@/styles/theme';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';

/**
 * 30 — Library folders, Phase 5: "the native picker" (issue #272).
 *
 * In the desktop app, _Browse…_ sits beside _Add_ in the add row and opens
 * the system folder dialog. It is drawn only when the folder bridge exists —
 * a plain browser has none. Each picked folder is posted in order, as if it
 * had been typed, and each is checked and refused on its own. A cancelled
 * pick posts nothing and shows nothing.
 *
 * The wire is a stubbed `fetch` that keeps a list the way the routes do; the
 * dialog is `fakeFolderBridge`.
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

const INSIDE =
  'That folder is inside E:\\Movies, which is already a library folder.';

/** A refusal the route words: `{ error }` under its status. */
function refusedResponse(status: number, error: string): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  } as unknown as Response;
}

/**
 * A `fetch` over a list the way the routes keep it: GET answers it, a POST
 * of a path under a listed one is refused with its sentence and any other
 * is added with no titles.
 */
function libraryWire(initial: LibraryFolder[]) {
  let listed = [...initial];
  let next = 0;
  fetchMock.mockImplementation((_input, init) => {
    const method = init?.method ?? 'GET';
    if (method === 'POST') {
      const { path } = JSON.parse(String(init?.body)) as { path: string };
      const parent = listed.find((folder) =>
        path.toLowerCase().startsWith(`${folder.path.toLowerCase()}\\`)
      );
      if (parent) {
        return Promise.resolve(
          refusedResponse(
            409,
            `That folder is inside ${parent.path}, which is already a library folder.`
          )
        );
      }
      next += 1;
      const added: LibraryFolder = {
        id: `f-new-${next}`,
        path,
        titleCount: 0,
        reachable: true,
      };
      listed = [...listed, added];
      return Promise.resolve(createdResponse(added));
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

/** Wait for the list to have loaded: the add row is drawn. */
const loaded = () =>
  waitFor(() => expect(screen.queryByRole('textbox')).not.toBeNull());

const browseButton = () => screen.getByRole('button', { name: 'Browse…' });

/** The paths posted to the add route, in the order they were sent. */
function postedPaths(): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .map(
      ([, init]) => (JSON.parse(String(init?.body)) as { path: string }).path
    );
}

describe('LibraryFolders — Browse… in a browser', () => {
  it('draws no Browse… without the folder bridge', async () => {
    libraryWire([]);
    renderPage();
    await loaded();

    expect(window.familyflix).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Browse…' })).toBeNull();
  });
});

describe('LibraryFolders — Browse… under the Desktop shell', () => {
  const bridge = fakeFolderBridge();

  it('draws Browse… beside Add', async () => {
    libraryWire([]);
    renderPage();
    await loaded();

    expect(browseButton()).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDefined();
  });

  it('opens the dialog on a press', async () => {
    libraryWire([]);
    renderPage();
    await loaded();

    await userEvent.click(browseButton());

    await waitFor(() => expect(bridge.picks()).toBe(1));
  });

  it('posts each picked path in order, and draws a row for each', async () => {
    libraryWire([]);
    bridge.setPick(['E:\\Movies', 'D:\\Kids', 'F:\\Films']);
    renderPage();
    await loaded();

    await userEvent.click(browseButton());

    await waitFor(() => expect(screen.getByText('F:\\Films')).toBeDefined());
    expect(screen.getByText('E:\\Movies')).toBeDefined();
    expect(screen.getByText('D:\\Kids')).toBeDefined();
    expect(postedPaths()).toEqual(['E:\\Movies', 'D:\\Kids', 'F:\\Films']);
    expect(screen.queryByText('No folders yet.')).toBeNull();
  });

  it('still lands the picks after a refused one', async () => {
    libraryWire([MOVIES]);
    bridge.setPick(['D:\\Kids', 'E:\\Movies\\Kids', 'F:\\Films']);
    renderPage();
    await loaded();

    await userEvent.click(browseButton());

    await waitFor(() => expect(screen.getByText('F:\\Films')).toBeDefined());
    expect(screen.getByText('D:\\Kids')).toBeDefined();
    expect(screen.queryByText('E:\\Movies\\Kids')).toBeNull();
    expect(postedPaths()).toEqual([
      'D:\\Kids',
      'E:\\Movies\\Kids',
      'F:\\Films',
    ]);
  });

  it('shows a refused pick’s sentence, with the other picks landed', async () => {
    libraryWire([MOVIES]);
    bridge.setPick(['D:\\Kids', 'E:\\Movies\\Kids']);
    renderPage();
    await loaded();

    await userEvent.click(browseButton());

    expect(await screen.findByText(INSIDE)).toBeDefined();
    expect(screen.getByText('D:\\Kids')).toBeDefined();
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(2);
  });

  it('posts nothing and shows nothing for a cancelled pick', async () => {
    libraryWire([MOVIES]);
    bridge.setPick([]);
    renderPage();
    await loaded();

    await userEvent.click(browseButton());

    await waitFor(() => expect(bridge.picks()).toBe(1));
    expect(postedPaths()).toEqual([]);
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(1);
    expect(screen.queryByText(INSIDE)).toBeNull();
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  });
});
