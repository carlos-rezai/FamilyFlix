import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { GenreControls } from './GenreControls';
import { theme } from '@/styles/theme';

/** How long the typing has to stop for before the URL is written. */
const DEBOUNCE_MS = 250;

/**
 * The prototype's option list, in the prototype's order — deliberately not the
 * declaration order of `MovieSort` — paired with the slug each one writes. The
 * genre header offers the same five as the home, so there is no second
 * vocabulary to learn on the way into a genre.
 */
const SORT_OPTIONS = [
  ['Recently Added', 'recently-added'],
  ['Title (A–Z)', 'a-z'],
  ['Year', 'year'],
  ['Unwatched First', 'unwatched-first'],
  ['Highest Rated', 'highest-rated'],
] as const;

/**
 * Every URL the router has been at since the test began, in order. It is the
 * only way to see how *many* times the query was written — a replaced entry
 * leaves no trace in history, and “written once” is the claim being made.
 */
let urlLog: string[] = [];

function UrlProbe() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    urlLog.push(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return (
    <>
      <div data-testid="url">{`${location.pathname}${location.search}`}</div>
      <button type="button" onClick={() => navigate('/genre/Action')}>
        Open genre
      </button>
      <button type="button" onClick={() => navigate('/movie/a1')}>
        Open movie
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
    </>
  );
}

beforeEach(() => {
  urlLog = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * The controls mounted on the genre route, with the home and a movie routed
 * beside them, so arriving and leaving are real navigations rather than a
 * remount at a different address.
 */
function renderControls(entries: string[] = ['/genre/Action']) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<span>Browse home</span>} />
          <Route path="/genre/:name" element={<GenreControls />} />
          <Route path="/movie/:id" element={<span>Movie</span>} />
        </Routes>
      </ThemeProvider>
      <UrlProbe />
    </MemoryRouter>
  );
}

/** The search box, found the way a parent finds it — by the name it announces. */
function box(genre = 'Action') {
  return screen.getByRole('textbox', {
    name: `Search in ${genre}`,
  }) as HTMLInputElement;
}

function type(value: string) {
  fireEvent.change(box(), { target: { value } });
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function currentUrl() {
  return screen.getByTestId('url').textContent;
}

function press(name: string) {
  act(() => {
    screen.getByRole('button', { name }).click();
  });
}

/** The sort pill, found by the name it announces. */
const pill = (value = 'Recently Added') =>
  screen.getByRole('button', { name: `Sort: ${value}` });

/** Opens it the way a keyboard user does — focus the pill, then activate it. */
function openSort(value?: string) {
  const control = pill(value);
  act(() => control.focus());
  fireEvent.click(control);
  return control;
}

/**
 * The rows of the open panel, in the order they are drawn. Scoped to the pill's
 * own slot, which holds the trigger and its panel and nothing else.
 */
function openOptionLabels(trigger: HTMLElement = pill()): string[] {
  return within(trigger.parentElement as HTMLElement)
    .queryAllByRole('menuitem')
    .map((row) => row.textContent ?? '');
}

function chooseSort(label: string, from?: string) {
  openSort(from);
  act(() => {
    screen.getByRole('menuitem', { name: label }).click();
  });
}

describe('GenreControls — the search box', () => {
  it('is labelled with the genre it searches inside', () => {
    // “Search in Action”, not “Search your movies”: this box narrows one shelf,
    // and the caption is the only thing on screen that says so.
    renderControls(['/genre/Action']);

    expect(box()).toBeTruthy();
  });

  it('names a genre whose name has a space in it, decoded', () => {
    renderControls(['/genre/Science%20Fiction']);

    expect(box('Science Fiction')).toBeTruthy();
  });

  it('starts empty on a plain genre page', () => {
    renderControls(['/genre/Action']);

    expect(box().value).toBe('');
  });

  it('starts empty even when the home was carrying a search', () => {
    // A fresh, narrower search: the home's term does not follow the parent into
    // the genre, so the shelf they asked to see whole opens whole.
    renderControls(['/?q=lighthouse']);

    press('Open genre');

    expect(box().value).toBe('');
    expect(currentUrl()).toBe('/genre/Action');
  });

  it('opens filled from the URL, so a shared or bookmarked search reads back', () => {
    renderControls(['/genre/Action?q=north']);

    expect(box().value).toBe('north');
  });

  it('keeps up with the typing, showing each keystroke before anything is written', () => {
    renderControls(['/genre/Action']);

    type('n');
    expect(box().value).toBe('n');

    type('no');
    expect(box().value).toBe('no');

    type('nor');
    expect(box().value).toBe('nor');

    expect(currentUrl()).toBe('/genre/Action');
  });
});

describe('GenreControls — when the query is written', () => {
  it('writes nothing while the typing is still going', () => {
    renderControls(['/genre/Action']);

    type('northwind');
    wait(DEBOUNCE_MS - 1);

    expect(currentUrl()).toBe('/genre/Action');
  });

  it('writes the term once the typing has stopped', () => {
    renderControls(['/genre/Action']);

    type('northwind');
    wait(DEBOUNCE_MS);

    expect(currentUrl()).toBe('/genre/Action?q=northwind');
  });

  it('writes once for a burst of typing, not once per keystroke', () => {
    // Nine keystrokes, one settled query — the grid follows the typing shortly
    // after it stops rather than thrashing through it.
    renderControls(['/genre/Action']);

    'northwind'.split('').forEach((_, index) => {
      type('northwind'.slice(0, index + 1));
      wait(50);
    });
    wait(DEBOUNCE_MS);

    expect(urlLog).toEqual(['/genre/Action', '/genre/Action?q=northwind']);
  });

  it('takes the query back off the URL when the box is cleared', () => {
    // An unnarrowed genre is a clean “/genre/Action” — never “/genre/Action?q=”.
    renderControls(['/genre/Action?q=north']);

    type('');
    wait(DEBOUNCE_MS);

    expect(currentUrl()).toBe('/genre/Action');
  });

  it('writes a term with a space in it so the URL carries it back intact', () => {
    renderControls(['/genre/Action']);

    type('comet season');
    wait(DEBOUNCE_MS);

    const written = new URLSearchParams(String(currentUrl()).split('?')[1]);
    expect(written.get('q')).toBe('comet season');
  });

  it('resets the box when the settled query changes underneath it', () => {
    renderControls(['/genre/Action?q=north']);

    type('northwind');
    press('Open movie');
    press('Back');

    expect(currentUrl()).toBe('/genre/Action?q=north');
    expect(box().value).toBe('north');
  });

  it('costs no history, so one press of Back escapes a search of any length', () => {
    renderControls(['/genre/Action']);

    ['n', 'nor', 'north', 'northwind'].forEach((term) => {
      type(term);
      wait(DEBOUNCE_MS);
    });

    press('Open movie');
    press('Back');
    expect(currentUrl()).toBe('/genre/Action?q=northwind');

    // Nothing of the abandoned terms is left behind to walk back through.
    press('Back');
    expect(currentUrl()).toBe('/genre/Action?q=northwind');
  });
});

describe('GenreControls — the sort pill', () => {
  it('shows the order a plain genre page is already in', () => {
    renderControls(['/genre/Action']);

    expect(pill('Recently Added').textContent).toContain('Recently Added');
  });

  it('shows the order the URL is carrying', () => {
    renderControls(['/genre/Action?sort=highest-rated']);

    expect(pill('Highest Rated')).toBeTruthy();
  });

  it('names every order the way the prototype writes it', () => {
    for (const [label, slug] of SORT_OPTIONS) {
      const view = renderControls([`/genre/Action?sort=${slug}`]);

      expect(pill(label)).toBeTruthy();

      view.unmount();
    }
  });

  it('says “Sort”, so the pill is not a value with no subject', () => {
    renderControls(['/genre/Action']);

    expect(pill().textContent).toContain('Sort');
  });

  it('lists the same five orders as the home, in the prototype’s order', () => {
    renderControls(['/genre/Action']);

    openSort();

    expect(openOptionLabels()).toEqual(SORT_OPTIONS.map(([label]) => label));
  });

  it('writes the order the chosen row stands for', () => {
    renderControls(['/genre/Action']);

    chooseSort('Title (A–Z)');

    expect(currentUrl()).toBe('/genre/Action?sort=a-z');
  });

  it('takes the parameter back off when the default order is chosen again', () => {
    renderControls(['/genre/Action?sort=a-z']);

    chooseSort('Recently Added', 'Title (A–Z)');

    expect(currentUrl()).toBe('/genre/Action');
  });
});

describe('GenreControls — the two controls together', () => {
  it('leaves the search alone when a new order is chosen', () => {
    renderControls(['/genre/Action?q=north']);

    chooseSort('Year');

    const written = new URLSearchParams(String(currentUrl()).split('?')[1]);
    expect(written.get('q')).toBe('north');
    expect(written.get('sort')).toBe('year');
  });

  it('leaves the order alone when the search settles', () => {
    renderControls(['/genre/Action?sort=a-z']);

    type('northwind');
    wait(DEBOUNCE_MS);

    const written = new URLSearchParams(String(currentUrl()).split('?')[1]);
    expect(written.get('sort')).toBe('a-z');
    expect(written.get('q')).toBe('northwind');
    expect(pill('Title (A–Z)')).toBeTruthy();
  });

  it('costs no history when the order is changed either', () => {
    renderControls(['/genre/Action']);

    chooseSort('Year');
    chooseSort('Highest Rated', 'Year');

    press('Open movie');
    press('Back');
    expect(currentUrl()).toBe('/genre/Action?sort=highest-rated');

    press('Back');
    expect(currentUrl()).toBe('/genre/Action?sort=highest-rated');
  });
});
