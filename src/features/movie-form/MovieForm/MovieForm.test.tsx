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
import { MemoryRouter } from 'react-router-dom';

import { MovieForm } from './MovieForm';
import { theme } from '@/styles/theme';
import type { Genre, Movie } from '@/types';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  createdResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

/** What the route answers with — a real library row, with no film behind it. */
const CREATED: Movie = makeMovie({
  id: 'new-1',
  title: 'Rear Window',
  year: 1954,
  videoPath: '',
});

/** The **Genre pool** as `GET /api/genres/pool` sends it: the 12, in migration order. */
const POOL: Genre[] = [
  'Action',
  'Comedy',
  'Drama',
  'Horror',
  'Thriller',
  'Sci-Fi',
  'Romance',
  'Documentary',
  'Animation',
  'Family',
  'Adventure',
  'Crime',
].map((name, index) => ({ id: `g${index + 1}`, name }));

/**
 * How each of the form's two requests answers, settled per test.
 *
 * The form now reads on mount as well as writing on Save, so the stub routes by
 * URL rather than answering everything alike — and a test that is about a save
 * in flight, or a pool that will not load, replaces one arm without touching
 * the other.
 */
let answerPool: () => Promise<Response>;
let answerSave: () => Promise<Response>;

beforeEach(() => {
  answerPool = () => Promise.resolve(okResponse({ genres: POOL }));
  answerSave = () => Promise.resolve(createdResponse(CREATED));

  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input) =>
    String(input).includes('/api/genres/pool') ? answerPool() : answerSave()
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mountForm() {
  return render(
    <MemoryRouter initialEntries={['/add']}>
      <ThemeProvider theme={theme}>
        <MovieForm />
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
}

/**
 * The form, with the pool it loads on mount already settled into chips.
 *
 * The flush is what every test here waits on rather than only the ones about
 * chips: a request answered after a test has finished is a state update outside
 * `act`, and every test on this screen mounts a form that reads.
 */
async function renderForm() {
  const view = mountForm();
  await act(async () => undefined);
  return view;
}

const titleField = () =>
  screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement;
const yearField = () =>
  screen.getByRole('textbox', { name: /year/i }) as HTMLInputElement;
const save = () =>
  screen.getByRole('button', {
    name: /add to library|adding/i,
  }) as HTMLButtonElement;
const currentPath = () => screen.getByTestId('pathname').textContent;

/** The video **File slot**'s own picker, offered while the slot is empty. */
const videoPicker = () =>
  screen.getByLabelText(/choose video file/i) as HTMLInputElement;

/** A film off the maintainer's own disk, as the browser hands it over. */
const videoFile = (name = 'lantern.mp4') =>
  new File(['video bytes'], name, { type: 'video/mp4' });

/**
 * Fill the video half of the **Save gate**.
 *
 * Every test that presses Save has to do this now, which is the whole of what
 * this slice changed about the gate: a title alone was the whole condition
 * while there was no slot to check, and a form that can hold a video is a form
 * that requires one.
 *
 * `applyAccept: false` because the accept list is asserted directly, on the
 * attribute — leaving it on would test `user-event`'s own reading of it rather
 * than what the form offers the file dialog.
 */
async function pickVideo(file: File = videoFile()): Promise<File> {
  await userEvent.upload(videoPicker(), file, { applyAccept: false });
  return file;
}

/** Every genre chip on the form, in the order it is drawn. */
function chips(): HTMLButtonElement[] {
  return (screen.getAllByRole('button') as HTMLButtonElement[]).filter((el) =>
    el.hasAttribute('aria-pressed')
  );
}

const chip = (name: string) =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

/** Whether the named genre is currently picked. */
const picked = (name: string) => chip(name).getAttribute('aria-pressed');

/** Every save the form has issued. */
function saveRequests() {
  return fetchMock.mock.calls.filter(
    ([input, init]) =>
      String(input).includes('/api/movies') && init?.method === 'POST'
  );
}

/** The multipart body of the save, or `undefined` if nothing was ever sent. */
function savedFields(): FormData | undefined {
  return saveRequests()[0]?.[1]?.body as FormData | undefined;
}

/**
 * The **Movie form** in its **Add context**, holding the fields and the chips
 * this slice gives it. It is the only writer in the app that is not a
 * single-signal write, and the first screen that creates a record rather than
 * amending one.
 *
 * The gate, the in-flight state and the destination are asserted here rather
 * than on `useMovieForm` directly: what the maintainer can press, and what the
 * button says while they wait, is the behaviour — the hook is where it happens
 * to live, and it has one more half of the gate to grow when the video slot
 * lands.
 */
describe('MovieForm', () => {
  it('offers a Title and a Year to type into', async () => {
    await renderForm();

    expect(titleField().value).toBe('');
    expect(yearField().value).toBe('');
  });

  describe('the Year field', () => {
    it('keeps the digits and drops everything else', async () => {
      await renderForm();

      fireEvent.change(yearField(), { target: { value: '19a5' } });

      // A year cannot hold something that is not a year, so there is no
      // invalid state to report and no error surface to design.
      expect(yearField().value).toBe('195');
    });

    it('stops at four characters', async () => {
      await renderForm();

      fireEvent.change(yearField(), { target: { value: '19544' } });

      expect(yearField().value).toBe('1954');
    });

    it('takes a four-digit year unchanged', async () => {
      await renderForm();

      fireEvent.change(yearField(), { target: { value: '1954' } });

      expect(yearField().value).toBe('1954');
    });

    it('can be cleared back to empty', async () => {
      await renderForm();

      fireEvent.change(yearField(), { target: { value: '1954' } });
      fireEvent.change(yearField(), { target: { value: '' } });

      expect(yearField().value).toBe('');
    });
  });

  // --- 11 — Movie form, Phase 1: the genre chips (issue #99) -----------------

  describe('the genre chips', () => {
    it('offers the whole pool, in the order the route sent it', async () => {
      await renderForm();

      // Twelve, including the ones no movie is tagged with — which is what
      // makes filing a film under Documentary before a Documentary row exists
      // possible at all.
      expect(chips().map((c) => c.textContent?.trim())).toEqual(
        POOL.map((genre) => genre.name)
      );
    });

    it('captions the row the way the prototype does', async () => {
      await renderForm();

      expect(screen.getByText(/pick one or more/i)).toBeDefined();
    });

    it('picks a genre when its chip is pressed', async () => {
      await renderForm();

      fireEvent.click(chip('Thriller'));

      expect(picked('Thriller')).toBe('true');
    });

    it('unpicks it when the same chip is pressed again', async () => {
      await renderForm();

      fireEvent.click(chip('Thriller'));
      fireEvent.click(chip('Thriller'));

      // The chips are the only control on the form with no other way to undo
      // it — a second press is the whole of "no, not that one".
      expect(picked('Thriller')).toBe('false');
    });

    it('holds several genres at once', async () => {
      await renderForm();

      fireEvent.click(chip('Thriller'));
      fireEvent.click(chip('Sci-Fi'));

      expect(picked('Thriller')).toBe('true');
      expect(picked('Sci-Fi')).toBe('true');
      expect(picked('Drama')).toBe('false');
    });

    it('leaves the others alone when one is unpicked', async () => {
      await renderForm();

      fireEvent.click(chip('Thriller'));
      fireEvent.click(chip('Sci-Fi'));
      fireEvent.click(chip('Thriller'));

      expect(picked('Thriller')).toBe('false');
      expect(picked('Sci-Fi')).toBe('true');
    });

    it('starts with nothing picked', async () => {
      await renderForm();

      // The count is asserted alongside, so a row that failed to draw at all
      // cannot pass this by having nothing to be pressed.
      expect(chips()).toHaveLength(POOL.length);
      expect(
        chips().every((c) => c.getAttribute('aria-pressed') === 'false')
      ).toBe(true);
    });
  });

  describe('the save gate', () => {
    it('reads "Add to library"', async () => {
      await renderForm();

      expect(save().textContent).toContain('Add to library');
    });

    it('is disabled while there is no title', async () => {
      await renderForm();

      // A gate rather than a validation message: `title` is NOT NULL, and the
      // only "invalid" state this form can reach is one where Save cannot be
      // pressed.
      expect(save().disabled).toBe(true);
    });

    it('opens once there is a title and a video', async () => {
      await renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      await pickVideo();

      // Story 33, whole. The gate arrived in halves — the title half was all a
      // form with no video slot could check — and this is the one condition
      // both halves now belong to rather than two conditions in two places.
      expect(save().disabled).toBe(false);
    });

    it('closes again if the title is deleted', async () => {
      await renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      await pickVideo();
      fireEvent.change(titleField(), { target: { value: '' } });

      expect(save().disabled).toBe(true);
    });

    it('does not open on a year alone', async () => {
      await renderForm();

      fireEvent.change(yearField(), { target: { value: '1954' } });

      expect(save().disabled).toBe(true);
    });

    it('does not open on a genre alone', async () => {
      await renderForm();

      fireEvent.click(chip('Thriller'));

      // Genre is optional, so it is no part of the gate — a filed film with no
      // title is still not a row this form can write.
      expect(save().disabled).toBe(true);
    });
  });

  describe('saving', () => {
    it('sends the typed title and year', async () => {
      await renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      await pickVideo();
      fireEvent.change(yearField(), { target: { value: '1954' } });
      fireEvent.click(save());

      await waitFor(() => expect(savedFields()).toBeDefined());
      const fields = savedFields() as FormData;
      expect(fields.get('title')).toBe('Rear Window');
      expect(fields.get('year')).toBe('1954');
    });

    it('sends the picked genres, in the order they were picked', async () => {
      await renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      await pickVideo();
      fireEvent.click(chip('Sci-Fi'));
      fireEvent.click(chip('Thriller'));
      fireEvent.click(save());

      await waitFor(() => expect(savedFields()).toBeDefined());
      // The maintainer's order, not the pool's: Sci-Fi is the sixth chip and
      // the first genre, and `genres[0]` is the primary tag.
      expect((savedFields() as FormData).getAll('genre')).toEqual([
        'Sci-Fi',
        'Thriller',
      ]);
    });

    it('sends no genre that was picked and then unpicked', async () => {
      await renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      await pickVideo();
      fireEvent.click(chip('Sci-Fi'));
      fireEvent.click(chip('Thriller'));
      fireEvent.click(chip('Sci-Fi'));
      fireEvent.click(save());

      await waitFor(() => expect(savedFields()).toBeDefined());
      expect((savedFields() as FormData).getAll('genre')).toEqual(['Thriller']);
    });

    it('sends no genre at all when none was picked', async () => {
      await renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      await pickVideo();
      fireEvent.click(save());

      await waitFor(() => expect(savedFields()).toBeDefined());
      // A film the maintainer has not filed is a normal row — in the library,
      // and on no shelf.
      expect((savedFields() as FormData).getAll('genre')).toEqual([]);
    });

    it('reads "Adding…" and is disabled while the request is in flight', async () => {
      let settle: (response: Response) => void = () => undefined;
      answerSave = () =>
        new Promise<Response>((resolve) => {
          settle = resolve;
        });
      await renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      await pickVideo();
      fireEvent.click(save());

      // The one place a large-file save will show its cost. The label says the
      // work started, and the disabled button is what stops a second row being
      // written by an impatient second press.
      await waitFor(() => expect(save().textContent).toContain('Adding…'));
      expect(save().disabled).toBe(true);

      settle(createdResponse(CREATED));
      await waitFor(() => expect(currentPath()).toBe('/'));
    });

    it('writes one movie however many times Save is pressed', async () => {
      let settle: (response: Response) => void = () => undefined;
      answerSave = () =>
        new Promise<Response>((resolve) => {
          settle = resolve;
        });
      await renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      await pickVideo();
      fireEvent.click(save());
      fireEvent.click(save());
      fireEvent.click(save());

      settle(createdResponse(CREATED));
      await waitFor(() => expect(currentPath()).toBe('/'));
      expect(saveRequests()).toHaveLength(1);
    });

    it('lands on the browse home once the movie is written', async () => {
      await renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      await pickVideo();
      fireEvent.click(save());

      // The **Add context** ends on the shelf the film just joined — the
      // prototype's `goBrowse()`, and the one place the maintainer can see the
      // save worked.
      await waitFor(() => expect(currentPath()).toBe('/'));
    });

    it('stays on the form and offers Save again when the save fails', async () => {
      answerSave = () => Promise.resolve(serverErrorResponse());
      await renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      await pickVideo();
      fireEvent.click(chip('Thriller'));
      fireEvent.click(save());

      // No snackbar in this slice, so the honest answer to a refused save is
      // the form still standing with everything typed still in it — the chip
      // included, since re-picking it is work the maintainer already did.
      await waitFor(() => expect(save().disabled).toBe(false));
      expect(currentPath()).toBe('/add');
      expect(titleField().value).toBe('Rear Window');
      expect(picked('Thriller')).toBe('true');
      expect(save().textContent).toContain('Add to library');
    });
  });

  describe('when the genre pool cannot be loaded', () => {
    it('draws no chips rather than an error', async () => {
      answerPool = () => Promise.resolve(serverErrorResponse());
      mountForm();

      // `useGenreList`'s recorded precedent: the prototype designs no error
      // state here, so a broken endpoint is a caption with nothing under it.
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(chips()).toEqual([]);
    });

    it('still saves the rest of the form', async () => {
      answerPool = () => Promise.reject(new Error('offline'));
      mountForm();
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      await pickVideo();
      fireEvent.change(yearField(), { target: { value: '1954' } });
      fireEvent.click(save());

      // The acceptance criterion this slice is most easily got wrong: a
      // maintainer with no chips has still lost nothing but the chips.
      await waitFor(() => expect(currentPath()).toBe('/'));
      const fields = savedFields() as FormData;
      expect(fields.get('title')).toBe('Rear Window');
      expect(fields.getAll('genre')).toEqual([]);
    });
  });
});

// --- 11 — Movie form, Phase 2: director, cast and description (issue #100) ---

const directorField = () =>
  screen.getByRole('textbox', { name: /director/i }) as HTMLInputElement;
const castField = () =>
  screen.getByRole('textbox', { name: /^cast$/i }) as HTMLInputElement;
const descriptionField = () =>
  screen.getByRole('textbox', { name: /description/i }) as HTMLTextAreaElement;

/**
 * The rest of the metadata the prototype collects: a **Director**, a **Cast**
 * typed as one comma-separated line, and a **Description** long enough to be a
 * paragraph.
 *
 * These are the first fields on this form whose typed shape and stored shape
 * differ — the cast is one line in the box and a list in the row — so what is
 * asserted here is the box, and what is asserted on the wire below is the list.
 * `castNames` is the seam between them, and is tested on its own.
 */
describe('MovieForm — the credits fields', () => {
  it('offers a Director, a Cast and a Description to type into', async () => {
    await renderForm();

    expect(directorField().value).toBe('');
    expect(castField().value).toBe('');
    expect(descriptionField().value).toBe('');
  });

  it('carries the prototype’s placeholders', async () => {
    await renderForm();

    expect(directorField().placeholder).toBe('Director name');
    expect(castField().placeholder).toBe('e.g. Jane Doe, John Roe');
    expect(descriptionField().placeholder).toBe(
      'A short synopsis of the movie'
    );
  });

  it('captions the Cast field the way the prototype does', async () => {
    await renderForm();

    // The whole of the cast's specification is in its caption: the comma is the
    // separator because the screen says it is.
    expect(screen.getByText(/separate with commas/i)).toBeDefined();
  });

  it('gives the Description a multi-line box rather than another line', async () => {
    await renderForm();

    // `prim.Textarea`'s reason for existing, from the one caller that has one.
    expect(descriptionField().tagName).toBe('TEXTAREA');
  });

  it('holds what is typed into each of them', async () => {
    await renderForm();

    fireEvent.change(directorField(), {
      target: { value: 'Alfred Hitchcock' },
    });
    fireEvent.change(castField(), { target: { value: 'Jane Doe, John Roe' } });
    fireEvent.change(descriptionField(), {
      target: { value: 'A photographer watches his neighbours.' },
    });

    expect(directorField().value).toBe('Alfred Hitchcock');
    expect(castField().value).toBe('Jane Doe, John Roe');
    expect(descriptionField().value).toBe(
      'A photographer watches his neighbours.'
    );
  });

  it('keeps the cast exactly as it is being typed, commas and all', async () => {
    await renderForm();

    // The split happens once, at the wire. A field that tidied itself while it
    // was being typed into would delete the comma just pressed.
    fireEvent.change(castField(), { target: { value: 'Jane Doe, ' } });

    expect(castField().value).toBe('Jane Doe, ');
  });
});

describe('MovieForm — the save gate, with the credits fields', () => {
  it('does not open on a director alone', async () => {
    await renderForm();

    fireEvent.change(directorField(), {
      target: { value: 'Alfred Hitchcock' },
    });

    // Every one of these three is optional, so none of them is part of the
    // gate — `title` is still the only NOT NULL column this form can fill.
    expect(save().disabled).toBe(true);
  });

  it('does not open on a cast alone', async () => {
    await renderForm();

    fireEvent.change(castField(), { target: { value: 'Jane Doe' } });

    expect(save().disabled).toBe(true);
  });

  it('does not open on a description alone', async () => {
    await renderForm();

    fireEvent.change(descriptionField(), {
      target: { value: 'A photographer watches his neighbours.' },
    });

    expect(save().disabled).toBe(true);
  });

  it('still opens on a title with none of them typed', async () => {
    await renderForm();

    fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
    await pickVideo();

    expect(save().disabled).toBe(false);
  });
});

describe('MovieForm — saving the credits fields', () => {
  it('sends the typed director and description', async () => {
    await renderForm();

    fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
    await pickVideo();
    fireEvent.change(directorField(), {
      target: { value: 'Alfred Hitchcock' },
    });
    fireEvent.change(descriptionField(), {
      target: { value: 'A photographer watches his neighbours.' },
    });
    fireEvent.click(save());

    await waitFor(() => expect(savedFields()).toBeDefined());
    const fields = savedFields() as FormData;
    expect(fields.get('director')).toBe('Alfred Hitchcock');
    expect(fields.get('description')).toBe(
      'A photographer watches his neighbours.'
    );
  });

  it('sends one cast part per name, in the order they were typed', async () => {
    await renderForm();

    fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
    await pickVideo();
    fireEvent.change(castField(), {
      target: { value: 'Jane Doe, John Roe, Ana Vega' },
    });
    fireEvent.click(save());

    await waitFor(() => expect(savedFields()).toBeDefined());
    // The genre chips' own spelling, for the same reason: a list on this wire
    // has always been one part per entry under one name. The typed line is
    // resolved here rather than re-split on the server.
    expect((savedFields() as FormData).getAll('cast')).toEqual([
      'Jane Doe',
      'John Roe',
      'Ana Vega',
    ]);
  });

  it('sends no cast part at all when the field is empty', async () => {
    await renderForm();

    fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
    await pickVideo();
    fireEvent.click(save());

    await waitFor(() => expect(savedFields()).toBeDefined());
    expect((savedFields() as FormData).getAll('cast')).toEqual([]);
  });

  it('sends an empty director and description rather than omitting them', async () => {
    await renderForm();

    fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
    await pickVideo();
    fireEvent.click(save());

    await waitFor(() => expect(savedFields()).toBeDefined());
    // `year`'s rule, read over two more fields: a field that vanished when it
    // was cleared could not say a director had been *removed* — the same
    // request shape one slice from now.
    const fields = savedFields() as FormData;
    expect(fields.get('director')).toBe('');
    expect(fields.get('description')).toBe('');
  });

  it('leaves all three still typed when the save fails', async () => {
    answerSave = () => Promise.resolve(serverErrorResponse());
    await renderForm();

    fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
    await pickVideo();
    fireEvent.change(directorField(), {
      target: { value: 'Alfred Hitchcock' },
    });
    fireEvent.change(castField(), { target: { value: 'Jane Doe, John Roe' } });
    fireEvent.change(descriptionField(), {
      target: { value: 'A photographer watches his neighbours.' },
    });
    fireEvent.click(save());

    // The synopsis is the most expensive thing on this screen to retype, which
    // is what makes losing it on a refused save the worst version of that bug.
    await waitFor(() => expect(save().disabled).toBe(false));
    expect(directorField().value).toBe('Alfred Hitchcock');
    expect(castField().value).toBe('Jane Doe, John Roe');
    expect(descriptionField().value).toBe(
      'A photographer watches his neighbours.'
    );
  });
});

// --- 11 — Movie form, Phase 2: the rating and the actions row (issue #101) ---

/** The **Half-star segment** that asks for the rating named on it. */
const segment = (name: string) =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

/** What the strip says the movie is scored, beside the stars. */
const ratingLabel = () =>
  screen.getByRole('group', { name: /your rating/i }).parentElement
    ?.textContent;

const cancel = () =>
  screen.getByRole('button', { name: /^cancel$/i }) as HTMLButtonElement;
const backPill = () =>
  screen.getByRole('button', { name: /^back$/i }) as HTMLButtonElement;

/**
 * The form as it is actually reached — from Settings, with somewhere behind it.
 *
 * `mountForm`'s single entry is the deep-linked case, where `useGoBack` falls
 * back to the library; this is the case the maintainer is in every time, and
 * the one where "the same way out" is a claim with two possible answers.
 */
async function renderFormFromSettings() {
  const view = render(
    <MemoryRouter initialEntries={['/settings', '/add']} initialIndex={1}>
      <ThemeProvider theme={theme}>
        <MovieForm />
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
  await act(async () => undefined);
  return view;
}

/**
 * The **Rating picker** in the **Movie form** — the same molecule the detail
 * page's **Meta line** already renders, with a different destination: there it
 * is a **Single-signal write**, here it is one field of the whole-record save.
 *
 * What is asserted here is the form holding a rating, not the picker working —
 * `RatingPicker` owns its own **Half-star segments**, its **Rating preview**
 * and its labels, and re-testing them here would test the molecule twice.
 */
describe('MovieForm — the rating picker', () => {
  it('captions the picker the way the prototype does', async () => {
    await renderForm();

    expect(screen.getByText(/click a star \(or half\)/i)).toBeDefined();
  });

  it('opens on Unrated rather than on nought stars', async () => {
    await renderForm();

    // A form that opened on 0.0 / 5 would have every movie arrive scored
    // nothing by a maintainer who never touched the stars.
    expect(ratingLabel()).toContain('Not rated');
  });

  it('sets a whole star', async () => {
    await renderForm();

    fireEvent.click(segment('Rate 4 stars'));

    expect(ratingLabel()).toContain('4.0 / 5');
  });

  it('sets a half star', async () => {
    await renderForm();

    fireEvent.click(segment('Rate 3½ stars'));

    // The reason the picker exists rather than five whole stars: three and a
    // half stops being something the maintainer has to round away from.
    expect(ratingLabel()).toContain('3.5 / 5');
  });

  it('clears back to Unrated when the segment holding the value is pressed again', async () => {
    await renderForm();

    fireEvent.click(segment('Rate 3½ stars'));
    fireEvent.click(segment('Clear rating'));

    // The same gesture the detail page already answers to — a rating is
    // removable the same way everywhere, and what it clears to is the absence
    // rather than a nought.
    expect(ratingLabel()).toContain('Not rated');
  });

  it('takes a second rating over the first', async () => {
    await renderForm();

    fireEvent.click(segment('Rate 2 stars'));
    fireEvent.click(segment('Rate 4½ stars'));

    expect(ratingLabel()).toContain('4.5 / 5');
  });

  it('does not open the save gate on a rating alone', async () => {
    await renderForm();

    fireEvent.click(segment('Rate 4 stars'));

    // Optional like every other field but the title, and the gate does not
    // move for it.
    expect(save().disabled).toBe(true);
  });
});

describe('MovieForm — saving the rating', () => {
  it('sends the rating in the units the column stores', async () => {
    await renderForm();

    fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
    await pickVideo();
    fireEvent.click(segment('Rate 4 stars'));
    fireEvent.click(save());

    await waitFor(() => expect(savedFields()).toBeDefined());
    // The form holds the percent the picker speaks and `toRatingUnits`
    // converts it once, at the wire — so no second rating representation
    // enters the app.
    expect((savedFields() as FormData).get('rating')).toBe('8');
  });

  it('sends a half star as the half unit it is', async () => {
    await renderForm();

    fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
    await pickVideo();
    fireEvent.click(segment('Rate 3½ stars'));
    fireEvent.click(save());

    await waitFor(() => expect(savedFields()).toBeDefined());
    expect((savedFields() as FormData).get('rating')).toBe('7');
  });

  it('sends an empty rating when the stars were never touched', async () => {
    await renderForm();

    fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
    await pickVideo();
    fireEvent.click(save());

    await waitFor(() => expect(savedFields()).toBeDefined());
    // Unrated is a state this form can hold and send. The field travels empty
    // rather than vanishing, for `year`'s reason, and it is emphatically not a
    // nought: a movie nobody scored must not read back as one scored nothing.
    const fields = savedFields() as FormData;
    expect(fields.get('rating')).toBe('');
    expect(fields.get('rating')).not.toBe('0');
  });

  it('sends an empty rating for one that was set and then cleared', async () => {
    await renderForm();

    fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
    await pickVideo();
    fireEvent.click(segment('Rate 3½ stars'));
    fireEvent.click(segment('Clear rating'));
    fireEvent.click(save());

    await waitFor(() => expect(savedFields()).toBeDefined());
    // A cleared rating and an untouched one are the same claim, and the wire
    // says it the same way.
    expect((savedFields() as FormData).get('rating')).toBe('');
  });

  it('leaves the rating still set when the save fails', async () => {
    answerSave = () => Promise.resolve(serverErrorResponse());
    await renderForm();

    fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
    await pickVideo();
    fireEvent.click(segment('Rate 3½ stars'));
    fireEvent.click(save());

    // The refused save leaves the form standing with everything in it — the
    // score included, since re-finding the same half star is work already done.
    await waitFor(() => expect(save().disabled).toBe(false));
    expect(ratingLabel()).toContain('3.5 / 5');
  });
});

/**
 * The **actions row** the tracer slice's lone Save button stood in for.
 *
 * Cancel and the back pill are one behaviour asserted twice, deliberately: two
 * ways out of the same screen that behaved differently would be the bug, and it
 * is only visible by driving both.
 */
describe('MovieForm — the actions row', () => {
  it('offers Cancel beside Save', async () => {
    await renderForm();

    expect(save().textContent).toContain('Add to library');
    expect(cancel().textContent).toContain('Cancel');
  });

  it('draws Save first and Cancel after it', async () => {
    await renderForm();

    // The prototype's order, and the one that puts the primary action where
    // the eye lands first.
    expect(
      save().compareDocumentPosition(cancel()) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('offers Cancel on a form too empty to save', async () => {
    await renderForm();

    // The gate closes Save, never the way out. A form the maintainer cannot
    // finish is exactly the form they most need to leave.
    expect(save().disabled).toBe(true);
    expect(cancel().disabled).toBe(false);
  });

  it('leaves for the screen behind the form, exactly as the back pill does', async () => {
    const { unmount } = await renderFormFromSettings();
    fireEvent.click(cancel());
    expect(currentPath()).toBe('/settings');
    unmount();

    // The same claim made through the other control, in one test rather than
    // two, because the claim *is* that the two agree — asserted apart, they
    // could drift and both still pass.
    await renderFormFromSettings();
    fireEvent.click(backPill());
    expect(currentPath()).toBe('/settings');
  });

  it('falls back to the library from both, on a form with nothing behind it', async () => {
    const { unmount } = await renderForm();
    fireEvent.click(cancel());
    expect(currentPath()).toBe('/');
    unmount();

    await renderForm();
    fireEvent.click(backPill());
    expect(currentPath()).toBe('/');
  });

  it('writes nothing when Cancel is pressed', async () => {
    await renderForm();

    fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
    fireEvent.click(cancel());

    // Cancel is a way out, not a save. The typed title leaves with the screen.
    expect(saveRequests()).toEqual([]);
  });
});

// --- 11 — Movie form, Phase 3: the video slot (issue #102) -------------------
//
// The first control on this form that is not a field: a **File slot**, which is
// empty, holds a **Picked file**, or (from the edit slice) holds a **Stored
// file**. What is asserted here is the screen — what the maintainer sees in the
// slot, what Save does about it, and what goes out on the wire — while
// `FileField` is where the molecule's own two states are asserted.
//
// The subtitle line under the heading is deliberately still absent: it reads
// "Pick the video, poster, and any subtitle files for this movie", and two of
// those three controls arrive in #103 and #104.

/** The video slot's remove control, offered only while the slot is filled. */
const removeVideo = () =>
  screen.getByRole('button', { name: /remove video/i }) as HTMLButtonElement;

/** The filename the slot is showing, or `null` while it is empty. */
const pickedFilename = () => screen.queryByText('lantern.mp4');

/** The video part of the save, or `undefined` if none was sent. */
const savedVideo = () => savedFields()?.get('video');

describe('MovieForm — the Files card', () => {
  it('draws the Files card with the video slot in it', async () => {
    await renderForm();

    // The prototype's own card: an uppercase "Files" caption over the slots,
    // and the video slot labelled beside its control.
    expect(screen.getByText(/^files$/i)).toBeDefined();
    expect(screen.getByText(/^video$/i)).toBeDefined();
  });

  it('offers an empty slot as a choose button', async () => {
    await renderForm();

    // Story 32: the empty state has to read as a button and say what it wants.
    expect(videoPicker()).toBeDefined();
    expect(pickedFilename()).toBeNull();
  });

  it('offers the container types a browser will not name', async () => {
    await renderForm();

    // Story 21. Chromium gives MKV and AVI no MIME type at all, so `video/*`
    // alone would grey out most of the family folder in the file dialog. The
    // server re-checks anyway — an accept list is a convenience, never a
    // guarantee.
    const accept = videoPicker().getAttribute('accept') ?? '';
    expect(accept).toContain('video/*');
    expect(accept).toContain('.mkv');
    expect(accept).toContain('.avi');
  });

  it('shows the filename of the film that was picked', async () => {
    await renderForm();

    await pickVideo();

    // Story 29: the filename is the only way to tell the right film from the
    // one next to it in the folder, since a browser will not say where either
    // came from.
    expect(pickedFilename()).not.toBeNull();
  });

  it('returns the slot to empty when the remove is pressed', async () => {
    await renderForm();
    await pickVideo();

    fireEvent.click(removeVideo());

    // Story 30. A slot stuck with the wrong file would be a form the
    // maintainer has to abandon and start again.
    expect(pickedFilename()).toBeNull();
    expect(videoPicker()).toBeDefined();
  });

  it('takes a different film once the wrong one is removed', async () => {
    await renderForm();
    await pickVideo(videoFile('the-wrong-film.mp4'));

    fireEvent.click(removeVideo());
    await pickVideo();

    expect(screen.queryByText('the-wrong-film.mp4')).toBeNull();
    expect(pickedFilename()).not.toBeNull();
  });
});

describe('MovieForm — the save gate, with the video slot', () => {
  it('does not open on a title alone', async () => {
    await renderForm();

    fireEvent.change(titleField(), { target: { value: 'Rear Window' } });

    // What this slice changed. `video_path` is NOT NULL and a row with no film
    // behind it is the state Phases 1 and 2 shipped in; now that the form can
    // offer a film, saving without one is no longer a row worth writing.
    expect(save().disabled).toBe(true);
  });

  it('does not open on a video alone', async () => {
    await renderForm();

    await pickVideo();

    expect(save().disabled).toBe(true);
  });

  it('closes again if the video is removed', async () => {
    await renderForm();
    fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
    await pickVideo();

    fireEvent.click(removeVideo());

    // The gate is a condition, not a latch: the second half can be taken back
    // exactly as the first one can.
    expect(save().disabled).toBe(true);
  });
});

describe('MovieForm — saving the video', () => {
  it('sends the picked file as the video part', async () => {
    await renderForm();
    fireEvent.change(titleField(), { target: { value: 'The Lantern Keeper' } });
    const file = await pickVideo();

    fireEvent.click(save());

    await waitFor(() => expect(savedFields()).toBeDefined());
    // The file itself, not its name: a browser `File` is a name and bytes and
    // never a path, so the bytes are the only thing there is to send.
    expect(savedVideo()).toBe(file);
  });

  it('sends one video part however big the film is', async () => {
    await renderForm();
    fireEvent.change(titleField(), { target: { value: 'The Lantern Keeper' } });
    await pickVideo();

    fireEvent.click(save());

    await waitFor(() => expect(savedFields()).toBeDefined());
    // Story 36: one request per save. No upload-on-pick, no draft id, and
    // nothing sent before Save was pressed.
    expect(savedFields()?.getAll('video')).toHaveLength(1);
    expect(saveRequests()).toHaveLength(1);
  });

  it('carries the video alongside every field that was typed', async () => {
    await renderForm();
    fireEvent.change(titleField(), { target: { value: 'The Lantern Keeper' } });
    fireEvent.change(yearField(), { target: { value: '2019' } });
    fireEvent.click(chip('Drama'));
    await pickVideo();

    fireEvent.click(save());

    await waitFor(() => expect(savedFields()).toBeDefined());
    const fields = savedFields() as FormData;
    expect(fields.get('title')).toBe('The Lantern Keeper');
    expect(fields.get('year')).toBe('2019');
    expect(fields.getAll('genre')).toEqual(['Drama']);
    expect(fields.get('video')).toBeInstanceOf(File);
  });

  it('leaves the film in the slot when the save fails', async () => {
    answerSave = () => Promise.resolve(serverErrorResponse());
    await renderForm();
    fireEvent.change(titleField(), { target: { value: 'The Lantern Keeper' } });
    await pickVideo();

    fireEvent.click(save());

    // The refused save leaves the form standing with everything in it — the
    // film included, since re-finding the same file in a file dialog is the
    // most tedious work on this screen to lose.
    await waitFor(() => expect(save().disabled).toBe(false));
    expect(currentPath()).toBe('/add');
    expect(pickedFilename()).not.toBeNull();
  });
});
