import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, act, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useQueryParamWriter } from './useQueryParamWriter';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';

function currentUrl() {
  return screen.getByTestId('url').textContent;
}

function writtenParams() {
  return new URLSearchParams(String(currentUrl()).split('?')[1]);
}

function goBack() {
  act(() => {
    screen.getByRole('button', { name: 'Back' }).click();
  });
}

/** Mount the hook on a given URL, with the probe watching alongside it. */
function mountOn(entries: string[] = ['/']) {
  return renderHook(() => useQueryParamWriter(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        {children}
        <LocationProbe withBack />
      </MemoryRouter>
    ),
  });
}

describe('useQueryParamWriter — writing a value', () => {
  it('writes a name and value onto a URL that carried no query string', () => {
    const { result } = mountOn(['/']);

    act(() => result.current('q', 'lighthouse', ''));

    expect(currentUrl()).toBe('/?q=lighthouse');
  });

  it('replaces the value of a name the URL already carries, rather than stacking a second', () => {
    const { result } = mountOn(['/?sort=a-z']);

    act(() => result.current('sort', 'year', 'recently-added'));

    expect(currentUrl()).toBe('/?sort=year');
  });

  it('leaves the path exactly as it found it', () => {
    // The writer is handed a name, a value and a value to omit at, and knows
    // nothing else — least of all which screen it is writing for.
    const { result } = mountOn(['/genre/Drama']);

    act(() => result.current('q', 'comet', ''));

    expect(currentUrl()).toBe('/genre/Drama?q=comet');
  });

  it('encodes a value that would otherwise break the URL', () => {
    const { result } = mountOn(['/']);

    act(() => result.current('q', 'comet & season', ''));

    expect(String(currentUrl())).not.toContain('comet & season');
    expect(writtenParams().get('q')).toBe('comet & season');
  });
});

describe('useQueryParamWriter — omitting at the value the caller names', () => {
  it('removes the parameter when the value is the one to omit at', () => {
    // A default state is a clean URL — there is no query string to explain.
    const { result } = mountOn(['/?q=lighthouse']);

    act(() => result.current('q', '', ''));

    expect(currentUrl()).toBe('/');
  });

  it('omits at whatever value the caller names, not only the empty string', () => {
    // “Recently added” is the default order and “0” is “All ratings”; both are
    // the absence of the parameter rather than a value of it, and neither is
    // the empty string.
    const { result } = mountOn(['/?sort=a-z&rating=8']);

    act(() => result.current('sort', 'recently-added', 'recently-added'));
    act(() => result.current('rating', '0', '0'));

    expect(currentUrl()).toBe('/');
  });

  it('writes no query string at all when an absent parameter is set to its omit value', () => {
    const { result } = mountOn(['/']);

    act(() => result.current('rating', '0', '0'));

    expect(currentUrl()).toBe('/');
  });
});

describe('useQueryParamWriter — the rest of the query', () => {
  it('leaves every other parameter as it found it when it adds one', () => {
    // This is what lets one screen build four setters on one writer without
    // any of them clobbering the others.
    const { result } = mountOn(['/?genre=Drama&rating=8']);

    act(() => result.current('q', 'lighthouse', ''));

    expect(writtenParams().get('genre')).toBe('Drama');
    expect(writtenParams().get('rating')).toBe('8');
    expect(writtenParams().get('q')).toBe('lighthouse');
  });

  it('leaves every other parameter as it found it when it removes one', () => {
    const { result } = mountOn(['/?q=lighthouse&sort=a-z']);

    act(() => result.current('q', '', ''));

    expect(currentUrl()).toBe('/?sort=a-z');
  });

  it('accumulates across writes, so two names written in turn both survive', () => {
    // Each write copies whatever the URL holds by then, rather than a set of
    // parameters captured when the hook mounted.
    const { result } = mountOn(['/']);

    act(() => result.current('q', 'comet', ''));
    act(() => result.current('sort', 'a-z', 'recently-added'));

    expect(writtenParams().get('q')).toBe('comet');
    expect(writtenParams().get('sort')).toBe('a-z');
  });
});

describe('useQueryParamWriter — what the writes do to history', () => {
  it('replaces rather than stacks, so one Back escapes writes of any number', () => {
    // Fourteen keystrokes must not cost fourteen presses of Back.
    const { result } = mountOn(['/movie/7', '/']);

    act(() => result.current('q', 'light', ''));
    act(() => result.current('q', 'lighthouse', ''));
    act(() => result.current('q', 'lighthouse k', ''));

    expect(currentUrl()).toBe('/?q=lighthouse+k');

    goBack();

    expect(currentUrl()).toBe('/movie/7');
  });

  it('costs no history when the write removes a parameter either', () => {
    const { result } = mountOn(['/movie/7', '/?q=comet']);

    act(() => result.current('q', 'light', ''));
    act(() => result.current('q', '', ''));

    expect(currentUrl()).toBe('/');

    goBack();

    expect(currentUrl()).toBe('/movie/7');
  });
});

describe('useQueryParamWriter — the callback the named setters are built on', () => {
  it('keeps the same callback across a render that did not change the URL', () => {
    // `useSettledText` holds on to a setter built from this one and restarts
    // its 250ms wait whenever that setter changes identity. A writer that came
    // back fresh each render would push the settle back for as long as the
    // screen kept rendering, and the search would never be written at all.
    const { result, rerender } = mountOn(['/genre/Drama']);
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
