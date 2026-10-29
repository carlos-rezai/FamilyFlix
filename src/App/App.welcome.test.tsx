import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import App from './App';
import type { HomePayload, Movie } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { makeSettings } from '@/test-support/makeSettings/makeSettings';

/**
 * 55, Intro animation, Phase 2 (issue #504): the welcome in the route table.
 *
 * `WelcomeProvider` is mounted in `App` inside the **Snackbar stack**, around
 * the routes: on a **Cold start** the **Welcome splash** is drawn while the
 * routes are already mounted beneath it in the **Home layer**, so the header
 * is there to land on.
 */

const NORTHWIND: Movie = makeMovie({ id: 'a1', title: 'Northwind' });

beforeEach(() => {
  sessionStorage.clear();
  const fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url === '/api/settings') {
      return Promise.resolve(okResponse(makeSettings()));
    }
    if (url.includes('/api/home')) {
      const payload: HomePayload = {
        continueWatching: [],
        favorites: [],
        rows: [{ genre: 'Action', count: 1, movies: [NORTHWIND] }],
        other: null,
      };
      return Promise.resolve(okResponse(payload));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('App: the welcome', () => {
  it('draws the welcome on a cold start, the routes rendering beneath it', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole('banner')).toBeDefined();
    expect(
      screen.queryByRole('status', { name: 'Opening FamilyFlix' })
    ).not.toBeNull();
  });

  it('renders the routes inside the provider on a deep link, with no welcome', async () => {
    render(
      <MemoryRouter initialEntries={['/?tab=movies']}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole('banner')).toBeDefined();
    expect(
      screen.queryByRole('status', { name: 'Opening FamilyFlix' })
    ).toBeNull();
  });
});
