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
import type { Genre, ShowFolderRead } from '@/types';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';

/**
 * 51 — Library audit, Phase 15 (issue #458): the title follows the pick.
 *
 * `useShowFolderPick` remembers whether the title came from a pick (log 29
 * Q19): a second **Show folder pick** replaces a picked title with its own
 * **Title guess**, and never a title the maintainer typed, before the pick
 * or after it.
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

const WRONG = 'E:\\Shows\\Reno 911';
const RIGHT = 'E:\\Shows\\Tacoma FD';

/** A read of `path`, titled by its last segment, holding one episode. */
const readOf = (path: string): ShowFolderRead => ({
  path,
  titleGuess: path.slice(path.lastIndexOf('\\') + 1),
  libraryFolderId: null,
  heldSeriesId: null,
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
  unplacedRelative: [],
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

const seriesTitle = () =>
  screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement;

describe('MovieForm — the title follows the pick', () => {
  const bridge = fakeFolderBridge();

  /** Pick `path` with the Show folder pick and wait for its row. */
  async function pick(path: string) {
    bridge.setPickOne(path);
    fireEvent.click(screen.getByRole('button', { name: /add show folder/i }));
    await act(async () => undefined);
    await waitFor(() => expect(screen.getByText(path)).toBeDefined());
  }

  it('replaces a picked title on a second pick', async () => {
    await renderSeries();
    await pick(WRONG);
    expect(seriesTitle().value).toBe('Reno 911');

    await pick(RIGHT);

    expect(seriesTitle().value).toBe('Tacoma FD');
  });

  it('never overwrites a title typed after a pick', async () => {
    await renderSeries();
    await pick(WRONG);
    fireEvent.change(seriesTitle(), { target: { value: 'Tacoma F.D.' } });

    await pick(RIGHT);

    expect(seriesTitle().value).toBe('Tacoma F.D.');
  });

  it('never overwrites a title typed before the picks', async () => {
    await renderSeries();
    fireEvent.change(seriesTitle(), { target: { value: 'Tacoma F.D.' } });
    await pick(WRONG);

    await pick(RIGHT);

    expect(seriesTitle().value).toBe('Tacoma F.D.');
  });
});
