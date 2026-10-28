import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { MovieForm } from './MovieForm';
import { theme } from '@/styles/theme';
import type { Genre, Movie, SeriesDetail } from '@/types';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  makeEpisode,
  makeSeries,
} from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import {
  createdResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 53 — Loading states, Phase 2 (issue #484): a save that waits.
 *
 * The **Movie form**'s save runs on the **Loader timing**, for every job and
 * both kinds: the button locks at once on its idle label, reads _Adding…_ on
 * an add or _Saving…_ on an edit only once the save has run 300ms, and the
 * form leaves only after the 500ms hold, because the leaving follows the
 * save's promise.
 *
 * The form is filled on real timers (a pick goes through `user-event`), and
 * the clock is faked from the press on.
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

const MOVIE: Movie = makeMovie({
  id: 'a1',
  title: 'The Lantern Keeper',
  year: 2019,
  videoPath: 'the-lantern-keeper-2019/lantern.mp4',
});

const SERIES = makeSeries({ id: 'harbor', title: 'Harbor & Vine' });

const PILOT = {
  ...makeEpisode(1, 1),
  title: 'Pilot',
  videoPath: 'harbor-vine/season-01/S01E01.mkv',
};

const DETAIL: SeriesDetail = {
  series: SERIES,
  seasons: [{ number: 1, episodes: [PILOT], next: PILOT, posterPath: null }],
  next: PILOT,
};

/** Every write the form has sent: an add's `POST` or an edit's `PATCH`. */
const writes = () =>
  fetchMock.mock.calls.filter(
    ([, init]) => init?.method === 'POST' || init?.method === 'PATCH'
  );

/** The save in flight, answered when the test says so. */
let settleSave: (response: Response) => void;

beforeEach(() => {
  settleSave = () => undefined;
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (init?.method === 'POST' || init?.method === 'PATCH') {
      return new Promise<Response>((resolve) => {
        settleSave = resolve;
      });
    }
    if (url.includes('/api/genres/pool')) {
      return Promise.resolve(okResponse({ genres: POOL }));
    }
    if (url.includes('/api/series/')) {
      return Promise.resolve(okResponse(DETAIL));
    }
    if (url.includes('/api/movies/')) {
      return Promise.resolve(okResponse(MOVIE));
    }
    return Promise.resolve(notFoundResponse('Not here'));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** The form at the end of `entries`, every read on mount settled. */
async function renderAt(entries: string[]) {
  const view = render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
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

/** The save button, under whichever label it wears. */
const saveButton = () =>
  screen.getByRole('button', {
    name: /^(add to library|adding…|save changes|saving…)$/i,
  }) as HTMLButtonElement;

const titleField = () =>
  screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement;

/** Move the clock on, and let every promise it frees settle. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Press Save on a faked clock. */
function pressSave() {
  vi.useFakeTimers();
  fireEvent.click(saveButton());
}

interface Job {
  name: string;
  open: () => Promise<unknown>;
  idleLabel: string;
  busyLabel: string;
  answer: () => Response;
  /** Where the form is before it leaves, and where it lands after. */
  at: string;
  landing: string;
}

const JOBS: Job[] = [
  {
    name: 'a movie add',
    open: async () => {
      await renderAt(['/settings', '/add']);
      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      await userEvent.upload(
        screen.getByLabelText(/choose video file/i),
        new File(['video bytes'], 'rear-window.mp4', { type: 'video/mp4' }),
        { applyAccept: false }
      );
    },
    idleLabel: 'Add to library',
    busyLabel: 'Adding…',
    answer: () =>
      createdResponse(makeMovie({ id: 'new-1', title: 'Rear Window' })),
    at: '/add',
    landing: '/',
  },
  {
    name: 'a series add',
    open: async () => {
      await renderAt(['/settings', '/add?kind=series']);
      await userEvent.upload(
        screen.getByLabelText(/add episode files/i),
        [
          new File(['video bytes'], 'Harbor.and.Vine.S01E01.Pilot.mkv', {
            type: 'video/x-matroska',
          }),
        ],
        { applyAccept: false }
      );
    },
    idleLabel: 'Add to library',
    busyLabel: 'Adding…',
    answer: () => createdResponse(makeSeries({ id: 'series-1' })),
    at: '/add',
    landing: '/',
  },
  {
    name: 'a movie edit',
    open: async () => {
      await renderAt(['/movie/a1', '/add?movie=a1']);
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper (restored)' },
      });
    },
    idleLabel: 'Save changes',
    busyLabel: 'Saving…',
    answer: () => okResponse(MOVIE),
    at: '/add',
    landing: '/movie/a1',
  },
  {
    name: 'a series edit',
    open: async () => {
      await renderAt(['/series/harbor', '/add?series=harbor']);
      fireEvent.change(titleField(), { target: { value: 'Harbor and Vine' } });
    },
    idleLabel: 'Save changes',
    busyLabel: 'Saving…',
    answer: () => okResponse(SERIES),
    at: '/add',
    landing: '/series/harbor',
  },
];

describe.each(JOBS)(
  'MovieForm — $name saves on the Loader timing',
  ({ open, idleLabel, busyLabel, answer, at, landing }) => {
    it(`locks at once on ${idleLabel}, and reads ${busyLabel} only after 300ms`, async () => {
      await open();
      pressSave();

      // Locked at once, but nothing drawn: the idle label, busy and disabled.
      expect(saveButton().disabled).toBe(true);
      expect(saveButton().getAttribute('aria-busy')).toBe('true');
      expect(saveButton().textContent).toBe(idleLabel);

      await advance(299);
      expect(saveButton().textContent).toBe(idleLabel);
      expect(screen.queryByText(busyLabel)).toBeNull();

      await advance(1);
      expect(saveButton().textContent).toBe(busyLabel);
      expect(
        saveButton().querySelector('[aria-live="polite"]')?.textContent
      ).toBe(busyLabel);

      await act(async () => {
        settleSave(answer());
      });
      await advance(500);
    });

    it('never draws its busy label for a save under 300ms, and leaves at once', async () => {
      await open();
      pressSave();

      await advance(100);
      expect(saveButton().textContent).toBe(idleLabel);
      await act(async () => {
        settleSave(answer());
      });
      await advance(0);

      expect(pathname()).toBe(landing);
      expect(screen.queryByText(busyLabel)).toBeNull();
    });

    it('leaves only once the 500ms hold is out', async () => {
      await open();
      pressSave();

      // Shown at 300ms; the save lands at 400ms; the hold runs to 800ms.
      await advance(400);
      await act(async () => {
        settleSave(answer());
      });

      await advance(399);
      expect(pathname()).toBe(at);
      expect(saveButton().textContent).toBe(busyLabel);

      await advance(1);
      expect(pathname()).toBe(landing);
    });

    it('sends one request for a double click, locked from the first press', async () => {
      await open();
      vi.useFakeTimers();

      const button = saveButton();
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.doubleClick(button);

      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(writes()).toHaveLength(1);

      await act(async () => {
        settleSave(answer());
      });
      await advance(500);
    });
  }
);
