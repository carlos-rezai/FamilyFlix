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
import type { Genre } from '@/types';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';
import {
  makeSeries,
  makeSeriesDetail,
} from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 48 — Add a show folder, Phase 4 (issue #420): the **Show folder pick**'s
 * edges.
 *
 * - The read's **Unplaced** videos land as rows numbered by the **Numbering
 *   guess** (`numberFoundRows`), continuing after the read's numbered
 *   episodes, so every row arrives numbered and editable; two rows claiming
 *   one number are the **Save gate**'s existing refusal.
 * - The read's stray subtitles are counted in one line under the episodes —
 *   _2 subtitle files matched no episode._ — and nothing is drawn at zero.
 * - A folder that is already a held series's **Show folder** (`heldSeriesId`
 *   set) draws _Harbor and Vine is already in your library._ — the series's
 *   own title — as a Refusal, and adds no rows.
 * - A second pick replaces the first folder's rows; rows added by hand stay.
 *
 * The wire is a stubbed `fetch`; the dialog is `fakeFolderBridge`.
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

const SHOW = 'E:\\Shows\\Harbor and Vine';
const SEASON_ONE = `${SHOW}\\Season 1`;

const PILOT = 'Harbor.and.Vine.S01E01.Pilot.mkv';
const LOW_TIDE = 'Harbor.and.Vine.S01E02.Low.Tide.mkv';
const BONUS = 'bonus.mkv';
const LOOSE = 'loose.mkv';

/** A read of `SHOW`: two numbered episodes, two Unplaced videos. */
const READ = {
  path: SHOW,
  titleGuess: 'Harbor and Vine',
  libraryFolderId: null,
  heldSeriesId: null,
  episodes: [
    {
      season: 1,
      number: 1,
      title: 'Pilot',
      video: `${SEASON_ONE}\\${PILOT}`,
      subtitles: [],
    },
    {
      season: 1,
      number: 2,
      title: 'Low Tide',
      video: `${SEASON_ONE}\\${LOW_TIDE}`,
      subtitles: [],
    },
  ],
  unplaced: [`${SEASON_ONE}\\${BONUS}`, `${SHOW}\\${LOOSE}`],
  straySubtitles: 0,
};

/** A read `groupShows` took for a film: nothing numbered, all Unplaced. */
const FILM_SHAPED = {
  ...READ,
  episodes: [],
  unplaced: [`${SHOW}\\the harbor.mkv`, `${SHOW}\\the vine.mkv`],
};

/** Another show, picked second. */
const OTHER_SHOW = 'E:\\Shows\\Lighthouse Keepers';
const ARRIVAL = 'Lighthouse.Keepers.S01E01.Arrival.mkv';
const OTHER_READ = {
  path: OTHER_SHOW,
  titleGuess: 'Lighthouse Keepers',
  libraryFolderId: null,
  heldSeriesId: null,
  episodes: [
    {
      season: 1,
      number: 1,
      title: 'Arrival',
      video: `${OTHER_SHOW}\\${ARRIVAL}`,
      subtitles: [],
    },
  ],
  unplaced: [],
  straySubtitles: 0,
};

/** The held series a held folder's read names, by its own title. */
const HELD_ID = 'harbor-and-vine';
const HELD = makeSeriesDetail([['unwatched']], {
  id: HELD_ID,
  title: 'Harbor and Vine',
});

let answerRead: (path: string) => Promise<Response>;

beforeEach(() => {
  answerRead = () => Promise.resolve(okResponse(READ));

  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (init?.method === 'POST') {
      return Promise.resolve(
        createdResponse(
          makeSeries({ id: 'series-1', title: 'Harbor and Vine' })
        )
      );
    }
    if (url.includes('/api/show-folder')) {
      const path = new URL(url, 'http://localhost').searchParams.get('path');
      return answerRead(path ?? '');
    }
    if (url.includes(`/api/series/${HELD_ID}`)) {
      return Promise.resolve(okResponse(HELD));
    }
    return Promise.resolve(okResponse({ genres: POOL }));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The series form at `/add?kind=series`, with Settings behind it, settled. */
async function renderSeries() {
  const view = render(
    <MemoryRouter
      initialEntries={['/settings', '/add?kind=series']}
      initialIndex={1}
    >
      <ThemeProvider theme={theme}>
        <MovieForm />
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
  await act(async () => undefined);
  return view;
}

const addShowFolder = () =>
  screen.getByRole('button', { name: /add show folder/i });

const episodePicker = () =>
  screen.getByLabelText(/add episode files/i) as HTMLInputElement;

const save = () =>
  screen.getByRole('button', {
    name: /add to library|adding/i,
  }) as HTMLButtonElement;

const showFolderRemove = () =>
  screen.queryByRole('button', { name: /^remove show folder$/i });

const numberFields = () =>
  screen.queryAllByRole('textbox', { name: 'Episode' }) as HTMLInputElement[];

/** The rows on screen as `[season, number, title]`, in the order drawn. */
const drawnRows = () => {
  const seasons = screen.queryAllByRole('textbox', {
    name: 'Season',
  }) as HTMLInputElement[];
  const numbers = numberFields();
  const titles = screen.queryAllByRole('textbox', {
    name: 'Episode title',
  }) as HTMLInputElement[];
  return seasons.map((season, index) => [
    season.value,
    numbers[index].value,
    titles[index].value,
  ]);
};

const STRAY_LINE = /subtitle files? matched no episode/i;
const HELD_REFUSAL = 'Harbor and Vine is already in your library.';

async function pressAddShowFolder() {
  fireEvent.click(addShowFolder());
  await act(async () => undefined);
}

async function pickEpisodes(names: string[]) {
  await userEvent.upload(
    episodePicker(),
    names.map(
      (name) => new File(['video bytes'], name, { type: 'video/x-matroska' })
    ),
    { applyAccept: false }
  );
}

describe('MovieForm — the Show folder pick’s edges', () => {
  const bridge = fakeFolderBridge();

  beforeEach(() => {
    bridge.setPickOne(SHOW);
  });

  describe('Unplaced videos', () => {
    it('arrive numbered by the guess, after the numbered episodes', async () => {
      await renderSeries();

      await pressAddShowFolder();

      await waitFor(() =>
        expect(drawnRows()).toEqual([
          ['1', '1', 'Pilot'],
          ['1', '2', 'Low Tide'],
          ['1', '3', ''],
          ['1', '4', ''],
        ])
      );
      expect(screen.getByText(BONUS)).toBeDefined();
      expect(screen.getByText(LOOSE)).toBeDefined();
    });

    it('number a folder read as a film from 1, every row numbered', async () => {
      answerRead = () => Promise.resolve(okResponse(FILM_SHAPED));
      await renderSeries();

      await pressAddShowFolder();

      await waitFor(() =>
        expect(drawnRows()).toEqual([
          ['1', '1', ''],
          ['1', '2', ''],
        ])
      );
      expect(save().disabled).toBe(false);
    });

    it('stay editable', async () => {
      await renderSeries();
      await pressAddShowFolder();
      await waitFor(() => expect(drawnRows()).toHaveLength(4));

      fireEvent.change(numberFields()[3], { target: { value: '9' } });

      expect(drawnRows()[3]).toEqual(['1', '9', '']);
    });

    it('are refused by the existing gate when two claim one number', async () => {
      await renderSeries();
      await pressAddShowFolder();
      await waitFor(() => expect(drawnRows()).toHaveLength(4));

      fireEvent.change(numberFields()[2], { target: { value: '1' } });

      expect(save().disabled).toBe(true);
      expect(screen.getAllByText('Another file is also S01E01.')).toHaveLength(
        2
      );
    });
  });

  describe('the stray line', () => {
    it('reads the count, under the episodes', async () => {
      answerRead = () =>
        Promise.resolve(okResponse({ ...READ, straySubtitles: 2 }));
      await renderSeries();

      await pressAddShowFolder();

      const line = await screen.findByText(
        '2 subtitle files matched no episode.'
      );
      expect(comesBefore(screen.getByText(LOOSE), line)).toBe(true);
    });

    it('is absent at zero', async () => {
      await renderSeries();

      await pressAddShowFolder();

      await waitFor(() => expect(drawnRows()).toHaveLength(4));
      expect(screen.queryByText(STRAY_LINE)).toBeNull();
    });

    it('goes with the folder’s rows on the ✕', async () => {
      answerRead = () =>
        Promise.resolve(okResponse({ ...READ, straySubtitles: 2 }));
      await renderSeries();
      await pressAddShowFolder();
      await screen.findByText(STRAY_LINE);

      fireEvent.click(showFolderRemove() as HTMLElement);

      expect(screen.queryByText(STRAY_LINE)).toBeNull();
    });
  });

  describe('a held folder', () => {
    beforeEach(() => {
      answerRead = () =>
        Promise.resolve(
          okResponse({
            ...READ,
            // The guess off a scene-named folder is not the series's title.
            titleGuess: 'Harbor Vine',
            heldSeriesId: HELD_ID,
          })
        );
    });

    it('draws its Refusal with the series’s title, under the form’s buttons', async () => {
      await renderSeries();

      await pressAddShowFolder();

      const refusal = await screen.findByText(HELD_REFUSAL);
      expect(comesBefore(save(), refusal)).toBe(true);
    });

    it('adds no rows and no Show folder row', async () => {
      await renderSeries();

      await pressAddShowFolder();

      await screen.findByText(HELD_REFUSAL);
      expect(drawnRows()).toEqual([]);
      expect(showFolderRemove()).toBeNull();
      expect(screen.queryByText(PILOT)).toBeNull();
    });
  });

  describe('a second pick', () => {
    it('replaces the first folder’s rows, and keeps the rows added by hand', async () => {
      answerRead = (path) =>
        Promise.resolve(
          okResponse(
            path === OTHER_SHOW ? OTHER_READ : { ...READ, unplaced: [] }
          )
        );
      await renderSeries();
      await pickEpisodes(['Harbor.and.Vine.S03E01.Bonus.mkv']);
      await pressAddShowFolder();
      await waitFor(() => expect(drawnRows()).toHaveLength(3));

      bridge.setPickOne(OTHER_SHOW);
      await pressAddShowFolder();

      await waitFor(() =>
        expect(drawnRows()).toEqual([
          ['3', '1', 'Bonus'],
          ['1', '1', 'Arrival'],
        ])
      );
      expect(screen.queryByText(SHOW)).toBeNull();
      expect(screen.getByText(OTHER_SHOW)).toBeDefined();
      expect(screen.queryByText(PILOT)).toBeNull();
      expect(screen.queryByText(BONUS)).toBeNull();
      expect(screen.getByText(ARRIVAL)).toBeDefined();
    });
  });
});
