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
import { makeSeries } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 48 — Add a show folder, Phase 1 (issue #417): the **Show folder pick**,
 * copied.
 *
 * On the series add in the shell, _＋ Add show folder_ sits before _＋ Add
 * episode files_ and opens the **Folder bridge**'s `pickOne()`; a browser has
 * no bridge and draws no button. The folder picked is read by
 * `GET /api/show-folder?path=`, and the **Show folder read** fills the **Show
 * folder row** (_Show folder_, the path, a ✕), then one **Episode file row**
 * per episode — season, then episode order — each a **Found file** with its
 * Subtitle rows. An empty title takes the read's **Title guess**; a typed one
 * is kept. A refusal of the read — `400` with its one sentence — is drawn
 * under the form's buttons and adds no rows. The ✕ takes only the folder's
 * rows off; rows from _＋ Add episode files_ stay.
 *
 * On Save a folder row travels as its `episode` field's `videoPath` and its
 * tracks as `storedSubtitles`, with no bytes after it — the server copies
 * them in — while a picked row still sends its bytes. _Adding…_ reads while
 * the server copies.
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
const SEASON_TWO = `${SHOW}\\Season 2`;

const PILOT = 'Harbor.and.Vine.S01E01.Pilot.mkv';
const PILOT_TRACK = 'Harbor.and.Vine.S01E01.Pilot.pt.srt';
const LOW_TIDE = 'Harbor.and.Vine.S01E02.Low.Tide.mkv';
const SPRING_TIDE = 'Harbor.and.Vine.S02E01.Spring.Tide.mkv';

/** What a row shows of each: its path inside the show. */
const PILOT_ROW = `Season 1/${PILOT}`;
const LOW_TIDE_ROW = `Season 1/${LOW_TIDE}`;
const SPRING_TIDE_ROW = `Season 2/${SPRING_TIDE}`;

/** What `GET /api/show-folder` answers for the picked show. */
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
      relativePath: PILOT_ROW,
      video: `${SEASON_ONE}\\${PILOT}`,
      subtitles: [
        { path: `${SEASON_ONE}\\${PILOT_TRACK}`, language: 'Portuguese' },
      ],
    },
    {
      season: 1,
      number: 2,
      title: 'Low Tide',
      relativePath: LOW_TIDE_ROW,
      video: `${SEASON_ONE}\\${LOW_TIDE}`,
      subtitles: [],
    },
    {
      season: 2,
      number: 1,
      title: 'Spring Tide',
      relativePath: SPRING_TIDE_ROW,
      video: `${SEASON_TWO}\\${SPRING_TIDE}`,
      subtitles: [],
    },
  ],
  unplaced: [],
  straySubtitles: 0,
};

const UNREADABLE = 'That folder can’t be read.';
const EMPTY = 'There are no videos in that folder.';

/** A `400` carrying the route's one sentence. */
const refusedResponse = (error: string): Response =>
  ({
    ok: false,
    status: 400,
    json: () => Promise.resolve({ error }),
  }) as unknown as Response;

let answerRead: () => Promise<Response>;
let answerSave: () => Promise<Response>;

beforeEach(() => {
  answerRead = () => Promise.resolve(okResponse(READ));
  answerSave = () =>
    Promise.resolve(
      createdResponse(makeSeries({ id: 'series-1', title: 'Harbor and Vine' }))
    );

  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    if (init?.method === 'POST') {
      return answerSave();
    }
    if (String(input).includes('/api/show-folder')) {
      return answerRead();
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

const seriesTitle = () =>
  screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement;

const save = () =>
  screen.getByRole('button', {
    name: /add to library|adding/i,
  }) as HTMLButtonElement;

const showFolderRemove = () =>
  screen.queryByRole('button', { name: /^remove show folder$/i });

/** The rows on screen as `[season, number, title]`, in the order drawn. */
const drawnRows = () => {
  const seasons = screen.queryAllByRole('textbox', {
    name: 'Season',
  }) as HTMLInputElement[];
  const numbers = screen.queryAllByRole('textbox', {
    name: 'Episode',
  }) as HTMLInputElement[];
  const titles = screen.queryAllByRole('textbox', {
    name: 'Episode title',
  }) as HTMLInputElement[];
  return seasons.map((season, index) => [
    season.value,
    numbers[index].value,
    titles[index].value,
  ]);
};

/** Every read of a picked folder the form has issued. */
const folderReads = () =>
  fetchMock.mock.calls.filter(([input]) =>
    String(input).includes('/api/show-folder')
  );

const seriesSaves = () =>
  fetchMock.mock.calls.filter(
    ([input, init]) =>
      String(input).includes('/api/series') && init?.method === 'POST'
  );

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

describe('MovieForm — Add show folder in the shell', () => {
  const bridge = fakeFolderBridge();

  describe('the button', () => {
    it('is drawn before Add episode files', async () => {
      await renderSeries();

      expect(comesBefore(addShowFolder(), episodePicker())).toBe(true);
    });

    it('opens the one-folder dialog', async () => {
      await renderSeries();

      await pressAddShowFolder();

      expect(bridge.pickOnes()).toBe(1);
    });

    it('changes nothing on a cancelled dialog', async () => {
      bridge.setPickOne(null);
      await renderSeries();

      await pressAddShowFolder();

      expect(folderReads()).toEqual([]);
      expect(drawnRows()).toEqual([]);
      expect(showFolderRemove()).toBeNull();
      expect(seriesTitle().value).toBe('');
    });
  });

  describe('a pick', () => {
    beforeEach(() => {
      bridge.setPickOne(SHOW);
    });

    it('reads the folder picked', async () => {
      await renderSeries();

      await pressAddShowFolder();

      expect(folderReads()).toHaveLength(1);
      expect(String(folderReads()[0][0])).toContain(
        `/api/show-folder?path=${encodeURIComponent(SHOW)}`
      );
    });

    it('fills the Show folder row with the path', async () => {
      await renderSeries();

      await pressAddShowFolder();

      await waitFor(() => expect(showFolderRemove()).not.toBeNull());
      expect(screen.getByText('Show folder')).toBeDefined();
      expect(screen.getByText(SHOW)).toBeDefined();
    });

    it('fills one row per episode, in season then episode order, after the Show folder row', async () => {
      await renderSeries();

      await pressAddShowFolder();

      await waitFor(() =>
        expect(drawnRows()).toEqual([
          ['1', '1', 'Pilot'],
          ['1', '2', 'Low Tide'],
          ['2', '1', 'Spring Tide'],
        ])
      );
      expect(screen.getByText(PILOT_ROW)).toBeDefined();
      expect(screen.getByText(SPRING_TIDE_ROW)).toBeDefined();
      expect(
        comesBefore(screen.getByText(SHOW), screen.getByText(PILOT_ROW))
      ).toBe(true);
    });

    it('draws each episode’s found subtitles under it, in their languages', async () => {
      await renderSeries();

      await pressAddShowFolder();

      const language = await screen.findByRole('button', {
        name: `Language for ${PILOT_TRACK}: Portuguese`,
      });
      expect(comesBefore(screen.getByText(PILOT_ROW), language)).toBe(true);
      expect(comesBefore(language, screen.getByText(LOW_TIDE_ROW))).toBe(true);
      expect(
        screen.queryAllByRole('button', { name: /^language for /i })
      ).toHaveLength(1);
    });

    it('fills an empty title with the Title guess', async () => {
      await renderSeries();

      await pressAddShowFolder();

      await waitFor(() => expect(seriesTitle().value).toBe('Harbor and Vine'));
    });

    it('keeps a typed title', async () => {
      await renderSeries();
      fireEvent.change(seriesTitle(), { target: { value: 'Harbor & Vine' } });

      await pressAddShowFolder();

      await waitFor(() => expect(drawnRows()).toHaveLength(3));
      expect(seriesTitle().value).toBe('Harbor & Vine');
    });
  });

  describe('a refused read', () => {
    beforeEach(() => {
      bridge.setPickOne(SHOW);
    });

    it.each([UNREADABLE, EMPTY])(
      'draws “%s” under the form’s buttons, and adds no rows',
      async (sentence) => {
        answerRead = () => Promise.resolve(refusedResponse(sentence));
        await renderSeries();

        await pressAddShowFolder();

        const refusal = await screen.findByText(sentence);
        expect(comesBefore(save(), refusal)).toBe(true);
        expect(drawnRows()).toEqual([]);
        expect(showFolderRemove()).toBeNull();
        expect(seriesTitle().value).toBe('');
      }
    );
  });

  describe('the Show folder row’s ✕', () => {
    beforeEach(() => {
      bridge.setPickOne(SHOW);
    });

    it('takes the folder’s rows off and keeps the rows added by hand', async () => {
      await renderSeries();
      await pickEpisodes(['Harbor.and.Vine.S03E01.Bonus.mkv']);
      await pressAddShowFolder();
      await waitFor(() => expect(drawnRows()).toHaveLength(4));

      fireEvent.click(showFolderRemove() as HTMLElement);

      expect(drawnRows()).toEqual([['3', '1', 'Bonus']]);
      expect(screen.queryByText(SHOW)).toBeNull();
      expect(screen.queryByText(PILOT_ROW)).toBeNull();
      expect(screen.queryByText(PILOT_TRACK)).toBeNull();
    });

    it('leaves Add episode files working beside the folder', async () => {
      await renderSeries();
      await pressAddShowFolder();
      await waitFor(() => expect(drawnRows()).toHaveLength(3));

      await pickEpisodes(['Harbor.and.Vine.S03E01.Bonus.mkv']);

      expect(drawnRows()).toEqual([
        ['1', '1', 'Pilot'],
        ['1', '2', 'Low Tide'],
        ['2', '1', 'Spring Tide'],
        ['3', '1', 'Bonus'],
      ]);
      expect(addShowFolder()).toBeDefined();
    });
  });

  describe('saving', () => {
    beforeEach(() => {
      bridge.setPickOne(SHOW);
    });

    it('sends each folder row as its paths, with no bytes, and a picked row as its bytes', async () => {
      await renderSeries();
      await pressAddShowFolder();
      await waitFor(() => expect(drawnRows()).toHaveLength(3));
      await pickEpisodes(['Harbor.and.Vine.S03E01.Bonus.mkv']);

      fireEvent.click(save());
      await waitFor(() => expect(seriesSaves()).toHaveLength(1));

      const body = seriesSaves()[0][1]?.body as FormData;
      const keys = [...body.keys()];
      expect(keys.filter((key) => key.startsWith('episode'))).toEqual([
        'episode',
        'episode',
        'episode',
        'episode',
        'episodeVideo',
      ]);
      const fields = body
        .getAll('episode')
        .map((part) => JSON.parse(String(part)) as Record<string, unknown>);
      expect(fields[0]).toMatchObject({
        season: 1,
        number: 1,
        title: 'Pilot',
        videoPath: `${SEASON_ONE}\\${PILOT}`,
        storedSubtitles: [
          { path: `${SEASON_ONE}\\${PILOT_TRACK}`, language: 'Portuguese' },
        ],
      });
      expect(fields[2]).toMatchObject({
        season: 2,
        number: 1,
        videoPath: `${SEASON_TWO}\\${SPRING_TIDE}`,
      });
      expect(fields[3]).toMatchObject({ season: 3, number: 1 });
      expect(fields[3]).not.toHaveProperty('videoPath');
      expect(
        (body.getAll('episodeVideo') as File[]).map((file) => file.name)
      ).toEqual(['Harbor.and.Vine.S03E01.Bonus.mkv']);
    });

    it('locks at once and takes no second press while the server copies', async () => {
      let settle: (response: Response) => void = () => undefined;
      answerSave = () =>
        new Promise<Response>((resolve) => {
          settle = resolve;
        });
      await renderSeries();
      await pressAddShowFolder();
      await waitFor(() => expect(drawnRows()).toHaveLength(3));

      fireEvent.click(save());

      // Locked at once. Its _Adding…_ on the **Loader timing** is
      // `MovieForm.busySave`'s, on fake timers.
      expect(save().disabled).toBe(true);
      fireEvent.click(save());
      expect(seriesSaves()).toHaveLength(1);

      await act(async () => {
        settle(
          createdResponse(
            makeSeries({ id: 'series-1', title: 'Harbor and Vine' })
          )
        );
      });
    });
  });
});
