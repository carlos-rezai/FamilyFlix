import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ManageLibrary } from './ManageLibrary';
import type { LibraryTitles } from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import {
  LocationProbe,
  navigationType,
  pathname,
  search,
} from '@/test-support/LocationProbe/LocationProbe';
import {
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
        <Routes>
          <Route path="/" element={<p>the browse home</p>} />
          <Route path="/settings" element={<p>the settings hub</p>} />
          <Route path="/settings/library" element={<ManageLibrary />} />
        </Routes>
        <LocationProbe />
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
