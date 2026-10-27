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
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import {
  LocationProbe,
  navigationType,
  pathname,
  search,
  url,
} from '@/test-support/LocationProbe/LocationProbe';
import { enrichPath } from '@/utils/enrichPath/enrichPath';
import { movieFormPath } from '@/utils/movieFormPath/movieFormPath';
import { moviePath } from '@/utils/moviePath/moviePath';
import { seriesPath } from '@/utils/seriesPath/seriesPath';
import {
  noContentResponse,
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import {
  makeLibraryMovie,
  makeLibrarySeries,
} from '@/test-support/makeLibraryTitle/makeLibraryTitle';

/**
 * 47 — Manage library, Phase 1: "the list, read-only" (issue #407).
 *
 * The **Manage library page**'s organism at `/settings/library`: the
 * maintainer header — Back through `useGoBack('/settings')`, _Manage
 * library_ and its lede — then, once the read lands, the toolbar — the
 * _Movies N_ / _Series N_ `PillTabs`, `tab` written as a replace and omitted
 * at movies, and the summary, _6 movies · 1 without details_, the second part
 * only when there is one — over one **Title row** per title of the tab, in
 * the order the route sent (A–Z). An empty tab is the card _No movies in your
 * library._ / _No series in your library._ **Blank until it lands**: nothing
 * under the header while the read is `null`, or failed.
 *
 * The wire is a stubbed `fetch` answering `GET /api/library-titles`.
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

const LIBRARY: LibraryTitles = {
  movies: [
    makeLibraryMovie({ id: 'm1', title: 'Coco', details: 'synced' }),
    makeLibraryMovie({ id: 'm2', title: 'Heat', details: 'none' }),
    makeLibraryMovie({ id: 'm3', title: 'Up', details: 'own' }),
  ],
  series: [
    makeLibrarySeries({ id: 's1', title: 'Bluey', details: 'synced' }),
    makeLibrarySeries({ id: 's2', title: 'Wanderers', details: 'synced' }),
  ],
};

/** Answer the list read with `titles`. */
function serve(titles: LibraryTitles = LIBRARY) {
  fetchMock.mockImplementation(() => Promise.resolve(okResponse(titles)));
}

/** Opened from Settings by default: the history the Settings row leaves. */
function renderPage(
  history: string[] = ['/', '/settings', '/settings/library']
) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Routes>
            <Route path="/" element={<p>the browse home</p>} />
            <Route path="/settings" element={<p>the settings hub</p>} />
            <Route path="/settings/library" element={<ManageLibrary />} />
          </Routes>
          <LocationProbe />
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const tab = (name: RegExp) => screen.getByRole('button', { name });

/** Wait for the read to have landed: the tabs are drawn. */
const loaded = () =>
  waitFor(() =>
    expect(screen.queryByRole('button', { name: /^Movies/ })).not.toBeNull()
  );

describe('ManageLibrary — the header', () => {
  it('draws Back, the heading Manage library and the lede', async () => {
    serve();
    renderPage();
    await loaded();

    expect(screen.getByRole('button', { name: 'Back' })).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Manage library' })
    ).toBeDefined();
    expect(
      screen.getByText(
        'Every title in your library, and where its files are. Edit its details, clear them, or delete it for good.'
      )
    ).toBeDefined();
  });
});

describe('ManageLibrary — Back', () => {
  it('steps back when there is an entry behind the page', async () => {
    serve();
    renderPage();
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/settings');
    expect(navigationType()).toBe('POP');
  });

  it('lands on /settings when there is nothing behind the page', async () => {
    serve();
    renderPage(['/settings/library']);
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/settings');
    expect(navigationType()).toBe('PUSH');
    expect(screen.getByText('the settings hub')).toBeDefined();
  });
});

describe('ManageLibrary — blank until it lands', () => {
  it('draws nothing under the header while the read is pending', () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Manage library' })
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Movies/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Series/ })).toBeNull();
    expect(screen.queryByText(/without details/)).toBeNull();
    expect(screen.queryByText('No movies in your library.')).toBeNull();
  });

  it('draws nothing under the header when the read fails', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(serverErrorResponse()));
    renderPage();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: /^Movies/ })).toBeNull();
    expect(screen.queryByText('No movies in your library.')).toBeNull();
    expect(screen.queryByText(/^\d+ movies?/)).toBeNull();
  });
});

describe('ManageLibrary — the tabs', () => {
  it('labels each tab with its count', async () => {
    serve();
    renderPage();
    await loaded();

    expect(tab(/^Movies 3$/)).toBeDefined();
    expect(tab(/^Series 2$/)).toBeDefined();
  });

  it('opens on Movies with no tab in the URL', async () => {
    serve();
    renderPage();
    await loaded();

    expect(tab(/^Movies/).getAttribute('aria-pressed')).toBe('true');
    expect(tab(/^Series/).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Coco')).toBeDefined();
    expect(screen.queryByText('Bluey')).toBeNull();
  });

  it('opens on Series at ?tab=series', async () => {
    serve();
    renderPage(['/settings', '/settings/library?tab=series']);
    await loaded();

    expect(tab(/^Series/).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Bluey')).toBeDefined();
    expect(screen.queryByText('Coco')).toBeNull();
  });

  it('writes tab=series as a replace', async () => {
    serve();
    renderPage();
    await loaded();

    fireEvent.click(tab(/^Series/));

    expect(pathname()).toBe('/settings/library');
    expect(search()).toBe('?tab=series');
    expect(navigationType()).toBe('REPLACE');
    expect(screen.getByText('Wanderers')).toBeDefined();
  });

  it('omits tab at movies, again as a replace', async () => {
    serve();
    renderPage(['/settings', '/settings/library?tab=series']);
    await loaded();

    fireEvent.click(tab(/^Movies/));

    expect(pathname()).toBe('/settings/library');
    expect(search()).toBe('');
    expect(navigationType()).toBe('REPLACE');
    expect(screen.getByText('Heat')).toBeDefined();
  });

  it('leaves Back stepping onto Settings after a switch of tab', async () => {
    serve();
    renderPage();
    await loaded();

    fireEvent.click(tab(/^Series/));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/settings');
  });
});

describe('ManageLibrary — the summary', () => {
  it('counts the tab’s titles and those without details', async () => {
    serve();
    renderPage();
    await loaded();

    expect(screen.getByText('3 movies · 1 without details')).toBeDefined();
  });

  it('leaves out without details at zero', async () => {
    serve();
    renderPage(['/settings', '/settings/library?tab=series']);
    await loaded();

    expect(screen.getByText('2 series')).toBeDefined();
    expect(screen.queryByText(/without details/)).toBeNull();
  });

  it('counts one movie in the singular', async () => {
    serve({
      movies: [makeLibraryMovie({ id: 'm1', title: 'Coco', details: 'own' })],
      series: [],
    });
    renderPage();
    await loaded();

    expect(screen.getByText('1 movie')).toBeDefined();
  });

  it('follows the tab it is drawn beside', async () => {
    serve({
      movies: LIBRARY.movies,
      series: [
        makeLibrarySeries({ id: 's1', title: 'Bluey', details: 'none' }),
        makeLibrarySeries({ id: 's2', title: 'Wanderers', details: 'none' }),
      ],
    });
    renderPage();
    await loaded();

    fireEvent.click(tab(/^Series/));

    expect(screen.getByText('2 series · 2 without details')).toBeDefined();
  });
});

describe('ManageLibrary — the list', () => {
  it('draws one Title row per title, in the order the route sent', async () => {
    serve();
    renderPage();
    await loaded();

    const coco = screen.getByText('Coco');
    const heat = screen.getByText('Heat');
    const up = screen.getByText('Up');
    expect(comesBefore(coco, heat)).toBe(true);
    expect(comesBefore(heat, up)).toBe(true);
  });

  it('draws each row’s Details state', async () => {
    serve();
    renderPage();
    await loaded();

    expect(screen.getByText('Synced with TMDB')).toBeDefined();
    expect(screen.getByText('No details')).toBeDefined();
    expect(screen.getByText('Your own details')).toBeDefined();
  });

  it('draws the empty card on a tab with no movies', async () => {
    serve({ movies: [], series: LIBRARY.series });
    renderPage();
    await loaded();

    expect(tab(/^Movies 0$/)).toBeDefined();
    expect(screen.getByText('No movies in your library.')).toBeDefined();
  });

  it('draws the empty card on a tab with no series', async () => {
    serve({ movies: LIBRARY.movies, series: [] });
    renderPage(['/settings', '/settings/library?tab=series']);
    await loaded();

    expect(screen.getByText('No series in your library.')).toBeDefined();
    expect(screen.queryByText('Coco')).toBeNull();
  });

  it('draws no empty card on a tab with titles', async () => {
    serve();
    renderPage();
    await loaded();

    expect(screen.queryByText('No movies in your library.')).toBeNull();
    expect(screen.queryByText('No series in your library.')).toBeNull();
  });
});

/**
 * 47 — Manage library, Phase 2: "Edit details and Sync with TMDB" (issue
 * #408).
 *
 * A Title row's _Edit ▾_ menu, seen from the page, under a router whose other
 * screens are stand-ins and a probe with its own Back:
 *
 * - _Edit details_ pushes the **Movie form**'s edit — `movieFormPath({ movie
 *   })` for a film, `movieFormPath({ series })` for a show — so the form's
 *   Back, and its save (both `useGoBack` over a **History step**), return to
 *   the overview.
 * - _Sync with TMDB_ pushes the title's page, then `enrichPath({ movie |
 *   series: id, start: true })`: log 45's leaving with a push where the add
 *   replaces, so Back from the flow lands on the title and Back again on the
 *   overview. The flow is **Started on arrival** under its own rules (no key,
 *   offline, a busy Sync, a Waiting run) — `EnrichmentFlow`'s suite holds
 *   those over this very URL, so nothing here re-runs them.
 */

function renderWithScreens(
  history: string[] = ['/', '/settings', '/settings/library']
) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Routes>
            <Route path="/settings" element={<p>the settings hub</p>} />
            <Route path="/settings/library" element={<ManageLibrary />} />
            <Route path="/add" element={<p>the movie form</p>} />
            <Route path="/movie/:id" element={<p>the movie page</p>} />
            <Route path="/series/:id" element={<p>the series page</p>} />
            <Route path="/enrich" element={<p>the enrichment flow</p>} />
          </Routes>
          <LocationProbe withBack />
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

/** The probe's own Back, once the page (and its header's Back) is gone. */
const probeBack = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));

/** Open the Edit ▾ menu on the `index`th row of the tab, in drawn order. */
function openEditOn(index: number) {
  const control = screen.getAllByRole('button', { name: 'Edit' })[index];
  control.focus();
  fireEvent.click(control);
}

const choose = (name: string) =>
  fireEvent.click(screen.getByRole('menuitem', { name }));

describe('ManageLibrary — Edit details', () => {
  it('draws one Edit ▾ per row', async () => {
    serve();
    renderWithScreens();
    await loaded();

    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(3);
  });

  it('pushes the Movie form’s edit for a film', async () => {
    serve();
    renderWithScreens();
    await loaded();

    openEditOn(1);
    choose('Edit details');

    expect(url()).toBe(movieFormPath({ movie: 'm2' }));
    expect(url()).toBe('/add?movie=m2');
    expect(navigationType()).toBe('PUSH');
    expect(screen.getByText('the movie form')).toBeDefined();
  });

  it('pushes the Movie form’s series edit for a show', async () => {
    serve();
    renderWithScreens(['/settings', '/settings/library?tab=series']);
    await loaded();

    openEditOn(0);
    choose('Edit details');

    expect(url()).toBe(movieFormPath({ series: 's1' }));
    expect(url()).toBe('/add?series=s1');
    expect(navigationType()).toBe('PUSH');
  });

  it('returns to the overview on a step back from the form', async () => {
    serve();
    renderWithScreens();
    await loaded();

    openEditOn(0);
    choose('Edit details');
    probeBack();

    expect(url()).toBe('/settings/library');
    expect(navigationType()).toBe('POP');
    await loaded();
  });

  it('returns to the series tab on a step back from a series edit', async () => {
    serve();
    renderWithScreens(['/settings', '/settings/library?tab=series']);
    await loaded();

    openEditOn(1);
    choose('Edit details');
    probeBack();

    expect(url()).toBe('/settings/library?tab=series');
    await loaded();
    expect(screen.getByText('Wanderers')).toBeDefined();
  });
});

describe('ManageLibrary — Sync with TMDB', () => {
  it('pushes the film’s page, then the flow started on arrival', async () => {
    serve();
    renderWithScreens();
    await loaded();

    openEditOn(0);
    choose('Sync with TMDB');

    expect(url()).toBe(enrichPath({ movie: 'm1', start: true }));
    expect(url()).toBe('/enrich?movie=m1&start=1');
    expect(navigationType()).toBe('PUSH');
    expect(screen.getByText('the enrichment flow')).toBeDefined();
  });

  it('pushes the show’s page, then the flow started on arrival', async () => {
    serve();
    renderWithScreens(['/settings', '/settings/library?tab=series']);
    await loaded();

    openEditOn(1);
    choose('Sync with TMDB');

    expect(url()).toBe(enrichPath({ series: 's2', start: true }));
    expect(url()).toBe('/enrich?series=s2&start=1');
    expect(navigationType()).toBe('PUSH');
  });

  it('leaves the film’s page behind the flow, and the overview behind it', async () => {
    serve();
    renderWithScreens();
    await loaded();

    openEditOn(2);
    choose('Sync with TMDB');

    probeBack();
    expect(url()).toBe(moviePath('m3'));
    expect(navigationType()).toBe('POP');
    expect(screen.getByText('the movie page')).toBeDefined();

    probeBack();
    expect(url()).toBe('/settings/library');
    await loaded();
  });

  it('leaves the show’s page behind the flow, and the overview behind it', async () => {
    serve();
    renderWithScreens(['/settings', '/settings/library?tab=series']);
    await loaded();

    openEditOn(0);
    choose('Sync with TMDB');

    probeBack();
    expect(url()).toBe(seriesPath('s1'));
    expect(screen.getByText('the series page')).toBeDefined();

    probeBack();
    expect(url()).toBe('/settings/library?tab=series');
    await loaded();
  });
});

/**
 * 47 — Manage library, Phase 3: "Clear details" (issue #409).
 *
 * A row's ⋯ → _Clear details_ opens the **Clear dialog** over that title;
 * _Clear details_ in it posts the clear for the title's kind, reads
 * _Clearing…_ while it runs, and on the `200` closes, redraws the row from
 * the echo — its dot _No details_ — and shows the `success` notice _Details
 * cleared for “Coco”._ through `useSnackbar()`. Cancel sends nothing. A
 * refused clear leaves the row as it was and shows no notice.
 *
 * The wire is a stubbed `fetch`: the list read, then the clear held or
 * answered as each test says.
 */

const CLEARED_COCO = makeLibraryMovie({
  id: 'm1',
  title: 'Coco',
  year: null,
  details: 'none',
});
const CLEARED_BLUEY = makeLibrarySeries({
  id: 's1',
  title: 'Bluey',
  year: null,
  details: 'none',
});

/** A clear answered only when the test says so. */
function heldClear() {
  let settle: (response: Response) => void = () => undefined;
  const pending = new Promise<Response>((resolve) => {
    settle = resolve;
  });
  return { pending, settle: (response: Response) => settle(response) };
}

/** The list read answered with LIBRARY, every write by `answer`. */
function serveWith(answer: () => Promise<Response>) {
  fetchMock.mockImplementation((input) =>
    String(input) === '/api/library-titles'
      ? Promise.resolve(okResponse(LIBRARY))
      : answer()
  );
}

const writes = () =>
  fetchMock.mock.calls.filter(
    ([input]) => String(input) !== '/api/library-titles'
  );

/** The Title row drawing `title`: the nearest ancestor holding its ⋯. */
function rowOf(title: string): HTMLElement {
  const more = screen.getByRole('button', {
    name: `More actions for “${title}”`,
  });
  let node: HTMLElement | null = more.parentElement;
  while (node !== null && !node.textContent?.includes(title)) {
    node = node.parentElement;
  }
  if (node === null) {
    throw new Error(`no row for ${title}`);
  }
  return node;
}

const clearDialog = () =>
  screen.queryByRole('dialog', { name: 'Clear details?' });

function openClearOn(title: string) {
  const more = screen.getByRole('button', {
    name: `More actions for “${title}”`,
  });
  more.focus();
  fireEvent.click(more);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Clear details' }));
}

const confirmClear = () =>
  fireEvent.click(
    within(clearDialog() as HTMLElement).getByRole('button', {
      name: /^Clear/,
    })
  );

describe('ManageLibrary — Clear details', () => {
  it('draws one ⋯ per row', async () => {
    serve();
    renderPage();
    await loaded();

    expect(
      screen.getAllByRole('button', { name: /^More actions for/ })
    ).toHaveLength(3);
  });

  it('opens the Clear dialog over the title, its path in it', async () => {
    serve();
    renderPage();
    await loaded();

    openClearOn('Coco');

    const dialog = clearDialog();
    expect(dialog).not.toBeNull();
    expect(
      within(dialog as HTMLElement).getByText(LIBRARY.movies[0]!.path)
    ).toBeDefined();
  });

  it('sends nothing and closes on Cancel', async () => {
    serve();
    renderPage();
    await loaded();
    openClearOn('Coco');

    fireEvent.click(
      within(clearDialog() as HTMLElement).getByRole('button', {
        name: 'Cancel',
      })
    );

    expect(clearDialog()).toBeNull();
    expect(writes()).toEqual([]);
  });

  it('posts a film’s clear on Clear details', async () => {
    serveWith(() => Promise.resolve(okResponse(CLEARED_COCO)));
    renderPage();
    await loaded();
    openClearOn('Coco');

    confirmClear();

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(String(writes()[0]?.[0])).toBe('/api/movies/m1/clear-details');
    expect(writes()[0]?.[1]?.method).toBe('POST');
  });

  it('posts a show’s clear on the series tab', async () => {
    serveWith(() => Promise.resolve(okResponse(CLEARED_BLUEY)));
    renderPage(['/', '/settings', '/settings/library?tab=series']);
    await loaded();
    openClearOn('Bluey');

    confirmClear();

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(String(writes()[0]?.[0])).toBe('/api/series/s1/clear-details');
  });

  it('reads Clearing… and is inert while the clear runs', async () => {
    const clear = heldClear();
    serveWith(() => clear.pending);
    renderPage();
    await loaded();
    openClearOn('Coco');

    confirmClear();

    const button = await within(clearDialog() as HTMLElement).findByRole(
      'button',
      { name: 'Clearing…' }
    );
    expect((button as HTMLButtonElement).disabled).toBe(true);
    clear.settle(okResponse(CLEARED_COCO));
    await waitFor(() => expect(clearDialog()).toBeNull());
  });

  it('closes, and redraws the row from the echo', async () => {
    serveWith(() => Promise.resolve(okResponse(CLEARED_COCO)));
    renderPage();
    await loaded();
    expect(within(rowOf('Coco')).getByText('Synced with TMDB')).toBeDefined();
    openClearOn('Coco');

    confirmClear();

    await waitFor(() => expect(clearDialog()).toBeNull());
    expect(within(rowOf('Coco')).getByText('No details')).toBeDefined();
    expect(within(rowOf('Coco')).queryByText('Synced with TMDB')).toBeNull();
  });

  it('shows the success notice, naming the title', async () => {
    serveWith(() => Promise.resolve(okResponse(CLEARED_COCO)));
    renderPage();
    await loaded();
    openClearOn('Coco');

    confirmClear();

    expect(
      await screen.findByText('Details cleared for “Coco”.')
    ).toBeDefined();
  });

  it('disables the cleared row’s Clear details after the redraw', async () => {
    serveWith(() => Promise.resolve(okResponse(CLEARED_COCO)));
    renderPage();
    await loaded();
    openClearOn('Coco');
    confirmClear();
    await waitFor(() => expect(clearDialog()).toBeNull());

    fireEvent.click(
      screen.getByRole('button', { name: 'More actions for “Coco”' })
    );

    expect(
      screen
        .getByRole('menuitem', { name: 'Clear details' })
        .getAttribute('aria-disabled')
    ).toBe('true');
  });

  it('leaves the row as it was, and shows no notice, on a refused clear', async () => {
    serveWith(() => Promise.resolve(notFoundResponse()));
    renderPage();
    await loaded();
    openClearOn('Coco');

    confirmClear();

    await waitFor(() => expect(writes()).toHaveLength(1));
    await waitFor(() =>
      expect(
        within(clearDialog() as HTMLElement).getByRole('button', {
          name: 'Clear details',
        })
      ).toBeDefined()
    );
    expect(within(rowOf('Coco')).getByText('Synced with TMDB')).toBeDefined();
    expect(screen.queryByText('Details cleared for “Coco”.')).toBeNull();
  });
});

/**
 * 47 — Manage library, Phase 4: "delete a copied title" (issue #410).
 *
 * A copied row's ⋯ → _Delete…_ opens the **Delete dialog** over that title;
 * its confirm sends the title's delete over the unchanged route, reads
 * _Deleting…_ while it runs, and on the `204` closes, takes the row off the
 * list — the tab's count and the summary following at once, with no re-read
 * — and shows the `success` notice _“Coco” was deleted._ through
 * `useSnackbar()`. Cancel sends nothing; a failed delete leaves the row and
 * shows no notice.
 */

const deleteDialog = (title = 'Coco') =>
  screen.queryByRole('dialog', { name: `Delete “${title}”?` });

function openDeleteOn(title: string) {
  const more = screen.getByRole('button', {
    name: `More actions for “${title}”`,
  });
  more.focus();
  fireEvent.click(more);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }));
}

const confirmDelete = (title = 'Coco') =>
  fireEvent.click(
    within(deleteDialog(title) as HTMLElement).getByRole('button', {
      name: /^Delet/,
    })
  );

const listReads = () =>
  fetchMock.mock.calls.filter(
    ([input]) => String(input) === '/api/library-titles'
  );

describe('ManageLibrary — Delete…', () => {
  it('opens the Delete dialog over the title, its path in it', async () => {
    serve();
    renderPage();
    await loaded();

    openDeleteOn('Coco');

    const dialog = deleteDialog();
    expect(dialog).not.toBeNull();
    expect(
      within(dialog as HTMLElement).getByText(LIBRARY.movies[0]!.path)
    ).toBeDefined();
  });

  it('sends nothing and closes on Cancel', async () => {
    serve();
    renderPage();
    await loaded();
    openDeleteOn('Coco');

    fireEvent.click(
      within(deleteDialog() as HTMLElement).getByRole('button', {
        name: 'Cancel',
      })
    );

    expect(deleteDialog()).toBeNull();
    expect(writes()).toEqual([]);
  });

  it('sends a film’s delete over its unchanged route, asking nothing new', async () => {
    serveWith(() => Promise.resolve(noContentResponse()));
    renderPage();
    await loaded();
    openDeleteOn('Coco');

    confirmDelete();

    await waitFor(() => expect(writes()).toHaveLength(1));
    const [input, init] = writes()[0]!;
    expect(String(input)).toBe('/api/movies/m1');
    expect(init?.method?.toUpperCase()).toBe('DELETE');
    expect(init?.body).toBeUndefined();
  });

  it('sends a show’s delete on the series tab', async () => {
    serveWith(() => Promise.resolve(noContentResponse()));
    renderPage(['/', '/settings', '/settings/library?tab=series']);
    await loaded();
    openDeleteOn('Bluey');

    confirmDelete('Bluey');

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(String(writes()[0]?.[0])).toBe('/api/series/s1');
  });

  it('reads Deleting… and is inert while the delete runs', async () => {
    const held = heldClear();
    serveWith(() => held.pending);
    renderPage();
    await loaded();
    openDeleteOn('Coco');

    confirmDelete();

    const button = await within(deleteDialog() as HTMLElement).findByRole(
      'button',
      { name: 'Deleting…' }
    );
    expect((button as HTMLButtonElement).disabled).toBe(true);
    held.settle(noContentResponse());
    await waitFor(() => expect(deleteDialog()).toBeNull());
  });

  it('closes, and takes the row off the list', async () => {
    serveWith(() => Promise.resolve(noContentResponse()));
    renderPage();
    await loaded();
    openDeleteOn('Coco');

    confirmDelete();

    await waitFor(() => expect(deleteDialog()).toBeNull());
    expect(screen.queryByText('Coco')).toBeNull();
    expect(screen.getByText('Heat')).toBeDefined();
    expect(screen.getByText('Up')).toBeDefined();
  });

  it('updates the tab’s count and the summary without a re-read', async () => {
    serveWith(() => Promise.resolve(noContentResponse()));
    renderPage();
    await loaded();
    openDeleteOn('Heat');

    confirmDelete('Heat');

    await waitFor(() => expect(tab(/^Movies 2$/)).toBeDefined());
    expect(tab(/^Series 2$/)).toBeDefined();
    expect(screen.getByText('2 movies')).toBeDefined();
    expect(screen.queryByText(/without details/)).toBeNull();
    expect(listReads()).toHaveLength(1);
  });

  it('updates the series tab’s count after a show’s delete', async () => {
    serveWith(() => Promise.resolve(noContentResponse()));
    renderPage(['/', '/settings', '/settings/library?tab=series']);
    await loaded();
    openDeleteOn('Bluey');

    confirmDelete('Bluey');

    await waitFor(() => expect(tab(/^Series 1$/)).toBeDefined());
    expect(tab(/^Movies 3$/)).toBeDefined();
    expect(screen.getByText('1 series')).toBeDefined();
    expect(screen.queryByText('Bluey')).toBeNull();
  });

  it('shows the success notice, naming the title', async () => {
    serveWith(() => Promise.resolve(noContentResponse()));
    renderPage();
    await loaded();
    openDeleteOn('Coco');

    confirmDelete();

    expect(await screen.findByText('“Coco” was deleted.')).toBeDefined();
  });

  it('leaves the row, and shows no notice, on a failed delete', async () => {
    serveWith(() => Promise.resolve(serverErrorResponse()));
    renderPage();
    await loaded();
    openDeleteOn('Coco');

    confirmDelete();

    await waitFor(() => expect(writes()).toHaveLength(1));
    await waitFor(() =>
      expect(
        within(deleteDialog() as HTMLElement).getByRole('button', {
          name: 'Delete movie',
        })
      ).toBeDefined()
    );
    expect(within(rowOf('Coco')).getByText('Synced with TMDB')).toBeDefined();
    expect(screen.queryByText('“Coco” was deleted.')).toBeNull();
  });
});

/**
 * 47 — Manage library, Phase 5: "delete a linked title" (issue #411).
 *
 * _Delete…_ is offered on every row, linked titles included. A linked
 * title's dialog keeps its files under What stays (52, Keep originals), and
 * an unreachable title's delete answers `204` like any other.
 */
const LINKED: LibraryTitles = {
  movies: [
    makeLibraryMovie({
      id: 'm1',
      title: 'Coco',
      linkedFiles: 'folder',
      path: 'E:\\Movies\\Coco (2017)',
    }),
    makeLibraryMovie({
      id: 'm2',
      title: 'Heat',
      linkedFiles: 'unreachable',
      path: 'F:\\Movies\\Heat (1995)',
    }),
  ],
  series: [],
};

/** The list read answered with LINKED, each write by the next of `answers`. */
function serveLinked(answers: Response[]) {
  fetchMock.mockImplementation((input) =>
    String(input) === '/api/library-titles'
      ? Promise.resolve(okResponse(LINKED))
      : Promise.resolve(answers.shift() ?? noContentResponse())
  );
}

describe('ManageLibrary — deleting a linked title', () => {
  it('opens the linked Delete dialog; a browser keeps the files', async () => {
    serveLinked([]);
    renderPage();
    await loaded();

    openDeleteOn('Coco');

    const dialog = deleteDialog() as HTMLElement;
    expect(
      within(dialog).getByText('Its folder, in your library folder')
    ).toBeDefined();
  });

  it('deletes an unreachable title, its row taken off', async () => {
    serveLinked([noContentResponse()]);
    renderPage();
    await loaded();
    openDeleteOn('Heat');

    confirmDelete('Heat');

    await waitFor(() => expect(deleteDialog('Heat')).toBeNull());
    expect(screen.queryByText('Heat')).toBeNull();
    expect(String(writes()[0]?.[0])).toBe('/api/movies/m2');
  });
});

/**
 * 52, Keep originals, Phase 4 (issue #477): one dialog everywhere. In the
 * shell (a **Folder bridge** present) a linked title's Delete dialog draws
 * what a browser draws, no choice of the files, its folder under What stays;
 * confirming sends the plain `DELETE`, no query, the row then off the list.
 */
describe('ManageLibrary — deleting a linked title, in the shell', () => {
  fakeFolderBridge();

  it('draws no choice of the files, its files kept', async () => {
    serveLinked([]);
    renderPage();
    await loaded();

    openDeleteOn('Coco');

    const dialog = deleteDialog() as HTMLElement;
    expect(within(dialog).queryAllByRole('radio')).toEqual([]);
    expect(
      within(dialog).getByText('Its folder, in your library folder')
    ).toBeDefined();
  });

  it('sends the plain DELETE, with no query, and takes the row off', async () => {
    serveLinked([noContentResponse()]);
    renderPage();
    await loaded();
    openDeleteOn('Coco');
    expect(
      within(deleteDialog() as HTMLElement).queryAllByRole('radio')
    ).toEqual([]);

    confirmDelete();

    await waitFor(() => expect(deleteDialog()).toBeNull());
    expect(writes()).toHaveLength(1);
    const [input, init] = writes()[0];
    expect(String(input)).toBe('/api/movies/m1');
    expect(init?.method?.toUpperCase()).toBe('DELETE');
    expect(screen.queryByText('Coco')).toBeNull();
  });
});
