import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
import {
  noContentResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { snackbarStack } from '@/test-support/snackbarStack/snackbarStack';

/**
 * 69, Silent waits, Phase 2 (issue #654): the Sync review's other row presses.
 *
 * With its route held open, each of _Apply choices_, _Skip_, _Keep all mine_
 * and _Search_ locks its own **Decision row** at once, so a second press
 * sends nothing, every other row staying pressable, and past 300ms reads its
 * own words. _Search_ raises _Searching TMDB…_ in the snackbar at once, as
 * today, and the row is redrawn with its new candidates only once the 500ms
 * hold is out. A **Season choice** locks its own season alone and reads
 * _Saving poster…_; the other seasons and the rows stay pressable.
 *
 * The review is read on real timers; the clock is faked from the press on.
 */

const SUMMARY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  gaps: 12,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryFolders: [],
};

const HARBOR: Decision = {
  id: 'd1',
  kind: 'ambiguous',
  title: 'Harbor Lights',
  reason: 'Two releases share this title. Pick the right one.',
  path: null,
  query: 'Harbor Lights',
  candidates: [
    {
      tmdbId: 101,
      title: 'Harbor Lights',
      year: 1963,
      genre: 'Drama',
      language: 'en',
      posterUrl: null,
      score: 100,
    },
  ],
};

const LANTERN: Decision = {
  id: 'd2',
  kind: 'conflict',
  title: 'The Lantern Keeper',
  reason: 'TMDB has different values for fields you already filled in.',
  path: null,
  query: 'The Lantern Keeper',
  fields: [{ field: 'year', label: 'Year', mine: '2019', tmdb: '2018' }],
};

const SUNDIAL: Decision = {
  id: 'd3',
  kind: 'missing',
  title: 'Sundial',
  reason: 'Nothing on TMDB matched this title.',
  path: null,
  query: 'Sundial',
};

const SUNDIAL_FOUND: Decision = {
  id: 'd3',
  kind: 'ambiguous',
  title: 'Sundial',
  reason: 'One release shares this title. Pick the right one.',
  path: null,
  query: 'Sundial',
  candidates: [
    {
      tmdbId: 601,
      title: 'Sundial',
      year: 2004,
      genre: 'Drama',
      language: 'en',
      posterUrl: null,
      score: 82,
    },
  ],
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

const SHOW = 's1';

/** A single-series run in review: three Decisions and two seasons. */
const REVIEW: EnrichmentRun = makeEnrichmentRun({
  phase: 'review',
  scope: 'single',
  seriesId: SHOW,
  total: 6,
  done: 6,
  enriched: 4,
  decisions: [HARBOR, LANTERN, SUNDIAL],
  seasons: [seasonOf(1, null), seasonOf(2, null)],
});

const pathOf = (url: string) => new URL(url, 'http://localhost').pathname;
const verbOf = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();

/** The one request a test holds open; every other is answered at once. */
let holding: (path: string, verb: string) => boolean = () => false;

const SEASON_POSTER = /^\/api\/enrichment\/current\/seasons\/(\d+)\/poster$/;

const { fetchMock, respond } = heldFetch((url, init) => {
  const p = pathOf(url);
  const verb = verbOf(init);
  if (holding(p, verb)) return undefined;
  const season = SEASON_POSTER.exec(p);
  if (season !== null && verb === 'POST') {
    return okResponse(
      seasonOf(Number(season[1]), `/api/images/S0${season[1]}.jpg`)
    );
  }
  if (/\/search$/.test(p) && verb === 'POST') return okResponse(SUNDIAL_FOUND);
  if (p.startsWith('/api/enrichment/current/decisions/')) {
    return noContentResponse();
  }
  if (p === '/api/enrichment/current') return okResponse(REVIEW);
  if (p === '/api/enrichment') return okResponse(SUMMARY);
  if (p === '/api/tmdb/key') return okResponse({ key: '0123456789abcdef' });
  if (p === `/api/series/${SHOW}`) {
    return okResponse(
      makeSeriesDetail([['unwatched'], ['unwatched']], {
        id: SHOW,
        title: 'The Hollow Coast',
      })
    );
  }
  return notFoundResponse('Not found');
});

afterEach(() => {
  vi.useRealTimers();
  holding = () => false;
});

const sentTo = (route: string, verb: string) =>
  fetchMock.mock.calls.filter(
    ([input, init]) => pathOf(String(input)) === route && verbOf(init) === verb
  );

/** The review drawn on real timers, then the clock faked. */
async function review() {
  render(
    <MemoryRouter
      initialEntries={['/settings', `/enrich?series=${SHOW}`]}
      initialIndex={1}
    >
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
  await screen.findByText(SUNDIAL.reason);
  vi.useFakeTimers();
}

/** The Busy row a reason sits in, or `null` while it is not one. */
const busyRowOf = (reason: string) =>
  screen.queryByText(reason)?.closest<HTMLElement>('[aria-busy="true"]') ??
  null;

interface RowPress {
  press: string;
  decision: Decision;
  route: string;
  verb: string;
  label: string;
  /** The button pressed, found on the review. */
  button: () => HTMLElement;
}

const PRESSES: RowPress[] = [
  {
    press: 'Apply choices',
    decision: LANTERN,
    route: '/api/enrichment/current/decisions/d2/apply',
    verb: 'POST',
    label: 'Updating details…',
    button: () => screen.getByRole('button', { name: 'Apply choices' }),
  },
  {
    press: 'Skip',
    decision: HARBOR,
    route: '/api/enrichment/current/decisions/d1',
    verb: 'DELETE',
    label: 'Skipping…',
    // Harbor Lights is the first row, its Skip the first.
    button: () => screen.getAllByRole('button', { name: 'Skip' })[0],
  },
  {
    press: 'Keep all mine',
    decision: LANTERN,
    route: '/api/enrichment/current/decisions/d2',
    verb: 'DELETE',
    label: 'Skipping…',
    button: () => screen.getByRole('button', { name: 'Keep all mine' }),
  },
  {
    press: 'Search',
    decision: SUNDIAL,
    route: '/api/enrichment/current/decisions/d3/search',
    verb: 'POST',
    label: 'Searching TMDB…',
    button: () => screen.getByRole('button', { name: 'Search' }),
  },
];

describe.each(PRESSES)(
  'EnrichmentFlow: $press as a Busy row',
  ({ decision, route, verb, label, button }) => {
    it('locks its own row at once: a second press sends no second request', async () => {
      holding = (p, v) => p === route && v === verb;
      await review();

      fireEvent.click(button());
      expect(sentTo(route, verb)).toHaveLength(1);
      const row = busyRowOf(decision.reason);
      expect(row).not.toBeNull();
      expect(row?.hasAttribute('inert')).toBe(true);

      fireEvent.click(button());
      await advanceClock(0);
      expect(sentTo(route, verb)).toHaveLength(1);

      await advanceClock(300);
      await respond(noContentResponse());
      await advanceClock(500);
    });

    it('leaves every other row unlocked', async () => {
      holding = (p, v) => p === route && v === verb;
      await review();

      fireEvent.click(button());
      await advanceClock(300);

      for (const other of [HARBOR, LANTERN, SUNDIAL]) {
        if (other.id === decision.id) continue;
        expect(busyRowOf(other.reason)).toBeNull();
      }
      expect(busyRowOf(decision.reason)).not.toBeNull();
    });

    it(`reads ${label} on its row past 300ms`, async () => {
      holding = (p, v) => p === route && v === verb;
      await review();

      fireEvent.click(button());
      await advanceClock(299);
      const row = busyRowOf(decision.reason);
      expect(row).not.toBeNull();
      expect(within(row as HTMLElement).queryByRole('status')).toBeNull();

      await advanceClock(1);
      expect(
        within(row as HTMLElement).getByRole('status', { name: label })
      ).toBeDefined();
    });
  }
);

describe('EnrichmentFlow: Search held open', () => {
  const SEARCH = '/api/enrichment/current/decisions/d3/search';

  it('raises Searching TMDB… in the snackbar at once, as today', async () => {
    holding = (p, v) => p === SEARCH && v === 'POST';
    await review();

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await advanceClock(0);

    expect(within(snackbarStack()).getByText('Searching TMDB…')).toBeDefined();
  });

  it('draws the new candidates only once the hold is out', async () => {
    holding = (p, v) => p === SEARCH && v === 'POST';
    await review();

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    // Shown at 300; the answer lands at 400; the hold runs to 800.
    await advanceClock(400);
    await respond(okResponse(SUNDIAL_FOUND));

    await advanceClock(399);
    expect(screen.queryByRole('button', { name: /82% match/ })).toBeNull();
    expect(screen.getByText(SUNDIAL.reason)).toBeDefined();

    await advanceClock(1);
    expect(screen.getByRole('button', { name: /82% match/ })).toBeDefined();
    expect(screen.queryByText(SUNDIAL.reason)).toBeNull();
  });
});

describe('EnrichmentFlow: a Season choice held open', () => {
  const SEASON_TWO = '/api/enrichment/current/seasons/2/poster';
  const SEASON_ONE = '/api/enrichment/current/seasons/1/poster';

  const pickerFor = (label: string) =>
    screen.getByRole('group', { name: `Posters for ${label}` });
  const seasonLocked = (label: string) =>
    pickerFor(label).closest('[aria-busy="true"]') !== null;

  async function choseSeasonTwo() {
    holding = (p, v) => p === SEASON_TWO && v === 'POST';
    await review();
    fireEvent.click(
      within(pickerFor('S02')).getByRole('button', {
        name: 'Series poster 2 for S02',
      })
    );
  }

  it('locks that season alone: a second press on it sends nothing', async () => {
    await choseSeasonTwo();

    expect(sentTo(SEASON_TWO, 'POST')).toHaveLength(1);
    expect(seasonLocked('S02')).toBe(true);
    expect(pickerFor('S02').closest('[inert]')).not.toBeNull();
    expect(seasonLocked('S01')).toBe(false);

    fireEvent.click(
      within(pickerFor('S02')).getByRole('button', {
        name: 'Poster 1 for S02',
      })
    );
    await advanceClock(0);
    expect(sentTo(SEASON_TWO, 'POST')).toHaveLength(1);
  });

  it('leaves the other seasons and the rows pressable', async () => {
    await choseSeasonTwo();

    fireEvent.click(
      within(pickerFor('S01')).getByRole('button', {
        name: 'Poster 1 for S01',
      })
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Skip' })[0]);
    await advanceClock(0);

    expect(sentTo(SEASON_ONE, 'POST')).toHaveLength(1);
    expect(
      sentTo('/api/enrichment/current/decisions/d1', 'DELETE')
    ).toHaveLength(1);
    expect(seasonLocked('S02')).toBe(true);
  });

  it('reads Saving poster… in that season past 300ms', async () => {
    await choseSeasonTwo();

    // 71, issue #681: the loader is the card's **Busy overlay**, drawn last
    // in the card, over its picker; the caption stays under it.
    const cardOf = (label: string) =>
      pickerFor(label).parentElement as HTMLElement;
    await advanceClock(299);
    expect(
      within(cardOf('S02')).queryByRole('status', { hidden: true })
    ).toBeNull();

    await advanceClock(1);
    const loader = within(cardOf('S02')).getByRole('status', {
      name: 'Saving poster…',
    });
    expect(cardOf('S02').lastElementChild?.contains(loader)).toBe(true);
    expect(within(pickerFor('S02')).queryByRole('status')).toBeNull();
    expect(within(cardOf('S01')).queryByRole('status')).toBeNull();
  });
});
