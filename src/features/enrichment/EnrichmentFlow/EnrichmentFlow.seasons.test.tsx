import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { EnrichmentFlow } from './EnrichmentFlow';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import type {
  Decision,
  EnrichmentRun,
  EnrichmentSummary,
  SeasonChoice,
} from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import {
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 42 — Review at scale, Slice 7: "choose a season's poster from TMDB" (issue
 * #364).
 *
 * A single-series Sync's review draws the **Seasons** section —
 * `SeasonChoices` over the run's `seasons` — under the tiles and above the
 * Decision rows, and on _All done_ too. A press posts
 * `POST /api/enrichment/current/seasons/<n>/poster { path }` and the section
 * redraws from the route's echo. A library-wide Sync, which carries no
 * `seasons`, draws no Seasons section. The seam is `fetch`.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const SHOW = 's1';
const TITLE = 'The Hollow Coast';

const SUMMARY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  gaps: 12,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryFolders: [],
};

const DECISION: Decision = {
  id: 'd1',
  kind: 'missing',
  title: 'Sundial',
  reason: 'Nothing on TMDB matched this title.',
  path: null,
  query: 'Sundial',
};

const tmdb = (p: string) => `https://image.tmdb.org/t/p/w342${p}`;

const seasonOf = (season: number, posterUrl: string | null): SeasonChoice => ({
  season,
  posterUrl,
  choices: [
    {
      path: `/s0${season}-a.jpg`,
      url: tmdb(`/s0${season}-a.jpg`),
      source: 'season',
    },
    { path: '/show-1.jpg', url: tmdb('/show-1.jpg'), source: 'series' },
  ],
});

const SEASONS: SeasonChoice[] = [
  seasonOf(1, '/api/images/the-hollow-coast-2018/S01-poster.jpg'),
  seasonOf(2, null),
];

const seriesReview = (decisions: Decision[]): EnrichmentRun =>
  makeEnrichmentRun({
    id: 'own',
    phase: 'review',
    scope: 'single',
    seriesId: SHOW,
    total: 1,
    done: 1,
    enriched: 1,
    decisions,
    seasons: SEASONS,
  });

const LIBRARY_REVIEW = makeEnrichmentRun({
  id: 'library',
  phase: 'review',
  scope: 'all',
  total: 30,
  done: 30,
  enriched: 29,
  decisions: [DECISION],
});

const ECHO = seasonOf(2, '/api/images/the-hollow-coast-2018/S02-poster.jpg');

const method = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;
const isSeasonPoster = (input: RequestInfo | URL, init?: RequestInit) =>
  /^\/api\/enrichment\/current\/seasons\/\d+\/poster$/.test(path(input)) &&
  method(init) === 'POST';

/** A server holding `held` as the Current run, in review. */
function serve(held: EnrichmentRun) {
  fetchMock.mockImplementation((input, init) => {
    const p = path(input);
    if (isSeasonPoster(input, init)) {
      return Promise.resolve(okResponse(ECHO));
    }
    if (p === '/api/enrichment/current' && method(init) === 'GET') {
      return Promise.resolve(okResponse(held));
    }
    if (p === '/api/enrichment' && method(init) === 'GET') {
      return Promise.resolve(okResponse(SUMMARY));
    }
    if (p === '/api/tmdb/key') {
      return Promise.resolve(okResponse({ key: '0123456789abcdef' }));
    }
    if (p === `/api/series/${SHOW}`) {
      return Promise.resolve(
        okResponse(
          makeSeriesDetail([['unwatched'], ['unwatched']], {
            id: SHOW,
            title: TITLE,
          })
        )
      );
    }
    return Promise.resolve(notFoundResponse('Not found'));
  });
}

function renderFlow(entry: string) {
  return render(
    <MemoryRouter initialEntries={['/settings', entry]} initialIndex={1}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Routes>
            <Route path="/settings" element={<p>the settings hub</p>} />
            <Route path="/series/:id" element={<p>the series page</p>} />
            <Route path="/enrich" element={<EnrichmentFlow />} />
          </Routes>
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const pickerFor = (label: string) =>
  screen.findByRole('group', { name: `Posters for ${label}` });

describe('EnrichmentFlow — the Seasons section of a single-series review', () => {
  it('draws one picker per season under the Seasons heading', async () => {
    serve(seriesReview([DECISION]));
    renderFlow(`/enrich?series=${SHOW}`);

    expect(await pickerFor('S01')).toBeTruthy();
    expect(await pickerFor('S02')).toBeTruthy();
    expect(screen.getByText('Seasons')).toBeTruthy();
  });

  it('draws the section above the Decision rows', async () => {
    serve(seriesReview([DECISION]));
    renderFlow(`/enrich?series=${SHOW}`);

    const picker = await pickerFor('S01');
    const row = await screen.findByText('Sundial');
    expect(comesBefore(picker, row)).toBe(true);
  });

  it('draws the section on All done too', async () => {
    serve(seriesReview([]));
    renderFlow(`/enrich?series=${SHOW}`);

    expect(await screen.findByText('All done')).toBeTruthy();
    expect(await pickerFor('S02')).toBeTruthy();
  });

  it('posts a press to that season’s poster route, and redraws from the echo', async () => {
    serve(seriesReview([]));
    renderFlow(`/enrich?series=${SHOW}`);
    const picker = await pickerFor('S02');
    expect(within(picker).getByText('No poster yet')).toBeTruthy();

    fireEvent.click(
      within(picker).getByRole('button', { name: 'Series poster 2 for S02' })
    );

    await waitFor(() => {
      expect(within(picker).getByText('Current poster')).toBeTruthy();
    });
    const sent = fetchMock.mock.calls.filter(([i, n]) => isSeasonPoster(i, n));
    expect(sent).toHaveLength(1);
    const [input, init] = sent[0];
    expect(path(input)).toBe('/api/enrichment/current/seasons/2/poster');
    expect(JSON.parse(String(init?.body))).toEqual({ path: '/show-1.jpg' });
  });
});

describe('EnrichmentFlow — a library-wide review', () => {
  it('draws no Seasons section', async () => {
    serve(LIBRARY_REVIEW);
    renderFlow('/enrich');

    expect(await screen.findByText('Sundial')).toBeTruthy();
    expect(screen.queryByText('Seasons')).toBeNull();
    expect(screen.queryByRole('group', { name: /^Posters for/ })).toBeNull();
  });
});
