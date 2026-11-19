import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { MovieForm } from './MovieForm';
import { theme } from '@/styles/theme';
import type { Genre, ImportProblemDetail, SeriesDetail } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeries } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import {
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 69 — Silent waits, Phase 7 (issue #659): the **Form skeleton**.
 *
 * While a job naming a record (an edit, a series edit, a **Resolve**) reads
 * it, the **Movie form** draws `LoadingForm` at once: no heading, no fields,
 * no save, so nothing is added twice or typed over. The form appears whole
 * when the record lands, or the add when the record is gone. A plain add
 * never draws it.
 *
 * The wire is a stubbed `fetch` whose record reads are held open until the
 * test answers them.
 */

const POOL: Genre[] = ['Action', 'Comedy', 'Drama'].map((name, index) => ({
  id: `g${index + 1}`,
  name,
}));

const MOVIE = makeMovie({ id: 'm1', title: 'The Lantern Keeper' });

const SERIES = makeSeries({ id: 'harbor', title: 'Harbor & Vine' });
const DETAIL: SeriesDetail = { series: SERIES, seasons: [], next: null };

const PROBLEM: ImportProblemDetail = {
  id: 'p3',
  kind: 'no-folder',
  title: 'Tidewater Rising',
  reason: 'No folder found matching this spreadsheet row.',
  row: { title: 'Tidewater Rising', year: 2019, genres: ['Drama'] },
  candidates: [],
  files: { videos: [], subtitles: [] },
};

/** Each held record read, answered when the test says so. */
let answer: (response: Response) => void;

beforeEach(() => {
  const fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (
      url.includes('/api/movies/') ||
      url.includes('/api/series/') ||
      url.includes('/api/import/current/problems/')
    ) {
      return new Promise<Response>((resolve) => {
        answer = resolve;
      });
    }
    return Promise.resolve(okResponse({ genres: POOL }));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The form at `entry`, the record's read still held open. */
async function renderAt(entry: string) {
  const view = render(
    <MemoryRouter initialEntries={[entry]}>
      <ThemeProvider theme={theme}>
        <MovieForm />
      </ThemeProvider>
    </MemoryRouter>
  );
  await act(async () => undefined);
  return view;
}

/** Answer the held read, and let the form redraw. */
async function land(response: Response) {
  await act(async () => answer(response));
  await act(async () => undefined);
  await act(async () => undefined);
}

const skeleton = (name: string) => screen.queryByRole('status', { name });
const saveButton = () =>
  screen.queryByRole('button', { name: /save|add to library|saving/i });
const textboxes = () => screen.queryAllByRole('textbox');

describe('MovieForm: the Form skeleton', () => {
  describe('an edit, a series edit and a Resolve draw it at once', () => {
    it('an edit draws Loading movie and no save until the movie lands', async () => {
      await renderAt('/add?movie=m1');

      expect(skeleton('Loading movie')).toBeTruthy();
      expect(saveButton()).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Add a movie' })).toBeNull();

      await land(okResponse(MOVIE));

      expect(skeleton('Loading movie')).toBeNull();
      expect(
        screen.getByRole('heading', { name: 'Edit details' })
      ).toBeTruthy();
      expect(saveButton()).toBeTruthy();
      expect(
        (screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement)
          .value
      ).toBe('The Lantern Keeper');
    });

    it('a series edit draws Loading series and no save until it lands', async () => {
      await renderAt('/add?series=harbor');

      expect(skeleton('Loading series')).toBeTruthy();
      expect(saveButton()).toBeNull();

      await land(okResponse(DETAIL));

      expect(skeleton('Loading series')).toBeNull();
      expect(saveButton()).toBeTruthy();
      expect(
        (screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement)
          .value
      ).toBe('Harbor & Vine');
    });

    it('a Resolve draws Loading movie and no save until the problem lands', async () => {
      await renderAt('/add?problem=p3');

      expect(skeleton('Loading movie')).toBeTruthy();
      expect(saveButton()).toBeNull();

      await land(okResponse(PROBLEM));

      expect(skeleton('Loading movie')).toBeNull();
      expect(saveButton()).toBeTruthy();
    });
  });

  describe('nothing can be typed into before the record lands', () => {
    it.each(['/add?movie=m1', '/add?series=harbor', '/add?problem=p3'])(
      '%s draws no field while its read is held',
      async (entry) => {
        await renderAt(entry);

        expect(textboxes()).toHaveLength(0);
      }
    );
  });

  describe('a plain add never draws it, and a gone record falls back to the add', () => {
    it('a plain add opens on the form, with no skeleton', async () => {
      await renderAt('/add');

      expect(skeleton('Loading movie')).toBeNull();
      expect(skeleton('Loading series')).toBeNull();
      expect(screen.getByRole('heading', { name: 'Add a movie' })).toBeTruthy();
      expect(textboxes().length).toBeGreaterThan(0);
    });

    it('a gone movie leaves the skeleton for the add', async () => {
      await renderAt('/add?movie=gone');

      expect(skeleton('Loading movie')).toBeTruthy();

      await land(notFoundResponse('No such movie'));

      expect(skeleton('Loading movie')).toBeNull();
      expect(screen.getByRole('heading', { name: 'Add a movie' })).toBeTruthy();
      expect(textboxes().length).toBeGreaterThan(0);
    });
  });

  describe('the skeleton is announced once, by its kind', () => {
    it('an edit announces one status, Loading movie, and no series', async () => {
      await renderAt('/add?movie=m1');

      expect(
        screen.getAllByRole('status', { name: /^Loading (movie|series)$/ })
      ).toHaveLength(1);
      expect(skeleton('Loading series')).toBeNull();
    });

    it('a series edit announces one status, Loading series, and no movie', async () => {
      await renderAt('/add?series=harbor');

      expect(
        screen.getAllByRole('status', { name: /^Loading (movie|series)$/ })
      ).toHaveLength(1);
      expect(skeleton('Loading movie')).toBeNull();
    });
  });
});
