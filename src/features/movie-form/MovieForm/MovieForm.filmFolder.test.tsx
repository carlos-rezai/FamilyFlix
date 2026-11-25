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
import type { FilmFolderRead, Genre, ImportProblemDetail } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 76, Whole add, Phase 4 (issue #719): a film taken whole.
 *
 * In the shell, on a plain movie add, a picked video's path is read through
 * the **Path bridge** and its folder asked for with the **Film folder read**,
 * `GET /api/film-folder?video=`. Its art fills the Poster and Backdrop by the
 * one fill rule (the Folder key's): a slot is filled when it is empty or still
 * holds the earlier pick's file, never over a file picked by hand. Each track
 * becomes a found Subtitles row, its language chosen, after the hand-added
 * rows. The video's ✕ takes back only the pick's own fills, and an answer
 * that lands after a later pick or after the ✕ is dropped. No loader is
 * drawn. On a save the found art travels as `posterPath` and `backdropPath`,
 * the found tracks as `subtitlePath`.
 *
 * An edit's replacement video, a **Resolve** and a browser read no folder.
 *
 * The wire is a stubbed `fetch` answering each video's read by its path; the
 * bridge is `fakeFolderBridge`.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

const POOL: Genre[] = [{ id: 'g1', name: 'Drama' }];

const HEAT = 'Heat.mkv';
const HEAT_DIR = 'E:\\Films\\Heat (1995)';
const HEAT_PATH = `${HEAT_DIR}\\Heat.mkv`;
const RONIN = 'Ronin.mkv';
const RONIN_DIR = 'E:\\Films\\Ronin (1998)';
const RONIN_PATH = `${RONIN_DIR}\\Ronin.mkv`;

/** Each video's Film folder read, by its path. */
const READS: Record<string, FilmFolderRead> = {
  [HEAT_PATH]: {
    poster: `${HEAT_DIR}\\Images\\heat-poster.jpg`,
    backdrop: `${HEAT_DIR}\\Images\\heat-backdrop.jpg`,
    subtitles: [
      { path: `${HEAT_DIR}\\Subtitles\\Heat.pt.srt`, language: 'Portuguese' },
      { path: `${HEAT_DIR}\\Subtitles\\Heat.fr.srt`, language: 'French' },
    ],
  },
  [RONIN_PATH]: {
    poster: `${RONIN_DIR}\\Images\\ronin-poster.jpg`,
    backdrop: `${RONIN_DIR}\\Images\\ronin-backdrop.jpg`,
    subtitles: [
      { path: `${RONIN_DIR}\\Subtitles\\Ronin.de.srt`, language: 'German' },
    ],
  },
};

/** A `no-folder` row: the sheet named the film, no folder held it. */
const HEAT_NO_FOLDER: ImportProblemDetail = {
  id: 'p3',
  kind: 'no-folder',
  title: 'Heat',
  reason: 'No folder found matching this spreadsheet row.',
  row: { title: 'Heat', year: 1995, genres: ['Drama'] },
  candidates: [],
  files: { videos: [], subtitles: [] },
};

/** Paths whose read is held until `release` answers it. */
let held: Map<string, (read: FilmFolderRead) => void>;

/** Answer the held read of `path`. */
async function release(path: string) {
  const answer = held.get(path);
  if (answer === undefined) throw new Error(`No read of ${path} is held`);
  held.delete(path);
  await act(async () => answer(READS[path]));
  await act(async () => undefined);
}

/** Hold the next read of `path` until `release(path)`. */
const holdRead = (path: string) => held.set(path, () => undefined);

beforeEach(() => {
  held = new Map();
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    const method = init?.method?.toUpperCase() ?? 'GET';
    if (url.includes('/api/import/current/problems/')) {
      return Promise.resolve(
        method === 'POST'
          ? createdResponse(makeMovie({ id: 'm1', title: 'Heat' }))
          : okResponse(HEAT_NO_FOLDER)
      );
    }
    if (method === 'POST' || method === 'PATCH') {
      return Promise.resolve(
        createdResponse(makeMovie({ id: 'm1', title: 'Heat' }))
      );
    }
    if (url.includes('/api/film-folder')) {
      const video =
        new URL(url, 'http://localhost').searchParams.get('video') ?? '';
      if (held.has(video)) {
        return new Promise((resolve) =>
          held.set(video, (read) => resolve(okResponse(read)))
        );
      }
      return Promise.resolve(okResponse(READS[video]));
    }
    if (url.includes('/api/library-folders/containing')) {
      return Promise.resolve(okResponse({ libraryFolderId: 'films' }));
    }
    if (url.includes('/api/movies/')) {
      return Promise.resolve(okResponse(makeMovie({ id: 'a1' })));
    }
    return Promise.resolve(okResponse({ genres: POOL }));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The form at `url`, every read on mount settled. */
async function renderAt(url = '/add') {
  render(
    <MemoryRouter initialEntries={['/settings', url]} initialIndex={1}>
      <ThemeProvider theme={theme}>
        <MovieForm />
      </ThemeProvider>
    </MemoryRouter>
  );
  await act(async () => undefined);
  await act(async () => undefined);
}

const videoPicker = () =>
  screen.getByLabelText(/choose video file/i) as HTMLInputElement;
const posterPicker = () =>
  screen.queryByLabelText(/choose poster image/i) as HTMLInputElement | null;
const backdropPicker = () =>
  screen.queryByLabelText(/choose backdrop image/i) as HTMLInputElement | null;
const subtitlePicker = () =>
  screen.getByLabelText(/add subtitle file/i) as HTMLInputElement;

async function pickVideo(name: string) {
  const file = new File(['video bytes'], name, { type: 'video/mp4' });
  await userEvent.upload(videoPicker(), file, { applyAccept: false });
  await act(async () => undefined);
  await act(async () => undefined);
}

async function removeVideo() {
  fireEvent.click(screen.getByRole('button', { name: /remove video/i }));
  await act(async () => undefined);
}

const removePoster = () =>
  fireEvent.click(screen.getByRole('button', { name: /remove poster/i }));

async function pickByHand(picker: () => HTMLInputElement | null, name: string) {
  const input = picker();
  if (input === null) throw new Error('No empty slot');
  await userEvent.upload(
    input,
    new File(['image bytes'], name, { type: 'image/jpeg' }),
    { applyAccept: false }
  );
}

async function attachSubtitle(name: string) {
  await userEvent.upload(
    subtitlePicker(),
    new File(['cue bytes'], name, { type: 'text/plain' }),
    { applyAccept: false }
  );
}

/** Every row's language control, in the order the rows are drawn. */
const languageControls = () =>
  screen.getAllByRole('button', { name: /^language for /i });

/** Each row's file and language, in the order the rows are drawn. */
const rows = () =>
  languageControls().map((control) =>
    (control.getAttribute('aria-label') ?? '')
      .replace(/^language for /i, '')
      .split(': ')
  );

const filmFolderReads = () =>
  fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/api/film-folder'));

const movieSaves = () =>
  fetchMock.mock.calls.filter(
    ([input, init]) =>
      String(input).includes('/api/movies') && init?.method === 'POST'
  );

async function savedBody(): Promise<FormData> {
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
    target: { value: 'Heat' },
  });
  fireEvent.click(screen.getByRole('button', { name: /add to library/i }));
  await waitFor(() => expect(movieSaves()).toHaveLength(1));
  return movieSaves()[0][1]?.body as FormData;
}

describe('MovieForm: the Film folder read on a shell movie add', () => {
  const bridge = fakeFolderBridge();

  beforeEach(() => {
    bridge.setPathOf(HEAT, HEAT_PATH);
    bridge.setPathOf(RONIN, RONIN_PATH);
  });

  it('reads the picked video’s folder by its path', async () => {
    await renderAt();

    await pickVideo(HEAT);

    await waitFor(() => expect(filmFolderReads()).toHaveLength(1));
    const asked = new URL(filmFolderReads()[0], 'http://localhost');
    expect(asked.pathname).toBe('/api/film-folder');
    expect(asked.searchParams.get('video')).toBe(HEAT_PATH);
  });

  it('fills the empty Poster and Backdrop with the film’s art, drawing no loader', async () => {
    await renderAt();

    await pickVideo(HEAT);

    await waitFor(() =>
      expect(screen.getByText('heat-poster.jpg')).toBeDefined()
    );
    expect(screen.getByText('heat-backdrop.jpg')).toBeDefined();
    expect(posterPicker()).toBeNull();
    expect(backdropPicker()).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('adds one row per track, its language chosen, after the hand-added rows', async () => {
    await renderAt();
    await attachSubtitle('mine.en.srt');

    await pickVideo(HEAT);

    await waitFor(() => expect(languageControls()).toHaveLength(3));
    expect(rows()).toEqual([
      ['mine.en.srt', 'English'],
      ['Heat.pt.srt', 'Portuguese'],
      ['Heat.fr.srt', 'French'],
    ]);
  });

  it('sends the found art as posterPath and backdropPath, the tracks as subtitlePath', async () => {
    await renderAt();
    await attachSubtitle('mine.en.srt');
    await pickVideo(HEAT);
    await waitFor(() => expect(languageControls()).toHaveLength(3));

    const body = await savedBody();

    expect(body.getAll('posterPath')).toEqual([
      `${HEAT_DIR}\\Images\\heat-poster.jpg`,
    ]);
    expect(body.getAll('backdropPath')).toEqual([
      `${HEAT_DIR}\\Images\\heat-backdrop.jpg`,
    ]);
    expect(body.getAll('poster')).toEqual([]);
    expect(body.getAll('backdrop')).toEqual([]);
    expect(body.getAll('subtitlePath')).toEqual([
      '',
      `${HEAT_DIR}\\Subtitles\\Heat.pt.srt`,
      `${HEAT_DIR}\\Subtitles\\Heat.fr.srt`,
    ]);
    expect(body.getAll('subtitleLanguage')).toEqual([
      'English',
      'Portuguese',
      'French',
    ]);
    expect(
      (body.getAll('subtitle') as File[]).map((file) => file.name)
    ).toEqual(['mine.en.srt']);
  });

  it('never fills a slot picked by hand, and fills the empty one', async () => {
    await renderAt();
    await pickByHand(posterPicker, 'my-poster.jpg');

    await pickVideo(HEAT);

    await waitFor(() =>
      expect(screen.getByText('heat-backdrop.jpg')).toBeDefined()
    );
    expect(screen.getByText('my-poster.jpg')).toBeDefined();
    expect(screen.queryByText('heat-poster.jpg')).toBeNull();
  });

  it('takes back the pick’s art and tracks with the video’s ✕, keeping the hand-added rows', async () => {
    await renderAt();
    await attachSubtitle('mine.en.srt');
    await pickVideo(HEAT);
    await waitFor(() => expect(languageControls()).toHaveLength(3));

    await removeVideo();

    expect(screen.queryByText('heat-poster.jpg')).toBeNull();
    expect(screen.queryByText('heat-backdrop.jpg')).toBeNull();
    expect(posterPicker()).not.toBeNull();
    expect(backdropPicker()).not.toBeNull();
    expect(rows()).toEqual([['mine.en.srt', 'English']]);
  });

  it('keeps a slot replaced by hand through the video’s ✕', async () => {
    await renderAt();
    await pickVideo(HEAT);
    await waitFor(() =>
      expect(screen.getByText('heat-poster.jpg')).toBeDefined()
    );
    removePoster();
    await pickByHand(posterPicker, 'my-poster.jpg');

    await removeVideo();

    expect(screen.getByText('my-poster.jpg')).toBeDefined();
    expect(screen.queryByText('heat-backdrop.jpg')).toBeNull();
    expect(backdropPicker()).not.toBeNull();
  });

  it('replaces only the earlier pick’s fills on a later pick', async () => {
    await renderAt();
    await attachSubtitle('mine.en.srt');
    await pickVideo(HEAT);
    await waitFor(() =>
      expect(screen.getByText('heat-poster.jpg')).toBeDefined()
    );
    removePoster();
    await pickByHand(posterPicker, 'my-poster.jpg');

    await removeVideo();
    await pickVideo(RONIN);

    await waitFor(() =>
      expect(screen.getByText('ronin-backdrop.jpg')).toBeDefined()
    );
    expect(screen.getByText('my-poster.jpg')).toBeDefined();
    expect(screen.queryByText('ronin-poster.jpg')).toBeNull();
    expect(screen.queryByText('heat-backdrop.jpg')).toBeNull();
    expect(rows()).toEqual([
      ['mine.en.srt', 'English'],
      ['Ronin.de.srt', 'German'],
    ]);
  });

  it('drops an answer that lands after a later pick', async () => {
    await renderAt();
    holdRead(HEAT_PATH);
    await pickVideo(HEAT);
    await waitFor(() => expect(filmFolderReads()).toHaveLength(1));
    await removeVideo();
    await pickVideo(RONIN);
    await waitFor(() =>
      expect(screen.getByText('ronin-poster.jpg')).toBeDefined()
    );

    await release(HEAT_PATH);

    expect(screen.getByText('ronin-poster.jpg')).toBeDefined();
    expect(screen.getByText('ronin-backdrop.jpg')).toBeDefined();
    expect(screen.queryByText('heat-poster.jpg')).toBeNull();
    expect(screen.queryByText('heat-backdrop.jpg')).toBeNull();
    expect(rows()).toEqual([['Ronin.de.srt', 'German']]);
  });

  it('drops an answer that lands after the video’s ✕', async () => {
    await renderAt();
    holdRead(HEAT_PATH);
    await pickVideo(HEAT);
    await waitFor(() => expect(filmFolderReads()).toHaveLength(1));
    await removeVideo();

    await release(HEAT_PATH);

    expect(screen.queryByText('heat-poster.jpg')).toBeNull();
    expect(screen.queryByText('heat-backdrop.jpg')).toBeNull();
    expect(posterPicker()).not.toBeNull();
    expect(backdropPicker()).not.toBeNull();
    expect(
      screen.queryAllByRole('button', { name: /^language for /i })
    ).toEqual([]);
  });
});

describe('MovieForm: where no folder is read', () => {
  describe('in the shell', () => {
    const bridge = fakeFolderBridge();

    beforeEach(() => {
      bridge.setPathOf(HEAT, HEAT_PATH);
    });

    it('reads no folder for an edit’s replacement video', async () => {
      await renderAt('/add?movie=a1');
      await removeVideo();

      await pickVideo(HEAT);

      expect(filmFolderReads()).toEqual([]);
      expect(screen.queryByText('heat-poster.jpg')).toBeNull();
    });

    it('reads no folder on a Resolve', async () => {
      await renderAt('/add?problem=p3');

      await pickVideo(HEAT);

      expect(filmFolderReads()).toEqual([]);
      expect(screen.queryByText('heat-poster.jpg')).toBeNull();
    });
  });

  it('reads no folder in a browser', async () => {
    await renderAt();

    await pickVideo(HEAT);

    expect(filmFolderReads()).toEqual([]);
    expect(posterPicker()).not.toBeNull();
  });
});
