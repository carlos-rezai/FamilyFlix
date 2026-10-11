import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { MovieForm } from './MovieForm';
import { theme } from '@/styles/theme';
import type { Episode, Genre, SeriesDetail } from '@/types';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import {
  makeEpisode,
  makeSeries,
} from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import {
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 38 — Title editing, Slice 4: "edit a series" (issue #307).
 *
 * The **Series edit job**, `/add?series=<id>` — the **Movie form**'s fifth
 * job, opened from the series ⋯ menu's _Edit details_. The shared fields and
 * the poster prefilled from the series, one **Episode file row** per held
 * episode in season then episode order, no **Kind tabs**; the series **Save
 * gate**; one `PATCH /api/series/:id` in which a held file travels as the
 * stored path it has and only a freshly picked one as bytes; and the series
 * page as the landing.
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

/** One held episode, titled and stored under the Series folder. */
function held(season: number, number: number, title: string): Episode {
  const tag = `S0${season}E0${number}`;
  return {
    ...makeEpisode(season, number),
    title,
    videoPath: `${FOLDER}/season-0${season}/${tag}.mkv`,
  };
}

const PILOT = held(1, 1, 'Pilot');
const LOW_TIDE: Episode = {
  ...held(1, 2, 'Low Tide'),
  subtitles: [
    {
      id: 'sub-1',
      path: `${FOLDER}/season-01/S01E02.en.srt`,
      language: 'English',
      position: 0,
    },
  ],
};
const SPRING_TIDE = held(2, 1, 'Spring Tide');

const SERIES = makeSeries({
  id: 'harbor',
  title: 'Harbor & Vine',
  year: 2019,
  endYear: 2023,
  creator: 'Mara Quinn',
  cast: ['Ana Vega', 'Tomas Bell'],
  synopsis: 'Two families share one vineyard.',
  genres: [{ id: 'g3', name: 'Drama' }],
  posterPath: `${FOLDER}/poster.jpg`,
});

/**
 * The series page's read, deliberately out of order — the second season
 * first, and its first season's episodes reversed — so the rows' order is
 * the form's own rule, season then episode, and not the payload's.
 */
const DETAIL: SeriesDetail = {
  series: SERIES,
  seasons: [
    { number: 2, episodes: [SPRING_TIDE], next: SPRING_TIDE },
    { number: 1, episodes: [LOW_TIDE, PILOT], next: PILOT },
  ],
  next: PILOT,
};

let answerSeries: () => Promise<Response>;
let answerSave: () => Promise<Response>;

beforeEach(() => {
  answerSeries = () => Promise.resolve(okResponse(DETAIL));
  answerSave = () => Promise.resolve(okResponse(SERIES));

  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (init?.method === 'PATCH' || init?.method === 'POST') {
      return answerSave();
    }
    if (url.includes('/api/genres/pool')) {
      return Promise.resolve(okResponse({ genres: POOL }));
    }
    if (url.includes('/api/series/')) {
      return answerSeries();
    }
    return Promise.resolve(notFoundResponse('Not here'));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The form at the end of `entries`, every read on mount settled. */
async function renderAt(
  entries: string[] = ['/series/harbor', '/add?series=harbor']
) {
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

const seriesTitle = () =>
  screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement;
const yearField = () =>
  screen.getByRole('textbox', { name: /year/i }) as HTMLInputElement;
const createdByField = () =>
  screen.getByRole('textbox', { name: /created by/i }) as HTMLInputElement;
const castField = () =>
  screen.getByRole('textbox', { name: /^cast$/i }) as HTMLInputElement;
const descriptionField = () =>
  screen.getByRole('textbox', { name: /description/i }) as HTMLTextAreaElement;
const saveChanges = () =>
  screen.getByRole('button', {
    name: /save changes|saving/i,
  }) as HTMLButtonElement;
const cancel = () => screen.getByRole('button', { name: /^cancel$/i });

const seasonFields = () =>
  screen.queryAllByRole('textbox', { name: 'Season' }) as HTMLInputElement[];
const numberFields = () =>
  screen.queryAllByRole('textbox', { name: 'Episode' }) as HTMLInputElement[];
const episodeTitles = () =>
  (
    screen.queryAllByRole('textbox', {
      name: 'Episode title',
    }) as HTMLInputElement[]
  ).map((field) => field.value);

/** The rows on screen as `[season, number, title]`, in the order drawn. */
const drawnRows = () => {
  const titles = episodeTitles();
  const numbers = numberFields();
  return seasonFields().map((season, index) => [
    season.value,
    numbers[index].value,
    titles[index],
  ]);
};

/** Every edit the form has sent. */
const patches = () =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');

/** The one edit's body, having waited for it. */
async function sentBody(): Promise<FormData> {
  await waitFor(() => expect(patches()).toHaveLength(1));
  return patches()[0][1]?.body as FormData;
}

/** The `episode` fields of a body, parsed, in order. */
const episodeFields = (body: FormData) =>
  body
    .getAll('episode')
    .map((text) => JSON.parse(String(text)) as Record<string, unknown>);

/** Every value of a body that carries bytes. */
const fileParts = (body: FormData) =>
  [...body.values()].filter((value) => value instanceof File);

describe('MovieForm — the Series edit job, opened', () => {
  it('reads the series the URL names', async () => {
    await renderAt();

    const reads = fetchMock.mock.calls.filter(
      ([input, init]) =>
        init?.method === undefined && String(input).includes('/api/series/')
    );
    expect(reads).toHaveLength(1);
    expect(String(reads[0][0])).toContain('/api/series/harbor');
  });

  it('says Edit details and Save changes, and draws no Kind tabs', async () => {
    await renderAt();

    expect(screen.getByRole('heading', { name: 'Edit details' })).toBeTruthy();
    expect(saveChanges()).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Kind' })).toBeNull();
  });

  it('prefills the shared fields from the series', async () => {
    await renderAt();

    expect(seriesTitle().value).toBe('Harbor & Vine');
    expect(yearField().value).toBe('2019–2023');
    expect(createdByField().value).toBe('Mara Quinn');
    expect(castField().value).toBe('Ana Vega, Tomas Bell');
    expect(descriptionField().value).toBe('Two families share one vineyard.');
    expect(
      screen.getByRole('button', { name: 'Drama' }).getAttribute('aria-pressed')
    ).toBe('true');
  });

  it('holds the series’ poster in its slot, as the file it already has', async () => {
    await renderAt();

    expect(screen.getByText('poster.jpg')).toBeTruthy();
  });

  it('draws one row per held episode, in season then episode order', async () => {
    await renderAt();

    expect(drawnRows()).toEqual([
      ['1', '1', 'Pilot'],
      ['1', '2', 'Low Tide'],
      ['2', '1', 'Spring Tide'],
    ]);
  });

  it('names each row’s stored video, draws its subtitles, and gives it a ✕', async () => {
    await renderAt();

    expect(screen.getByText('S01E01.mkv')).toBeTruthy();
    expect(screen.getByText('S01E02.mkv')).toBeTruthy();
    expect(screen.getByText('S02E01.mkv')).toBeTruthy();
    expect(screen.getByText('S01E02.en.srt')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Remove S01E01.mkv' })
    ).toBeTruthy();
  });
});

describe('MovieForm — the Series edit job, saved', () => {
  it('sends a title-only edit to the series, with no file part', async () => {
    await renderAt();
    fireEvent.change(seriesTitle(), { target: { value: 'Harbor and Vine' } });

    fireEvent.click(saveChanges());
    const body = await sentBody();

    expect(String(patches()[0][0])).toContain('/api/series/harbor');
    expect(body.get('title')).toBe('Harbor and Vine');
    expect(fileParts(body)).toEqual([]);
    expect(body.get('posterPath')).toBe(`${FOLDER}/poster.jpg`);
    const episodes = episodeFields(body);
    expect(episodes.map((episode) => episode.id)).toEqual([
      PILOT.id,
      LOW_TIDE.id,
      SPRING_TIDE.id,
    ]);
    expect(episodes.map((episode) => episode.videoPath)).toEqual([
      PILOT.videoPath,
      LOW_TIDE.videoPath,
      SPRING_TIDE.videoPath,
    ]);
    expect(episodes[1].storedSubtitles).toEqual([
      { path: `${FOLDER}/season-01/S01E02.en.srt`, language: 'English' },
    ]);
  });

  it('keeps Save closed, and sends nothing, while two rows share a pair of numbers', async () => {
    await renderAt();

    fireEvent.change(numberFields()[1], { target: { value: '1' } });

    expect(saveChanges().disabled).toBe(true);
    fireEvent.click(saveChanges());
    await act(async () => undefined);
    expect(patches()).toHaveLength(0);
  });

  it('sends two episodes’ numbers swapped, each under its own id', async () => {
    await renderAt();

    fireEvent.change(numberFields()[0], { target: { value: '2' } });
    fireEvent.change(numberFields()[1], { target: { value: '1' } });
    expect(saveChanges().disabled).toBe(false);

    fireEvent.click(saveChanges());
    const episodes = episodeFields(await sentBody());

    expect(
      episodes.map((episode) => [episode.id, episode.season, episode.number])
    ).toEqual([
      [PILOT.id, 1, 2],
      [LOW_TIDE.id, 1, 1],
      [SPRING_TIDE.id, 2, 1],
    ]);
  });

  it('leaves out a held row its ✕ took off', async () => {
    await renderAt();

    fireEvent.click(screen.getByRole('button', { name: 'Remove S01E02.mkv' }));
    fireEvent.click(saveChanges());
    const episodes = episodeFields(await sentBody());

    expect(episodes.map((episode) => episode.id)).toEqual([
      PILOT.id,
      SPRING_TIDE.id,
    ]);
  });

  it('appends picked rows with no id, their videos as bytes', async () => {
    await renderAt();
    const picked = new File(['video bytes'], 'Harbor.S02E02.Neap.Tide.mkv', {
      type: 'video/x-matroska',
    });

    await userEvent.upload(
      screen.getByLabelText(/add episode files/i) as HTMLInputElement,
      [picked],
      { applyAccept: false }
    );
    expect(drawnRows()).toHaveLength(4);
    fireEvent.click(saveChanges());
    const body = await sentBody();

    const episodes = episodeFields(body);
    expect(episodes).toHaveLength(4);
    expect(episodes[3]).toMatchObject({ season: 2, number: 2 });
    expect(episodes[3].id).toBeUndefined();
    expect(fileParts(body)).toEqual([picked]);
  });

  it('lands on the series page once the save is written', async () => {
    await renderAt();
    fireEvent.change(seriesTitle(), { target: { value: 'Harbor and Vine' } });

    fireEvent.click(saveChanges());

    await waitFor(() => expect(pathname()).toBe('/series/harbor'));
  });

  it('lands a deep-linked edit on the series page too', async () => {
    await renderAt(['/add?series=harbor']);
    fireEvent.change(seriesTitle(), { target: { value: 'Harbor and Vine' } });

    fireEvent.click(saveChanges());

    await waitFor(() => expect(pathname()).toBe('/series/harbor'));
  });

  it('leaves for the series page from Cancel, sending nothing', async () => {
    await renderAt(['/add?series=harbor']);

    fireEvent.click(cancel());

    expect(pathname()).toBe('/series/harbor');
    expect(patches()).toHaveLength(0);
  });
});

/**
 * 38 — Title editing, Slice 5 (issue #308): a held row's mono line names the
 * episode's **Source file** — the original file a scan found it as — when the
 * library knows it, else the stored video's name.
 */
describe('MovieForm — the Series edit job, the Source file', () => {
  it('names a row by its Source file when set, else by its stored video', async () => {
    const imported: Episode = {
      ...PILOT,
      sourceFile: 'Season 01/eps1.0_hellofriend.mov',
    };
    answerSeries = () =>
      Promise.resolve(
        okResponse({
          ...DETAIL,
          seasons: [
            { number: 2, episodes: [SPRING_TIDE], next: SPRING_TIDE },
            { number: 1, episodes: [LOW_TIDE, imported], next: imported },
          ],
          next: imported,
        })
      );

    await renderAt();

    expect(screen.getByText('Season 01/eps1.0_hellofriend.mov')).toBeTruthy();
    expect(screen.queryByText('S01E01.mkv')).toBeNull();
    expect(screen.getByText('S01E02.mkv')).toBeTruthy();
    expect(screen.getByText('S02E01.mkv')).toBeTruthy();
  });
});
