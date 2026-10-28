import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { MovieForm } from './MovieForm';
import { theme } from '@/styles/theme';
import type {
  Genre,
  ImportProblemDetail,
  Movie,
  SeriesDetail,
  ShowFolderRead,
} from '@/types';
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
  noContentResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';

/**
 * 53, Loading states, Phase 2 (issue #484): a save that waits.
 *
 * The **Movie form**'s save runs on the **Loader timing**, for every job and
 * both kinds: the button locks at once on its idle label, reads _Adding…_ on
 * an add or _Saving…_ on an edit only once the save has run 300ms, and the
 * form leaves only after the 500ms hold, because the leaving follows the
 * save's promise.
 *
 * Amended by issue #490: _Save & continue_ over a resolve reads _Saving…_,
 * and a show folder's add in the shell _Adding…_, on the same timing, so
 * every save the form makes has its label pinned here.
 *
 * The form is filled on real timers (a pick goes through `user-event`), and
 * the clock is faked from the press on.
 */

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
/** A run's unfiled film, the record `a1`, as _Resolve_ opens it. */
const PROBLEM: ImportProblemDetail = {
  id: 'p9',
  kind: 'missing-meta',
  title: 'The Lantern Keeper',
  reason:
    "Imported, but the row has no genre, so it won't appear in any genre row.",
  movieId: MOVIE.id,
  row: { title: 'The Lantern Keeper', year: 2019, genres: [] },
  folder: 'C:\\Movies\\The.Lantern.Keeper.2019',
  candidates: [],
  files: { videos: [], subtitles: [] },
};

/** The show folder the shell's picker answers, one episode in it. */
const SHOW_FOLDER = 'E:\\Shows\\Harbor and Vine';
const SHOW_READ: ShowFolderRead = {
  path: SHOW_FOLDER,
  titleGuess: 'Harbor and Vine',
  libraryFolderId: null,
  heldSeriesId: null,
  episodes: [
    {
      season: 1,
      number: 1,
      title: 'Pilot',
      relativePath: 'Season 1/Harbor.and.Vine.S01E01.Pilot.mkv',
      video: `${SHOW_FOLDER}\\Season 1\\Harbor.and.Vine.S01E01.Pilot.mkv`,
      subtitles: [],
    },
  ],
  unplaced: [],
  straySubtitles: 0,
};

const writes = () =>
  fetchMock.mock.calls.filter(
    ([, init]) => init?.method === 'POST' || init?.method === 'PATCH'
  );

const { fetchMock, respond } = heldFetch((url, init) => {
  if (init?.method === 'POST' || init?.method === 'PATCH') {
    return undefined;
  }
  if (init?.method === 'DELETE') {
    return noContentResponse();
  }
  if (url.includes('/api/genres/pool')) {
    return okResponse({ genres: POOL });
  }
  if (url.includes('/api/import/current/problems/')) {
    return okResponse(PROBLEM);
  }
  if (url.includes('/api/show-folder')) {
    return okResponse(SHOW_READ);
  }
  if (url.includes('/api/series/')) {
    return okResponse(DETAIL);
  }
  if (url.includes('/api/movies/')) {
    return okResponse(MOVIE);
  }
  return notFoundResponse('Not here');
});

afterEach(() => {
  vi.useRealTimers();
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
    name: /^(add to library|adding…|save changes|save & continue|saving…)$/i,
  }) as HTMLButtonElement;

const titleField = () =>
  screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement;

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
  /** The folder the shell's picker answers; absent, the form is in a browser. */
  shellPick?: string;
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
  {
    name: 'a resolve',
    open: async () => {
      await renderAt(['/settings', '/import', '/add?movie=a1&problem=p9']);
    },
    idleLabel: 'Save & continue',
    busyLabel: 'Saving…',
    answer: () => okResponse(MOVIE),
    at: '/add',
    landing: '/import',
  },
  {
    name: 'a show folder add',
    open: async () => {
      await renderAt(['/settings', '/add?kind=series']);
      fireEvent.click(screen.getByRole('button', { name: /add show folder/i }));
      await screen.findByRole('button', { name: /^remove show folder$/i });
    },
    idleLabel: 'Add to library',
    busyLabel: 'Adding…',
    answer: () => createdResponse(makeSeries({ id: 'series-1' })),
    at: '/add',
    landing: '/',
    shellPick: SHOW_FOLDER,
  },
];

describe.each(JOBS)(
  'MovieForm: $name saves on the Loader timing',
  ({ open, idleLabel, busyLabel, answer, at, landing, shellPick }) => {
    if (shellPick !== undefined) {
      const bridge = fakeFolderBridge();
      beforeEach(() => {
        bridge.setPickOne(shellPick);
      });
    }

    it(`locks at once on ${idleLabel}, and reads ${busyLabel} only after 300ms`, async () => {
      await open();
      pressSave();

      // Locked at once, but nothing drawn: the idle label, busy and disabled.
      expect(saveButton().disabled).toBe(true);
      expect(saveButton().getAttribute('aria-busy')).toBe('true');
      expect(saveButton().textContent).toBe(idleLabel);

      await advanceClock(299);
      expect(saveButton().textContent).toBe(idleLabel);
      expect(screen.queryByText(busyLabel)).toBeNull();

      await advanceClock(1);
      expect(saveButton().textContent).toBe(busyLabel);
      expect(
        saveButton().querySelector('[aria-live="polite"]')?.textContent
      ).toBe(busyLabel);

      await respond(answer());
      await advanceClock(500);
    });

    it('never draws its busy label for a save under 300ms, and leaves at once', async () => {
      await open();
      pressSave();

      await advanceClock(100);
      expect(saveButton().textContent).toBe(idleLabel);
      await respond(answer());
      await advanceClock(0);

      expect(pathname()).toBe(landing);
      expect(screen.queryByText(busyLabel)).toBeNull();
    });

    it('leaves only once the 500ms hold is out', async () => {
      await open();
      pressSave();

      // Shown at 300ms; the save lands at 400ms; the hold runs to 800ms.
      await advanceClock(400);
      await respond(answer());

      await advanceClock(399);
      expect(pathname()).toBe(at);
      expect(saveButton().textContent).toBe(busyLabel);

      await advanceClock(1);
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

      await respond(answer());
      await advanceClock(500);
    });
  }
);
