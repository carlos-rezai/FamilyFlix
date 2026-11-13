import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { RowViewSwitch } from './RowViewSwitch';
import { DisplayPreferenceProvider } from '@/App/DisplayPreferenceProvider/DisplayPreferenceProvider';
import { theme } from '@/styles/theme';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { makeSettings } from '@/test-support/makeSettings/makeSettings';

/**
 * 63, Row view, Phase 2 (issue #609): the **Row view switch**, a
 * `FilterDropdown` labelled _View_ over `rowViewOptions` and `useRowView`. It
 * shows the current tab's **Row view**, and a choice sets the household's
 * setting and writes no URL: search text, genre, rating and sort all stay.
 */

const SETTINGS_ROUTE = '/api/settings';

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    if (String(input) === SETTINGS_ROUTE) {
      return Promise.resolve(
        okResponse(
          makeSettings({ movieRowView: 'genre', seriesRowView: 'all' })
        )
      );
    }
    const body = JSON.parse(String(init?.body)) as { value: unknown };
    return Promise.resolve(okResponse({ value: body.value }));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function UrlProbe() {
  const location = useLocation();
  return (
    <div data-testid="url">{`${location.pathname}${location.search}`}</div>
  );
}

const currentUrl = () => screen.getByTestId('url').textContent;

async function renderSwitch(url = '/') {
  const view = render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider theme={theme}>
        <DisplayPreferenceProvider>
          <RowViewSwitch />
          <UrlProbe />
        </DisplayPreferenceProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
  await act(async () => undefined);
  return view;
}

/** The pill, found by the name it announces. */
const pill = (value: string) =>
  screen.getByRole('button', { name: `View: ${value}` });

function choose(pillValue: string, row: string) {
  const control = pill(pillValue);
  act(() => control.focus());
  fireEvent.click(control);
  fireEvent.click(screen.getByRole('menuitem', { name: row }));
}

describe('RowViewSwitch: what it shows', () => {
  it('is named View and shows Movies’ view under Movies', async () => {
    await renderSwitch('/');

    expect(
      await screen.findByRole('button', { name: 'View: By genre' })
    ).toBeDefined();
  });

  it('shows Series’ view under Series', async () => {
    await renderSwitch('/?tab=series');

    expect(
      await screen.findByRole('button', { name: 'View: All' })
    ).toBeDefined();
  });

  it('draws its caption, View, on the pill', async () => {
    await renderSwitch('/');

    const control = await screen.findByRole('button', {
      name: 'View: By genre',
    });
    expect(control.textContent).toContain('View');
  });

  it('marks the current view as the chosen row', async () => {
    await renderSwitch('/');
    const control = await screen.findByRole('button', {
      name: 'View: By genre',
    });

    act(() => control.focus());
    fireEvent.click(control);

    expect(
      screen
        .getByRole('menuitem', { name: 'By genre' })
        .getAttribute('aria-current')
    ).toBeTruthy();
    expect(
      screen.getByRole('menuitem', { name: 'All' }).getAttribute('aria-current')
    ).toBeNull();
  });
});

describe('RowViewSwitch: a choice', () => {
  it('shows the chosen view at once', async () => {
    await renderSwitch('/');
    await screen.findByRole('button', { name: 'View: By genre' });

    choose('By genre', 'All');

    expect(
      await screen.findByRole('button', { name: 'View: All' })
    ).toBeDefined();
  });

  it('writes no URL: search text, genre, rating and sort all stay', async () => {
    const url = '/?tab=series&q=harbor&genre=Drama&rating=6&sort=year';
    await renderSwitch(url);
    await screen.findByRole('button', { name: 'View: All' });

    choose('All', 'By genre');

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'View: By genre' })
      ).toBeDefined()
    );
    expect(currentUrl()).toBe(url);
  });

  it('writes no URL on the Movies tab either, not even a tab', async () => {
    await renderSwitch('/?q=north');
    await screen.findByRole('button', { name: 'View: By genre' });

    choose('By genre', 'All');

    await screen.findByRole('button', { name: 'View: All' });
    expect(currentUrl()).toBe('/?q=north');
  });
});
