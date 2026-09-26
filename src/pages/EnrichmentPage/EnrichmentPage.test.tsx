import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import EnrichmentPage from './EnrichmentPage';
import { theme } from '@/styles/theme';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 23 — Enrichment, Phase 2: "the tracer — Just this movie" (issue #204).
 *
 * `/enrich` — composition only, `ImportPage`'s shape: the **Enrichment flow**
 * in the **Maintainer surface**. What the flow does once mounted is tested
 * where it lives.
 */

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const p = new URL(String(input), 'http://localhost').pathname;
      if (p === '/api/movies/m1') {
        return Promise.resolve(
          okResponse(makeMovie({ id: 'm1', title: 'The Lantern Keeper' }))
        );
      }
      return Promise.resolve(notFoundResponse('Not found'));
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EnrichmentPage', () => {
  it('mounts the enrichment flow for the movie in the query', async () => {
    render(
      <MemoryRouter
        initialEntries={['/movie/m1', '/enrich?movie=m1']}
        initialIndex={1}
      >
        <ThemeProvider theme={theme}>
          <Routes>
            <Route path="/movie/:id" element={<p>the movie page</p>} />
            <Route path="/enrich" element={<EnrichmentPage />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Sync with TMDB' })
    ).toBeDefined();
    expect(await screen.findByText('Just this movie')).toBeDefined();
  });
});
