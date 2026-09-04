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
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';

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

/**
 * Render the pills and let the genre list land before handing back.
 *
 * `useGenreList` fetches on mount, so its state update arrives after the
 * synchronous render — outside `act`, which React is right to warn about. The
 * settle belongs here rather than in the hook, which is behaving correctly: a
 * dropdown that renders before its list arrives is the point.
 */
async function renderFilters(url = '/') {
  const view = render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider theme={theme}>
        <LibraryFilters />
      </ThemeProvider>
      <UrlProbe />
    </MemoryRouter>
  );
  await act(async () => undefined);
  return view;
}

function currentUrl() {
  return screen.getByTestId('url').textContent;
}

/** The sort pill, found by the name it announces. */
const pill = (value = 'Recently Added') =>
  screen.getByRole('button', { name: `Sort: ${value}` });

/** One row of the open panel. */
const optionRow = (label: string) =>
  screen.getByRole('menuitem', { name: label });
const noOptionRow = (label: string) =>
  screen.queryByRole('menuitem', { name: label });

/** Opens it the way a keyboard user does — focus the pill, then activate it. */
function openSort(value?: string) {
  const control = pill(value);
  act(() => control.focus());
  fireEvent.click(control);
  return control;
}

/**
 * The rows of the panel opened from one pill, in the order they are drawn, and
 * an empty list for a pill that is shut. Scoped to the pill's own slot, which
 * holds the trigger and its panel and nothing else — there is more than one
 * pill in the header now.
 */
function openOptionLabels(trigger: HTMLElement = pill()): string[] {
  return within(trigger.parentElement as HTMLElement)
    .queryAllByRole('menuitem')
    .map((row) => row.textContent ?? '');
}

describe('LibraryFilters — the sort pill', () => {
  it('shows the order the home is already in, on a clean “/”', async () => {
    // The pill reads the state of the screen without anything being opened.
    await renderFilters('/');

    expect(pill('Recently Added').textContent).toContain('Recently Added');
  });

  it('shows the order the URL is carrying', async () => {
    await renderFilters('/?sort=highest-rated');

    expect(pill('Highest Rated')).toBeTruthy();
  });

  it('names every order the way the prototype writes it', async () => {
    for (const [label, slug] of SORT_OPTIONS) {
      const view = await renderFilters(`/?sort=${slug}`);

      expect(pill(label)).toBeTruthy();

      view.unmount();
    }
  });

  it('says “Sort”, so the pill is not a value with no subject', async () => {
    await renderFilters('/');

    expect(pill().textContent).toContain('Sort');
  });

  it('lists nothing until it is opened', async () => {
    await renderFilters('/');

    expect(noOptionRow('Year')).toBeNull();
  });
});

describe('LibraryFilters — the option list', () => {
  it('lists the five orders in the prototype’s order', async () => {
    // Not the declaration order of `MovieSort`: the dropdown follows the
    // prototype, which puts Unwatched First before Highest Rated.
    await renderFilters('/');

    openSort();

    expect(openOptionLabels()).toEqual(SORT_OPTIONS.map(([label]) => label));
  });

  it('ticks the order the screen is currently in', async () => {
    await renderFilters('/?sort=year');

    openSort('Year');

    expect(optionRow('Year').getAttribute('aria-current')).toBe('true');
  });

  it('ticks exactly one order, and it is the current one', async () => {
    await renderFilters('/?sort=year');

    openSort('Year');

    const ticked = screen
      .getAllByRole('menuitem')
      .filter((row) => row.getAttribute('aria-current') === 'true');
    expect(ticked).toHaveLength(1);
    expect(ticked[0].textContent).toBe('Year');
  });

  it('ticks the default order on a home that has never been sorted', async () => {
    await renderFilters('/');

    openSort();

    expect(optionRow('Recently Added').getAttribute('aria-current')).toBe(
      'true'
    );
  });
});

describe('LibraryFilters — choosing an order', () => {
  it('writes the chosen order into the URL', async () => {
    await renderFilters('/');

    openSort();
    fireEvent.click(optionRow('Title (A–Z)'));

    expect(currentUrl()).toBe('/?sort=a-z');
  });

  it('writes the slug the wire uses, not the words on the row', async () => {
    for (const [label, slug] of SORT_OPTIONS.slice(1)) {
      const view = await renderFilters('/');

      openSort();
      fireEvent.click(optionRow(label));

      expect(currentUrl()).toBe(`/?sort=${slug}`);

      view.unmount();
    }
  });

  it('writes no parameter for the default order, so “/” stays clean', async () => {
    await renderFilters('/?sort=a-z');

    openSort('Title (A–Z)');
    fireEvent.click(optionRow('Recently Added'));

    expect(currentUrl()).toBe('/');
  });

  it('shuts the panel once an order is chosen', async () => {
    await renderFilters('/');

    openSort();
    fireEvent.click(optionRow('Year'));

    expect(noOptionRow('Title (A–Z)')).toBeNull();
  });

  it('shows the new order on the pill', async () => {
    await renderFilters('/');

    openSort();
    fireEvent.click(optionRow('Year'));

    expect(pill('Year')).toBeTruthy();
  });

  it('leaves the search text alone — sorting is not a new search', async () => {
    await renderFilters('/?q=lighthouse');

    openSort();
    fireEvent.click(optionRow('Year'));

    const written = new URLSearchParams(String(currentUrl()).split('?')[1]);
    expect(written.get('q')).toBe('lighthouse');
    expect(written.get('sort')).toBe('year');
  });
});

describe('LibraryFilters — from the keyboard', () => {
  it('offers the pill as a real button, so Tab reaches it', async () => {
    await renderFilters('/');

    act(() => pill().focus());

    expect(document.activeElement).toBe(pill());
  });

  it('opens on the pill being activated, onto options that are buttons too', async () => {
    await renderFilters('/');

    openSort();

    for (const [label] of SORT_OPTIONS) {
      expect(optionRow(label).tagName).toBe('BUTTON');
    }
  });

  it('hands focus back to the pill when an order is chosen', async () => {
    // A parent on the keyboard is never dropped at the top of the document.
    await renderFilters('/');

    openSort();
    fireEvent.click(optionRow('Year'));

    expect(document.activeElement).toBe(pill('Year'));
  });

  it('closes on Escape, with focus back on the pill', async () => {
    await renderFilters('/');

    openSort();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(noOptionRow('Year')).toBeNull();
    expect(document.activeElement).toBe(pill());
  });

  it('leaves the order alone when the panel is dismissed rather than used', async () => {
    await renderFilters('/');

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
  it('shows “All Genres” on a clean “/”, so the way out is already visible', async () => {
    await renderFilters('/');

    expect(genrePill().textContent).toContain('All Genres');
  });

  it('says “Genre”, so the pill is not a value with no subject', async () => {
    await renderFilters('/');

    expect(genrePill().textContent).toContain('Genre');
  });

  it('shows the genre the URL is carrying', async () => {
    // A shared or bookmarked link opens with the pill already saying so.
    await renderFilters('/?genre=Drama');

    expect(genrePill('Drama')).toBeTruthy();
  });

  it('shows a genre name the URL had to encode', async () => {
    await renderFilters('/?genre=Science%20Fiction');

    expect(genrePill('Science Fiction')).toBeTruthy();
  });

  it('lists nothing until it is opened', async () => {
    await renderFilters('/');

    await waitFor(() => expect(genreRequests()).toHaveLength(1));
    expect(noOptionRow('Drama')).toBeNull();
  });

  it('renders before the list has arrived rather than waiting for it', async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));

    await renderFilters('/');

    expect(genrePill()).toBeTruthy();
  });
});

describe('LibraryFilters — the genre list', () => {
  it('lists “All Genres” first, then the genres by count, most first', async () => {
    await renderFilters('/');

    const control = await openGenre();

    expect(panelRowLabels(control)).toEqual(GENRE_ROWS);
  });

  it('shows each genre’s count beside it', async () => {
    await renderFilters('/');

    await openGenre();

    // The count is chrome, not part of the row's name — the row is still
    // "Drama" to a screen reader, and the tally is beside it.
    expect(optionRow('Drama').textContent).toContain('12');
    expect(optionRow('Action').textContent).toContain('9');
  });

  it('shows the library total beside “All Genres”', async () => {
    await renderFilters('/');

    await openGenre();

    // 9 + 4 + 12 + 4 is 29; the library holds 24, because movies are tagged
    // more than once. The total is a count of movies.
    expect(optionRow('All Genres').textContent).toContain('24');
  });

  it('ticks “All Genres” when no genre is set', async () => {
    await renderFilters('/');

    await openGenre();

    expect(optionRow('All Genres').getAttribute('aria-current')).toBe('true');
  });

  it('ticks the genre the screen is filtered to, and only that one', async () => {
    await renderFilters('/?genre=Drama');

    const control = await openGenre('Drama');

    const ticked = within(control.parentElement as HTMLElement)
      .getAllByRole('menuitem')
      .filter((row) => row.getAttribute('aria-current') === 'true');
    expect(ticked).toHaveLength(1);
    expect(ticked[0].textContent).toContain('Drama');
  });

  it('asks for the list once, and not again as the query changes', async () => {
    await renderFilters('/');
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
    await renderFilters('/');

    await openGenre();
    fireEvent.click(optionRow('Drama'));

    expect(currentUrl()).toBe('/?genre=Drama');
  });

  it('takes the parameter back off the URL for “All Genres”', async () => {
    await renderFilters('/?genre=Drama');

    await openGenre('Drama');
    fireEvent.click(optionRow('All Genres'));

    expect(currentUrl()).toBe('/');
  });

  it('shuts the panel once a genre is chosen', async () => {
    await renderFilters('/');

    await openGenre();
    fireEvent.click(optionRow('Drama'));

    expect(noOptionRow('Action')).toBeNull();
  });

  it('shows the new genre on the pill', async () => {
    await renderFilters('/');

    await openGenre();
    fireEvent.click(optionRow('Drama'));

    expect(genrePill('Drama')).toBeTruthy();
  });

  it('replaces the genre rather than stacking a second one', async () => {
    await renderFilters('/?genre=Drama');

    await openGenre('Drama');
    fireEvent.click(optionRow('Action'));

    expect(currentUrl()).toBe('/?genre=Action');
  });

  it('leaves the search text and the order alone', async () => {
    await renderFilters('/?q=lighthouse&sort=a-z');

    await openGenre();
    fireEvent.click(optionRow('Drama'));

    const written = new URLSearchParams(String(currentUrl()).split('?')[1]);
    expect(written.get('q')).toBe('lighthouse');
    expect(written.get('sort')).toBe('a-z');
    expect(written.get('genre')).toBe('Drama');
  });

  it('hands focus back to the pill, so the keyboard is never dropped', async () => {
    await renderFilters('/');

    await openGenre();
    fireEvent.click(optionRow('Drama'));

    expect(document.activeElement).toBe(genrePill('Drama'));
  });

  it('leaves the genre alone when the panel is dismissed rather than used', async () => {
    await renderFilters('/');

    await openGenre();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(currentUrl()).toBe('/');
    expect(noOptionRow('Drama')).toBeNull();
  });
});

describe('LibraryFilters — two pills in one header', () => {
  it('opens the genre panel and the sort panel one at a time', async () => {
    await renderFilters('/');

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

  it('shows both pills with what the URL says, without either reading the other', async () => {
    await renderFilters('/?genre=Drama&sort=year');

    expect(genrePill('Drama')).toBeTruthy();
    expect(pill('Year')).toBeTruthy();
  });
});

describe('LibraryFilters — when the genre list cannot be loaded', () => {
  it('offers “All Genres” alone rather than an empty panel', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await renderFilters('/');

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
    await renderFilters('/');
    await waitFor(() => expect(genreRequests()).toHaveLength(1));

    openSort();
    fireEvent.click(optionRow('Year'));

    expect(currentUrl()).toBe('/?sort=year');
  });

  it('still shows a genre the URL is carrying on the pill', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await renderFilters('/?genre=Drama');

    await waitFor(() => expect(genreRequests()).toHaveLength(1));
    expect(genrePill('Drama')).toBeTruthy();
  });
});

// --- 05 — Search + filter, Phase 5: "the Rating dropdown" (issue #37) ---------

/** The panel's rows in the prototype's order (`FamilyFlix.dc.html:162`). */
const RATING_ROWS = ['All ratings', '4+ stars', '3+ stars', '2+ stars'];

/** The rows paired with the minimum each one writes, in stored half-star units. */
const RATING_OPTIONS = [
  ['4+ stars', '8'],
  ['3+ stars', '6'],
  ['2+ stars', '4'],
] as const;

/**
 * The rating pill, found by the name it announces. There is no caption on
 * screen to find it by — the accessible name is the only name it has.
 */
const ratingPill = (value = 'All ratings') =>
  screen.getByRole('button', { name: `Minimum rating: ${value}` });

/** Opens it the way a keyboard user does — focus the pill, then activate it. */
function openRating(value?: string) {
  const control = ratingPill(value);
  act(() => control.focus());
  fireEvent.click(control);
  return control;
}

/** The header's pills in the order the document holds them. */
function headerPillOrder(): string[] {
  return screen
    .getAllByRole('button')
    .map((control) => control.getAttribute('aria-label') ?? '')
    .filter((name) => /^(Genre|Minimum rating|Sort):/.test(name))
    .map((name) => name.split(':')[0]);
}

describe('LibraryFilters — the rating pill', () => {
  it('shows “All ratings” on a clean “/”, so the way out is already visible', async () => {
    await renderFilters('/');

    expect(ratingPill().textContent).toContain('All ratings');
  });

  it('wears a ★ where the other pills wear a word', async () => {
    await renderFilters('/');

    expect(ratingPill().textContent).toContain('★');
  });

  it('shows no caption on screen, which is what the ★ is standing in for', async () => {
    await renderFilters('/');

    expect(ratingPill().textContent).not.toContain('Minimum rating');
    expect(screen.queryByText('Minimum rating')).toBeNull();
  });

  it('still announces what it filters, so the pill is not a value with no subject', async () => {
    // `showLabel={false}` hides the caption; it never drops it from the name.
    await renderFilters('/?rating=6');

    expect(ratingPill('3+ stars').getAttribute('aria-label')).toBe(
      'Minimum rating: 3+ stars'
    );
  });

  it('shows the minimum the URL is carrying', async () => {
    // A shared or bookmarked link opens with the pill already saying so.
    await renderFilters('/?rating=8');

    expect(ratingPill('4+ stars')).toBeTruthy();
  });

  it('shows “All ratings” for a minimum the dropdown could not have written', async () => {
    // The pill and the rows must agree: a URL the query drops is a filter that
    // is not applied.
    await renderFilters('/?rating=7');

    expect(ratingPill()).toBeTruthy();
  });

  it('sits between the genre and the sort pills, as the prototype draws them', async () => {
    await renderFilters('/');

    expect(headerPillOrder()).toEqual(['Genre', 'Minimum rating', 'Sort']);
  });

  it('lists nothing until it is opened', async () => {
    await renderFilters('/');

    expect(noOptionRow('3+ stars')).toBeNull();
  });
});

describe('LibraryFilters — the rating list', () => {
  it('offers the four cut-offs in order, strongest first under “All ratings”', async () => {
    await renderFilters('/');

    const control = openRating();

    expect(openOptionLabels(control)).toEqual(RATING_ROWS);
  });

  it('writes every cut-off in stars rather than in stored units', async () => {
    await renderFilters('/');

    openRating();

    // Nobody has to know that "3+ stars" is a 6 on the wire.
    expect(noOptionRow('6')).toBeNull();
    expect(optionRow('3+ stars')).toBeTruthy();
  });

  it('shows no tally beside a cut-off, unlike the genre rows', async () => {
    await renderFilters('/');

    const control = openRating();

    for (const row of openOptionLabels(control)) {
      expect(row).not.toMatch(/\d+$/);
    }
  });

  it('marks the cut-off the URL is carrying as the current one', async () => {
    await renderFilters('/?rating=6');

    openRating('3+ stars');

    expect(optionRow('3+ stars').getAttribute('aria-current')).toBe('true');
  });

  it('marks “All ratings” when nothing is filtering', async () => {
    await renderFilters('/');

    openRating();

    expect(optionRow('All ratings').getAttribute('aria-current')).toBe('true');
  });
});

describe('LibraryFilters — choosing a minimum rating', () => {
  it('writes the chosen cut-off into the URL as “rating”', async () => {
    for (const [label, value] of RATING_OPTIONS) {
      const view = await renderFilters('/');

      openRating();
      fireEvent.click(optionRow(label));

      expect(currentUrl()).toBe(`/?rating=${value}`);
      view.unmount();
    }
  });

  it('takes the parameter back off the URL for “All ratings”', async () => {
    await renderFilters('/?rating=8');

    openRating('4+ stars');
    fireEvent.click(optionRow('All ratings'));

    expect(currentUrl()).toBe('/');
  });

  it('shuts the panel once a cut-off is chosen', async () => {
    await renderFilters('/');

    openRating();
    fireEvent.click(optionRow('3+ stars'));

    expect(noOptionRow('2+ stars')).toBeNull();
  });

  it('shows the new cut-off on the pill', async () => {
    await renderFilters('/');

    openRating();
    fireEvent.click(optionRow('3+ stars'));

    expect(ratingPill('3+ stars')).toBeTruthy();
  });

  it('replaces the minimum rather than stacking a second one', async () => {
    await renderFilters('/?rating=8');

    openRating('4+ stars');
    fireEvent.click(optionRow('2+ stars'));

    expect(currentUrl()).toBe('/?rating=4');
  });

  it('leaves the search text, the genre and the order alone', async () => {
    // "Highest rated comedies" is one question, not two.
    await renderFilters('/?q=lighthouse&genre=Comedy&sort=highest-rated');

    openRating();
    fireEvent.click(optionRow('4+ stars'));

    const written = new URLSearchParams(String(currentUrl()).split('?')[1]);
    expect(written.get('q')).toBe('lighthouse');
    expect(written.get('genre')).toBe('Comedy');
    expect(written.get('sort')).toBe('highest-rated');
    expect(written.get('rating')).toBe('8');
  });
});

describe('LibraryFilters — the rating pill from the keyboard', () => {
  it('offers the pill as a real button, so Tab reaches it', async () => {
    await renderFilters('/');

    act(() => ratingPill().focus());

    expect(document.activeElement).toBe(ratingPill());
  });

  it('opens on the pill being activated, onto options that are buttons too', async () => {
    await renderFilters('/');

    openRating();

    for (const label of RATING_ROWS) {
      expect(optionRow(label).tagName).toBe('BUTTON');
    }
  });

  it('hands focus back to the pill when a cut-off is chosen', async () => {
    await renderFilters('/');

    openRating();
    fireEvent.click(optionRow('3+ stars'));

    expect(document.activeElement).toBe(ratingPill('3+ stars'));
  });

  it('closes on Escape, with focus back on the pill and the URL untouched', async () => {
    await renderFilters('/');

    openRating();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(noOptionRow('3+ stars')).toBeNull();
    expect(document.activeElement).toBe(ratingPill());
    expect(currentUrl()).toBe('/');
  });
});

describe('LibraryFilters — three pills in one header', () => {
  it('opens the rating panel and the genre panel one at a time', async () => {
    await renderFilters('/');

    const genre = await openGenre();
    expect(optionRow('Drama')).toBeTruthy();

    const rating = ratingPill();
    act(() => rating.focus());
    fireEvent.pointerDown(rating);
    fireEvent.click(rating);

    // Opening a third pill is a press outside the other two, which is already
    // what shuts them — still no coordinating state anywhere.
    expect(openOptionLabels(genre)).toEqual([]);
    expect(optionRow('3+ stars')).toBeTruthy();
  });

  it('shows all three pills with what the URL says, without any reading another', async () => {
    await renderFilters('/?genre=Drama&sort=year&rating=6');

    expect(genrePill('Drama')).toBeTruthy();
    expect(ratingPill('3+ stars')).toBeTruthy();
    expect(pill('Year')).toBeTruthy();
  });

  it('keeps working when the genre list cannot be loaded', async () => {
    // The genre list has no error state by design; its failure must not take
    // the rating filter down with it.
    fetchMock.mockRejectedValue(new Error('offline'));
    await renderFilters('/');

    openRating();
    fireEvent.click(optionRow('4+ stars'));

    expect(currentUrl()).toBe('/?rating=8');
  });
});
