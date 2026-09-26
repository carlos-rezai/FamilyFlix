import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import {
  MemoryRouter,
  Route,
  Routes,
  type MemoryRouterProps,
} from 'react-router-dom';

import { SeasonEpisodes } from './SeasonEpisodes';
import { theme } from '@/styles/theme';
import type {
  Episode,
  SeasonSummary,
  Series,
  SeriesDetail,
  WatchStatus,
} from '@/types';
import {
  LocationProbe,
  navigationType,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import {
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 22 — Series (TV), Phase 3 (issue #193): the season page's organism.
 *
 * It reads the same series read as the series page — `GET /api/series/:id` —
 * and draws `page.SeasonPage` for the season in the URL: _Back to series_, the
 * show's title over _Season 2_, the _Resume E04_ / _Play E01_ button (inert
 * until episode playback exists), the `8 episodes · 3 watched` count line,
 * _Mark season watched_ / _unwatched_, one **Episode row** per episode, and
 * the _Other seasons_ pills.
 *
 * Its two writes flip on screen at once and flip back on refusal: the episode
 * box through the shared `saveEpisodeWatched` (`POST /api/episodes/:id/watched`)
 * and the season button through `POST /api/series/:id/seasons/:n/watched`. Both
 * follow the movie's rule on screen too: watched forgets the resume position.
 *
 * The pills are a **Sideways move** — a `replace` — so _Back to series_ is one
 * step to the series page however many seasons were looked at, and the page's
 * **Landing** is the series page. An unknown season is the not-found face.
 */

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
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'harbor',
    tmdbId: null,
    title: 'Harbor & Vine',
    year: 2019,
    endYear: 2023,
    synopsis: null,
    creator: 'Mara Quinn',
    cast: [],
    rating: 8,
    isFavorite: false,
    posterPath: null,
    backdropPath: null,
    originalTitle: null,
    tmdbScore: null,
    genres: [{ id: 'g1', name: 'Drama' }],
    watched: false,
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

function makeEpisode(
  season: number,
  number: number,
  status: WatchStatus = 'unwatched',
  overrides: Partial<Episode> = {}
): Episode {
  return {
    id: `s${season}e${number}`,
    seriesId: 'harbor',
    season,
    number,
    title: null,
    airDate: null,
    runtimeMinutes: 44,
    watched: status === 'watched',
    resumePositionSeconds: status === 'in-progress' ? 660 : 0,
    status,
    videoPath: `harbor-2019/season-0${season}/e${number}.mp4`,
    subtitles: [],
    lastWatchedAt: null,
    ...overrides,
  };
}

/** A season of `count`, every episode in `status`; next is its first. */
function uniform(
  number: number,
  count: number,
  status: WatchStatus = 'unwatched'
): SeasonSummary {
  const episodes = Array.from({ length: count }, (_, index) =>
    makeEpisode(number, index + 1, status)
  );
  return { number, episodes, next: episodes[0] ?? null };
}

/** Season 2 of eight: E01–E03 watched, E04 part-way (11:00 of 44:00), the rest unstarted. */
function midSeason(): SeasonSummary {
  const episodes = [1, 2, 3, 4, 5, 6, 7, 8].map((number) => {
    if (number <= 3) {
      return makeEpisode(2, number, 'watched', {
        title: number === 1 ? 'The Return' : null,
        airDate: number === 1 ? '2020-03-04' : null,
      });
    }
    if (number === 4) {
      return makeEpisode(2, number, 'in-progress', { title: 'The Harvest' });
    }
    return makeEpisode(2, number);
  });
  return { number: 2, episodes, next: episodes[3] };
}

/** Three seasons, the family in the middle of the second. */
function harbor(seasons: SeasonSummary[] = defaultSeasons()): SeriesDetail {
  return { series: makeSeries(), seasons, next: null };
}

function defaultSeasons(): SeasonSummary[] {
  return [uniform(1, 2, 'watched'), midSeason(), uniform(3, 1)];
}

/** Answer the read with `detail`; echo every write, or refuse it. */
function serve(detail: SeriesDetail, { refuse = false } = {}) {
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method !== 'GET') {
      if (refuse) {
        return Promise.resolve(serverErrorResponse());
      }
      const body = JSON.parse(String(init?.body)) as { value: unknown };
      return Promise.resolve(okResponse({ value: body.value }));
    }
    if (url === `/api/series/${detail.series.id}`) {
      return Promise.resolve(okResponse(detail));
    }
    if (url.startsWith('/api/series/')) {
      return Promise.resolve(notFoundResponse('Unknown series'));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

function renderSeason(
  initialEntries: MemoryRouterProps['initialEntries'] = [
    '/series/harbor/season/2',
  ]
) {
  return render(
    <MemoryRouter
      initialEntries={initialEntries}
      initialIndex={(initialEntries?.length ?? 1) - 1}
    >
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<h1>Your library</h1>} />
          <Route path="/series/:id" element={<h1>Series page</h1>} />
          <Route path="/series/:id/season/:n" element={<SeasonEpisodes />} />
          <Route path="/episode/:id/play" element={<h1>Player</h1>} />
        </Routes>
      </ThemeProvider>
      <LocationProbe />
    </MemoryRouter>
  );
}

const findSeasonHeading = (label = 'Season 2') =>
  screen.findByRole('heading', { level: 1, name: label });

/** One episode row, by its `S02E04` code. */
function episodeRow(code: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${code}\\b`) });
}

/** The watched box inside one row. */
function boxOf(code: string): HTMLElement {
  return within(episodeRow(code)).getByRole('button', {
    name: /^(Mark as watched|Watched — click to unmark)$/,
  });
}

/** Every row's box state, in order. */
function pressedStates(): (string | null)[] {
  return screen
    .getAllByRole('button', {
      name: /^(Mark as watched|Watched — click to unmark)$/,
    })
    .map((control) => control.getAttribute('aria-pressed'));
}

/** Every write the page issued, as url and parsed body. */
function writes() {
  return fetchMock.mock.calls
    .filter(([, init]) => (init?.method ?? 'GET').toUpperCase() !== 'GET')
    .map(([input, init]) => ({
      url: String(input),
      method: (init?.method ?? 'GET').toUpperCase(),
      body: JSON.parse(String(init?.body)) as unknown,
    }));
}

describe('SeasonEpisodes — the header', () => {
  it('loads the series named by the URL and reads its title over Season N', async () => {
    serve(harbor());

    renderSeason();

    expect(await findSeasonHeading('Season 2')).toBeDefined();
    expect(screen.getByText('Harbor & Vine')).toBeDefined();
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain(
      '/api/series/harbor'
    );
  });

  it('offers Resume E04 when the season’s next episode is part watched', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();

    expect(screen.getByRole('button', { name: 'Resume E04' })).toBeDefined();
  });

  it('offers Play E01 for a season nobody has started', async () => {
    serve(harbor([uniform(1, 3)]));

    renderSeason(['/series/harbor/season/1']);
    await findSeasonHeading('Season 1');

    expect(screen.getByRole('button', { name: 'Play E01' })).toBeDefined();
  });

  // 22 — Series (TV), Phase 4 (issue #194): the button is no longer inert.
  it('opens the player on the season’s part-watched episode, as a push', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();
    fireEvent.click(screen.getByRole('button', { name: 'Resume E04' }));

    expect(pathname()).toBe('/episode/s2e4/play');
    expect(navigationType()).toBe('PUSH');
    expect(writes()).toEqual([]);
  });

  it('opens the player on E01 of a season nobody has started', async () => {
    serve(harbor([uniform(1, 3)]));

    renderSeason(['/series/harbor/season/1']);
    await findSeasonHeading('Season 1');
    fireEvent.click(screen.getByRole('button', { name: 'Play E01' }));

    expect(pathname()).toBe('/episode/s1e1/play');
  });

  it('reads the count line as 8 episodes · 3 watched', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();

    expect(screen.getByText('8 episodes')).toBeDefined();
    expect(screen.getByText('3 watched')).toBeDefined();
  });
});

describe('SeasonEpisodes — the episode rows', () => {
  it('draws one row per episode of the season, in order', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();

    const codes = screen
      .getAllByRole('button', { name: /^S\d\dE\d\d\b/ })
      .map((row) => row.getAttribute('aria-label')?.slice(0, 6));
    expect(codes).toEqual([
      'S02E01',
      'S02E02',
      'S02E03',
      'S02E04',
      'S02E05',
      'S02E06',
      'S02E07',
      'S02E08',
    ]);
  });

  it('reads each row’s title, or Untitled episode, and the air date when there is one', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();

    expect(within(episodeRow('S02E01')).getByText('The Return')).toBeDefined();
    expect(within(episodeRow('S02E01')).getByText('Mar 4, 2020')).toBeDefined();
    expect(
      within(episodeRow('S02E02')).getByText('Untitled episode')
    ).toBeDefined();
  });

  it('draws the Resume label and bar on the part-watched row alone', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();

    expect(
      within(episodeRow('S02E04')).getByText('Resume · 11:00 of 44:00')
    ).toBeDefined();
    expect(within(episodeRow('S02E04')).getByRole('progressbar')).toBeDefined();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  });

  it('ticks the box of every watched episode', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();

    expect(pressedStates()).toEqual([
      'true',
      'true',
      'true',
      'false',
      'false',
      'false',
      'false',
      'false',
    ]);
  });

  // 22 — Series (TV), Phase 4 (issue #194): a row now plays its episode.
  it('opens the player on the row’s own episode when the row is clicked', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();
    fireEvent.click(episodeRow('S02E05'));

    expect(pathname()).toBe('/episode/s2e5/play');
    expect(navigationType()).toBe('PUSH');
    expect(writes()).toEqual([]);
  });

  it.each(['Enter', ' '])(
    'opens the player on the row’s episode from the keyboard (%j)',
    async (key) => {
      serve(harbor());

      renderSeason();
      await findSeasonHeading();
      fireEvent.keyDown(episodeRow('S02E06'), { key });

      expect(pathname()).toBe('/episode/s2e6/play');
    }
  );
});

describe('SeasonEpisodes — the episode box', () => {
  it('ticks the box the moment it is pressed, and counts it', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();
    fireEvent.click(boxOf('S02E05'));

    expect(boxOf('S02E05').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('4 watched')).toBeDefined();
  });

  it('saves the mark through the episode’s watched route', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();
    fireEvent.click(boxOf('S02E05'));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toEqual({
      url: '/api/episodes/s2e5/watched',
      method: 'POST',
      body: { value: true },
    });
  });

  it('forgets a part-watched episode’s resume position when it is marked watched', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();
    fireEvent.click(boxOf('S02E04'));

    expect(boxOf('S02E04').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText(/^Resume · /)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('unmarks a watched episode', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();
    fireEvent.click(boxOf('S02E02'));

    expect(boxOf('S02E02').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('2 watched')).toBeDefined();
    await waitFor(() =>
      expect(writes()[0]).toEqual({
        url: '/api/episodes/s2e2/watched',
        method: 'POST',
        body: { value: false },
      })
    );
  });

  it('never opens the row when the box is pressed', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();
    fireEvent.click(boxOf('S02E05'));

    expect(pathname()).toBe('/series/harbor/season/2');
  });

  it('puts the box, the count and the Resume label back when the save is refused', async () => {
    serve(harbor(), { refuse: true });

    renderSeason();
    await findSeasonHeading();
    fireEvent.click(boxOf('S02E04'));

    await waitFor(() => expect(writes()).toHaveLength(1));
    await waitFor(() =>
      expect(boxOf('S02E04').getAttribute('aria-pressed')).toBe('false')
    );
    expect(screen.getByText('3 watched')).toBeDefined();
    expect(
      within(episodeRow('S02E04')).getByText('Resume · 11:00 of 44:00')
    ).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Season 2' })
    ).toBeDefined();
  });
});

describe('SeasonEpisodes — Mark season watched', () => {
  it('offers Mark season watched while any episode is unwatched', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();

    expect(
      screen.getByRole('button', { name: 'Mark season watched' })
    ).toBeDefined();
  });

  it('offers Mark season unwatched once every episode is watched', async () => {
    serve(harbor([uniform(1, 3, 'watched')]));

    renderSeason(['/series/harbor/season/1']);
    await findSeasonHeading('Season 1');

    expect(
      screen.getByRole('button', { name: 'Mark season unwatched' })
    ).toBeDefined();
  });

  it('ticks every box at once, forgets the resume position, and flips its own label', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark season watched' })
    );

    expect(pressedStates().every((state) => state === 'true')).toBe(true);
    expect(screen.getByText('8 watched')).toBeDefined();
    expect(screen.queryByText(/^Resume · /)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Mark season unwatched' })
    ).toBeDefined();
  });

  it('saves the season through the season’s watched route', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark season watched' })
    );

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toEqual({
      url: '/api/series/harbor/seasons/2/watched',
      method: 'POST',
      body: { value: true },
    });
  });

  it('unmarks every episode of a finished season', async () => {
    serve(harbor([uniform(1, 3, 'watched')]));

    renderSeason(['/series/harbor/season/1']);
    await findSeasonHeading('Season 1');
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark season unwatched' })
    );

    expect(pressedStates().every((state) => state === 'false')).toBe(true);
    expect(screen.getByText('0 watched')).toBeDefined();
    await waitFor(() =>
      expect(writes()[0]).toEqual({
        url: '/api/series/harbor/seasons/1/watched',
        method: 'POST',
        body: { value: false },
      })
    );
  });

  it('puts every box, the count and its label back when the save is refused', async () => {
    serve(harbor(), { refuse: true });

    renderSeason();
    await findSeasonHeading();
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark season watched' })
    );

    await waitFor(() => expect(writes()).toHaveLength(1));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Mark season watched' })
      ).toBeDefined()
    );
    expect(pressedStates()).toEqual([
      'true',
      'true',
      'true',
      'false',
      'false',
      'false',
      'false',
      'false',
    ]);
    expect(screen.getByText('3 watched')).toBeDefined();
    expect(
      within(episodeRow('S02E04')).getByText('Resume · 11:00 of 44:00')
    ).toBeDefined();
  });
});

describe('SeasonEpisodes — Other seasons', () => {
  it('draws a pill for every other season, and none for this one', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();

    expect(screen.getByText('Other seasons')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Season 1' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Season 3' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Season 2' })).toBeNull();
  });

  it('draws no Other seasons for a series of one season', async () => {
    serve(harbor([midSeason()]));

    renderSeason();
    await findSeasonHeading();

    expect(screen.queryByText('Other seasons')).toBeNull();
  });

  it('opens the other season in place, as a replace', async () => {
    serve(harbor());

    renderSeason();
    await findSeasonHeading();
    fireEvent.click(screen.getByRole('button', { name: 'Season 3' }));

    expect(await findSeasonHeading('Season 3')).toBeDefined();
    expect(pathname()).toBe('/series/harbor/season/3');
    expect(navigationType()).toBe('REPLACE');
  });

  it('reaches the series page in one Back step however many seasons were looked at', async () => {
    serve(harbor());

    renderSeason(['/series/harbor', '/series/harbor/season/2']);
    await findSeasonHeading();
    fireEvent.click(screen.getByRole('button', { name: 'Season 3' }));
    await findSeasonHeading('Season 3');
    fireEvent.click(screen.getByRole('button', { name: 'Season 1' }));
    await findSeasonHeading('Season 1');

    fireEvent.click(screen.getByRole('button', { name: 'Back to series' }));

    await waitFor(() => expect(pathname()).toBe('/series/harbor'));
    expect(navigationType()).toBe('POP');
  });
});

describe('SeasonEpisodes — Back', () => {
  it('steps back to the series page it was opened from', async () => {
    serve(harbor());

    renderSeason(['/series/harbor', '/series/harbor/season/2']);
    await findSeasonHeading();
    fireEvent.click(screen.getByRole('button', { name: 'Back to series' }));

    await waitFor(() => expect(pathname()).toBe('/series/harbor'));
    expect(navigationType()).toBe('POP');
  });

  it('lands on the series page when the season was opened by deep link', async () => {
    serve(harbor());

    renderSeason(['/series/harbor/season/2']);
    await findSeasonHeading();
    fireEvent.click(screen.getByRole('button', { name: 'Back to series' }));

    await waitFor(() => expect(pathname()).toBe('/series/harbor'));
    expect(navigationType()).toBe('PUSH');
  });
});

describe('SeasonEpisodes — not found', () => {
  it('draws the not-found face for a season the series does not have', async () => {
    serve(harbor());

    renderSeason(['/series/harbor/season/9']);

    expect(await screen.findByText(/isn’t here/)).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Season 9' })).toBeNull();
    expect(screen.queryAllByRole('button', { name: /^S\d\dE\d\d\b/ })).toEqual(
      []
    );
  });

  it('draws the not-found face for a series the library does not hold', async () => {
    serve(harbor());

    renderSeason(['/series/gone/season/1']);

    expect(await screen.findByText(/isn’t here/)).toBeDefined();
  });
});
