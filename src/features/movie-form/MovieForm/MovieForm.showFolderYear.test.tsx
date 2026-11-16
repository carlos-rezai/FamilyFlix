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
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { makeSeries } from '@/test-support/makeSeriesDetail/makeSeriesDetail';

/**
 * 48, Show folder title, phase 2 (issue #630): the year is prefilled.
 *
 * `useMovieForm`'s `prefillFolderKey` writes the read's **Folder key** year
 * beside its title, by the same picked-or-empty rule and decided apart from
 * the title: a field is replaced when it is empty (trimmed) or still says
 * what the last pick filled, and otherwise stays. A `null` year writes `''`,
 * so a yearless second pick empties a picked year.
 *
 * A Sync keeps a filled year and fills an empty one (`planFields`: _a filled
 * field is left as it is_, _empty fields are filled_); here the picked year
 * is shown to be what the save sends, so a Sync finds it filled.
 *
 * The wire is a stubbed `fetch` answering each folder's read by its path, as
 * the server's `folderKeyOf` would; the dialog is `fakeFolderBridge`.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

const POOL: Genre[] = [{ id: 'g1', name: 'Comedy' }];

const SEVERANCE_OPEN = 'E:\\Shows\\Severance (2022–)';
const SEVERANCE_HYPHEN = 'E:\\Shows\\Severance (2022-2025)';
const SEVERANCE_DASH = 'E:\\Shows\\Severance (2022–2025)';
const HEAT_1995 = 'E:\\Shows\\Heat (1995)';
const HEAT_1986 = 'E:\\Shows\\Heat (1986)';
const YEARLESS = 'E:\\Shows\\Reno 911';
const OTHER_YEARLESS = 'E:\\Shows\\Tacoma FD';

/** The Folder key the server answers for each folder's name. */
const KEYS: Record<string, Pick<ShowFolderRead, 'title' | 'year'>> = {
  [SEVERANCE_OPEN]: { title: 'Severance', year: 2022 },
  [SEVERANCE_HYPHEN]: { title: 'Severance', year: 2022 },
  [SEVERANCE_DASH]: { title: 'Severance', year: 2022 },
  [HEAT_1995]: { title: 'Heat', year: 1995 },
  [HEAT_1986]: { title: 'Heat', year: 1986 },
  [YEARLESS]: { title: 'Reno 911', year: null },
  [OTHER_YEARLESS]: { title: 'Tacoma FD', year: null },
};

/** A read of `path`, keyed by `KEYS`, holding one episode. */
const readOf = (path: string): ShowFolderRead => ({
  path,
  ...KEYS[path],
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
  straySubtitles: 0,
});

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (init?.method === 'POST') {
      return Promise.resolve(
        createdResponse(makeSeries({ id: 'series-1', title: 'Severance' }))
      );
    }
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

const seriesYear = () =>
  screen.getByRole('textbox', { name: 'Year' }) as HTMLInputElement;

const type = (field: HTMLInputElement, value: string) =>
  fireEvent.change(field, { target: { value } });

const seriesSaves = () =>
  fetchMock.mock.calls.filter(
    ([input, init]) =>
      String(input).includes('/api/series') && init?.method === 'POST'
  );

describe('MovieForm: the year follows the pick', () => {
  const bridge = fakeFolderBridge();

  /** Pick `path` with the Show folder pick and wait for its row. */
  async function pick(path: string) {
    bridge.setPickOne(path);
    fireEvent.click(screen.getByRole('button', { name: /add show folder/i }));
    await act(async () => undefined);
    await waitFor(() => expect(screen.getByText(path)).toBeDefined());
  }

  describe('an empty Year field', () => {
    it.each([
      ['Severance (2022–)/', SEVERANCE_OPEN],
      ['Severance (2022-2025)/', SEVERANCE_HYPHEN],
      ['Severance (2022–2025)/', SEVERANCE_DASH],
    ])('takes 2022 from a picked %s', async (_name, path) => {
      await renderSeries();

      await pick(path);

      expect(seriesYear().value).toBe('2022');
    });

    it('stays empty for a yearless folder, and empty to the next pick', async () => {
      await renderSeries();

      await pick(YEARLESS);

      expect(seriesYear().value).toBe('');
      expect(seriesTitle().value).toBe('Reno 911');

      await pick(HEAT_1995);

      expect(seriesYear().value).toBe('1995');
    });
  });

  describe('typed before the pick', () => {
    it('keeps a typed year, and still fills an empty title', async () => {
      await renderSeries();
      type(seriesYear(), '2021');

      await pick(SEVERANCE_OPEN);

      expect(seriesYear().value).toBe('2021');
      expect(seriesTitle().value).toBe('Severance');
    });

    it('fills only the year beside a typed title', async () => {
      await renderSeries();
      type(seriesTitle(), 'Severance: Lumon');

      await pick(SEVERANCE_OPEN);

      expect(seriesTitle().value).toBe('Severance: Lumon');
      expect(seriesYear().value).toBe('2022');
    });

    it('fills only the title beside a typed year', async () => {
      await renderSeries();
      type(seriesYear(), '1996');

      await pick(HEAT_1995);

      expect(seriesTitle().value).toBe('Heat');
      expect(seriesYear().value).toBe('1996');
    });
  });

  describe('a second pick', () => {
    it('replaces the picked year: Heat (1995)/ then Heat (1986)/ shows 1986', async () => {
      await renderSeries();
      await pick(HEAT_1995);
      expect(seriesYear().value).toBe('1995');

      await pick(HEAT_1986);

      expect(seriesYear().value).toBe('1986');
    });

    it('empties the picked year for a yearless folder', async () => {
      await renderSeries();
      await pick(SEVERANCE_OPEN);
      expect(seriesYear().value).toBe('2022');

      await pick(OTHER_YEARLESS);

      expect(seriesYear().value).toBe('');
      expect(seriesTitle().value).toBe('Tacoma FD');
    });

    it('keeps a year typed after the first pick', async () => {
      await renderSeries();
      await pick(HEAT_1995);
      expect(seriesYear().value).toBe('1995');
      type(seriesYear(), '1994');

      await pick(HEAT_1986);

      expect(seriesYear().value).toBe('1994');
    });

    it('fills a year cleared by hand after the first pick', async () => {
      await renderSeries();
      await pick(HEAT_1995);
      type(seriesYear(), '');

      await pick(HEAT_1986);

      expect(seriesYear().value).toBe('1986');
    });

    it('fills a title cleared by hand, beside a typed year that stays', async () => {
      await renderSeries();
      await pick(HEAT_1995);
      expect(seriesYear().value).toBe('1995');
      type(seriesTitle(), '  ');
      type(seriesYear(), '1994');

      await pick(HEAT_1986);

      expect(seriesTitle().value).toBe('Heat');
      expect(seriesYear().value).toBe('1994');
    });
  });

  describe('the save', () => {
    it('sends the picked year, so a Sync finds it filled', async () => {
      await renderSeries();
      await pick(SEVERANCE_OPEN);

      fireEvent.click(
        screen.getByRole('button', { name: /add to library|adding/i })
      );
      await waitFor(() => expect(seriesSaves()).toHaveLength(1));

      const body = seriesSaves()[0][1]?.body as FormData;
      expect(body.get('year')).toBe('2022');
    });
  });
});
