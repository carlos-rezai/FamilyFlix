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
 * 76, Whole add, Phase 2 (issue #717): the pick fills the Poster and
 * Backdrop.
 *
 * The **Show folder pick** fills both slots with the show's **Folder art**,
 * each a **Found file**, by the one fill rule (the Folder key's): a slot is
 * filled when it is empty or still holds the earlier pick's file, never over
 * a file picked by hand. The Show folder row's ✕ takes back each slot still
 * holding the pick's art and keeps one replaced by hand. A folder with no
 * art fills nothing and draws nothing. On a save the found art travels as
 * `posterPath` and `backdropPath`.
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

const HARBOR = 'E:\\Shows\\Harbor and Vine';
const LIGHTHOUSE = 'E:\\Shows\\Lighthouse Keepers';
const BARE = 'E:\\Shows\\Bare Show';

/** Each folder's art: its poster and backdrop, absolute, `null` for none. */
const ART: Record<string, { poster: string | null; backdrop: string | null }> =
  {
    [HARBOR]: {
      poster: `${HARBOR}\\Images\\harbor-poster.jpg`,
      backdrop: `${HARBOR}\\Images\\harbor-backdrop.jpg`,
    },
    [LIGHTHOUSE]: {
      poster: `${LIGHTHOUSE}\\Images\\lighthouse-poster.jpg`,
      backdrop: `${LIGHTHOUSE}\\Images\\lighthouse-backdrop.jpg`,
    },
    [BARE]: { poster: null, backdrop: null },
  };

/** A read of `path`, titled by its last segment, holding one episode. */
const readOf = (path: string): ShowFolderRead => ({
  path,
  title: path.slice(path.lastIndexOf('\\') + 1),
  year: null,
  libraryFolderId: null,
  heldSeriesId: null,
  ...(ART[path] ?? { poster: null, backdrop: null }),
  episodes: [
    {
      season: 1,
      number: 1,
      title: null,
      video: `${path}\\S01E01.mkv`,
      relativePath: 'S01E01.mkv',
      subtitles: [],
    },
  ],
  unplaced: [],
  straySubtitles: 0,
});

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/show-folder')) {
      const path = new URL(url, 'http://localhost').searchParams.get('path');
      return Promise.resolve(okResponse(readOf(path ?? '')));
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

const posterPicker = () =>
  screen.queryByLabelText(/choose poster image/i) as HTMLInputElement | null;
const backdropPicker = () =>
  screen.queryByLabelText(/choose backdrop image/i) as HTMLInputElement | null;

const art = (name: string) =>
  new File(['image bytes'], name, { type: 'image/jpeg' });

/** Pick `file` into the empty slot `picker` finds. */
async function pickByHand(picker: () => HTMLInputElement | null, file: File) {
  const input = picker();
  if (input === null) throw new Error('No empty slot');
  await userEvent.upload(input, file, { applyAccept: false });
}

const removePoster = () =>
  fireEvent.click(screen.getByRole('button', { name: /remove poster/i }));

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

describe('MovieForm: the Show folder pick fills the art', () => {
  const bridge = fakeFolderBridge();

  /** Pick `path` with the Show folder pick and wait for its row. */
  async function pick(path: string) {
    bridge.setPickOne(path);
    fireEvent.click(screen.getByRole('button', { name: /add show folder/i }));
    await act(async () => undefined);
    await waitFor(() => expect(screen.getByText(path)).toBeDefined());
  }

  it('fills the empty Poster and Backdrop with the show’s art', async () => {
    await renderSeries();

    await pick(HARBOR);

    expect(screen.getByText('harbor-poster.jpg')).toBeDefined();
    expect(screen.getByText('harbor-backdrop.jpg')).toBeDefined();
    expect(posterPicker()).toBeNull();
    expect(backdropPicker()).toBeNull();
  });

  it('sends the found art as posterPath and backdropPath on the save', async () => {
    await renderSeries();
    await pick(HARBOR);

    addToLibrary();
    const body = await sentBody();

    expect(body.getAll('posterPath')).toEqual([
      `${HARBOR}\\Images\\harbor-poster.jpg`,
    ]);
    expect(body.getAll('backdropPath')).toEqual([
      `${HARBOR}\\Images\\harbor-backdrop.jpg`,
    ]);
    expect(body.getAll('poster')).toEqual([]);
    expect(body.getAll('backdrop')).toEqual([]);
  });

  it('never fills a slot picked by hand, and fills the empty one', async () => {
    await renderSeries();
    await pickByHand(posterPicker, art('my-poster.jpg'));

    await pick(HARBOR);

    expect(screen.getByText('my-poster.jpg')).toBeDefined();
    expect(screen.queryByText('harbor-poster.jpg')).toBeNull();
    expect(screen.getByText('harbor-backdrop.jpg')).toBeDefined();
  });

  it('replaces the first pick’s art on a second pick', async () => {
    await renderSeries();
    await pick(HARBOR);

    await pick(LIGHTHOUSE);

    expect(screen.getByText('lighthouse-poster.jpg')).toBeDefined();
    expect(screen.getByText('lighthouse-backdrop.jpg')).toBeDefined();
    expect(screen.queryByText('harbor-poster.jpg')).toBeNull();
    expect(screen.queryByText('harbor-backdrop.jpg')).toBeNull();
  });

  it('replaces only the first pick’s art, keeping a slot replaced by hand', async () => {
    await renderSeries();
    await pick(HARBOR);
    removePoster();
    await pickByHand(posterPicker, art('my-poster.jpg'));

    await pick(LIGHTHOUSE);

    expect(screen.getByText('my-poster.jpg')).toBeDefined();
    expect(screen.queryByText('lighthouse-poster.jpg')).toBeNull();
    expect(screen.getByText('lighthouse-backdrop.jpg')).toBeDefined();
  });

  it('takes the pick’s art back with the Show folder row’s ✕', async () => {
    await renderSeries();
    await pick(HARBOR);
    expect(screen.getByText('harbor-poster.jpg')).toBeDefined();
    expect(screen.getByText('harbor-backdrop.jpg')).toBeDefined();

    fireEvent.click(showFolderRemove());

    expect(screen.queryByText('harbor-poster.jpg')).toBeNull();
    expect(screen.queryByText('harbor-backdrop.jpg')).toBeNull();
    expect(posterPicker()).not.toBeNull();
    expect(backdropPicker()).not.toBeNull();
  });

  it('keeps a slot replaced by hand through the ✕', async () => {
    await renderSeries();
    await pick(HARBOR);
    removePoster();
    await pickByHand(posterPicker, art('my-poster.jpg'));

    fireEvent.click(showFolderRemove());

    expect(screen.getByText('my-poster.jpg')).toBeDefined();
    expect(screen.queryByText('harbor-backdrop.jpg')).toBeNull();
    expect(backdropPicker()).not.toBeNull();
  });

  it('fills nothing and draws nothing for a second pick with no art', async () => {
    await renderSeries();
    await pick(HARBOR);
    expect(screen.getByText('harbor-poster.jpg')).toBeDefined();

    await pick(BARE);

    expect(screen.queryByText('harbor-poster.jpg')).toBeNull();
    expect(screen.queryByText('harbor-backdrop.jpg')).toBeNull();
    expect(posterPicker()).not.toBeNull();
    expect(backdropPicker()).not.toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
