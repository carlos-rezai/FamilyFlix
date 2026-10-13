import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { MovieForm } from './MovieForm';
import { theme } from '@/styles/theme';
import type {
  Episode,
  Genre,
  ImportProblemDetail,
  SeriesDetail,
} from '@/types';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import {
  makeEpisode,
  makeSeries,
} from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import {
  createdResponse,
  noContentResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 38 — Title editing, Slice 7 (issue #310): the **Series Resolve** and the
 * film's **Found-file choice**.
 *
 * An `unplaced` row's _Resolve_ opens `/add?kind=series&problem=<id>` — the
 * **Movie form**'s series kind in import context. The **Problem detail**'s
 * `files.videos` become one **Episode file row** each, as a `found` path, its
 * numbers prefilled by the **Numbering guess**: the season from the folder (a
 * **Season folder**'s number, season 1 at the **Show folder**'s root), the
 * episode from the **Episode word**, else the next free number in name order.
 * Every number stays editable. _Save & continue_ posts the series body to the
 * problem's resolve route, each found video as its `episode` field's
 * `videoPath`, and lands on the review.
 *
 * With `&series=<id>` the show is already held: the fields come from that
 * series, the rows are only the problem's videos, and the gate also refuses a
 * number the series already holds.
 *
 * A film Resolve whose folder holds two or more videos draws the Found-file
 * choice, the first preselected.
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

const SHOW = 'E:\\Series\\The Night Ferry';

/** The show's unplaced videos, in the name order the detail lists them. */
const DEPARTURE = `${SHOW}\\Season 2\\eps2.0_departure.mov`;
const FOG_HORN = `${SHOW}\\Season 2\\eps2.1_fog_horn.mov`;
const PURSER = `${SHOW}\\Season 2\\the_purser Episode 2.mov`;
const LANDFALL = `${SHOW}\\landfall.mov`;

/** The `unplaced` Problem of a show the library does not hold yet. */
const NIGHT_FERRY: ImportProblemDetail = {
  id: 'p5',
  kind: 'unplaced',
  title: 'The Night Ferry',
  reason: '4 episodes need numbers',
  row: {
    title: 'The Night Ferry',
    year: 2021,
    genres: ['Drama'],
    director: 'Ines Okafor',
  },
  folder: SHOW,
  candidates: [],
  files: {
    subtitles: [],
    videos: [DEPARTURE, FOG_HORN, PURSER, LANDFALL],
  },
};

/** The two new files of a show the run already holds, in its Season 1 folder. */
const BONUS_A = `${SHOW}\\Season 1\\bonus_a.mov`;
const BONUS_B = `${SHOW}\\Season 1\\bonus_b.mov`;

const JOINING: ImportProblemDetail = {
  id: 'p6',
  kind: 'unplaced',
  title: 'The Night Ferry',
  reason: '2 episodes need numbers',
  row: {
    title: 'The Night Ferry',
    year: 2020,
    genres: [],
    director: 'Someone Else',
  },
  folder: SHOW,
  candidates: [],
  files: { subtitles: [], videos: [BONUS_A, BONUS_B] },
};

const HELD_FOLDER = 'the-night-ferry-2019';

function held(number: number, title: string): Episode {
  return {
    ...makeEpisode(1, number),
    title,
    videoPath: `${HELD_FOLDER}/season-01/S01E0${number}.mkv`,
  };
}

const PILOT = held(1, 'Pilot');
const LOW_TIDE = held(2, 'Low Tide');

/** The series the run already holds: S01E01 and S01E02. */
const HELD: SeriesDetail = {
  series: makeSeries({
    id: 'night-ferry',
    title: 'The Night Ferry',
    year: 2019,
    endYear: 2021,
    creator: 'Mara Quinn',
    genres: [{ id: 'g3', name: 'Drama' }],
  }),
  seasons: [
    { number: 1, episodes: [PILOT, LOW_TIDE], next: PILOT, posterPath: null },
  ],
  next: PILOT,
};

/** A film folder holding two videos: the `no-video` Problem's parity case. */
const PAPER_MOONS_FOLDER = 'E:\\Movies\\Paper Moons (2014)';
const FEATURE = `${PAPER_MOONS_FOLDER}\\paper.moons.2014.1080p.mkv`;
const EXTRAS = `${PAPER_MOONS_FOLDER}\\paper.moons.2014.extras.mkv`;

const PAPER_MOONS: ImportProblemDetail = {
  id: 'p7',
  kind: 'no-video',
  title: 'Paper Moons',
  reason: 'Two videos. Pick the film.',
  row: { title: 'Paper Moons', year: 2014, genres: [] },
  folder: PAPER_MOONS_FOLDER,
  candidates: [],
  files: { subtitles: [], videos: [FEATURE, EXTRAS] },
};

let answerProblem: () => Promise<Response>;

beforeEach(() => {
  answerProblem = () => Promise.resolve(okResponse(NIGHT_FERRY));

  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    const method = init?.method?.toUpperCase() ?? 'GET';
    if (url.includes('/api/import/current/problems/')) {
      if (method === 'POST') {
        return Promise.resolve(createdResponse(HELD.series));
      }
      if (method === 'DELETE') {
        return Promise.resolve(noContentResponse());
      }
      return answerProblem();
    }
    if (url.includes('/api/genres/pool')) {
      return Promise.resolve(okResponse({ genres: POOL }));
    }
    if (url.includes('/api/series/')) {
      return Promise.resolve(okResponse(HELD));
    }
    return Promise.resolve(notFoundResponse('Not here'));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The form opened from the review's _Resolve_, every read on mount settled. */
async function renderResolve(url: string) {
  const view = render(
    <MemoryRouter
      initialEntries={['/settings', '/import', url]}
      initialIndex={2}
    >
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

const titleField = () =>
  screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement;
const yearField = () =>
  screen.getByRole('textbox', { name: /year/i }) as HTMLInputElement;
const createdByField = () =>
  screen.getByRole('textbox', { name: /created by/i }) as HTMLInputElement;
const saveAndContinue = () =>
  screen.getByRole('button', {
    name: /save & continue|saving/i,
  }) as HTMLButtonElement;

const seasonFields = () =>
  screen.queryAllByRole('textbox', { name: 'Season' }) as HTMLInputElement[];
const numberFields = () =>
  screen.queryAllByRole('textbox', { name: 'Episode' }) as HTMLInputElement[];

/** The rows on screen as `[season, number]`, in the order drawn. */
const drawnNumbers = () => {
  const numbers = numberFields();
  return seasonFields().map((season, index) => [
    season.value,
    numbers[index].value,
  ]);
};

/** Every resolve the form has posted. */
const resolves = () =>
  fetchMock.mock.calls.filter(
    ([input, init]) =>
      init?.method?.toUpperCase() === 'POST' &&
      String(input).includes('/api/import/current/problems/')
  );

/** The one resolve's body, having waited for it. */
async function sentBody(): Promise<FormData> {
  await waitFor(() => expect(resolves()).toHaveLength(1));
  return resolves()[0][1]?.body as FormData;
}

/** The `episode` fields of a body, parsed, in order. */
const episodeFields = (body: FormData) =>
  body
    .getAll('episode')
    .map((text) => JSON.parse(String(text)) as Record<string, unknown>);

const fileParts = (body: FormData) =>
  [...body.values()].filter((value) => value instanceof File);

describe('MovieForm — the Series Resolve, a show not yet held', () => {
  const AT = '/add?kind=series&problem=p5';

  it('reads the problem the URL names, and is the series kind', async () => {
    await renderResolve(AT);

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes('/api/import/current/problems/p5')
      )
    ).toBe(true);
    expect(screen.getByRole('textbox', { name: /created by/i })).toBeTruthy();
    expect(titleField().value).toBe('The Night Ferry');
  });

  it('draws one Episode file row per found video, each named by its path', async () => {
    await renderResolve(AT);

    expect(seasonFields()).toHaveLength(4);
    for (const video of [DEPARTURE, FOG_HORN, PURSER, LANDFALL]) {
      expect(screen.getByText(video)).toBeTruthy();
    }
  });

  it('numbers the rows by the Numbering guess: the folder’s season, the Episode word, else the next free number', async () => {
    await renderResolve(AT);

    expect(drawnNumbers()).toEqual([
      // Season 2's folder; no word, so the first free number.
      ['2', '1'],
      // No word either; 2 is the purser's by its word, so 3.
      ['2', '3'],
      // `Episode 2`, the Episode word, under the folder's season.
      ['2', '2'],
      // At the Show folder's root: season 1, its first free number.
      ['1', '1'],
    ]);
  });

  it('guesses season 1 under a folder that is not a Season folder, as the server reads it', async () => {
    const disc = `${SHOW}\\Disc 2\\the_boarding.mov`;
    answerProblem = () =>
      Promise.resolve(
        okResponse({
          ...NIGHT_FERRY,
          reason: '1 episode needs a number',
          files: { subtitles: [], videos: [disc] },
        })
      );

    await renderResolve(AT);

    expect(drawnNumbers()).toEqual([['1', '1']]);
  });

  it('opens Save & continue on the guess alone', async () => {
    await renderResolve(AT);

    expect(saveAndContinue().disabled).toBe(false);
  });

  it('keeps every number editable, and sends what was typed', async () => {
    await renderResolve(AT);

    fireEvent.change(seasonFields()[3], { target: { value: '3' } });
    fireEvent.change(numberFields()[3], { target: { value: '7' } });
    fireEvent.click(saveAndContinue());
    const episodes = episodeFields(await sentBody());

    expect(episodes[3]).toMatchObject({ season: 3, number: 7 });
  });

  it('closes Save while two rows share a pair of numbers, sending nothing', async () => {
    await renderResolve(AT);

    fireEvent.change(numberFields()[1], { target: { value: '1' } });

    expect(saveAndContinue().disabled).toBe(true);
    fireEvent.click(saveAndContinue());
    await act(async () => undefined);
    expect(resolves()).toHaveLength(0);
  });

  // Issue #312: a row the gate refuses says why, and 0 is a number.
  it('says why Save is closed, under the row that closes it, and on its field', async () => {
    await renderResolve(AT);

    fireEvent.change(numberFields()[1], { target: { value: '1' } });

    expect(screen.getAllByText('Another file is also S02E01.')).toHaveLength(2);
    expect(numberFields()[1].getAttribute('aria-invalid')).toBe('true');
    expect(numberFields()[2].getAttribute('aria-invalid')).toBe('false');
  });

  it('keeps Save open on an episode 0, and sends it', async () => {
    await renderResolve(AT);

    fireEvent.change(numberFields()[3], { target: { value: '0' } });

    expect(saveAndContinue().disabled).toBe(false);
    expect(
      screen.queryByText(/another file|already has|give this episode/i)
    ).toBeNull();
    fireEvent.click(saveAndContinue());
    const episodes = episodeFields(await sentBody());
    expect(episodes[3]).toMatchObject({ season: 1, number: 0 });
  });

  it('guesses season 0 under a Season 0 folder, as the server reads it', async () => {
    const special = `${SHOW}\\Season 0\\christmas_special.mov`;
    answerProblem = () =>
      Promise.resolve(
        okResponse({
          ...NIGHT_FERRY,
          reason: '1 episode needs a number',
          files: { subtitles: [], videos: [special] },
        })
      );

    await renderResolve(AT);

    expect(drawnNumbers()).toEqual([['0', '1']]);
  });

  it('posts to the problem’s resolve route, each video as its found path, no bytes', async () => {
    await renderResolve(AT);

    fireEvent.click(saveAndContinue());
    const body = await sentBody();

    expect(String(resolves()[0][0])).toContain(
      '/api/import/current/problems/p5/resolve'
    );
    expect(body.get('title')).toBe('The Night Ferry');
    expect(fileParts(body)).toEqual([]);
    expect(
      episodeFields(body).map((episode) => [
        episode.season,
        episode.number,
        episode.videoPath,
      ])
    ).toEqual([
      [2, 1, DEPARTURE],
      [2, 3, FOG_HORN],
      [2, 2, PURSER],
      [1, 1, LANDFALL],
    ]);
    for (const episode of episodeFields(body)) {
      expect(episode.id).toBeUndefined();
    }
  });

  it('lands on the review once the save is written', async () => {
    await renderResolve(AT);

    fireEvent.click(saveAndContinue());

    await waitFor(() => expect(pathname()).toBe('/import'));
  });
});

describe('MovieForm — the Series Resolve, joining a held series', () => {
  const AT = '/add?kind=series&problem=p6&series=night-ferry';

  beforeEach(() => {
    answerProblem = () => Promise.resolve(okResponse(JOINING));
  });

  it('reads the held series the URL names', async () => {
    await renderResolve(AT);

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes('/api/series/night-ferry')
      )
    ).toBe(true);
  });

  it('prefills the fields from the held series, not the sheet row', async () => {
    await renderResolve(AT);

    expect(titleField().value).toBe('The Night Ferry');
    expect(yearField().value).toBe('2019–2021');
    expect(createdByField().value).toBe('Mara Quinn');
  });

  it('draws rows for the new files only, numbered after what the series holds', async () => {
    await renderResolve(AT);

    expect(drawnNumbers()).toEqual([
      ['1', '3'],
      ['1', '4'],
    ]);
    expect(screen.getByText(BONUS_A)).toBeTruthy();
    expect(screen.getByText(BONUS_B)).toBeTruthy();
    expect(screen.queryByText('S01E01.mkv')).toBeNull();
  });

  it('closes Save on a number the series already holds, sending nothing', async () => {
    await renderResolve(AT);
    expect(saveAndContinue().disabled).toBe(false);

    fireEvent.change(numberFields()[0], { target: { value: '2' } });

    expect(saveAndContinue().disabled).toBe(true);
    fireEvent.click(saveAndContinue());
    await act(async () => undefined);
    expect(resolves()).toHaveLength(0);
  });

  it('posts only the new files, each as its found path', async () => {
    await renderResolve(AT);

    fireEvent.click(saveAndContinue());
    const episodes = episodeFields(await sentBody());

    expect(
      episodes.map((episode) => [
        episode.season,
        episode.number,
        episode.videoPath,
      ])
    ).toEqual([
      [1, 3, BONUS_A],
      [1, 4, BONUS_B],
    ]);
  });
});

describe('MovieForm — the film Resolve’s Found-file choice', () => {
  const AT = '/add?problem=p7';

  beforeEach(() => {
    answerProblem = () => Promise.resolve(okResponse(PAPER_MOONS));
  });

  const option = (name: string) => screen.getByRole('radio', { name });

  it('draws the folder’s videos as the choice, the first preselected', async () => {
    await renderResolve(AT);

    expect(screen.getByRole('radiogroup', { name: 'Video' })).toBeTruthy();
    expect(
      option('paper.moons.2014.1080p.mkv').getAttribute('aria-checked')
    ).toBe('true');
    expect(
      option('paper.moons.2014.extras.mkv').getAttribute('aria-checked')
    ).toBe('false');
    expect(saveAndContinue().disabled).toBe(false);
  });

  it('sends the preselected video’s path on Save & continue', async () => {
    await renderResolve(AT);

    fireEvent.click(saveAndContinue());
    const body = await sentBody();

    expect(body.get('videoPath')).toBe(FEATURE);
  });

  it('sends the video chosen instead, once another is chosen', async () => {
    await renderResolve(AT);

    fireEvent.click(option('paper.moons.2014.extras.mkv'));
    expect(
      option('paper.moons.2014.extras.mkv').getAttribute('aria-checked')
    ).toBe('true');
    fireEvent.click(saveAndContinue());
    const body = await sentBody();

    expect(body.get('videoPath')).toBe(EXTRAS);
  });
});
