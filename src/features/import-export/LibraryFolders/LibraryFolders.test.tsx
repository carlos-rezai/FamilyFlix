import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  noContentResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 30 — Library folders, Phase 1: "a remembered list, end to end" (issue #268).
 *
 * The **Library folders page**'s organism, on the Settings furniture under
 * the maintainer header: Back, **Library folders** and the lede; then the
 * group **Folders** — one **Folder row** per listed folder, a divider, and
 * the add row, a mono `TextField` with the folder glyph and _Add_. A refusal
 * is a 13px `danger` line under the field, and the typed path stays in it.
 * With no folders, _No folders yet._ Nothing under the header is drawn until
 * the list has loaded. Back is the **Back rule** with `/settings` as its
 * **Landing**.
 *
 * The wire is a stubbed `fetch` that keeps a list the way the routes do.
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

const DANGER = 'rgb(201, 122, 106)';

const MOVIES: LibraryFolder = {
  id: 'f-movies',
  path: 'E:\\Movies',
  titleCount: 12,
  reachable: true,
};

const KIDS: LibraryFolder = {
  id: 'f-kids',
  path: 'D:\\Kids',
  titleCount: 3,
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
 * is added with no titles, a DELETE takes the folder off.
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
    if (method === 'DELETE') {
      const id = decodeURIComponent(String(_input).split('/').pop() ?? '');
      listed = listed.filter((folder) => folder.id !== id);
      return Promise.resolve(noContentResponse());
    }
    return Promise.resolve(okResponse(listed));
  });
}

/** Opened from Settings by default: the history the Settings row leaves. */
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
        </Routes>
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const field = () => screen.getByRole('textbox') as HTMLInputElement;
const addButton = () => screen.getByRole('button', { name: 'Add' });

/** Wait for the list to have loaded: the add row is drawn. */
const loaded = () =>
  waitFor(() => expect(screen.queryByRole('textbox')).not.toBeNull());

describe('LibraryFolders — the header', () => {
  it('draws Back and the heading Library folders', async () => {
    libraryWire([MOVIES]);
    renderPage();
    await loaded();

    expect(screen.getByRole('button', { name: 'Back' })).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Library folders' })
    ).toBeDefined();
  });

  it('draws nothing under the header until the list has loaded', () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Library folders' })
    ).toBeDefined();
    expect(screen.queryByText('Folders')).toBeNull();
    expect(screen.queryByText('No folders yet.')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
  });
});

describe('LibraryFolders — the list', () => {
  it('shows No folders yet. when none is listed', async () => {
    libraryWire([]);
    renderPage();
    await loaded();

    expect(screen.getByText('No folders yet.')).toBeDefined();
  });

  it('draws one row per listed folder, and no empty line', async () => {
    libraryWire([MOVIES, KIDS]);
    renderPage();
    await loaded();

    expect(screen.getByText('Folders')).toBeDefined();
    expect(screen.getByText('E:\\Movies')).toBeDefined();
    expect(screen.getByText('12 titles')).toBeDefined();
    expect(screen.getByText('D:\\Kids')).toBeDefined();
    expect(screen.getByText('3 titles')).toBeDefined();
    expect(screen.queryByText('No folders yet.')).toBeNull();
  });

  it('draws the add field in mono', async () => {
    libraryWire([]);
    renderPage();
    await loaded();

    expect(getComputedStyle(field()).fontFamily).toContain('JetBrains Mono');
  });
});

describe('LibraryFolders — a typed add', () => {
  it('posts the typed path and draws its row', async () => {
    libraryWire([]);
    renderPage();
    await loaded();

    await userEvent.type(field(), 'E:\\Movies');
    await userEvent.click(addButton());

    await waitFor(() => expect(screen.getByText('E:\\Movies')).toBeDefined());
    expect(screen.getByText('0 titles')).toBeDefined();
    expect(screen.queryByText('No folders yet.')).toBeNull();
    const posts = fetchMock.mock.calls.filter(
      ([, init]) => init?.method === 'POST'
    );
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0]?.[1]?.body))).toEqual({
      path: 'E:\\Movies',
    });
  });

  it('shows a refusal under the field, in 13px danger, and keeps the typed path', async () => {
    libraryWire([MOVIES]);
    renderPage();
    await loaded();

    await userEvent.type(field(), 'E:\\Movies\\Kids');
    await userEvent.click(addButton());

    const line = await screen.findByText(INSIDE);
    const drawn = getComputedStyle(line);
    expect(drawn.color).toBe(DANGER);
    expect(drawn.fontSize).toBe('13px');
    expect(field().value).toBe('E:\\Movies\\Kids');
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(1);
  });

  it('lets the refusal go once an add lands', async () => {
    libraryWire([MOVIES]);
    renderPage();
    await loaded();
    await userEvent.type(field(), 'E:\\Movies\\Kids');
    await userEvent.click(addButton());
    await screen.findByText(INSIDE);

    await userEvent.clear(field());
    await userEvent.type(field(), 'D:\\Kids');
    await userEvent.click(addButton());

    await waitFor(() => expect(screen.getByText('D:\\Kids')).toBeDefined());
    expect(screen.queryByText(INSIDE)).toBeNull();
  });
});

describe('LibraryFolders — remove', () => {
  it('drops the row its ✕ belongs to', async () => {
    libraryWire([MOVIES, KIDS]);
    renderPage();
    await loaded();

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove E:\\Movies' })
    );

    await waitFor(() => expect(screen.queryByText('E:\\Movies')).toBeNull());
    expect(screen.getByText('D:\\Kids')).toBeDefined();
  });

  it('shows No folders yet. once the last is removed', async () => {
    libraryWire([MOVIES]);
    renderPage();
    await loaded();

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove E:\\Movies' })
    );

    await waitFor(() =>
      expect(screen.getByText('No folders yet.')).toBeDefined()
    );
  });
});

describe('LibraryFolders — Back', () => {
  it('steps back onto Settings when there is an entry behind the page', async () => {
    libraryWire([]);
    renderPage();
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/settings');
    expect(navigationType()).toBe('POP');
  });

  it('lands on /settings when there is nothing behind the page', async () => {
    libraryWire([]);
    renderPage(['/settings/folders']);
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/settings');
    expect(navigationType()).toBe('PUSH');
    expect(screen.getByText('the settings hub')).toBeDefined();
  });
});
