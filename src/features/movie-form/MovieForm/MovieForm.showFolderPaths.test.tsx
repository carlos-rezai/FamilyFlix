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
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';

/**
 * 51, Library audit, Phase 13 (issue #456): picked episodes read apart.
 *
 * The **Show folder read** answers each found video with its path inside the
 * show: an episode's `relativePath`, and an **Unplaced** video's in its
 * `unplaced` entry. Each **Episode file row** a pick lands shows that path
 * as its mono line, so two seasons' `Aflevering 1.mp4` read
 * `Seizoen 1/Aflevering 1.mp4` and `Seizoen 2/Aflevering 1.mp4`; a file
 * picked by hand with _＋ Add episode files_ keeps its own name. The **Show
 * folder row** ellipsises its path from the start, so the folder's own name
 * always shows, and carries the full path as its `title`.
 *
 * The wire is a stubbed `fetch`; the dialog is `fakeFolderBridge`.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

const POOL: Genre[] = [{ id: 'g1', name: 'Comedy' }];

const SHOW = 'C:\\Users\\Carlos\\Videos\\Series\\De Luizenmoeder';

/** What `GET /api/show-folder` answers: two seasons' same-named files. */
const READ = {
  path: SHOW,
  titleGuess: 'De Luizenmoeder',
  libraryFolderId: null,
  heldSeriesId: null,
  episodes: [
    {
      season: 1,
      number: 1,
      title: null,
      video: `${SHOW}\\Seizoen 1\\Aflevering 1.mp4`,
      relativePath: 'Seizoen 1/Aflevering 1.mp4',
      subtitles: [],
    },
    {
      season: 2,
      number: 1,
      title: null,
      video: `${SHOW}\\Seizoen 2\\Aflevering 1.mp4`,
      relativePath: 'Seizoen 2/Aflevering 1.mp4',
      subtitles: [],
    },
  ],
  unplaced: [
    {
      video: `${SHOW}\\Extras\\Kerstspecial.mp4`,
      relativePath: 'Extras/Kerstspecial.mp4',
    },
  ],
  straySubtitles: 0,
};

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input) => {
    if (String(input).includes('/api/show-folder')) {
      return Promise.resolve(okResponse(READ));
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

const showFolderRemove = () =>
  screen.queryByRole('button', { name: /^remove show folder$/i });

async function pickShowFolder() {
  fireEvent.click(screen.getByRole('button', { name: /add show folder/i }));
  await act(async () => undefined);
  await waitFor(() => expect(showFolderRemove()).not.toBeNull());
}

async function pickEpisodesByHand(names: string[]) {
  await userEvent.upload(
    screen.getByLabelText(/add episode files/i) as HTMLInputElement,
    names.map((name) => new File(['video bytes'], name, { type: 'video/mp4' })),
    { applyAccept: false }
  );
}

/** The element carrying the Show folder row's ellipsis: the one under the text. */
const showFolderName = () => {
  const text = screen.getByText(SHOW);
  return text.tagName === 'BDI' ? (text.parentElement as HTMLElement) : text;
};

describe('MovieForm: picked episodes read apart', () => {
  const bridge = fakeFolderBridge();

  beforeEach(() => {
    bridge.setPickOne(SHOW);
  });

  describe('the Episode file rows', () => {
    it('show each picked episode’s path inside the show', async () => {
      await renderSeries();

      await pickShowFolder();

      expect(screen.getByText('Seizoen 1/Aflevering 1.mp4')).toBeDefined();
      expect(screen.getByText('Seizoen 2/Aflevering 1.mp4')).toBeDefined();
    });

    it('show a picked Unplaced video’s path inside the show', async () => {
      await renderSeries();

      await pickShowFolder();

      expect(screen.getByText('Extras/Kerstspecial.mp4')).toBeDefined();
    });

    it('keep a hand-picked file’s own name beside the picked rows', async () => {
      await renderSeries();
      await pickEpisodesByHand(['De.Luizenmoeder.S03E01.mp4']);

      await pickShowFolder();

      expect(screen.getByText('De.Luizenmoeder.S03E01.mp4')).toBeDefined();
      expect(screen.getByText('Seizoen 2/Aflevering 1.mp4')).toBeDefined();
    });
  });

  describe('the Show folder row', () => {
    it('ellipsises the path from its start, so the folder’s own name shows', async () => {
      await renderSeries();

      await pickShowFolder();

      const style = getComputedStyle(showFolderName());
      expect(style.direction).toBe('rtl');
      expect(style.textOverflow).toBe('ellipsis');
    });

    it('carries the full path as its title', async () => {
      await renderSeries();

      await pickShowFolder();

      expect(showFolderName().getAttribute('title')).toBe(SHOW);
    });
  });
});
