import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { MovieForm } from './MovieForm';
import { theme } from '@/styles/theme';
import type { Genre, ImportProblemDetail, SeriesDetail } from '@/types';
import {
  LocationProbe,
  navigationType,
  pathname,
  url,
} from '@/test-support/LocationProbe/LocationProbe';
import {
  makeEpisode,
  makeSeries,
} from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import {
  createdResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 45 — Add and sync, Phase 3 (issue #395): the series kind.
 *
 * The same `EnrichCheckCard` and the same leaving, over a show. The card is
 * drawn on a plain add at `?kind=series` and never on a **Series edit job** or
 * a **Series Resolve**; `enrich` is kept across a switch on the **Kind tabs**.
 * A ticked series save replaces `/add` with the new series' page, then pushes
 * the **Enrichment flow** for it, **Started on arrival**
 * (`/enrich?series=<id>&start=1`); an unticked one lands on the Series tab as
 * now; a refused one goes nowhere.
 */

const LABEL = 'Also fetch metadata and posters from TMDB';

const CREATED = makeSeries({ id: 'series-1', title: 'Harbor and Vine' });

const SEASON = [
  'Harbor.and.Vine.S01E01.Pilot.mkv',
  'Harbor.and.Vine.S01E02.Low.Tide.mkv',
];

const PILOT = {
  ...makeEpisode(1, 1),
  title: 'Pilot',
  videoPath: 'harbor-2019/season-01/S01E01.mkv',
};

/** The series a Series edit job reads. */
const HELD: SeriesDetail = {
  series: makeSeries({ id: 'harbor', title: 'Harbor & Vine', year: 2019 }),
  seasons: [{ number: 1, episodes: [PILOT], next: PILOT, posterPath: null }],
  next: PILOT,
};

const SHOW = 'E:\\Series\\The Night Ferry';

/** An `unplaced` show's Problem: the Series Resolve's read. */
const UNPLACED: ImportProblemDetail = {
  id: 'p5',
  kind: 'unplaced',
  title: 'The Night Ferry',
  reason: '2 episodes need numbers',
  row: { title: 'The Night Ferry', year: 2021, genres: ['Drama'] },
  folder: SHOW,
  candidates: [],
  files: {
    subtitles: [],
    videos: [
      `${SHOW}\\Season 1\\eps1.0_departure.mov`,
      `${SHOW}\\Season 1\\eps1.1_fog_horn.mov`,
    ],
  },
};

const POOL: Genre[] = ['Action', 'Comedy', 'Drama'].map((name, index) => ({
  id: `g${index + 1}`,
  name,
}));

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;
let answerSave: () => Promise<Response>;

beforeEach(() => {
  answerSave = () => Promise.resolve(createdResponse(CREATED));

  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    const address = String(input);
    const method = init?.method?.toUpperCase() ?? 'GET';
    if (address.includes('/api/tmdb/key')) {
      return Promise.resolve(okResponse({ key: 'k-123' }));
    }
    if (address.includes('/api/genres/pool')) {
      return Promise.resolve(okResponse({ genres: POOL }));
    }
    if (method === 'POST' || method === 'PATCH') return answerSave();
    if (address.includes('/api/import/current/problems/')) {
      return Promise.resolve(okResponse(UNPLACED));
    }
    return Promise.resolve(okResponse(HELD));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The form at `entry`, with Settings behind it, its reads settled. The form is
 * routed at `/add` alone, so once a save has left it the probe's Back is the
 * only one on screen.
 */
async function renderAt(entry: string) {
  const view = render(
    <MemoryRouter initialEntries={['/settings', entry]} initialIndex={1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/add" element={<MovieForm />} />
          <Route path="*" element={null} />
        </Routes>
        <LocationProbe withBack />
      </ThemeProvider>
    </MemoryRouter>
  );
  await act(async () => undefined);
  await act(async () => undefined);
  return view;
}

const enrichBox = () =>
  screen.getByRole('checkbox', { name: new RegExp(LABEL) }) as HTMLInputElement;
const queryEnrichBox = () =>
  screen.queryByRole('checkbox', { name: new RegExp(LABEL) });
const enrichCard = () => {
  const label = enrichBox().closest('label');
  if (label === null) throw new Error('no card around the checkbox');
  return label;
};

const titleField = () =>
  screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement;
const save = () =>
  screen.getByRole('button', {
    name: /add to library|adding/i,
  }) as HTMLButtonElement;

const pressKind = (name: 'Movie' | 'Series') => {
  const group = screen.getByRole('group', { name: 'Kind' });
  act(() => {
    within(group).getByRole('button', { name }).click();
  });
};

/** Pick the season's episodes: the rows numbered, the title filled. */
async function fillGate(): Promise<void> {
  await userEvent.upload(
    screen.getByLabelText(/add episode files/i) as HTMLInputElement,
    SEASON.map(
      (name) => new File(['video bytes'], name, { type: 'video/x-matroska' })
    ),
    { applyAccept: false }
  );
  await waitFor(() => expect(save().disabled).toBe(false));
}

const seriesSaves = () =>
  fetchMock.mock.calls.filter(
    ([input, init]) =>
      String(input).includes('/api/series') &&
      init?.method?.toUpperCase() === 'POST'
  );

describe('MovieForm — the box on a series, where it is drawn', () => {
  it('draws the card on a plain series add', async () => {
    await renderAt('/add?kind=series');

    expect(enrichBox()).toBeDefined();
    expect(
      screen.getAllByRole('checkbox', { name: new RegExp(LABEL) })
    ).toHaveLength(1);
  });

  it('is absent on a series edit', async () => {
    await renderAt(`/add?series=${HELD.series.id}`);

    await waitFor(() => expect(titleField().value).toBe('Harbor & Vine'));
    expect(queryEnrichBox()).toBeNull();
  });

  it('is absent on a Series Resolve', async () => {
    await renderAt(`/add?kind=series&problem=${UNPLACED.id}`);

    await waitFor(() => expect(titleField().value).toBe('The Night Ferry'));
    expect(queryEnrichBox()).toBeNull();
  });
});

describe('MovieForm — the box across the Kind tabs', () => {
  it('stays ticked across Movie → Series → Movie', async () => {
    await renderAt('/add');
    fireEvent.click(enrichCard());
    expect(enrichBox().checked).toBe(true);

    pressKind('Series');
    await waitFor(() => expect(url()).toBe('/add?kind=series'));
    expect(enrichBox().checked).toBe(true);

    pressKind('Movie');
    await waitFor(() => expect(url()).toBe('/add'));
    expect(enrichBox().checked).toBe(true);
  });
});

describe('MovieForm — the box and a series save', () => {
  it('ends a ticked series save on the flow for the new series, Started on arrival', async () => {
    await renderAt('/add?kind=series');
    await fillGate();
    fireEvent.click(enrichCard());

    fireEvent.click(save());

    await waitFor(() => expect(url()).toBe('/enrich?series=series-1&start=1'));
    expect(navigationType()).toBe('PUSH');
  });

  it("steps Back from the flow onto the series' page, and never onto /add", async () => {
    await renderAt('/add?kind=series');
    await fillGate();
    fireEvent.click(enrichCard());
    fireEvent.click(save());
    await waitFor(() => expect(pathname()).toBe('/enrich'));

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    await waitFor(() => expect(pathname()).toBe('/series/series-1'));

    // The series' page replaced `/add`: one more step is Settings.
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    await waitFor(() => expect(pathname()).toBe('/settings'));
  });

  it('lands an unticked series save on the Series tab, as now', async () => {
    await renderAt('/add?kind=series');
    await fillGate();

    fireEvent.click(save());

    await waitFor(() => expect(url()).toBe('/?tab=series'));
    expect(navigationType()).toBe('PUSH');
  });

  it('goes nowhere on a refused ticked series save', async () => {
    answerSave = () => Promise.resolve(serverErrorResponse());
    await renderAt('/add?kind=series');
    await fillGate();
    fireEvent.click(enrichCard());

    fireEvent.click(save());
    await waitFor(() => expect(seriesSaves()).toHaveLength(1));
    await waitFor(() => expect(save().disabled).toBe(false));

    expect(url()).toBe('/add?kind=series');
    expect(enrichBox().checked).toBe(true);
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).includes('/api/enrichment')
      )
    ).toHaveLength(0);
  });
});
