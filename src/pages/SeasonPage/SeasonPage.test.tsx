import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import {
  MemoryRouter,
  Route,
  Routes,
  type MemoryRouterProps,
} from 'react-router-dom';

import SeasonPage from './SeasonPage';
import { theme } from '@/styles/theme';
import type { SeriesDetail } from '@/types';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { stubScrollMetrics } from '@/test-support/stubScrollMetrics/stubScrollMetrics';

/**
 * 22 — Series (TV), Phase 3 (issue #193): `/series/:id/season/:n`,
 * composition only — `SeriesPage`'s precedent over the `SeasonEpisodes`
 * organism. What this file tests is that the page composes it at its route and
 * that its **Landing** is the series page; `SeasonEpisodes` owns the rest.
 */

const DETAIL: SeriesDetail = {
  series: {
    id: 'harbor',
    tmdbId: null,
    title: 'Harbor & Vine',
    year: 2019,
    endYear: null,
    synopsis: null,
    creator: null,
    cast: [],
    rating: null,
    isFavorite: false,
    posterPath: null,
    backdropPath: null,
    genres: [],
    watched: false,
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
  },
  seasons: [
    {
      number: 1,
      episodes: [
        {
          id: 's1e1',
          seriesId: 'harbor',
          season: 1,
          number: 1,
          title: 'Pilot',
          airDate: null,
          runtimeMinutes: null,
          watched: false,
          resumePositionSeconds: 0,
          status: 'unwatched',
          videoPath: 'harbor-2019/season-01/e1.mp4',
          subtitles: [],
          lastWatchedAt: null,
        },
      ],
      next: null,
    },
  ],
  next: null,
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(okResponse(DETAIL)))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

stubScrollMetrics(4200);

function renderAt(initialEntries: MemoryRouterProps['initialEntries']) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={initialEntries}>
        <LocationProbe />
        <Routes>
          <Route path="/series/:id" element={<span>Series page</span>} />
          <Route path="/series/:id/season/:n" element={<SeasonPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('SeasonPage', () => {
  it('draws the season named by the URL', async () => {
    renderAt(['/series/harbor/season/1']);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Season 1' })
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /^S01E01\b/ })).toBeDefined();
  });

  it('lands on the series page when the season was opened by deep link', async () => {
    renderAt(['/series/harbor/season/1']);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Back to series' })
    );

    await waitFor(() => expect(pathname()).toBe('/series/harbor'));
  });
});
