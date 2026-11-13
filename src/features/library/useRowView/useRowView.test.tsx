import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useRowView } from './useRowView';
import { DisplayPreferenceProvider } from '@/App/DisplayPreferenceProvider/DisplayPreferenceProvider';
import { useDisplayPreference } from '@/App/useDisplayPreference/useDisplayPreference';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { makeSettings } from '@/test-support/makeSettings/makeSettings';

/**
 * 63, Row view, Phase 2 (issue #609): `useRowView()` reads the current
 * **Library tab** off the URL and answers that tab's **Row view** and a setter
 * for it alone, so neither the switch nor the body knows there are two
 * settings. Asserted under the real provider over a stubbed `fetch`.
 */

const SETTINGS_ROUTE = '/api/settings';
const MOVIE_ROW_VIEW_ROUTE = '/api/settings/movie-row-view';
const SERIES_ROW_VIEW_ROUTE = '/api/settings/series-row-view';

/** Movies All, Series By genre: the two differ, so a mix-up shows. */
const STORED = makeSettings({ movieRowView: 'all', seriesRowView: 'genre' });

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
      return Promise.resolve(okResponse(STORED));
    }
    const body = JSON.parse(String(init?.body)) as { value: unknown };
    return Promise.resolve(okResponse({ value: body.value }));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The values posted to one route so far. */
function postedTo(route: string): unknown[] {
  return fetchMock.mock.calls
    .filter(
      ([input, init]) => String(input) === route && init?.method === 'POST'
    )
    .map(
      ([, init]) => (JSON.parse(String(init?.body)) as { value: unknown }).value
    );
}

/** The hook at `url`, beside the provider's two raw values, once landed. */
async function renderAt(url: string) {
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[url]}>
        <DisplayPreferenceProvider>{children}</DisplayPreferenceProvider>
      </MemoryRouter>
    );
  }
  const rendered = renderHook(
    () => ({ ...useRowView(), preference: useDisplayPreference() }),
    { wrapper }
  );
  await waitFor(() => expect(rendered.result.current.rowView).not.toBeNull());
  return rendered;
}

describe('useRowView: the current tab’s view', () => {
  it('is null until the settings read lands', () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));

    const { result } = renderHook(() => useRowView(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <MemoryRouter initialEntries={['/']}>
          <DisplayPreferenceProvider>{children}</DisplayPreferenceProvider>
        </MemoryRouter>
      ),
    });

    expect(result.current.rowView).toBeNull();
  });

  it('answers Movies’ view under Movies', async () => {
    const { result } = await renderAt('/');

    expect(result.current.rowView).toBe('all');
  });

  it('answers Series’ view under Series', async () => {
    const { result } = await renderAt('/?tab=series');

    expect(result.current.rowView).toBe('genre');
  });
});

describe('useRowView: the setter sets the current tab’s alone', () => {
  it('under Movies, sets and posts Movies’ view and leaves Series’', async () => {
    const { result } = await renderAt('/');

    await act(async () => {
      await result.current.setRowView('genre');
    });

    expect(result.current.rowView).toBe('genre');
    expect(result.current.preference.movieRowView).toBe('genre');
    expect(result.current.preference.seriesRowView).toBe('genre');
    expect(postedTo(MOVIE_ROW_VIEW_ROUTE)).toEqual(['genre']);
    expect(postedTo(SERIES_ROW_VIEW_ROUTE)).toEqual([]);
  });

  it('under Series, sets and posts Series’ view and leaves Movies’', async () => {
    const { result } = await renderAt('/?tab=series');

    await act(async () => {
      await result.current.setRowView('all');
    });

    expect(result.current.rowView).toBe('all');
    expect(result.current.preference.seriesRowView).toBe('all');
    expect(result.current.preference.movieRowView).toBe('all');
    expect(postedTo(SERIES_ROW_VIEW_ROUTE)).toEqual(['all']);
    expect(postedTo(MOVIE_ROW_VIEW_ROUTE)).toEqual([]);
  });
});
