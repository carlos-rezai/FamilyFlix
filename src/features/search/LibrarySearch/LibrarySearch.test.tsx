import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';

import { LibrarySearch } from './LibrarySearch';
import { theme } from '@/styles/theme';

/** How long the typing has to stop for before the URL is written. */
const DEBOUNCE_MS = 250;

/**
 * Every URL the router has been at since the test began, in order. It is the
 * only way to see how *many* times the query was written — a replaced entry
 * leaves no trace in history, and "written once" is the claim being made.
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

function renderSearch(entries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <ThemeProvider theme={theme}>
        <LibrarySearch />
      </ThemeProvider>
      <UrlProbe />
    </MemoryRouter>
  );
}

/** The search box, found the way a parent finds it — by the name it announces. */
function box() {
  return screen.getByRole('textbox', {
    name: 'Search your movies',
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

describe('LibrarySearch — what the box shows', () => {
  it('starts empty on an unfiltered home', () => {
    renderSearch(['/']);

    expect(box().value).toBe('');
  });

  it('opens filled from the URL, so a shared or bookmarked search reads back', () => {
    renderSearch(['/?q=lighthouse']);

    expect(box().value).toBe('lighthouse');
  });

  it('keeps up with the typing, showing each keystroke before anything is written', () => {
    // The field must never feel like it is lagging behind the parent, so the
    // debounce holds back the URL and never the box.
    renderSearch(['/']);

    type('l');
    expect(box().value).toBe('l');

    type('li');
    expect(box().value).toBe('li');

    type('lig');
    expect(box().value).toBe('lig');

    expect(currentUrl()).toBe('/');
  });
});

describe('LibrarySearch — when the query is written', () => {
  it('writes nothing while the typing is still going', () => {
    renderSearch(['/']);

    type('lighthouse');
    wait(DEBOUNCE_MS - 1);

    expect(currentUrl()).toBe('/');
  });

  it('writes the term once the typing has stopped', () => {
    renderSearch(['/']);

    type('lighthouse');
    wait(DEBOUNCE_MS);

    expect(currentUrl()).toBe('/?q=lighthouse');
  });

  it('writes once for a burst of typing, not once per keystroke', () => {
    // Ten keystrokes, one settled query — nothing downstream ever sees “l”,
    // “li” or “lig”, so the rows are not re-fetched nine times for nothing.
    renderSearch(['/']);

    'lighthouse'.split('').forEach((_, index) => {
      type('lighthouse'.slice(0, index + 1));
      wait(50);
    });
    wait(DEBOUNCE_MS);

    expect(urlLog).toEqual(['/', '/?q=lighthouse']);
  });

  it('writes again when the typing resumes after it had settled', () => {
    renderSearch(['/']);

    type('comet');
    wait(DEBOUNCE_MS);
    type('comets');
    wait(DEBOUNCE_MS);

    expect(urlLog).toEqual(['/', '/?q=comet', '/?q=comets']);
  });

  it('writes a term with a space in it so the URL carries it back intact', () => {
    renderSearch(['/']);

    type('comet season');
    wait(DEBOUNCE_MS);

    const written = new URLSearchParams(String(currentUrl()).split('?')[1]);
    expect(written.get('q')).toBe('comet season');
  });

  it('takes the query back off the URL when the box is cleared', () => {
    // An unfiltered home is a clean “/” — never “/?q=”.
    renderSearch(['/?q=lighthouse']);

    type('');
    wait(DEBOUNCE_MS);

    expect(currentUrl()).toBe('/');
  });
});

describe('LibrarySearch — the search and the Back button', () => {
  it('returns to the filtered view, box still filled, when a movie is closed', () => {
    renderSearch(['/']);

    type('lighthouse');
    wait(DEBOUNCE_MS);

    press('Open movie');
    expect(currentUrl()).toBe('/movie/a1');

    press('Back');

    expect(currentUrl()).toBe('/?q=lighthouse');
    expect(box().value).toBe('lighthouse');
  });

  it('costs no history, so one press of Back escapes a search of any length', () => {
    // Fourteen keystrokes settling five times must still be one press of Back
    // to get out of — the whole point of replacing rather than stacking.
    renderSearch(['/']);

    ['l', 'ligh', 'lighth', 'lighthouse', 'lighthousekeep'].forEach((term) => {
      type(term);
      wait(DEBOUNCE_MS);
    });

    press('Open movie');
    press('Back');
    expect(currentUrl()).toBe('/?q=lighthousekeep');

    // Nothing of the abandoned terms is left behind to walk back through.
    press('Back');
    expect(currentUrl()).toBe('/?q=lighthousekeep');
  });
});
