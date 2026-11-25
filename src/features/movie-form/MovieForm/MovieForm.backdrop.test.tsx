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
import type { Genre, ImportProblemDetail } from '@/types';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import {
  createdResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 76, Whole add, Phase 1 (issue #716): the **Backdrop** by hand.
 *
 * Both kinds' Files card draws a Backdrop File field directly under Poster,
 * _Choose backdrop image_ when empty, on the add, the edit and (since #725) a
 * Resolve, which prefills it from the problem detail's found backdrop as a
 * **Found file**, sent as its `backdropPath`. An edit opens on the held backdrop. On the wire it is the Poster's
 * word for word: a **Picked file** is a `backdrop` part, a held **Stored
 * path** a `backdropPath` field, and an edit whose ✕ emptied it sends neither.
 *
 * The wire is a stubbed `fetch`, in a browser: no Path bridge.
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

const KEEPER_FOLDER = 'the-lantern-keeper-2019';
const HELD_MOVIE_BACKDROP = `${KEEPER_FOLDER}/lantern-wide.jpg`;

const KEEPER = makeMovie({
  id: 'a1',
  title: 'The Lantern Keeper',
  year: 2019,
  videoPath: `${KEEPER_FOLDER}/lantern.mp4`,
  posterPath: `${KEEPER_FOLDER}/lantern-poster.jpg`,
  backdropPath: HELD_MOVIE_BACKDROP,
});

const HARBOR_FOLDER = 'harbor-vine-2019';
const HELD_SERIES_BACKDROP = `${HARBOR_FOLDER}/harbor-wide.jpg`;

const HARBOR = makeSeriesDetail([['unwatched']], {
  id: 'harbor',
  title: 'Harbor & Vine',
  posterPath: `${HARBOR_FOLDER}/poster.jpg`,
  backdropPath: HELD_SERIES_BACKDROP,
});

/** A film's `no-folder` Problem. */
const FILM_PROBLEM: ImportProblemDetail = {
  id: 'p3',
  kind: 'no-folder',
  title: 'The Lantern Keeper',
  reason: 'No folder found matching this spreadsheet row.',
  row: { title: 'The Lantern Keeper', year: 2019, genres: ['Drama'] },
  candidates: [],
  files: { videos: [], subtitles: [] },
};

/** A show's `unplaced` Problem. */
const SHOW_PROBLEM: ImportProblemDetail = {
  id: 'p5',
  kind: 'unplaced',
  title: 'The Night Ferry',
  reason: '1 episode needs a number',
  row: { title: 'The Night Ferry', year: 2021, genres: [] },
  folder: 'E:\\Series\\The Night Ferry',
  candidates: [],
  files: {
    videos: ['E:\\Series\\The Night Ferry\\Season 02\\departure.mov'],
    subtitles: [],
  },
};

const LANTERN_SOURCE = 'E:\\Movies\\The Lantern Keeper (2019)';
const FOUND_BACKDROP = `${LANTERN_SOURCE}\\Images\\backdrop.jpg`;

/** A film's `failed` Problem whose Source folder holds a backdrop. */
const FOUND_FILM_PROBLEM: ImportProblemDetail = {
  id: 'p4',
  kind: 'failed',
  title: 'The Lantern Keeper',
  reason: 'The copy failed.',
  row: { title: 'The Lantern Keeper', year: 2019, genres: ['Drama'] },
  folder: LANTERN_SOURCE,
  files: {
    video: `${LANTERN_SOURCE}\\lantern.mp4`,
    videos: [`${LANTERN_SOURCE}\\lantern.mp4`],
    poster: `${LANTERN_SOURCE}\\Images\\poster.jpg`,
    backdrop: FOUND_BACKDROP,
    subtitles: [],
  },
};

const FERRY_SOURCE = 'E:\\Series\\The Night Ferry';
const FOUND_SHOW_BACKDROP = `${FERRY_SOURCE}\\fanart.jpg`;

/** A show's `unplaced` Problem whose Show folder holds a backdrop. */
const FOUND_SHOW_PROBLEM: ImportProblemDetail = {
  ...SHOW_PROBLEM,
  id: 'p8',
  files: { ...SHOW_PROBLEM.files, backdrop: FOUND_SHOW_BACKDROP },
};

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    const method = init?.method?.toUpperCase() ?? 'GET';
    if (method === 'PATCH') {
      return Promise.resolve(
        okResponse(url.includes('/api/series') ? HARBOR.series : KEEPER)
      );
    }
    if (method === 'POST') {
      return Promise.resolve(
        createdResponse(url.includes('/api/series') ? HARBOR.series : KEEPER)
      );
    }
    if (url.includes('/api/genres/pool')) {
      return Promise.resolve(okResponse({ genres: POOL }));
    }
    if (url.includes('/api/import/current/problems/p3')) {
      return Promise.resolve(okResponse(FILM_PROBLEM));
    }
    if (url.includes('/api/import/current/problems/p4')) {
      return Promise.resolve(okResponse(FOUND_FILM_PROBLEM));
    }
    if (url.includes('/api/import/current/problems/p8')) {
      return Promise.resolve(okResponse(FOUND_SHOW_PROBLEM));
    }
    if (url.includes('/api/import/current/problems/p5')) {
      return Promise.resolve(okResponse(SHOW_PROBLEM));
    }
    if (url.includes('/api/movies/a1')) {
      return Promise.resolve(okResponse(KEEPER));
    }
    if (url.includes('/api/series/harbor')) {
      return Promise.resolve(okResponse(HARBOR));
    }
    return Promise.resolve(notFoundResponse('Not here'));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderAt(entries: string[]) {
  render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <ThemeProvider theme={theme}>
        <MovieForm />
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
  await act(async () => undefined);
  await act(async () => undefined);
}

const renderMovieAdd = () => renderAt(['/settings', '/add']);
const renderSeriesAdd = () => renderAt(['/settings', '/add?kind=series']);
const renderMovieEdit = () => renderAt(['/movies/a1', '/add?movie=a1']);
const renderSeriesEdit = () =>
  renderAt(['/series/harbor', '/add?series=harbor']);

const backdropPicker = () =>
  screen.queryByLabelText(/choose backdrop image/i) as HTMLInputElement | null;

const art = (name: string) =>
  new File(['image bytes'], name, { type: 'image/jpeg' });

async function pickBackdrop(file: File) {
  const picker = backdropPicker();
  if (picker === null) throw new Error('No backdrop slot');
  await userEvent.upload(picker, file, { applyAccept: false });
}

const removeBackdrop = () =>
  fireEvent.click(screen.getByRole('button', { name: /remove backdrop/i }));

/** True when `first` is drawn before `second` in the document. */
const before = (first: HTMLElement, second: HTMLElement) =>
  (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !==
  0;

const saves = (method: 'POST' | 'PATCH') =>
  fetchMock.mock.calls.filter(
    ([, init]) => init?.method?.toUpperCase() === method
  );

async function sentBody(method: 'POST' | 'PATCH'): Promise<FormData> {
  await waitFor(() => expect(saves(method)).toHaveLength(1));
  return saves(method)[0][1]?.body as FormData;
}

const titleField = () =>
  screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement;

async function fillMovieAdd() {
  fireEvent.change(titleField(), { target: { value: 'The Lantern Keeper' } });
  await userEvent.upload(
    screen.getByLabelText(/choose video file/i) as HTMLInputElement,
    new File(['video bytes'], 'lantern.mp4', { type: 'video/mp4' }),
    { applyAccept: false }
  );
  await act(async () => undefined);
}

async function fillSeriesAdd() {
  fireEvent.change(titleField(), { target: { value: 'Harbor & Vine' } });
  await userEvent.upload(
    screen.getByLabelText(/add episode files/i) as HTMLInputElement,
    [
      new File(['video bytes'], 'Harbor.S01E01.Pilot.mkv', {
        type: 'video/x-matroska',
      }),
    ],
    { applyAccept: false }
  );
  await act(async () => undefined);
}

const addToLibrary = () =>
  fireEvent.click(screen.getByRole('button', { name: /add to library/i }));
const saveAndContinue = () =>
  fireEvent.click(screen.getByRole('button', { name: /save & continue/i }));
const saveChanges = () =>
  fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

describe('MovieForm: the Backdrop slot is drawn under Poster', () => {
  it('on a movie add, between Poster and Subtitles', async () => {
    await renderMovieAdd();

    const label = screen.getByText(/^backdrop$/i);
    expect(backdropPicker()).not.toBeNull();
    expect(before(screen.getByText(/^poster$/i), label)).toBe(true);
    expect(before(label, screen.getByText(/^subtitles$/i))).toBe(true);
  });

  it('on a series add, between Poster and Episodes', async () => {
    await renderSeriesAdd();

    const label = screen.getByText(/^backdrop$/i);
    expect(backdropPicker()).not.toBeNull();
    expect(before(screen.getByText(/^poster$/i), label)).toBe(true);
    expect(before(label, screen.getByText(/^episodes$/i))).toBe(true);
  });

  it('on a movie edit, holding the held backdrop', async () => {
    await renderMovieEdit();

    expect(screen.getByText(/^backdrop$/i)).toBeDefined();
    expect(screen.getByText('lantern-wide.jpg')).toBeDefined();
    expect(backdropPicker()).toBeNull();
  });

  it('on a series edit, holding the held backdrop', async () => {
    await renderSeriesEdit();

    expect(screen.getByText(/^backdrop$/i)).toBeDefined();
    expect(screen.getByText('harbor-wide.jpg')).toBeDefined();
    expect(backdropPicker()).toBeNull();
  });
});

describe('MovieForm: a Resolve draws the Backdrop slot under Poster (#725)', () => {
  it('on a film Resolve, between Poster and Subtitles, empty when none was found', async () => {
    await renderAt(['/settings', '/import', '/add?problem=p3']);

    const label = screen.getByText(/^backdrop$/i);
    expect(backdropPicker()).not.toBeNull();
    expect(before(screen.getByText(/^poster$/i), label)).toBe(true);
    expect(before(label, screen.getByText(/^subtitles$/i))).toBe(true);
  });

  it('on a Series Resolve, between Poster and Episodes, empty when none was found', async () => {
    await renderAt(['/settings', '/import', '/add?kind=series&problem=p5']);

    const label = screen.getByText(/^backdrop$/i);
    expect(backdropPicker()).not.toBeNull();
    expect(before(screen.getByText(/^poster$/i), label)).toBe(true);
    expect(before(label, screen.getByText(/^episodes$/i))).toBe(true);
  });

  it('on a Series Resolve joining a held series', async () => {
    await renderAt([
      '/settings',
      '/import',
      '/add?kind=series&problem=p5&series=harbor',
    ]);

    expect(screen.getByText(/^poster$/i)).toBeDefined();
    expect(screen.getByText(/^backdrop$/i)).toBeDefined();
  });

  it('prefills a film Resolve’s slot with the found backdrop, as Poster is', async () => {
    await renderAt(['/settings', '/import', '/add?problem=p4']);

    expect(screen.getByText('backdrop.jpg')).toBeDefined();
    expect(backdropPicker()).toBeNull();
  });

  it('prefills a Series Resolve’s slot with the found backdrop', async () => {
    await renderAt(['/settings', '/import', '/add?kind=series&problem=p8']);

    expect(screen.getByText('fanart.jpg')).toBeDefined();
    expect(backdropPicker()).toBeNull();
  });
});

describe('MovieForm: a Resolve’s backdrop on the wire (#725)', () => {
  it('sends a found backdrop as its backdropPath on a film Resolve', async () => {
    await renderAt(['/settings', '/import', '/add?problem=p4']);

    saveAndContinue();
    const body = await sentBody('POST');

    expect(body.getAll('backdropPath')).toEqual([FOUND_BACKDROP]);
    expect(body.getAll('backdrop')).toEqual([]);
  });

  it('sends a found backdrop as its backdropPath on a Series Resolve', async () => {
    await renderAt(['/settings', '/import', '/add?kind=series&problem=p8']);

    saveAndContinue();
    const body = await sentBody('POST');

    expect(body.getAll('backdropPath')).toEqual([FOUND_SHOW_BACKDROP]);
    expect(body.getAll('backdrop')).toEqual([]);
  });

  it('sends a picked backdrop as a backdrop part in place of the found one', async () => {
    await renderAt(['/settings', '/import', '/add?problem=p4']);
    const wide = art('lantern-new.jpg');

    removeBackdrop();
    await pickBackdrop(wide);
    saveAndContinue();
    const body = await sentBody('POST');

    expect(body.getAll('backdrop')).toEqual([wide]);
    expect(body.getAll('backdropPath')).toEqual([]);
  });

  it('sends a picked backdrop as a backdrop part on a Series Resolve', async () => {
    await renderAt(['/settings', '/import', '/add?kind=series&problem=p5']);
    const wide = art('ferry-wide.jpg');

    await pickBackdrop(wide);
    saveAndContinue();
    const body = await sentBody('POST');

    expect(body.getAll('backdrop')).toEqual([wide]);
    expect(body.getAll('backdropPath')).toEqual([]);
  });

  it('sends neither when no backdrop was found or picked, as today', async () => {
    await renderAt(['/settings', '/import', '/add?kind=series&problem=p5']);

    expect(backdropPicker()).not.toBeNull();
    saveAndContinue();
    const body = await sentBody('POST');

    expect(body.getAll('backdrop')).toEqual([]);
    expect(body.getAll('backdropPath')).toEqual([]);
  });
});

describe('MovieForm: the backdrop on the wire', () => {
  it('uploads a picked backdrop’s bytes as a backdrop part on a browser movie add', async () => {
    await renderMovieAdd();
    await fillMovieAdd();
    const wide = art('lantern-wide.jpg');

    await pickBackdrop(wide);
    addToLibrary();
    const body = await sentBody('POST');

    expect(body.getAll('backdrop')).toEqual([wide]);
    expect(body.getAll('backdropPath')).toEqual([]);
  });

  it('sends a picked backdrop as a backdrop part on a series add', async () => {
    await renderSeriesAdd();
    await fillSeriesAdd();
    const wide = art('harbor-wide.jpg');

    await pickBackdrop(wide);
    addToLibrary();
    const body = await sentBody('POST');

    expect(body.getAll('backdrop')).toEqual([wide]);
  });

  it('keeps a movie’s held backdrop by sending its Stored path', async () => {
    await renderMovieEdit();

    saveChanges();
    const body = await sentBody('PATCH');

    expect(body.getAll('backdropPath')).toEqual([HELD_MOVIE_BACKDROP]);
    expect(body.getAll('backdrop')).toEqual([]);
  });

  it('keeps a series’ held backdrop by sending its Stored path', async () => {
    await renderSeriesEdit();

    saveChanges();
    const body = await sentBody('PATCH');

    expect(body.getAll('backdropPath')).toEqual([HELD_SERIES_BACKDROP]);
    expect(body.getAll('backdrop')).toEqual([]);
  });

  it('sends neither once the ✕ took the held backdrop away', async () => {
    await renderMovieEdit();

    removeBackdrop();
    expect(backdropPicker()).not.toBeNull();
    saveChanges();
    const body = await sentBody('PATCH');

    expect(body.getAll('backdropPath')).toEqual([]);
    expect(body.getAll('backdrop')).toEqual([]);
  });

  it('sends a new pick in place of the held one on a series edit', async () => {
    await renderSeriesEdit();
    const wide = art('harbor-new.jpg');

    removeBackdrop();
    await pickBackdrop(wide);
    expect(screen.getByText('harbor-new.jpg')).toBeDefined();
    saveChanges();
    const body = await sentBody('PATCH');

    expect(body.getAll('backdrop')).toEqual([wide]);
    expect(body.getAll('backdropPath')).toEqual([]);
  });
});
