import { describe, it, expect } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { LibraryTabs } from './LibraryTabs';
import { theme } from '@/styles/theme';
import {
  LocationProbe,
  navigationType,
  search,
} from '@/test-support/LocationProbe/LocationProbe';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';

/**
 * 22 — Series (TV), Phase 1 (issue #190): the Movies / Series switch.
 *
 * `LibraryTabs` is the prototype's pill track, first in the library header's
 * start slot: two buttons in a group named _Library_, the active one on the
 * accent pill and carrying `aria-pressed`. It reads and writes `tab` on the
 * URL through the existing query-param writer — a `replace`, omitted at
 * `movies` — and a switch clears the search while keeping genre, rating and
 * sort.
 */

function renderTabs(url = '/') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider theme={theme}>
        <LibraryTabs />
      </ThemeProvider>
      <LocationProbe />
    </MemoryRouter>
  );
}

const group = () => screen.getByRole('group', { name: 'Library' });
const tab = (name: 'Movies' | 'Series') =>
  within(group()).getByRole('button', { name });

function press(name: 'Movies' | 'Series') {
  act(() => {
    tab(name).click();
  });
}

/** The URL's query, parsed — order-free, so the assertion is about content. */
function params(): URLSearchParams {
  return new URLSearchParams(search() ?? '');
}

describe('LibraryTabs — the switch', () => {
  it('draws Movies and Series as two buttons in a group named Library', () => {
    renderTabs();

    expect(
      within(group())
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['Movies', 'Series']);
  });

  it('marks Movies as the pressed tab on a URL that names none', () => {
    renderTabs('/');

    expect(tab('Movies').getAttribute('aria-pressed')).toBe('true');
    expect(tab('Series').getAttribute('aria-pressed')).toBe('false');
  });

  it('marks Series as the pressed tab at tab=series', () => {
    renderTabs('/?tab=series');

    expect(tab('Series').getAttribute('aria-pressed')).toBe('true');
    expect(tab('Movies').getAttribute('aria-pressed')).toBe('false');
  });

  it('writes tab=series as a replace when Series is pressed', () => {
    renderTabs('/');

    press('Series');

    expect(params().get('tab')).toBe('series');
    expect(navigationType()).toBe('REPLACE');
    expect(tab('Series').getAttribute('aria-pressed')).toBe('true');
  });

  it('takes tab back off the URL, as a replace, when Movies is pressed', () => {
    renderTabs('/?tab=series');

    press('Movies');

    expect(search()).toBe('');
    expect(navigationType()).toBe('REPLACE');
    expect(tab('Movies').getAttribute('aria-pressed')).toBe('true');
  });

  it('clears the search and keeps genre, rating and sort across a switch', () => {
    renderTabs('/?q=harbor&genre=Drama&rating=6&sort=title');

    press('Series');

    const written = params();
    expect(written.get('tab')).toBe('series');
    expect(written.has('q')).toBe(false);
    expect(written.get('genre')).toBe('Drama');
    expect(written.get('rating')).toBe('6');
    expect(written.get('sort')).toBe('title');
  });

  it('clears the search on the way back to Movies too', () => {
    renderTabs('/?tab=series&q=harbor&genre=Drama');

    press('Movies');

    const written = params();
    expect(written.has('tab')).toBe(false);
    expect(written.has('q')).toBe(false);
    expect(written.get('genre')).toBe('Drama');
  });
});

/**
 * The active tab's pill is the accent, as `FamilyFlix.dc.html`'s `tabStyle`
 * draws it; the resting one is transparent. Each tab is a **Control** on
 * `controlStates` — the Press in 60ms and the Focus ring under Tab.
 */
describe('LibraryTabs — the pill track and its Control states', () => {
  const c = theme.colors;

  it('fills the active tab with the accent and leaves the other transparent', () => {
    renderTabs('/?tab=series');

    expect(resolvedStyle(tab('Series')).background).toBe(normCss(c.accent));
    expect(resolvedStyle(tab('Movies')).background).toBe('transparent');
  });

  it('presses a tab down in 60ms, as every Control does', () => {
    renderTabs('/');

    const pressed = resolvedStyle(tab('Series'), { hover: true, active: true });

    expect(pressed['transition-duration']).toBe('60ms');
    expect(pressed.transform).toBeDefined();
  });

  it('draws the accent Focus ring under Tab, and none for a click', () => {
    renderTabs('/');

    const series = tab('Series');
    expect(resolvedStyle(series, { focusVisible: true })['box-shadow']).toBe(
      normCss(`0 0 0 3px ${c.focusRing}`)
    );
    expect(resolvedStyle(series, { focus: true })).toEqual(
      resolvedStyle(series)
    );
  });
});
