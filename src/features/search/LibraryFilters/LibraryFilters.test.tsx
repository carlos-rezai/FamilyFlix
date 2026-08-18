import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

/** The panel's rows in the order they are drawn; the pill is the first button. */
function openOptionLabels(): string[] {
  return screen
    .getAllByRole('button')
    .slice(1, 1 + SORT_OPTIONS.length)
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
