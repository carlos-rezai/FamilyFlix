import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { MovieForm } from './MovieForm';
import { theme } from '@/styles/theme';
import type { Genre, ImportProblemDetail, Movie } from '@/types';
import {
  LocationProbe,
  navigationType,
  pathname,
  url,
} from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import {
  createdResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 45 — Add and sync, Phase 2 (issue #394): the box on a film's plain add.
 *
 * The **Movie form** draws the `EnrichCheckCard` — graduated to `components/`
 * — between the Files card and the actions on a plain add, never on an edit or
 * a Resolve, with the form's own keyed hint. `useMovieForm` holds `enrich`,
 * off on every mount. **Add and sync**: a ticked save replaces `/add` with the
 * new film's page, then pushes the **Enrichment flow** for it, **Started on
 * arrival** (`/enrich?movie=<id>&start=1`); an unticked save lands on its
 * **Fresh home** as now; a refused save goes nowhere. The form itself starts
 * no Sync and posts nothing to enrichment — the flow does that on arrival.
 */

const LABEL = 'Also fetch metadata and posters from TMDB';
const FORM_HINT =
  'Runs straight after the save, over this title. Needs the internet.';
const IMPORT_HINT =
  'Runs straight after the import, over everything it brings in. Needs the internet.';
const HINT_WITHOUT_KEY =
  'Needs a TMDB key. Add one under Settings → Network first.';

const CREATED: Movie = makeMovie({
  id: 'new-1',
  title: 'Rear Window',
  year: 1954,
  videoPath: '',
});

const STORED: Movie = makeMovie({
  id: 'a1',
  title: 'The Lantern Keeper',
  year: 2019,
  videoPath: 'the-lantern-keeper-2019/lantern.mp4',
});

const FOLDER = 'C:\\Movies\\Die.Hard.1988.1080p';

const PROBLEM: ImportProblemDetail = {
  id: 'p1',
  kind: 'failed',
  title: 'Die Hard',
  reason: "Couldn't copy the video file: EBUSY: resource busy or locked.",
  row: {
    title: 'Die Hard',
    year: 1988,
    genres: ['Action'],
    director: 'John McTiernan',
    cast: ['Bruce Willis'],
    synopsis: 'A New York cop takes on a tower full of thieves.',
    rating: 8,
  },
  folder: FOLDER,
  candidates: [],
  files: {
    video: `${FOLDER}\\Die.Hard.1988.1080p.mp4`,
    videos: [`${FOLDER}\\Die.Hard.1988.1080p.mp4`],
    subtitles: [],
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
let answerKey: () => Promise<Response>;
let answerSave: () => Promise<Response>;

beforeEach(() => {
  answerKey = () => Promise.resolve(okResponse({ key: 'k-123' }));
  answerSave = () => Promise.resolve(createdResponse(CREATED));

  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    const address = String(input);
    const method = init?.method?.toUpperCase() ?? 'GET';
    if (address.includes('/api/tmdb/key')) return answerKey();
    if (address.includes('/api/genres/pool')) {
      return Promise.resolve(okResponse({ genres: POOL }));
    }
    if (address.includes('/api/import/current/problems/')) {
      return Promise.resolve(okResponse(PROBLEM));
    }
    if (method === 'POST' || method === 'PATCH') return answerSave();
    return Promise.resolve(okResponse(STORED));
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
  screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement;
const save = () =>
  screen.getByRole('button', {
    name: /add to library|adding/i,
  }) as HTMLButtonElement;
const videoPicker = () =>
  screen.getByLabelText(/choose video file/i) as HTMLInputElement;

async function pickVideo(): Promise<void> {
  await userEvent.upload(
    videoPicker(),
    new File(['video bytes'], 'lantern.mp4', { type: 'video/mp4' }),
    { applyAccept: false }
  );
}

async function fillGate(): Promise<void> {
  fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
  await pickVideo();
}

const enrichmentRequests = () =>
  fetchMock.mock.calls.filter(([input]) =>
    String(input).includes('/api/enrichment')
  );

describe('MovieForm — the box, where it is drawn', () => {
  it('draws the card on a plain film add', async () => {
    await renderAt('/add');

    expect(enrichBox()).toBeDefined();
    expect(
      screen.getAllByRole('checkbox', { name: new RegExp(LABEL) })
    ).toHaveLength(1);
  });

  it('draws it between the Files card and the actions', async () => {
    await renderAt('/add');

    expect(comesBefore(videoPicker(), enrichCard())).toBe(true);
    expect(comesBefore(enrichCard(), save())).toBe(true);
  });

  it('is absent on an edit', async () => {
    await renderAt(`/add?movie=${STORED.id}`);

    expect(
      screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement
    ).toBeDefined();
    expect(queryEnrichBox()).toBeNull();
  });

  it('is absent on a Resolve', async () => {
    await renderAt(`/add?problem=${PROBLEM.id}`);

    await waitFor(() => expect(titleField().value).toBe('Die Hard'));
    expect(queryEnrichBox()).toBeNull();
  });
});

describe('MovieForm — the box, its state', () => {
  it('is off on mount', async () => {
    await renderAt('/add');

    expect(enrichBox().checked).toBe(false);
  });

  it('is a real checkbox in the tab order', async () => {
    await renderAt('/add');

    expect(enrichBox().tagName).toBe('INPUT');
    expect(enrichBox().type).toBe('checkbox');
    expect(enrichBox().disabled).toBe(false);
    expect(enrichBox().tabIndex).toBeGreaterThanOrEqual(0);
  });

  it('is ticked by a press and unticked by another', async () => {
    await renderAt('/add');

    fireEvent.click(enrichCard());
    expect(enrichBox().checked).toBe(true);

    fireEvent.click(enrichCard());
    expect(enrichBox().checked).toBe(false);
  });

  it('toggles on Space from the keyboard', async () => {
    const user = userEvent.setup();
    await renderAt('/add');
    enrichBox().focus();

    await user.keyboard(' ');

    expect(enrichBox().checked).toBe(true);
  });
});

describe('MovieForm — the box, its hint', () => {
  it("reads the form's own sentence while a key is stored", async () => {
    await renderAt('/add');

    await waitFor(() => expect(screen.getByText(FORM_HINT)).toBeDefined());
    expect(screen.queryByText(IMPORT_HINT)).toBeNull();
    expect(screen.queryByText(HINT_WITHOUT_KEY)).toBeNull();
  });

  it("draws the card's own key-less hint with no key stored", async () => {
    answerKey = () => Promise.resolve(okResponse({ key: null }));
    await renderAt('/add');

    expect(screen.getByText(HINT_WITHOUT_KEY)).toBeDefined();
    expect(screen.queryByText(FORM_HINT)).toBeNull();
  });
});

describe('MovieForm — the box and the save', () => {
  it('keeps Add to library as the label, ticked or not', async () => {
    await renderAt('/add');
    expect(save().textContent).toContain('Add to library');

    fireEvent.click(enrichCard());

    expect(save().textContent).toContain('Add to library');
  });

  it('leaves the Save gate a title and a video with the box ticked', async () => {
    await renderAt('/add');
    fireEvent.click(enrichCard());

    expect(save().disabled).toBe(true);
    fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
    expect(save().disabled).toBe(true);
    await pickVideo();
    expect(save().disabled).toBe(false);
    fireEvent.change(titleField(), { target: { value: '' } });
    expect(save().disabled).toBe(true);
  });

  it('ends a ticked save on the flow for the new film, Started on arrival', async () => {
    await renderAt('/add');
    await fillGate();
    fireEvent.click(enrichCard());

    fireEvent.click(save());

    await waitFor(() => expect(url()).toBe('/enrich?movie=new-1&start=1'));
    expect(navigationType()).toBe('PUSH');
  });

  it("steps Back from the flow onto the film's page, and never onto /add", async () => {
    await renderAt('/add');
    await fillGate();
    fireEvent.click(enrichCard());
    fireEvent.click(save());
    await waitFor(() => expect(pathname()).toBe('/enrich'));

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    await waitFor(() => expect(pathname()).toBe('/movie/new-1'));

    // The film's page replaced `/add`: one more step is Settings.
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    await waitFor(() => expect(pathname()).toBe('/settings'));
  });

  it('posts nothing to enrichment itself on a ticked save', async () => {
    await renderAt('/add');
    await fillGate();
    fireEvent.click(enrichCard());

    fireEvent.click(save());
    await waitFor(() => expect(pathname()).toBe('/enrich'));

    expect(enrichmentRequests()).toHaveLength(0);
  });

  it('lands an unticked save on its Fresh home, as now', async () => {
    await renderAt('/add');
    await fillGate();

    fireEvent.click(save());

    await waitFor(() => expect(url()).toBe('/'));
    expect(navigationType()).toBe('PUSH');
  });

  it('goes nowhere on a refused ticked save, keeps every field, starts no Sync', async () => {
    answerSave = () => Promise.resolve(serverErrorResponse());
    await renderAt('/add');
    await fillGate();
    fireEvent.click(enrichCard());

    fireEvent.click(save());
    await waitFor(() => expect(save().disabled).toBe(false));

    expect(url()).toBe('/add');
    expect(titleField().value).toBe('Rear Window');
    expect(screen.getByText('lantern.mp4')).toBeDefined();
    expect(enrichBox().checked).toBe(true);
    expect(enrichmentRequests()).toHaveLength(0);
  });
});
