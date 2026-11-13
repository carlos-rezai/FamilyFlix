import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import App from './App';
import type {
  HomePayload,
  Movie,
  MovieGridPayload,
  RowView,
  Series,
  SeriesGenrePayload,
  SeriesHomePayload,
  SeriesRowsPayload,
  Settings,
} from '@/types';
import {
  LocationProbe,
  pathname,
  search,
} from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeries } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { makeSettings } from '@/test-support/makeSettings/makeSettings';

/**
 * 63, Row view, Phase 7 (issue #614): design log 63's live walk, as tests.
 *
 * `App` over a stubbed wire that behaves like the server: it keeps the
 * household's settings and hearts between requests, narrows every read by the
 * `q` and `rating` it is asked with, and answers the four bodies (Movies **By
 * genre** and **All**, Series **All** and **By genre**) and the series Genre
 * page. Each **Library tab** is walked both ways through the **Row view
 * switch**; a filter and a search narrow each view and survive a switch; a
 * heart on a row and on the grid reaches the **Favorites row**; _View all_ on
 * a series row and on _Other series_ opens the series Genre page and Back
 * returns to the held view; and a remount, the relaunch, draws both tabs in
 * the stored views on first paint.
 */

interface Shelved<T> {
  item: T;
  /** Its one genre, or `null` for the genre-less. */
  genre: string | null;
}

const MOVIES: Shelved<Movie>[] = [
  {
    item: makeMovie({ id: 'm1', title: 'Northwind', rating: 9 }),
    genre: 'Action',
  },
  {
    item: makeMovie({ id: 'm2', title: 'Ironclad', rating: 5 }),
    genre: 'Action',
  },
  {
    item: makeMovie({ id: 'm3', title: 'Quiet Harbor', rating: 8.5 }),
    genre: 'Drama',
  },
  {
    item: makeMovie({ id: 'm4', title: 'Orbital Drift', rating: 4 }),
    genre: 'Drama',
  },
];

const SERIES: Shelved<Series>[] = [
  {
    item: makeSeries({ id: 's1', title: 'Harbor & Vine', rating: 9 }),
    genre: 'Drama',
  },
  {
    item: makeSeries({ id: 's2', title: 'Lighthouse Keepers', rating: 5 }),
    genre: 'Drama',
  },
  {
    item: makeSeries({ id: 's3', title: 'Orbital Station', rating: 8 }),
    genre: 'Science Fiction',
  },
  {
    item: makeSeries({ id: 's4', title: 'Attic Tape', rating: 8 }),
    genre: null,
  },
];

/** What the stubbed server holds: it outlives a remount, as the database does. */
let stored: Settings;
let hearted: Set<string>;

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

/** Narrow a shelf by the read's `q` and `rating`, hearts applied. */
function narrowed<T extends Movie | Series>(
  shelf: Shelved<T>[],
  params: URLSearchParams
): Shelved<T>[] {
  const q = params.get('q')?.toLowerCase();
  const rating = Number(params.get('rating') ?? 0);
  return shelf
    .map(({ item, genre }) => ({
      item: { ...item, isFavorite: hearted.has(item.id) },
      genre,
    }))
    .filter(
      ({ item }) => q === undefined || item.title.toLowerCase().includes(q)
    )
    .filter(({ item }) => (item.rating ?? 0) >= rating);
}

/** The genre rows of a narrowed shelf, in first-seen order, and its Other. */
function rowsOf<T>(shelf: Shelved<T>[]) {
  const genres = [
    ...new Set(shelf.flatMap(({ genre }) => (genre === null ? [] : [genre]))),
  ];
  const rows = genres.map((genre) => {
    const items = shelf.filter((entry) => entry.genre === genre);
    return { genre, count: items.length, items: items.map((e) => e.item) };
  });
  const loose = shelf.filter(({ genre }) => genre === null);
  const other =
    loose.length === 0
      ? null
      : { genre: '', count: loose.length, items: loose.map((e) => e.item) };
  return { rows, other };
}

function answer(url: string, init?: RequestInit): Promise<Response> {
  const [path, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  const method = (init?.method ?? 'GET').toUpperCase();

  if (method === 'POST') {
    const { value } = JSON.parse(String(init?.body)) as { value: unknown };
    if (path === '/api/settings/movie-row-view') {
      stored = { ...stored, movieRowView: value as RowView };
    } else if (path === '/api/settings/series-row-view') {
      stored = { ...stored, seriesRowView: value as RowView };
    } else if (/^\/api\/(movies|series)\/[^/]+\/favorite$/.test(path)) {
      const id = path.split('/')[3];
      if (value === true) {
        hearted.add(id);
      } else {
        hearted.delete(id);
      }
    } else {
      return Promise.reject(new Error(`Unexpected write: ${url}`));
    }
    return Promise.resolve(okResponse({ value }));
  }

  if (path === '/api/settings') {
    return Promise.resolve(okResponse(stored));
  }
  if (path === '/api/home') {
    const shelf = narrowed(MOVIES, params);
    const { rows } = rowsOf(shelf);
    const payload: HomePayload = {
      continueWatching: [],
      favorites: shelf.map((e) => e.item).filter((m) => m.isFavorite),
      rows: rows.map(({ genre, count, items }) => ({
        genre,
        count,
        movies: items,
      })),
      other: null,
    };
    return Promise.resolve(okResponse(payload));
  }
  if (path === '/api/movies') {
    const payload: MovieGridPayload = {
      movies: narrowed(MOVIES, params).map((e) => e.item),
      continueWatching: [],
    };
    return Promise.resolve(okResponse(payload));
  }
  if (path === '/api/series') {
    const series = narrowed(SERIES, params).map((e) => e.item);
    const payload: SeriesHomePayload = {
      series,
      episodeCount: series.length * 10,
      continueWatching: [],
    };
    return Promise.resolve(okResponse(payload));
  }
  if (path === '/api/series/rows') {
    const shelf = narrowed(SERIES, params);
    const { rows, other } = rowsOf(shelf);
    const payload: SeriesRowsPayload = {
      rows: rows.map(({ genre, count, items }) => ({
        genre,
        count,
        series: items,
      })),
      other:
        other === null
          ? null
          : { genre: '', count: other.count, series: other.items },
      favorites: shelf.map((e) => e.item).filter((s) => s.isFavorite),
      continueWatching: [],
    };
    return Promise.resolve(okResponse(payload));
  }
  if (
    path.startsWith('/api/series/genre/') ||
    path === '/api/series/genre-less'
  ) {
    const genre = path.startsWith('/api/series/genre/')
      ? decodeURIComponent(path.slice('/api/series/genre/'.length))
      : null;
    const whole = SERIES.filter((entry) => entry.genre === genre);
    const series = narrowed(whole, params).map((e) => e.item);
    const payload: SeriesGenrePayload = {
      genre: genre ?? '',
      total: whole.length,
      series,
    };
    return Promise.resolve(okResponse(payload));
  }
  // The genre lists and anything else: refused, and every screen here keeps
  // what it had on a refusal.
  return Promise.reject(new Error(`Unexpected request: ${url}`));
}

beforeEach(() => {
  stored = makeSettings();
  hearted = new Set();
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => answer(String(input), init));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderApp(entry = '/') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
      <LocationProbe />
    </MemoryRouter>
  );
}

/** Every request so far as `METHOD path?query`, in order. */
const requests = () =>
  fetchMock.mock.calls.map(
    ([input, init]) =>
      `${(init?.method ?? 'GET').toUpperCase()} ${String(input)}`
  );

/** The writes so far, each as `path value`. */
const writes = () =>
  fetchMock.mock.calls
    .filter(([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST')
    .map(
      ([input, init]) =>
        `${String(input)} ${String(
          (JSON.parse(String(init?.body)) as { value: unknown }).value
        )}`
    );

/** The body reads (no settings, no genre lists) since request `from`. */
const bodyReadsSince = (from: number) =>
  requests()
    .slice(from)
    .filter((line) => line.startsWith('GET '))
    .map((line) => line.slice('GET '.length).split('?')[0])
    .filter((path) => path !== '/api/settings' && !path.endsWith('/genres'));

/** Choose one item from a header pill, the way a parent does. */
function choose(pillName: string | RegExp, item: string) {
  const pill = screen.getByRole('button', { name: pillName });
  act(() => pill.focus());
  fireEvent.click(pill);
  fireEvent.click(screen.getByRole('menuitem', { name: item }));
}

/** Set the current tab's **Row view** through the switch. */
const chooseView = (view: 'All' | 'By genre') => choose(/^View: /, view);

/** Press one **Library tab**. */
function openTab(name: 'Movies' | 'Series') {
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Library' })).getByRole('button', {
      name,
    })
  );
}

const region = (name: string) => screen.getByRole('region', { name });
const findRegion = (name: string) => screen.findByRole('region', { name });
const findLevel2 = (name: string) =>
  screen.findByRole('heading', { name, level: 2 });

/** The heart on one title's card inside `scope`. */
const heartOn = (scope: HTMLElement, title: string) =>
  within(within(scope).getByRole('button', { name: title })).getByRole(
    'button',
    { name: 'Favorite' }
  );

/** Movies under By genre, drawn: the Action row is the sign. */
const moviesByGenre = () => findRegion('Action');
/** Series under By genre, drawn: the Drama row is the sign. */
const seriesByGenre = () => findRegion('Drama');

describe('App: the Row view walk, each tab both ways', () => {
  it('switches each tab both ways, posting its one setting and redrawing only its own body', async () => {
    renderApp();
    // The file's first render pays for App's imports (issue #510).
    await screen.findByRole('region', { name: 'Action' }, { timeout: 3000 });
    expect(
      screen.getByRole('button', { name: 'View: By genre' })
    ).toBeDefined();

    // Movies: By genre to All.
    let mark = requests().length;
    chooseView('All');
    await findLevel2('All movies');
    expect(screen.queryByRole('region', { name: 'Action' })).toBeNull();
    expect(writes()).toEqual(['/api/settings/movie-row-view all']);
    expect(bodyReadsSince(mark)).toEqual(['/api/movies']);

    // Series keeps its own view: All, as stored.
    openTab('Series');
    await findLevel2('All series');
    expect(screen.getByRole('button', { name: 'View: All' })).toBeDefined();

    // Series: All to By genre.
    mark = requests().length;
    chooseView('By genre');
    await seriesByGenre();
    expect(
      screen.queryByRole('heading', { name: 'All series', level: 2 })
    ).toBeNull();
    expect(writes()).toEqual([
      '/api/settings/movie-row-view all',
      '/api/settings/series-row-view genre',
    ]);
    expect(bodyReadsSince(mark)).toEqual(['/api/series/rows']);

    // Movies still holds All; back to By genre.
    openTab('Movies');
    await findLevel2('All movies');
    mark = requests().length;
    chooseView('By genre');
    await moviesByGenre();
    expect(
      screen.queryByRole('heading', { name: 'All movies', level: 2 })
    ).toBeNull();
    expect(bodyReadsSince(mark)).toEqual(['/api/home']);

    // Series still holds By genre; back to All.
    openTab('Series');
    await seriesByGenre();
    mark = requests().length;
    chooseView('All');
    await findLevel2('All series');
    expect(screen.queryByRole('region', { name: 'Drama' })).toBeNull();
    expect(bodyReadsSince(mark)).toEqual(['/api/series']);

    expect(writes()).toEqual([
      '/api/settings/movie-row-view all',
      '/api/settings/series-row-view genre',
      '/api/settings/movie-row-view genre',
      '/api/settings/series-row-view all',
    ]);
  });
});

describe('App: a filter and a search under each view', () => {
  /** Type into the header's search box and let it settle into the URL. */
  async function searchFor(placeholder: string, text: string) {
    fireEvent.change(screen.getByRole('textbox', { name: placeholder }), {
      target: { value: text },
    });
    await waitFor(() =>
      expect(new URLSearchParams(search() ?? '').get('q')).toBe(text)
    );
  }

  it('narrows Movies under both views, and survives each switch', async () => {
    renderApp();
    await moviesByGenre();

    // By genre: the 4+ stars filter.
    choose('Minimum rating: All ratings', '4+ stars');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Ironclad' })).toBeNull()
    );
    expect(
      within(region('Action')).getByRole('button', { name: 'Northwind' })
    ).toBeDefined();
    expect(
      within(region('Drama')).getByRole('button', { name: 'Quiet Harbor' })
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Orbital Drift' })).toBeNull();

    // To All: the filter rides along.
    chooseView('All');
    await findLevel2('All movies');
    await screen.findByRole('button', { name: 'Northwind' });
    expect(screen.getByRole('button', { name: 'Quiet Harbor' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Ironclad' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Orbital Drift' })).toBeNull();

    // All: a search narrows the grid further.
    await searchFor('Search your movies', 'north');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Quiet Harbor' })).toBeNull()
    );
    expect(screen.getByRole('button', { name: 'Northwind' })).toBeDefined();

    // Back to By genre: both ride along.
    chooseView('By genre');
    await moviesByGenre();
    expect(
      within(region('Action')).getByRole('button', { name: 'Northwind' })
    ).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Drama' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ironclad' })).toBeNull();
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Search your movies',
        }) as HTMLInputElement
      ).value
    ).toBe('north');
    expect(
      screen.getByRole('button', { name: 'Minimum rating: 4+ stars' })
    ).toBeDefined();
  });

  it('narrows Series under both views, and survives each switch', async () => {
    renderApp('/?tab=series');
    await findLevel2('All series');

    // All: the 4+ stars filter.
    choose('Minimum rating: All ratings', '4+ stars');
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Lighthouse Keepers' })
      ).toBeNull()
    );
    expect(screen.getByRole('button', { name: 'Harbor & Vine' })).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Orbital Station' })
    ).toBeDefined();

    // To By genre: the filter rides along.
    chooseView('By genre');
    await seriesByGenre();
    expect(
      within(region('Drama')).getByRole('button', { name: 'Harbor & Vine' })
    ).toBeDefined();
    expect(
      screen.queryByRole('button', { name: 'Lighthouse Keepers' })
    ).toBeNull();
    expect(region('Science Fiction')).toBeDefined();

    // By genre: a search narrows the rows further.
    await searchFor('Search your series', 'harbor');
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Science Fiction' })
      ).toBeNull()
    );
    expect(
      within(region('Drama')).getByRole('button', { name: 'Harbor & Vine' })
    ).toBeDefined();

    // Back to All: both ride along.
    chooseView('All');
    await findLevel2('All series');
    await screen.findByRole('button', { name: 'Harbor & Vine' });
    expect(
      screen.queryByRole('button', { name: 'Orbital Station' })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Lighthouse Keepers' })
    ).toBeNull();
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Search your series',
        }) as HTMLInputElement
      ).value
    ).toBe('harbor');
    expect(
      screen.getByRole('button', { name: 'Minimum rating: 4+ stars' })
    ).toBeDefined();
  });
});

describe('App: a heart on a row and on the grid', () => {
  it('puts a film on the Favorites row from a genre row and from the grid', async () => {
    renderApp();
    await moviesByGenre();
    expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull();

    fireEvent.click(heartOn(region('Action'), 'Northwind'));
    const shelf = await findRegion('Favorites');
    expect(
      within(shelf).getByRole('button', { name: 'Northwind' })
    ).toBeDefined();

    chooseView('All');
    await findLevel2('All movies');
    await waitFor(() =>
      expect(
        within(region('Favorites')).getByRole('button', { name: 'Northwind' })
      ).toBeDefined()
    );

    // Quiet Harbor is on the grid alone until its heart is pressed there.
    fireEvent.click(heartOn(document.body, 'Quiet Harbor'));
    await waitFor(() =>
      expect(
        within(region('Favorites')).getByRole('button', {
          name: 'Quiet Harbor',
        })
      ).toBeDefined()
    );
  });

  it('puts a series on the Favorites row from the grid and from a genre row', async () => {
    renderApp('/?tab=series');
    await findLevel2('All series');
    expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull();

    fireEvent.click(heartOn(document.body, 'Orbital Station'));
    const shelf = await findRegion('Favorites');
    expect(
      within(shelf).getByRole('button', { name: 'Orbital Station' })
    ).toBeDefined();

    chooseView('By genre');
    await seriesByGenre();
    await waitFor(() =>
      expect(
        within(region('Favorites')).getByRole('button', {
          name: 'Orbital Station',
        })
      ).toBeDefined()
    );

    fireEvent.click(heartOn(region('Drama'), 'Harbor & Vine'));
    await waitFor(() =>
      expect(
        within(region('Favorites')).getByRole('button', {
          name: 'Harbor & Vine',
        })
      ).toBeDefined()
    );
  });
});

describe('App: View all from Series By genre, and Back', () => {
  beforeEach(() => {
    stored = makeSettings({ seriesRowView: 'genre' });
  });

  /** Back on the library: the Series tab, in By genre. */
  async function backOnSeriesByGenre() {
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await seriesByGenre();
    expect(pathname()).toBe('/');
    expect(new URLSearchParams(search() ?? '').get('tab')).toBe('series');
    expect(
      screen.getByRole('button', { name: 'View: By genre' })
    ).toBeDefined();
  }

  it('opens the series Genre page from a genre row, and Back returns to By genre', async () => {
    renderApp('/?tab=series');
    await seriesByGenre();

    fireEvent.click(
      within(region('Drama')).getByRole('button', { name: /view all/i })
    );

    expect(pathname()).toBe('/genre/Drama');
    expect(new URLSearchParams(search() ?? '').get('tab')).toBe('series');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Drama' })
    ).toBeDefined();
    await screen.findByRole('button', { name: 'Lighthouse Keepers' });
    expect(
      requests().some((line) => line.startsWith('GET /api/series/genre/Drama'))
    ).toBe(true);

    await backOnSeriesByGenre();
  });

  it('opens the series Genre page from Other series, and Back returns to By genre', async () => {
    renderApp('/?tab=series');
    await findRegion('Other series');

    fireEvent.click(
      within(region('Other series')).getByRole('button', { name: /view all/i })
    );

    expect(pathname()).toBe('/genre-less');
    expect(new URLSearchParams(search() ?? '').get('tab')).toBe('series');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Other series' })
    ).toBeDefined();
    await screen.findByRole('button', { name: 'Attic Tape' });
    expect(
      requests().some((line) => line.startsWith('GET /api/series/genre-less'))
    ).toBe(true);

    await backOnSeriesByGenre();
  });
});

describe('App: the relaunch', () => {
  it('draws both tabs in the stored views on first paint after a remount', async () => {
    const first = renderApp();
    await moviesByGenre();
    chooseView('All');
    await findLevel2('All movies');
    openTab('Series');
    await findLevel2('All series');
    chooseView('By genre');
    await seriesByGenre();
    first.unmount();

    const mark = requests().length;
    renderApp('/');
    await findLevel2('All movies');
    expect(screen.getByRole('button', { name: 'View: All' })).toBeDefined();
    openTab('Series');
    await seriesByGenre();
    expect(
      screen.getByRole('button', { name: 'View: By genre' })
    ).toBeDefined();

    // Neither default was ever drawn: no genre rows read, no All series read.
    expect(bodyReadsSince(mark)).toEqual(['/api/movies', '/api/series/rows']);
  });
});
