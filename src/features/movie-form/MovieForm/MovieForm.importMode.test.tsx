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
import type { Genre, ImportProblemDetail } from '@/types';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';
import {
  makeSeries,
  makeSeriesDetail,
} from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 48 — Add a show folder, Phase 2 (issue #418): the series add links by
 * default.
 *
 * In the shell the series add draws the **Import mode** — `ImportModeChoice`,
 * the caption _Files_ over Link and Copy — and only there: never on a series
 * edit, never on a **Resolve**, never in a browser. **Link** is chosen on every
 * visit, never remembered. The **Show folder read**'s `libraryFolderId`
 * decides whether Link is available: with `null` the Link card is disabled,
 * reading _Only for files inside one of your library folders._, and **Copy**
 * is chosen; a later pick under a **Library folder** enables it again.
 *
 * On Save the body's first field is `mode` — a browser sends `copy` — the
 * folder rows travel as their paths in either mode, and a picked row always
 * as its bytes.
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

const LISTED_SHOW = 'E:\\Shows\\Harbor and Vine';
const UNLISTED_SHOW = 'D:\\Downloads\\Harbor and Vine';

const PILOT = 'Harbor.and.Vine.S01E01.Pilot.mkv';
const LOW_TIDE = 'Harbor.and.Vine.S01E02.Low.Tide.mkv';

/** What `GET /api/show-folder` answers for a show under `libraryFolderId`. */
const readOf = (path: string, libraryFolderId: string | null) => ({
  path,
  titleGuess: 'Harbor and Vine',
  libraryFolderId,
  heldSeriesId: null,
  episodes: [
    {
      season: 1,
      number: 1,
      title: 'Pilot',
      relativePath: `Season 1/${PILOT}`,
      video: `${path}\\Season 1\\${PILOT}`,
      subtitles: [],
    },
    {
      season: 1,
      number: 2,
      title: 'Low Tide',
      relativePath: `Season 1/${LOW_TIDE}`,
      video: `${path}\\Season 1\\${LOW_TIDE}`,
      subtitles: [],
    },
  ],
  unplaced: [],
  unplacedRelative: [],
  straySubtitles: 0,
});

const LISTED_READ = readOf(LISTED_SHOW, 'shows');
const UNLISTED_READ = readOf(UNLISTED_SHOW, null);

/** An `unplaced` Problem, for the Resolve the choice is never drawn on. */
const NIGHT_FERRY: ImportProblemDetail = {
  id: 'p5',
  kind: 'unplaced',
  title: 'The Night Ferry',
  reason: '1 episode needs numbers',
  row: { title: 'The Night Ferry', year: 2021, genres: ['Drama'] },
  folder: 'E:\\Series\\The Night Ferry',
  candidates: [],
  files: {
    subtitles: [],
    videos: ['E:\\Series\\The Night Ferry\\landfall.mov'],
  },
};

const DISABLED_LINE = 'Only for files inside one of your library folders.';

let answerRead: () => Promise<Response>;

beforeEach(() => {
  answerRead = () => Promise.resolve(okResponse(LISTED_READ));

  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (init?.method === 'POST' || init?.method === 'PATCH') {
      return Promise.resolve(
        createdResponse(
          makeSeries({ id: 'series-1', title: 'Harbor and Vine' })
        )
      );
    }
    if (url.includes('/api/show-folder')) {
      return answerRead();
    }
    if (url.includes('/api/import/current/problems/')) {
      return Promise.resolve(okResponse(NIGHT_FERRY));
    }
    if (url.includes('/api/series/')) {
      return Promise.resolve(
        okResponse(makeSeriesDetail([['unwatched']], { id: 'harbor' }))
      );
    }
    return Promise.resolve(okResponse({ genres: POOL }));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The form at `url`, with Settings behind it, every read on mount settled. */
async function renderAt(url = '/add?kind=series') {
  const view = render(
    <MemoryRouter initialEntries={['/settings', url]} initialIndex={1}>
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

const choice = () => screen.queryByRole('radiogroup', { name: 'Files' });

const modeRadio = (name: 'Link' | 'Copy') =>
  within(choice() as HTMLElement).getByRole('radio', {
    name: new RegExp(`^${name}`),
  });

const isChecked = (name: 'Link' | 'Copy') =>
  modeRadio(name).getAttribute('aria-checked') === 'true';

const isDisabled = (element: HTMLElement) =>
  element.hasAttribute('disabled') ||
  element.getAttribute('aria-disabled') === 'true';

const addShowFolder = () =>
  screen.getByRole('button', { name: /add show folder/i });

const episodePicker = () =>
  screen.getByLabelText(/add episode files/i) as HTMLInputElement;

const save = () =>
  screen.getByRole('button', {
    name: /add to library|adding/i,
  }) as HTMLButtonElement;

const drawnRowCount = () =>
  screen.queryAllByRole('textbox', { name: 'Season' }).length;

const seriesSaves = () =>
  fetchMock.mock.calls.filter(
    ([input, init]) =>
      String(input).includes('/api/series') && init?.method === 'POST'
  );

async function pressAddShowFolder(rows = 2) {
  fireEvent.click(addShowFolder());
  await act(async () => undefined);
  await waitFor(() => expect(drawnRowCount()).toBe(rows));
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

/** Press Save and answer the one body it sent. */
async function savedBody(): Promise<FormData> {
  fireEvent.click(save());
  await waitFor(() => expect(seriesSaves()).toHaveLength(1));
  return seriesSaves()[0][1]?.body as FormData;
}

/** The body's `episode` fields, parsed. */
const episodeFields = (body: FormData) =>
  body
    .getAll('episode')
    .map((part) => JSON.parse(String(part)) as Record<string, unknown>);

describe('MovieForm — the Import mode on a shell series add', () => {
  const bridge = fakeFolderBridge();

  describe('where it is drawn', () => {
    it('draws Files over Link and Copy, Link chosen', async () => {
      await renderAt();

      expect(choice()).not.toBeNull();
      expect(isChecked('Link')).toBe(true);
      expect(isChecked('Copy')).toBe(false);
      expect(isDisabled(modeRadio('Link'))).toBe(false);
    });

    it('is drawn on the add and never on a series edit', async () => {
      const add = await renderAt();
      expect(choice()).not.toBeNull();
      add.unmount();

      await renderAt('/add?series=harbor');

      expect(screen.getByRole('textbox', { name: 'Title' })).toBeDefined();
      expect(choice()).toBeNull();
    });

    it('is drawn on the add and never on a Resolve', async () => {
      const add = await renderAt();
      expect(choice()).not.toBeNull();
      add.unmount();

      await renderAt('/add?kind=series&problem=p5');

      expect(screen.getByRole('textbox', { name: 'Title' })).toBeDefined();
      expect(choice()).toBeNull();
    });

    it('chooses Link on every visit, never remembering Copy', async () => {
      const first = await renderAt();
      fireEvent.click(modeRadio('Copy'));
      expect(isChecked('Copy')).toBe(true);
      first.unmount();

      await renderAt();

      expect(isChecked('Link')).toBe(true);
      expect(isChecked('Copy')).toBe(false);
    });
  });

  describe('whether Link is available', () => {
    it('disables Link with its line and chooses Copy for a folder under no Library folder', async () => {
      bridge.setPickOne(UNLISTED_SHOW);
      answerRead = () => Promise.resolve(okResponse(UNLISTED_READ));
      await renderAt();

      await pressAddShowFolder();

      await waitFor(() => expect(isDisabled(modeRadio('Link'))).toBe(true));
      expect(within(modeRadio('Link')).getByText(DISABLED_LINE)).toBeDefined();
      expect(isChecked('Copy')).toBe(true);
      expect(isChecked('Link')).toBe(false);
    });

    it('keeps Copy chosen when the disabled Link is pressed', async () => {
      bridge.setPickOne(UNLISTED_SHOW);
      answerRead = () => Promise.resolve(okResponse(UNLISTED_READ));
      await renderAt();
      await pressAddShowFolder();
      await waitFor(() => expect(isDisabled(modeRadio('Link'))).toBe(true));

      fireEvent.click(modeRadio('Link'));

      expect(isChecked('Copy')).toBe(true);
      expect(isChecked('Link')).toBe(false);
    });

    it('enables Link again on a later pick under a Library folder', async () => {
      bridge.setPickOne(UNLISTED_SHOW);
      answerRead = () => Promise.resolve(okResponse(UNLISTED_READ));
      await renderAt();
      await pressAddShowFolder();
      await waitFor(() => expect(isDisabled(modeRadio('Link'))).toBe(true));

      bridge.setPickOne(LISTED_SHOW);
      answerRead = () => Promise.resolve(okResponse(LISTED_READ));
      await pressAddShowFolder();

      await waitFor(() => expect(isDisabled(modeRadio('Link'))).toBe(false));
      expect(within(modeRadio('Link')).queryByText(DISABLED_LINE)).toBeNull();
      fireEvent.click(modeRadio('Link'));
      expect(isChecked('Link')).toBe(true);
    });
  });

  describe('the wire', () => {
    it('sends mode link first, the folder rows as their paths and a picked row as its bytes', async () => {
      bridge.setPickOne(LISTED_SHOW);
      await renderAt();
      await pressAddShowFolder();
      await pickEpisodes(['Harbor.and.Vine.S01E03.Bonus.mkv']);

      const body = await savedBody();

      expect([...body.keys()][0]).toBe('mode');
      expect(body.get('mode')).toBe('link');
      const fields = episodeFields(body);
      expect(fields[0]).toMatchObject({
        videoPath: `${LISTED_SHOW}\\Season 1\\${PILOT}`,
      });
      expect(fields[1]).toMatchObject({
        videoPath: `${LISTED_SHOW}\\Season 1\\${LOW_TIDE}`,
      });
      expect(fields[2]).not.toHaveProperty('videoPath');
      expect(
        (body.getAll('episodeVideo') as File[]).map((file) => file.name)
      ).toEqual(['Harbor.and.Vine.S01E03.Bonus.mkv']);
    });

    it('sends mode copy first when Copy is chosen, the folder rows still as their paths', async () => {
      bridge.setPickOne(LISTED_SHOW);
      await renderAt();
      await pressAddShowFolder();
      await pickEpisodes(['Harbor.and.Vine.S01E03.Bonus.mkv']);
      fireEvent.click(modeRadio('Copy'));

      const body = await savedBody();

      expect([...body.keys()][0]).toBe('mode');
      expect(body.get('mode')).toBe('copy');
      const fields = episodeFields(body);
      expect(fields[0]).toMatchObject({
        videoPath: `${LISTED_SHOW}\\Season 1\\${PILOT}`,
      });
      expect(fields[2]).not.toHaveProperty('videoPath');
      expect(
        (body.getAll('episodeVideo') as File[]).map((file) => file.name)
      ).toEqual(['Harbor.and.Vine.S01E03.Bonus.mkv']);
    });

    it('sends mode copy when Link is unavailable', async () => {
      bridge.setPickOne(UNLISTED_SHOW);
      answerRead = () => Promise.resolve(okResponse(UNLISTED_READ));
      await renderAt();
      await pressAddShowFolder();

      const body = await savedBody();

      expect([...body.keys()][0]).toBe('mode');
      expect(body.get('mode')).toBe('copy');
      expect(episodeFields(body)[0]).toMatchObject({
        videoPath: `${UNLISTED_SHOW}\\Season 1\\${PILOT}`,
      });
    });
  });
});

describe('MovieForm — the series add in a browser', () => {
  it('draws no Import mode, and sends mode copy first with a picked row’s bytes', async () => {
    await renderAt();
    expect(choice()).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: 'Harbor and Vine' },
    });
    await pickEpisodes(['Harbor.and.Vine.S01E01.Pilot.mkv']);

    const body = await savedBody();

    expect([...body.keys()][0]).toBe('mode');
    expect(body.get('mode')).toBe('copy');
    expect(
      (body.getAll('episodeVideo') as File[]).map((file) => file.name)
    ).toEqual(['Harbor.and.Vine.S01E01.Pilot.mkv']);
  });
});
