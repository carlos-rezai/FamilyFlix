import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { MovieForm } from './MovieForm';
import { theme } from '@/styles/theme';
import type { Episode, Genre, SeriesDetail } from '@/types';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';
import {
  makeEpisode,
  makeSeries,
} from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import {
  createdResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 42 — Review at scale, Slice 8: "season posters from a file" (issue #365).
 *
 * The series kind's Files card gains a _Season posters_ list under the series
 * poster: one slot per **Season** the **Episode file rows** hold, in season
 * order, appearing and disappearing as rows for that season come and go — on
 * the add and the **Series edit job** alike. On the wire, a `seasonPoster`
 * field `{ season, path? }`: a held poster travels as its `path`, a picked one
 * as a `seasonPosterFile` part straight after its field, and a held one its ✕
 * took away as a field with neither.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

const POOL: Genre[] = ['Action', 'Comedy', 'Drama'].map((name, index) => ({
  id: `g${index + 1}`,
  name,
}));

const FOLDER = 'harbor-vine-2019';
const HELD_SEASON_ONE = `${FOLDER}/S01-poster.jpg`;

function held(season: number, number: number, title: string): Episode {
  const tag = `S0${season}E0${number}`;
  return {
    ...makeEpisode(season, number),
    title,
    videoPath: `${FOLDER}/season-0${season}/${tag}.mkv`,
  };
}

const PILOT = held(1, 1, 'Pilot');
const SPRING_TIDE = held(2, 1, 'Spring Tide');

const SERIES = makeSeries({
  id: 'harbor',
  title: 'Harbor & Vine',
  year: 2019,
  endYear: 2023,
  posterPath: `${FOLDER}/poster.jpg`,
});

/** The first season holds a Season poster; the second holds none. */
const DETAIL: SeriesDetail = {
  series: SERIES,
  seasons: [
    {
      number: 1,
      episodes: [PILOT],
      next: PILOT,
      posterPath: HELD_SEASON_ONE,
    },
    { number: 2, episodes: [SPRING_TIDE], next: SPRING_TIDE, posterPath: null },
  ],
  next: PILOT,
};

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (init?.method === 'PATCH') {
      return Promise.resolve(okResponse(SERIES));
    }
    if (init?.method === 'POST') {
      return Promise.resolve(createdResponse(SERIES));
    }
    if (url.includes('/api/genres/pool')) {
      return Promise.resolve(okResponse({ genres: POOL }));
    }
    if (url.includes('/api/series/')) {
      return Promise.resolve(okResponse(DETAIL));
    }
    return Promise.resolve(notFoundResponse('Not here'));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderAt(entries: string[]) {
  const view = render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <ThemeProvider theme={theme}>
        <MovieForm />
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
  await act(async () => undefined);
  await act(async () => undefined);
  return view;
}

const renderAdd = () => renderAt(['/settings', '/add?kind=series']);
const renderEdit = () => renderAt(['/series/harbor', '/add?series=harbor']);

const episodeVideo = (name: string) =>
  new File(['video bytes'], name, { type: 'video/x-matroska' });

const seasonArt = (name = 'spring.jpg') =>
  new File(['image bytes'], name, { type: 'image/jpeg' });

async function pickEpisodes(names: string[]) {
  await userEvent.upload(
    screen.getByLabelText(/add episode files/i) as HTMLInputElement,
    names.map(episodeVideo),
    { applyAccept: false }
  );
}

const list = () => screen.getByRole('group', { name: 'Season posters' });
const noList = () =>
  screen.queryByRole('group', { name: 'Season posters' }) === null;

/** The slots drawn, by their labels, in order. */
const slotLabels = () =>
  within(list())
    .getAllByText(/^S\d{2}$/)
    .map((label) => label.textContent);

async function pickSeasonPoster(season: number, file: File) {
  await userEvent.upload(
    within(list()).getByLabelText(
      new RegExp(`choose poster for season ${season}$`, 'i')
    ) as HTMLInputElement,
    file,
    { applyAccept: false }
  );
}

const seasonFields = () =>
  screen.queryAllByRole('textbox', { name: 'Season' }) as HTMLInputElement[];

const saves = (method: 'POST' | 'PATCH') =>
  fetchMock.mock.calls.filter(
    ([input, init]) =>
      String(input).includes('/api/series') && init?.method === method
  );

async function sentBody(method: 'POST' | 'PATCH'): Promise<FormData> {
  await waitFor(() => expect(saves(method)).toHaveLength(1));
  return saves(method)[0][1]?.body as FormData;
}

/** The `seasonPoster` fields of a body, parsed, in order. */
const seasonPosterFields = (body: FormData) =>
  body
    .getAll('seasonPoster')
    .map((text) => JSON.parse(String(text)) as Record<string, unknown>);

/**
 * The body's entries as `[name, what]` in order — a file as its name — so a
 * `seasonPosterFile` can be seen to follow its own `seasonPoster` field.
 */
const seasonEntries = (body: FormData) =>
  [...body.entries()]
    .filter(([name]) => name === 'seasonPoster' || name === 'seasonPosterFile')
    .map(([name, value]) => [
      name,
      value instanceof File ? value.name : JSON.parse(String(value)),
    ]);

describe('MovieForm — the Season posters list, on a series add', () => {
  it('draws no list until a row holds a season, then one slot per season in season order', async () => {
    await renderAdd();
    expect(noList()).toBe(true);

    await pickEpisodes([
      'Harbor.S02E01.Spring.Tide.mkv',
      'Harbor.S01E01.Pilot.mkv',
      'Harbor.S01E02.Low.Tide.mkv',
    ]);

    expect(slotLabels()).toEqual(['S01', 'S02']);
    expect(
      within(list()).getByLabelText(/choose poster for season 1$/i)
    ).toBeDefined();
    expect(
      within(list()).getByLabelText(/choose poster for season 2$/i)
    ).toBeDefined();
  });

  it('adds a slot as a row moves into a new season, and drops one whose rows are gone', async () => {
    await renderAdd();
    await pickEpisodes(['Harbor.S01E01.Pilot.mkv', 'Harbor.S02E01.Spring.mkv']);

    fireEvent.change(seasonFields()[1], { target: { value: '3' } });
    expect(slotLabels()).toEqual(['S01', 'S03']);

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Harbor.S02E01.Spring.mkv' })
    );
    expect(slotLabels()).toEqual(['S01']);
  });

  it('shows a picked poster by its file’s name, and empties the slot again on its ✕', async () => {
    await renderAdd();
    await pickEpisodes(['Harbor.S01E01.Pilot.mkv']);

    await pickSeasonPoster(1, seasonArt('pilot-art.jpg'));
    expect(within(list()).getByText('pilot-art.jpg')).toBeDefined();

    fireEvent.click(
      within(list()).getByRole('button', { name: /^remove s01$/i })
    );
    expect(within(list()).queryByText('pilot-art.jpg')).toBeNull();
    expect(
      within(list()).getByLabelText(/choose poster for season 1$/i)
    ).toBeDefined();
  });

  it('sends a picked poster as a seasonPosterFile part straight after its seasonPoster field', async () => {
    await renderAdd();
    await pickEpisodes(['Harbor.S01E01.Pilot.mkv', 'Harbor.S02E01.Spring.mkv']);
    const art = seasonArt('spring.jpg');

    await pickSeasonPoster(2, art);
    fireEvent.click(screen.getByRole('button', { name: /add to library/i }));
    const body = await sentBody('POST');

    expect(seasonEntries(body)).toEqual([
      ['seasonPoster', { season: 2 }],
      ['seasonPosterFile', 'spring.jpg'],
    ]);
    expect(body.getAll('seasonPosterFile')).toEqual([art]);
  });
});

describe('MovieForm — the Season posters list, on the Series edit job', () => {
  it('holds a season’s poster by its stored name, and offers a slot for a season with none', async () => {
    await renderEdit();

    expect(slotLabels()).toEqual(['S01', 'S02']);
    expect(within(list()).getByText('S01-poster.jpg')).toBeDefined();
    expect(
      within(list()).getByLabelText(/choose poster for season 2$/i)
    ).toBeDefined();
  });

  it('sends an untouched held poster back as its path, with no file part', async () => {
    await renderEdit();

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const body = await sentBody('PATCH');

    expect(seasonPosterFields(body)).toEqual([
      { season: 1, path: HELD_SEASON_ONE },
    ]);
    expect(body.getAll('seasonPosterFile')).toEqual([]);
  });

  it('sends a held poster its ✕ took away as a seasonPoster with no path and no file', async () => {
    await renderEdit();

    fireEvent.click(
      within(list()).getByRole('button', { name: /^remove s01$/i })
    );
    expect(
      within(list()).getByLabelText(/choose poster for season 1$/i)
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const body = await sentBody('PATCH');

    expect(seasonPosterFields(body)).toEqual([{ season: 1 }]);
    expect(body.getAll('seasonPosterFile')).toEqual([]);
  });

  it('sends a poster picked for a season beside the held one, its part after its field', async () => {
    await renderEdit();
    const art = seasonArt('spring.jpg');

    await pickSeasonPoster(2, art);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const body = await sentBody('PATCH');

    expect(seasonEntries(body)).toEqual([
      ['seasonPoster', { season: 1, path: HELD_SEASON_ONE }],
      ['seasonPoster', { season: 2 }],
      ['seasonPosterFile', 'spring.jpg'],
    ]);
    expect(body.getAll('seasonPosterFile')).toEqual([art]);
  });

  it('adds a slot for a season a picked row brings', async () => {
    await renderEdit();

    await pickEpisodes(['Harbor.S03E01.Harvest.mkv']);

    expect(slotLabels()).toEqual(['S01', 'S02', 'S03']);
  });
});
