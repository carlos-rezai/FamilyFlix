import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';

import { LibraryFilters } from './LibraryFilters';
import { theme } from '@/styles/theme';

/**
 * The prototype's option list, in the prototype's order — deliberately not the
 * declaration order of `MovieSort` — paired with the slug each one writes.
 * Both halves are the claim: what the parent reads, and what goes on the wire.
 */
const SORT_OPTIONS = [
  ['Recently Added', 'recently-added'],
  ['Title (A–Z)', 'a-z'],
  ['Year', 'year'],
  ['Unwatched First', 'unwatched-first'],
  ['Highest Rated', 'highest-rated'],
] as const;

/**
 * The genre list `GET /api/genres` answers with — the counts deliberately not
 * alphabetical, and a tie in them, so the panel's order is a real claim. The
 * total is a count of movies, which is why it is not the sum of the counts.
 */
const GENRE_LIST = {
  total: 24,
  genres: [
    { id: 'g1', name: 'Action', count: 9 },
    { id: 'g2', name: 'Comedy', count: 4 },
    { id: 'g3', name: 'Drama', count: 12 },
    { id: 'g4', name: 'Adventure', count: 4 },
  ],
};

/** The order the panel draws them in: the total first, then count-descending. */
const GENRE_ROWS = ['All Genres', 'Drama', 'Action', 'Adventure', 'Comedy'];

let fetchMock: ReturnType<
  typeof vi.fn<(input: RequestInfo | URL) => Promise<Response>>
>;

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/** Answer the genre list; anything else this component asks for is a mistake. */
function serveGenres(body: unknown = GENRE_LIST) {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/genres')) {
      return Promise.resolve(okResponse(body));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

beforeEach(() => {
  fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();
  vi.stubGlobal('fetch', fetchMock);
  serveGenres();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function UrlProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <div data-testid="url">{`${location.pathname}${location.search}`}</div>
      <button type="button" onClick={() => navigate('/movie/a1')}>
        Open movie
      </button>
    </>
  );
}

function renderFilters(url = '/') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider theme={theme}>
        <LibraryFilters />
      </ThemeProvider>
      <UrlProbe />
    </MemoryRouter>
  );
}

function currentUrl() {
  return screen.getByTestId('url').textContent;
}

/** The sort pill, found by the name it announces. */
const pill = (value = 'Recently Added') =>
  screen.getByRole('button', { name: `Sort: ${value}` });

/** One row of the open panel. */
const optionRow = (label: string) =>
  screen.getByRole('button', { name: label });
const noOptionRow = (label: string) =>
  screen.queryByRole('button', { name: label });

/** Opens it the way a keyboard user does — focus the pill, then activate it. */
function openSort(value?: string) {
  const control = pill(value);
  act(() => control.focus());
  fireEvent.click(control);
  return control;
}

/**
 * The rows of the panel opened from one pill, in the order they are drawn.
 * Scoped to the pill's own slot, which holds the trigger and its panel and
 * nothing else — there is more than one pill in the header now.
 */
function openOptionLabels(trigger: HTMLElement = pill()): string[] {
  return within(trigger.parentElement as HTMLElement)
    .getAllByRole('button')
    .filter((row) => row !== trigger)
    .map((row) => row.textContent ?? '');
}

describe('LibraryFilters — the sort pill', () => {
  it('shows the order the home is already in, on a clean “/”', () => {
    // The pill reads the state of the screen without anything being opened.
    renderFilters('/');

    expect(pill('Recently Added').textContent).toContain('Recently Added');
  });

  it('shows the order the URL is carrying', () => {
    renderFilters('/?sort=highest-rated');

    expect(pill('Highest Rated')).toBeTruthy();
  });

  it('names every order the way the prototype writes it', () => {
    for (const [label, slug] of SORT_OPTIONS) {
      const view = renderFilters(`/?sort=${slug}`);

      expect(pill(label)).toBeTruthy();

      view.unmount();
    }
  });

  it('says “Sort”, so the pill is not a value with no subject', () => {
    renderFilters('/');

    expect(pill().textContent).toContain('Sort');
  });

  it('lists nothing until it is opened', () => {
    renderFilters('/');

    expect(noOptionRow('Year')).toBeNull();
  });
});

describe('LibraryFilters — the option list', () => {
  it('lists the five orders in the prototype’s order', () => {
    // Not the declaration order of `MovieSort`: the dropdown follows the
    // prototype, which puts Unwatched First before Highest Rated.
    renderFilters('/');

    openSort();

    expect(openOptionLabels()).toEqual(SORT_OPTIONS.map(([label]) => label));
  });

  it('ticks the order the screen is currently in', () => {
    renderFilters('/?sort=year');

    openSort('Year');

    expect(optionRow('Year').getAttribute('aria-current')).toBe('true');
  });

  it('ticks exactly one order, and it is the current one', () => {
    renderFilters('/?sort=year');

    openSort('Year');

    const ticked = screen
      .getAllByRole('button')
      .filter((row) => row.getAttribute('aria-current') === 'true');
    expect(ticked).toHaveLength(1);
    expect(ticked[0].textContent).toBe('Year');
  });

  it('ticks the default order on a home that has never been sorted', () => {
    renderFilters('/');

    openSort();

    expect(optionRow('Recently Added').getAttribute('aria-current')).toBe(
      'true'
    );
  });
});

describe('LibraryFilters — choosing an order', () => {
  it('writes the chosen order into the URL', () => {
    renderFilters('/');

    openSort();
    fireEvent.click(optionRow('Title (A–Z)'));

    expect(currentUrl()).toBe('/?sort=a-z');
  });

  it('writes the slug the wire uses, not the words on the row', () => {
    for (const [label, slug] of SORT_OPTIONS.slice(1)) {
      const view = renderFilters('/');

      openSort();
      fireEvent.click(optionRow(label));

      expect(currentUrl()).toBe(`/?sort=${slug}`);

      view.unmount();
    }
  });

  it('writes no parameter for the default order, so “/” stays clean', () => {
    renderFilters('/?sort=a-z');

    openSort('Title (A–Z)');
    fireEvent.click(optionRow('Recently Added'));

    expect(currentUrl()).toBe('/');
  });

  it('shuts the panel once an order is chosen', () => {
    renderFilters('/');

    openSort();
    fireEvent.click(optionRow('Year'));

    expect(noOptionRow('Title (A–Z)')).toBeNull();
  });

  it('shows the new order on the pill', () => {
    renderFilters('/');

    openSort();
    fireEvent.click(optionRow('Year'));

    expect(pill('Year')).toBeTruthy();
  });

  it('leaves the search text alone — sorting is not a new search', () => {
    renderFilters('/?q=lighthouse');

    openSort();
    fireEvent.click(optionRow('Year'));

    const written = new URLSearchParams(String(currentUrl()).split('?')[1]);
    expect(written.get('q')).toBe('lighthouse');
    expect(written.get('sort')).toBe('year');
  });
});

describe('LibraryFilters — from the keyboard', () => {
  it('offers the pill as a real button, so Tab reaches it', () => {
    renderFilters('/');

    act(() => pill().focus());

    expect(document.activeElement).toBe(pill());
  });

  it('opens on the pill being activated, onto options that are buttons too', () => {
    renderFilters('/');

    openSort();

    for (const [label] of SORT_OPTIONS) {
      expect(optionRow(label).tagName).toBe('BUTTON');
    }
  });

  it('hands focus back to the pill when an order is chosen', () => {
    // A parent on the keyboard is never dropped at the top of the document.
    renderFilters('/');

    openSort();
    fireEvent.click(optionRow('Year'));

    expect(document.activeElement).toBe(pill('Year'));
  });

  it('closes on Escape, with focus back on the pill', () => {
    renderFilters('/');

    openSort();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(noOptionRow('Year')).toBeNull();
    expect(document.activeElement).toBe(pill());
  });

  it('leaves the order alone when the panel is dismissed rather than used', () => {
    renderFilters('/');

    openSort();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(currentUrl()).toBe('/');
  });
});

// --- 05 — Search + filter, Phase 4: "the Genre dropdown" (issue #36) -----------

/** The genre pill, found by the name it announces. */
const genrePill = (value = 'All Genres') =>
  screen.getByRole('button', { name: `Genre: ${value}` });

/** The rows of one open panel, with the trailing count stripped off each. */
function panelRowLabels(trigger: HTMLElement): string[] {
  return openOptionLabels(trigger).map((row) => row.replace(/\d+$/, ''));
}

/** Opens it the way a keyboard user does, and waits for the list to arrive. */
async function openGenre(value?: string) {
  const control = genrePill(value);
  act(() => control.focus());
  fireEvent.click(control);
  await waitFor(() =>
    expect(openOptionLabels(control).length).toBeGreaterThan(1)
  );
  return control;
}

/** Every genre-list request the header has issued. */
function genreRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/api/genres'));
}

describe('LibraryFilters — the genre pill', () => {
  it('shows “All Genres” on a clean “/”, so the way out is already visible', () => {
    renderFilters('/');

    expect(genrePill().textContent).toContain('All Genres');
  });

  it('says “Genre”, so the pill is not a value with no subject', () => {
    renderFilters('/');

    expect(genrePill().textContent).toContain('Genre');
  });

  it('shows the genre the URL is carrying', () => {
    // A shared or bookmarked link opens with the pill already saying so.
    renderFilters('/?genre=Drama');

    expect(genrePill('Drama')).toBeTruthy();
  });

  it('shows a genre name the URL had to encode', () => {
    renderFilters('/?genre=Science%20Fiction');

    expect(genrePill('Science Fiction')).toBeTruthy();
  });

  it('lists nothing until it is opened', async () => {
    renderFilters('/');

    await waitFor(() => expect(genreRequests()).toHaveLength(1));
    expect(noOptionRow('Drama')).toBeNull();
  });

  it('renders before the list has arrived rather than waiting for it', () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));

    renderFilters('/');

    expect(genrePill()).toBeTruthy();
  });
});

describe('LibraryFilters — the genre list', () => {
  it('lists “All Genres” first, then the genres by count, most first', async () => {
    renderFilters('/');

    const control = await openGenre();

    expect(panelRowLabels(control)).toEqual(GENRE_ROWS);
  });

  it('shows each genre’s count beside it', async () => {
    renderFilters('/');

    await openGenre();

    // The count is chrome, not part of the row's name — the row is still
    // "Drama" to a screen reader, and the tally is beside it.
    expect(optionRow('Drama').textContent).toContain('12');
    expect(optionRow('Action').textContent).toContain('9');
  });

  it('shows the library total beside “All Genres”', async () => {
    renderFilters('/');

    await openGenre();

    // 9 + 4 + 12 + 4 is 29; the library holds 24, because movies are tagged
    // more than once. The total is a count of movies.
    expect(optionRow('All Genres').textContent).toContain('24');
  });

  it('ticks “All Genres” when no genre is set', async () => {
    renderFilters('/');

    await openGenre();

    expect(optionRow('All Genres').getAttribute('aria-current')).toBe('true');
  });

  it('ticks the genre the screen is filtered to, and only that one', async () => {
    renderFilters('/?genre=Drama');

    const control = await openGenre('Drama');

    const ticked = within(control.parentElement as HTMLElement)
      .getAllByRole('button')
      .filter((row) => row.getAttribute('aria-current') === 'true');
    expect(ticked).toHaveLength(1);
    expect(ticked[0].textContent).toContain('Drama');
  });

  it('asks for the list once, and not again as the query changes', async () => {
    renderFilters('/');
    await openGenre();

    fireEvent.click(optionRow('Drama'));
    await openGenre('Drama');
    fireEvent.click(optionRow('Action'));

    // The counts must not reshuffle under a finger already reaching for them.
    expect(genreRequests()).toHaveLength(1);
  });
});

describe('LibraryFilters — choosing a genre', () => {
  it('writes the chosen genre into the URL', async () => {
    renderFilters('/');

    await openGenre();
    fireEvent.click(optionRow('Drama'));

    expect(currentUrl()).toBe('/?genre=Drama');
  });

  it('takes the parameter back off the URL for “All Genres”', async () => {
    renderFilters('/?genre=Drama');

    await openGenre('Drama');
    fireEvent.click(optionRow('All Genres'));

    expect(currentUrl()).toBe('/');
  });

  it('shuts the panel once a genre is chosen', async () => {
    renderFilters('/');

    await openGenre();
    fireEvent.click(optionRow('Drama'));

    expect(noOptionRow('Action')).toBeNull();
  });

  it('shows the new genre on the pill', async () => {
    renderFilters('/');

    await openGenre();
    fireEvent.click(optionRow('Drama'));

    expect(genrePill('Drama')).toBeTruthy();
  });

  it('replaces the genre rather than stacking a second one', async () => {
    renderFilters('/?genre=Drama');

    await openGenre('Drama');
    fireEvent.click(optionRow('Action'));

    expect(currentUrl()).toBe('/?genre=Action');
  });

  it('leaves the search text and the order alone', async () => {
    renderFilters('/?q=lighthouse&sort=a-z');

    await openGenre();
    fireEvent.click(optionRow('Drama'));

    const written = new URLSearchParams(String(currentUrl()).split('?')[1]);
    expect(written.get('q')).toBe('lighthouse');
    expect(written.get('sort')).toBe('a-z');
    expect(written.get('genre')).toBe('Drama');
  });

  it('hands focus back to the pill, so the keyboard is never dropped', async () => {
    renderFilters('/');

    await openGenre();
    fireEvent.click(optionRow('Drama'));

    expect(document.activeElement).toBe(genrePill('Drama'));
  });

  it('leaves the genre alone when the panel is dismissed rather than used', async () => {
    renderFilters('/');

    await openGenre();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(currentUrl()).toBe('/');
    expect(noOptionRow('Drama')).toBeNull();
  });
});

describe('LibraryFilters — two pills in one header', () => {
  it('opens the genre panel and the sort panel one at a time', async () => {
    renderFilters('/');

    const genre = await openGenre();
    expect(optionRow('Drama')).toBeTruthy();

    act(() => pill().focus());
    fireEvent.pointerDown(pill());
    fireEvent.click(pill());

    // Opening the second pill is a press outside the first, which is already
    // what shuts it — no coordinating state anywhere.
    expect(openOptionLabels(genre)).toEqual([]);
    expect(optionRow('Year')).toBeTruthy();
  });

  it('shows both pills with what the URL says, without either reading the other', () => {
    renderFilters('/?genre=Drama&sort=year');

    expect(genrePill('Drama')).toBeTruthy();
    expect(pill('Year')).toBeTruthy();
  });
});

describe('LibraryFilters — when the genre list cannot be loaded', () => {
  it('offers “All Genres” alone rather than an empty panel', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    renderFilters('/');

    const control = genrePill();
    act(() => control.focus());
    fireEvent.click(control);

    await waitFor(() => expect(genreRequests()).toHaveLength(1));
    expect(panelRowLabels(control)).toEqual(['All Genres']);
  });

  it('leaves the sort pill working', async () => {
    // The prototype designs no error state here, so a failed list is a quiet
    // one — it must not take the rest of the header down with it.
    fetchMock.mockRejectedValue(new Error('offline'));
    renderFilters('/');
    await waitFor(() => expect(genreRequests()).toHaveLength(1));

    openSort();
    fireEvent.click(optionRow('Year'));

    expect(currentUrl()).toBe('/?sort=year');
  });

  it('still shows a genre the URL is carrying on the pill', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    renderFilters('/?genre=Drama');

    await waitFor(() => expect(genreRequests()).toHaveLength(1));
    expect(genrePill('Drama')).toBeTruthy();
  });
});
