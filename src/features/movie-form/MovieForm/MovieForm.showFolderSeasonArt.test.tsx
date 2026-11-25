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
import type { Genre, ShowFolderRead } from '@/types';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';

/**
 * 76, Whole add, Phase 3 (issue #718): the pick fills the Season posters and
 * the Stills.
 *
 * The **Show folder pick** fills each _Season posters_ slot its rows hold
 * with the season's found **Season poster**, and each row's **Still** with
 * its found Still, each a **Found file**, by the one fill rule: never over a
 * file picked by hand. The Show folder row's ✕ takes them back and keeps a
 * hand pick. On a save a found Season poster travels as its `seasonPoster`
 * field's `path`, a found Still as its `episode` field's `stillPath`.
 *
 * The wire is a stubbed `fetch` answering each folder's read by its path;
 * the dialog is `fakeFolderBridge`.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

const POOL: Genre[] = [{ id: 'g1', name: 'Comedy' }];

const SHOW = 'E:\\Shows\\The Show (2019)';
const OTHER = 'E:\\Shows\\Other Show';
const S1_POSTER = `${SHOW}\\Season 01\\Images\\s1-poster.jpg`;
const S2_POSTER = `${SHOW}\\Season 02\\Images\\s2-poster.jpg`;
const PILOT_STILL = `${SHOW}\\Season 01\\Images\\Stills\\S01E01.jpg`;
const OTHER_S1_POSTER = `${OTHER}\\Season 01\\Images\\other-s1-poster.jpg`;

/** The Show: two seasons, both with a Season poster, the pilot a Still. */
const THE_SHOW: ShowFolderRead = {
  path: SHOW,
  title: 'The Show',
  year: 2019,
  libraryFolderId: null,
  heldSeriesId: null,
  poster: null,
  backdrop: null,
  seasonPosters: [
    { season: 1, path: S1_POSTER },
    { season: 2, path: S2_POSTER },
  ],
  episodes: [
    {
      season: 1,
      number: 1,
      title: null,
      video: `${SHOW}\\Season 01\\S01E01.mkv`,
      relativePath: 'Season 01/S01E01.mkv',
      subtitles: [],
      still: PILOT_STILL,
    },
    {
      season: 2,
      number: 1,
      title: null,
      video: `${SHOW}\\Season 02\\S02E01.mkv`,
      relativePath: 'Season 02/S02E01.mkv',
      subtitles: [],
      still: null,
    },
  ],
  unplaced: [],
  straySubtitles: 0,
};

/** Another show: one season with its Season poster, no Still. */
const OTHER_SHOW: ShowFolderRead = {
  ...THE_SHOW,
  path: OTHER,
  title: 'Other Show',
  year: null,
  seasonPosters: [{ season: 1, path: OTHER_S1_POSTER }],
  episodes: [
    {
      season: 1,
      number: 1,
      title: null,
      video: `${OTHER}\\S01E01.mkv`,
      relativePath: 'S01E01.mkv',
      subtitles: [],
      still: null,
    },
  ],
};

const READS: Record<string, ShowFolderRead> = {
  [SHOW]: THE_SHOW,
  [OTHER]: OTHER_SHOW,
};

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/show-folder')) {
      const path = new URL(url, 'http://localhost').searchParams.get('path');
      return Promise.resolve(okResponse(READS[path ?? '']));
    }
    return Promise.resolve(okResponse({ genres: POOL }));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The series form at `/add?kind=series`, settled. */
async function renderSeries() {
  render(
    <MemoryRouter initialEntries={['/add?kind=series']}>
      <ThemeProvider theme={theme}>
        <MovieForm />
      </ThemeProvider>
    </MemoryRouter>
  );
  await act(async () => undefined);
}

const seasonPosterPicker = (season: number) =>
  screen.queryByLabelText(
    new RegExp(`choose poster for season ${season}`, 'i')
  ) as HTMLInputElement | null;

const removeSeasonPoster = (season: number) =>
  fireEvent.click(
    screen.getByRole('button', {
      name: `Remove S${String(season).padStart(2, '0')}`,
    })
  );

const image = (name: string) =>
  new File(['image bytes'], name, { type: 'image/jpeg' });

/** Pick `file` into the empty slot `picker` finds. */
async function pickByHand(picker: () => HTMLInputElement | null, file: File) {
  const input = picker();
  if (input === null) throw new Error('No empty slot');
  await userEvent.upload(input, file, { applyAccept: false });
}

/** Add a hand-picked episode video. */
async function addEpisodeByHand(name: string) {
  await userEvent.upload(
    screen.getByLabelText(/add episode files/i) as HTMLInputElement,
    [new File(['video bytes'], name, { type: 'video/x-matroska' })],
    { applyAccept: false }
  );
}

const showFolderRemove = () =>
  screen.getByRole('button', { name: /^remove show folder$/i });

const addToLibrary = () =>
  fireEvent.click(screen.getByRole('button', { name: /add to library/i }));

const saves = () =>
  fetchMock.mock.calls.filter(
    ([, init]) => init?.method?.toUpperCase() === 'POST'
  );

async function sentBody(): Promise<FormData> {
  await waitFor(() => expect(saves()).toHaveLength(1));
  return saves()[0][1]?.body as FormData;
}

describe('MovieForm: the Show folder pick fills Season posters and Stills', () => {
  const bridge = fakeFolderBridge();

  /** Pick `path` with the Show folder pick and wait for its row. */
  async function pick(path: string) {
    bridge.setPickOne(path);
    fireEvent.click(screen.getByRole('button', { name: /add show folder/i }));
    await act(async () => undefined);
    await waitFor(() => expect(screen.getByText(path)).toBeDefined());
  }

  it('fills each season’s poster slot and each row’s Still', async () => {
    await renderSeries();

    await pick(SHOW);

    expect(screen.getByText('s1-poster.jpg')).toBeDefined();
    expect(screen.getByText('s2-poster.jpg')).toBeDefined();
    expect(seasonPosterPicker(1)).toBeNull();
    expect(seasonPosterPicker(2)).toBeNull();
    expect(screen.getByText('S01E01.jpg')).toBeDefined();
    expect(screen.getByLabelText(/choose still for S02E01/i)).toBeDefined();
  });

  it('sends found Season posters as paths and a found Still as stillPath', async () => {
    await renderSeries();
    await pick(SHOW);

    addToLibrary();
    const body = await sentBody();

    expect(
      body.getAll('seasonPoster').map((field) => JSON.parse(field as string))
    ).toEqual([
      { season: 1, path: S1_POSTER },
      { season: 2, path: S2_POSTER },
    ]);
    expect(body.getAll('seasonPosterFile')).toEqual([]);
    const episodes = body
      .getAll('episode')
      .map((field) => JSON.parse(field as string));
    expect(episodes[0]).toMatchObject({ stillPath: PILOT_STILL });
    expect(episodes[1].stillPath).toBeUndefined();
    expect(body.getAll('episodeStill')).toEqual([]);
  });

  it('never fills a Season poster slot picked by hand', async () => {
    await renderSeries();
    await addEpisodeByHand('The.Show.S01E05.mkv');
    await pickByHand(() => seasonPosterPicker(1), image('my-s1.jpg'));

    await pick(SHOW);

    expect(screen.getByText('my-s1.jpg')).toBeDefined();
    expect(screen.queryByText('s1-poster.jpg')).toBeNull();
    expect(screen.getByText('s2-poster.jpg')).toBeDefined();
  });

  it('replaces the first pick’s Season posters on a second pick', async () => {
    await renderSeries();
    await pick(SHOW);

    await pick(OTHER);

    expect(screen.getByText('other-s1-poster.jpg')).toBeDefined();
    expect(screen.queryByText('s1-poster.jpg')).toBeNull();
    expect(screen.queryByText('S01E01.jpg')).toBeNull();
  });

  it('takes the pick’s Season posters back with the ✕, keeping a hand pick', async () => {
    await renderSeries();
    await addEpisodeByHand('The.Show.S01E05.mkv');
    await addEpisodeByHand('The.Show.S02E05.mkv');
    await pick(SHOW);
    removeSeasonPoster(2);
    await pickByHand(() => seasonPosterPicker(2), image('my-s2.jpg'));

    fireEvent.click(showFolderRemove());

    expect(screen.queryByText('s1-poster.jpg')).toBeNull();
    expect(seasonPosterPicker(1)).not.toBeNull();
    expect(screen.getByText('my-s2.jpg')).toBeDefined();
    expect(screen.queryByText('S01E01.jpg')).toBeNull();
  });
});
