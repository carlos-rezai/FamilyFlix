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
import type { Genre, ImportProblemDetail, Movie } from '@/types';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  createdResponse,
  noContentResponse,
  notFoundResponse,
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

/**
 * The film the **Edit context** opens on — a record with every field the form
 * collects already filled in, and every **File slot** already holding a
 * **Stored file**.
 */
const STORED: Movie = makeMovie({
  id: 'a1',
  title: 'The Lantern Keeper',
  year: 2019,
  director: 'Ana Sørensen',
  cast: ['Marit Holt', 'Peder Vinge'],
  synopsis: 'A keeper on a fading coast takes in a runaway girl.',
  rating: 7,
  videoPath: 'the-lantern-keeper-2019/lantern.mp4',
  posterPath: 'the-lantern-keeper-2019/poster.jpg',
  genres: [
    { id: 'g3', name: 'Drama' },
    { id: 'g1', name: 'Action' },
  ],
  subtitles: [
    {
      id: 's1',
      path: 'the-lantern-keeper-2019/lantern.en.srt',
      language: 'English',
      position: 0,
    },
    {
      id: 's2',
      path: 'the-lantern-keeper-2019/lantern.pt.srt',
      language: 'Portuguese',
      position: 1,
    },
  ],
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
let answerMovie: () => Promise<Response>;

beforeEach(() => {
  answerPool = () => Promise.resolve(okResponse({ genres: POOL }));
  answerSave = () => Promise.resolve(createdResponse(CREATED));
  // The third arm, and the one only the **Edit context** reaches: the record
  // `?movie=` names, read back through the shared `fetchMovie` the detail page
  // and the player already call.
  answerMovie = () => Promise.resolve(okResponse(STORED));

  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    if (init?.method === 'POST' || init?.method === 'PATCH') {
      return answerSave();
    }
    return String(input).includes('/api/genres/pool')
      ? answerPool()
      : answerMovie();
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- Rendering the form ---------------------------------------------------------

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

/** The form opened on a movie, the way **Edit details** opens it. */
async function renderEdit(id = STORED.id) {
  const view = render(
    <MemoryRouter initialEntries={[`/add?movie=${id}`]}>
      <ThemeProvider theme={theme}>
        <MovieForm />
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
  // Two reads settle on mount here rather than one — the pool and the record —
  // and both fill the screen this test is about.
  await act(async () => undefined);
  return view;
}

// --- The fields, the chips and the rating ---------------------------------------

const titleField = () =>
  screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement;
const yearField = () =>
  screen.getByRole('textbox', { name: /year/i }) as HTMLInputElement;
const save = () =>
  screen.getByRole('button', {
    name: /add to library|adding/i,
  }) as HTMLButtonElement;
const currentPath = () => screen.getByTestId('pathname').textContent;
const directorField = () =>
  screen.getByRole('textbox', { name: /director/i }) as HTMLInputElement;
const castField = () =>
  screen.getByRole('textbox', { name: /^cast$/i }) as HTMLInputElement;
const descriptionField = () =>
  screen.getByRole('textbox', { name: /description/i }) as HTMLTextAreaElement;

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

/** Save, in the **Edit context**, under whichever of its two labels it wears. */
const saveChanges = () =>
  screen.getByRole('button', {
    name: /save changes|saving/i,
  }) as HTMLButtonElement;

// --- The file slots -------------------------------------------------------------

/** The video **File slot**'s own picker, offered while the slot is empty. */
const videoPicker = () =>
  screen.getByLabelText(/choose video file/i) as HTMLInputElement;

/** A film off the maintainer's own disk, as the browser hands it over. */
const videoFile = (name = 'lantern.mp4') =>
  new File(['video bytes'], name, { type: 'video/mp4' });

/**
 * Fill the video half of the **Save gate**.
 *
 * Every test that presses Save has to do this: a form that can hold a video is
 * a form that requires one.
 *
 * `applyAccept: false` because the accept list is asserted directly, on the
 * attribute — leaving it on would test `user-event`'s own reading of it rather
 * than what the form offers the file dialog.
 */
async function pickVideo(file: File = videoFile()): Promise<File> {
  await userEvent.upload(videoPicker(), file, { applyAccept: false });
  return file;
}

/** The poster **File slot**'s own picker, offered while the slot is empty. */
const posterPicker = () =>
  screen.getByLabelText(/choose poster image/i) as HTMLInputElement;

/** The artwork beside the film in the same folder. */
const posterFile = (name = 'lantern-poster.jpg') =>
  new File(['image bytes'], name, { type: 'image/jpeg' });

/**
 * Fill the poster slot.
 *
 * No test that presses Save has to call this — the poster is not a half of the
 * **Save gate**: a film with no artwork to hand is a film that still gets into
 * the library.
 */
async function pickPoster(file: File = posterFile()): Promise<File> {
  await userEvent.upload(posterPicker(), file, { applyAccept: false });
  return file;
}

/** The video slot's remove control, offered only while the slot is filled. */
const removeVideo = () =>
  screen.getByRole('button', { name: /remove video/i }) as HTMLButtonElement;

/** The filename the slot is showing, or `null` while it is empty. */
const pickedFilename = () => screen.queryByText('lantern.mp4');

/** The poster slot's remove control, offered only while the slot is filled. */
const removePoster = () =>
  screen.getByRole('button', { name: /remove poster/i }) as HTMLButtonElement;

/** The poster filename the slot is showing, or `null` while it is empty. */
const pickedPoster = () => screen.queryByText('lantern-poster.jpg');

/** The "＋ Add subtitle file" picker, offered however many rows already exist. */
const subtitlePicker = () =>
  screen.getByLabelText(/add subtitle file/i) as HTMLInputElement;

/** A subtitle file off the maintainer's own disk. */
const subtitleFile = (name = 'lantern.en.srt') =>
  new File(['cue bytes'], name, { type: 'text/plain' });

/**
 * Attach one track, the way the maintainer does: pick a file, and a row
 * appears. There is no empty subtitle row to fill in — the ＋ is the picker.
 */
async function attachSubtitle(file: File = subtitleFile()): Promise<File> {
  await userEvent.upload(subtitlePicker(), file, { applyAccept: false });
  return file;
}

/** One row's language control, named after the file it labels. */
const languageOf = (filename: string) =>
  screen.getByRole('button', {
    name: new RegExp(`language for ${filename.replace(/\./g, '\\.')}`, 'i'),
  });

/** Sets one row's language through its own list. */
function chooseLanguage(filename: string, language: string) {
  fireEvent.click(languageOf(filename));
  fireEvent.click(screen.getByRole('menuitem', { name: language }));
}

// --- What went out on the wire --------------------------------------------------

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

/** The video part of the save, or `undefined` if none was sent. */
const savedVideo = () => savedFields()?.get('video');

/** The poster part of the save, or `undefined` if none was sent. */
const savedPoster = () => savedFields()?.get('poster');

/** Every subtitle part of the save, in the order they were appended. */
const savedSubtitles = () => savedFields()?.getAll('subtitle') ?? [];

/** Every language field of the save, in the order they were appended. */
const savedLanguages = () => savedFields()?.getAll('subtitleLanguage') ?? [];

/** Every edit the form has issued. */
function patchRequests() {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
}

/** The multipart body of the edit, or `undefined` if nothing was ever sent. */
function patchedFields(): FormData | undefined {
  return patchRequests()[0]?.[1]?.body as FormData | undefined;
}

/**
 * Every part of the edit that carried bytes rather than a value.
 *
 * The three names are named rather than the body walked: they are the only
 * parts this form can put bytes in, so a fourth appearing is a change to the
 * encoding rather than something to absorb quietly.
 */
const patchedFiles = (): File[] => {
  const body = patchedFields();
  return body === undefined
    ? []
    : ['video', 'poster', 'subtitle']
        .flatMap((name) => body.getAll(name))
        .filter((value): value is File => value instanceof File);
};

/**
 * The **Movie form** in its **Add context**: the fields, the chips, the rating
 * picker and the three kinds of file. It is the only writer in the app that is
 * not a single-signal write, and the one screen that creates a record rather
 * than amending one.
 *
 * The gate, the in-flight state and the destination are asserted here rather
 * than on `useMovieForm` directly: what the maintainer can press, and what the
 * button says while they wait, is the behaviour — the hook is where it happens
 * to live.
 */
/**
 * The metadata fields — what the **Movie form** offers to type into, and what
 * each box holds while it is being typed into.
 *
 * The **Year** cannot hold a non-year, so there is no invalid state to report.
 * The **Cast** is the one field whose typed shape and stored shape differ — one
 * comma-separated line in the box, a list on the wire — so what is asserted
 * here is the box, and what is asserted on the wire is the list. `castNames`
 * is the seam between them, and is tested on its own.
 */
describe('MovieForm — the fields', () => {
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

  describe('the credits fields', () => {
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
      fireEvent.change(castField(), {
        target: { value: 'Jane Doe, John Roe' },
      });
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
});

/**
 * The genre chips — the **Genre pool** drawn as `Chip`s, held in the order they
 * were picked. `genres[0]` is the primary tag, and the chips are the first
 * caller in the app that can decide what it is.
 *
 * A pool that cannot be loaded draws no chips and no error, on `useGenreList`'s
 * recorded precedent — and costs the maintainer nothing but the chips.
 */
describe('MovieForm — the genre chips', () => {
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

      // The acceptance criterion most easily got wrong: a maintainer with no
      // chips has still lost nothing but the chips.
      await waitFor(() => expect(currentPath()).toBe('/'));
      const fields = savedFields() as FormData;
      expect(fields.get('title')).toBe('Rear Window');
      expect(fields.getAll('genre')).toEqual([]);
    });
  });
});

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
});

/**
 * The Files card — the three kinds of file a **Movie** carries, and the line
 * under the heading that names them.
 *
 * The video and the poster are each one **File slot**: empty, or holding a
 * **Picked file** (or, in the **Edit context**, a **Stored file**). The
 * subtitles are a **list**: a film carries as many **Subtitles** as the family
 * needs, each in a language the maintainer chooses, and the rows are held by
 * key rather than by index — removing the middle of three has to leave the
 * other two exactly as they were.
 *
 * What is asserted here is the screen: what the maintainer sees in each slot,
 * which row a change lands on, and that the slots are told apart. `FileField`
 * owns how a slot looks, `SubtitleRow` how one row looks, and `MovieFormFiles`
 * what the card knows.
 */
describe('MovieForm — the Files card', () => {
  it('says the form takes subtitle files, now that it does', async () => {
    await renderForm();

    // The prototype's own caption. It names three controls, and the screen
    // has all three — a lede that described a control the form did not have
    // would be a promise the form could not keep.
    expect(
      screen.getByText(/pick the video, poster, and any subtitle files/i)
    ).toBeDefined();
  });

  describe('the video slot', () => {
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

  describe('the poster slot', () => {
    it('draws the poster slot beside the video one', async () => {
      await renderForm();

      // Both slots of the prototype's Files card, in the order it draws them.
      expect(screen.getByText(/^video$/i)).toBeDefined();
      expect(screen.getByText(/^poster$/i)).toBeDefined();
    });

    it('offers pictures to the file dialog', async () => {
      await renderForm();

      // Story 23. Every image container a poster arrives in has a MIME type, so
      // unlike the video slot's list this is the whole of what the picker has to
      // say — and the server re-checks by extension either way.
      expect(posterPicker().getAttribute('accept')).toBe('image/*');
    });

    it('shows the filename of the poster that was picked', async () => {
      await renderForm();

      await pickPoster();

      expect(pickedPoster()).not.toBeNull();
    });

    it('keeps the two slots apart when both are filled', async () => {
      await renderForm();

      await pickVideo();
      await pickPoster();

      // Two files, two filenames, two named ✕s: a screen that showed one of them
      // would leave the maintainer unable to tell which file went where.
      expect(pickedFilename()).not.toBeNull();
      expect(pickedPoster()).not.toBeNull();
      expect(removeVideo()).toBeDefined();
      expect(removePoster()).toBeDefined();
    });

    it('returns the poster slot to empty when its remove is pressed', async () => {
      await renderForm();
      await pickVideo();
      await pickPoster();

      fireEvent.click(removePoster());

      // Story 30 again, at the second slot — and the film is untouched, because
      // the ✕ pressed was the poster's.
      expect(pickedPoster()).toBeNull();
      expect(posterPicker()).toBeDefined();
      expect(pickedFilename()).not.toBeNull();
    });
  });

  describe('the subtitle rows', () => {
    it('offers the picker with no row under it to begin with', async () => {
      await renderForm();

      // Story 64: a film with no subtitles is a normal film, and the section
      // opens as an add button and nothing else.
      expect(subtitlePicker()).toBeDefined();
      expect(screen.queryByText('lantern.en.srt')).toBeNull();
    });

    it('offers the four formats the parsers dispatch on', async () => {
      await renderForm();

      // Story 28. The same four `parseSubtitle/` knows — a file the player could
      // never read is not one the dialog should offer — and the server re-checks
      // by extension regardless.
      const accept = subtitlePicker().getAttribute('accept') ?? '';
      expect(accept).toContain('.srt');
      expect(accept).toContain('.vtt');
      expect(accept).toContain('.ass');
      expect(accept).toContain('.sub');
    });

    it('adds a row when a subtitle file is picked', async () => {
      await renderForm();

      await attachSubtitle();

      // Story 24, and the whole shape of this control: picking is what creates
      // the row, so no row is ever waiting to be filled in.
      expect(screen.getByText('lantern.en.srt')).toBeDefined();
    });

    it('lands a picked subtitle in English', async () => {
      await renderForm();

      await attachSubtitle();

      // Story 27. Most of the family folder is English, so the common case is
      // meant to need no second press — and the default is a real choice the
      // maintainer can take back, not a locked value.
      expect(languageOf('lantern.en.srt').textContent).toContain('English');
    });

    it('attaches several subtitle files', async () => {
      await renderForm();

      await attachSubtitle(subtitleFile('lantern.en.srt'));
      await attachSubtitle(subtitleFile('lantern.pt.srt'));

      // Story 25: a film shown to a family that does not all read the same
      // language needs more than one track.
      expect(screen.getByText('lantern.en.srt')).toBeDefined();
      expect(screen.getByText('lantern.pt.srt')).toBeDefined();
    });

    it('still offers the picker once rows exist', async () => {
      await renderForm();

      await attachSubtitle();

      // Unlike the video and poster slots, which swap their picker for the file
      // they hold: this one is a list, and the ＋ is how it grows.
      expect(subtitlePicker()).toBeDefined();
    });

    it('changes one row’s language and leaves the other alone', async () => {
      await renderForm();
      await attachSubtitle(subtitleFile('lantern.en.srt'));
      await attachSubtitle(subtitleFile('lantern.pt.srt'));

      chooseLanguage('lantern.pt.srt', 'Portuguese');

      // Story 26. Two rows, two languages: a change that reached both would make
      // a second track pointless.
      expect(languageOf('lantern.pt.srt').textContent).toContain('Portuguese');
      expect(languageOf('lantern.en.srt').textContent).toContain('English');
    });

    it('takes a second language over the first on the same row', async () => {
      await renderForm();
      await attachSubtitle();

      chooseLanguage('lantern.en.srt', 'French');
      chooseLanguage('lantern.en.srt', 'German');

      expect(languageOf('lantern.en.srt').textContent).toContain('German');
      expect(languageOf('lantern.en.srt').textContent).not.toContain('French');
    });

    it('removes the row whose ✕ was pressed', async () => {
      await renderForm();
      await attachSubtitle(subtitleFile('lantern.en.srt'));
      await attachSubtitle(subtitleFile('lantern.pt.srt'));

      fireEvent.click(
        screen.getByRole('button', { name: /remove lantern\.en\.srt/i })
      );

      expect(screen.queryByText('lantern.en.srt')).toBeNull();
      expect(screen.getByText('lantern.pt.srt')).toBeDefined();
    });

    it('leaves the surviving rows in the languages they were given', async () => {
      await renderForm();
      await attachSubtitle(subtitleFile('lantern.en.srt'));
      await attachSubtitle(subtitleFile('lantern.pt.srt'));
      await attachSubtitle(subtitleFile('lantern.fr.srt'));
      chooseLanguage('lantern.pt.srt', 'Portuguese');
      chooseLanguage('lantern.fr.srt', 'French');

      fireEvent.click(
        screen.getByRole('button', { name: /remove lantern\.pt\.srt/i })
      );

      // The rows are held by their own stable `key`, not by where they sit. An
      // index-keyed list would quietly hand the French row's language to whatever
      // moved up into its place, and the maintainer would have no way to see it
      // had happened until the film was already in the library.
      expect(screen.queryByText('lantern.pt.srt')).toBeNull();
      expect(languageOf('lantern.en.srt').textContent).toContain('English');
      expect(languageOf('lantern.fr.srt').textContent).toContain('French');
    });

    it('takes the same file again once the wrong one is removed', async () => {
      await renderForm();
      await attachSubtitle(subtitleFile('the-wrong-track.srt'));

      fireEvent.click(
        screen.getByRole('button', { name: /remove the-wrong-track\.srt/i })
      );
      await attachSubtitle();

      expect(screen.queryByText('the-wrong-track.srt')).toBeNull();
      expect(screen.getByText('lantern.en.srt')).toBeDefined();
    });
  });
});

/**
 * The **Save gate** — a disabled button, never a message. `title` is `NOT NULL`
 * and so is `video_path`, so a title and a film are the whole condition: every
 * other field on the form is optional, and none of them moves the gate in
 * either direction. It is a condition rather than a latch, so either half can
 * be taken back.
 */
describe('MovieForm — the save gate', () => {
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

    // Story 33, whole: a title and a film are one condition rather than two
    // conditions in two places.
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

  it('does not open the save gate on a rating alone', async () => {
    await renderForm();

    fireEvent.click(segment('Rate 4 stars'));

    // Optional like every other field but the title, and the gate does not
    // move for it.
    expect(save().disabled).toBe(true);
  });

  it('does not open on a title alone', async () => {
    await renderForm();

    fireEvent.change(titleField(), { target: { value: 'Rear Window' } });

    // `video_path` is NOT NULL, and a row with no film behind it is not a row
    // worth writing.
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

  it('opens on a title and a film with no poster at all', async () => {
    await renderForm();

    fireEvent.change(titleField(), { target: { value: 'The Lantern Keeper' } });
    await pickVideo();

    // Story 63. `poster_path` is nullable and a film the maintainer has no
    // artwork for still belongs in the library — so the gate is the two halves
    // it already had, and this slot is not a third.
    expect(save().disabled).toBe(false);
  });

  it('does not open on a poster alone', async () => {
    await renderForm();

    await pickPoster();

    expect(save().disabled).toBe(true);
  });

  it('opens on a title and a film with no subtitles at all', async () => {
    await renderForm();

    fireEvent.change(titleField(), { target: { value: 'The Lantern Keeper' } });
    await pickVideo();

    // Story 64. The gate is the two halves it has had since the video slot
    // landed, and neither the poster nor a subtitle is a third.
    expect(save().disabled).toBe(false);
  });

  it('does not open on a subtitle alone', async () => {
    await renderForm();

    await attachSubtitle();

    expect(save().disabled).toBe(true);
  });
});

/**
 * Saving, in the **Add context** — one `POST` carrying every field and every
 * file, and where the screen goes once it has landed.
 *
 * The body is asserted on the `FormData` the platform actually encodes: a list
 * is one part per entry under one name, a cleared field travels empty rather
 * than vanishing, and a file travels as bytes because a browser `File` is a
 * name and bytes and never a path. One request per save, however many slots
 * are filled — no upload-on-pick, no draft id. And a refused save leaves the
 * form standing with everything still in it, because there is no snackbar yet
 * and re-finding a file in a dialog is the most tedious work on this screen to
 * lose.
 */
describe('MovieForm — saving', () => {
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

    // There is no snackbar yet, so the honest answer to a refused save is
    // the form still standing with everything typed still in it — the chip
    // included, since re-picking it is work the maintainer already did.
    await waitFor(() => expect(save().disabled).toBe(false));
    expect(currentPath()).toBe('/add');
    expect(titleField().value).toBe('Rear Window');
    expect(picked('Thriller')).toBe('true');
    expect(save().textContent).toContain('Add to library');
  });

  describe('the credits fields', () => {
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
      // was cleared could not say a director had been *removed*, which is what
      // an edit that clears one has to say.
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
      fireEvent.change(castField(), {
        target: { value: 'Jane Doe, John Roe' },
      });
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

  describe('the rating', () => {
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

  describe('the video', () => {
    it('sends the picked file as the video part', async () => {
      await renderForm();
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper' },
      });
      const file = await pickVideo();

      fireEvent.click(save());

      await waitFor(() => expect(savedFields()).toBeDefined());
      // The file itself, not its name: a browser `File` is a name and bytes and
      // never a path, so the bytes are the only thing there is to send.
      expect(savedVideo()).toBe(file);
    });

    it('sends one video part however big the film is', async () => {
      await renderForm();
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper' },
      });
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
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper' },
      });
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
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper' },
      });
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

  describe('the poster', () => {
    it('sends the picked poster as the poster part', async () => {
      await renderForm();
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper' },
      });
      await pickVideo();
      const artwork = await pickPoster();

      fireEvent.click(save());

      await waitFor(() => expect(savedFields()).toBeDefined());
      // The file itself, on the video part's own rule: a browser `File` is a name
      // and bytes and never a path.
      expect(savedPoster()).toBe(artwork);
    });

    it('carries the film and its artwork in one request', async () => {
      await renderForm();
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper' },
      });
      await pickVideo();
      await pickPoster();

      fireEvent.click(save());

      await waitFor(() => expect(savedFields()).toBeDefined());
      // Story 36 with two files in it: still one request per save, no
      // upload-on-pick and no draft id, however many slots are filled.
      const fields = savedFields() as FormData;
      expect(fields.get('video')).toBeInstanceOf(File);
      expect(fields.get('poster')).toBeInstanceOf(File);
      expect(saveRequests()).toHaveLength(1);
    });

    it('sends no poster part when the slot was left empty', async () => {
      await renderForm();
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper' },
      });
      await pickVideo();

      fireEvent.click(save());

      await waitFor(() => expect(savedFields()).toBeDefined());
      // No part at all rather than an empty one — a file with no bytes is not a
      // thing the server could store, and `poster_path` stays null.
      expect(savedPoster()).toBeNull();
    });

    it('leaves the poster in the slot when the save fails', async () => {
      answerSave = () => Promise.resolve(serverErrorResponse());
      await renderForm();
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper' },
      });
      await pickVideo();
      await pickPoster();

      fireEvent.click(save());

      // The refused save leaves the form standing with everything in it, and
      // re-finding a file in a file dialog is the most tedious work on this
      // screen to lose — twice over now.
      await waitFor(() => expect(save().disabled).toBe(false));
      expect(currentPath()).toBe('/add');
      expect(pickedFilename()).not.toBeNull();
      expect(pickedPoster()).not.toBeNull();
    });
  });

  describe('the subtitles', () => {
    it('sends one subtitle part per attached file, in the order attached', async () => {
      await renderForm();
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper' },
      });
      await pickVideo();
      const english = await attachSubtitle(subtitleFile('lantern.en.srt'));
      const portuguese = await attachSubtitle(subtitleFile('lantern.pt.srt'));

      fireEvent.click(save());

      await waitFor(() => expect(savedFields()).toBeDefined());
      // The order the parts are sent in is the order the tracks are stored in,
      // which is the order `preferredSubtitle` falls back through when no
      // language is preferred.
      expect(savedSubtitles()).toEqual([english, portuguese]);
    });

    it('sends each row’s language beside its file, in the same order', async () => {
      await renderForm();
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper' },
      });
      await pickVideo();
      await attachSubtitle(subtitleFile('lantern.en.srt'));
      await attachSubtitle(subtitleFile('lantern.pt.srt'));
      chooseLanguage('lantern.pt.srt', 'Portuguese');

      fireEvent.click(save());

      await waitFor(() => expect(savedFields()).toBeDefined());
      // Two repeated names travelling in step — the shape `genre` and `cast`
      // already use, read pairwise: the i-th language belongs to the i-th file.
      expect(savedLanguages()).toEqual(['English', 'Portuguese']);
    });

    it('carries the film, its artwork and its tracks in one request', async () => {
      await renderForm();
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper' },
      });
      await pickVideo();
      await pickPoster();
      await attachSubtitle();

      fireEvent.click(save());

      await waitFor(() => expect(savedFields()).toBeDefined());
      // Story 36 with four files in it: still one request per save, no
      // upload-on-pick and no draft id, however many slots are filled.
      expect(savedFields()?.get('video')).toBeInstanceOf(File);
      expect(savedFields()?.get('poster')).toBeInstanceOf(File);
      expect(savedSubtitles()).toHaveLength(1);
      expect(saveRequests()).toHaveLength(1);
    });

    it('sends no subtitle part at all when none was attached', async () => {
      await renderForm();
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper' },
      });
      await pickVideo();

      fireEvent.click(save());

      await waitFor(() => expect(savedFields()).toBeDefined());
      // The lists' rule rather than the fields': there is no file with no bytes
      // and no language belonging to nothing, so an empty list sends nothing.
      expect(savedSubtitles()).toEqual([]);
      expect(savedLanguages()).toEqual([]);
    });

    it('sends no part for a track that was attached and then removed', async () => {
      await renderForm();
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper' },
      });
      await pickVideo();
      await attachSubtitle(subtitleFile('the-wrong-track.srt'));
      await attachSubtitle(subtitleFile('lantern.en.srt'));
      fireEvent.click(
        screen.getByRole('button', { name: /remove the-wrong-track\.srt/i })
      );

      fireEvent.click(save());

      await waitFor(() => expect(savedFields()).toBeDefined());
      const sent = savedSubtitles() as File[];
      expect(sent.map((file) => file.name)).toEqual(['lantern.en.srt']);
    });

    it('leaves the tracks attached when the save fails', async () => {
      answerSave = () => Promise.resolve(serverErrorResponse());
      await renderForm();
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper' },
      });
      await pickVideo();
      await attachSubtitle();
      chooseLanguage('lantern.en.srt', 'Portuguese');

      fireEvent.click(save());

      // The refused save leaves the form standing with everything in it — the
      // language chosen included, since re-labelling a track is work the
      // maintainer did on purpose.
      await waitFor(() => expect(save().disabled).toBe(false));
      expect(currentPath()).toBe('/add');
      expect(screen.getByText('lantern.en.srt')).toBeDefined();
      expect(languageOf('lantern.en.srt').textContent).toContain('Portuguese');
    });
  });
});

/**
 * The **actions row**: Save first, Cancel beside it.
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

/**
 * The **Edit context** — the same screen doing the other job. There is no
 * `/edit` route and no second component: `/add?movie=<id>` pre-fills this form
 * from the stored record, and what changes is the heading, the button, and
 * where a finished save lands. The tests mount the same `MovieForm` the **Add
 * context** ones do, at a different URL, because that is the whole claim.
 *
 * Every **File slot** opens holding a **Stored file**, and the passthrough is
 * the point: a file the library already holds travels as the path it already
 * has, so correcting a typo on a 12 GB film moves nothing on disk. A stored
 * track's ✕ takes it off the movie exactly as a picked one's does — nothing on
 * the screen distinguishes the two — which is worth pinning precisely because
 * the wire *does* distinguish them.
 */
describe('MovieForm — the Edit context', () => {
  describe('pre-filling from the stored record', () => {
    it('pre-fills every metadata field from the stored record', async () => {
      await renderEdit();

      // Story 46: editing one field does not mean retyping the rest. The year is
      // in the box as text, because the box is text.
      expect(titleField().value).toBe('The Lantern Keeper');
      expect(yearField().value).toBe('2019');
      expect(directorField().value).toBe('Ana Sørensen');
      expect(castField().value).toBe('Marit Holt, Peder Vinge');
      expect(descriptionField().value).toBe(
        'A keeper on a fading coast takes in a runaway girl.'
      );
    });

    it('pre-fills the genres the movie is filed under, and nothing else', async () => {
      await renderEdit();

      expect(picked('Drama')).toBe('true');
      expect(picked('Action')).toBe('true');
      expect(picked('Comedy')).toBe('false');
    });

    it('pre-fills the rating as the stars the maintainer gave it', async () => {
      await renderEdit();

      // 7 units is 70%, which is three and a half stars: the column stores units
      // and the strip speaks percent, and the conversion happens once at each
      // end rather than being held twice in between.
      expect(ratingLabel()).toContain('3.5 / 5');
    });

    it('opens an unrated movie on Unrated rather than on nought stars', async () => {
      answerMovie = () =>
        Promise.resolve(okResponse(makeMovie({ ...STORED, rating: null })));
      await renderEdit();

      // Story 58 read as a prefill: "I have not decided" and "nought out of five"
      // are two different claims, and a form that opened one as the other would
      // score every unrated film the moment its title was corrected.
      expect(titleField().value).toBe('The Lantern Keeper');
      expect(ratingLabel()).toContain('Not rated');
    });

    it('reads the movie the URL names, and only that one', async () => {
      await renderEdit();

      const reads = fetchMock.mock.calls.filter(
        ([input, init]) =>
          init?.method === undefined && String(input).includes('/api/movies/')
      );
      expect(reads).toHaveLength(1);
      expect(String(reads[0][0])).toContain('/api/movies/a1');
    });
  });

  describe('which of the two jobs the screen is doing', () => {
    it('says Edit details and Save changes', async () => {
      await renderEdit();

      // Story 47. One screen, two jobs, and the maintainer can tell which one is
      // in front of them from the heading and the button alone.
      expect(
        screen.getByRole('heading', { name: 'Edit details' })
      ).toBeDefined();
      expect(saveChanges()).toBeDefined();
    });

    it('still says Add a movie and Add to library with no movie named', async () => {
      await renderForm();

      // The other half of the same claim: the **Add context** is unchanged, and a
      // form reached with no `?movie=` is still the one that creates a record.
      expect(
        screen.getByRole('heading', { name: 'Add a movie' })
      ).toBeDefined();
      expect(save()).toBeDefined();
    });

    it('falls back to adding when the id names no movie', async () => {
      answerMovie = () =>
        Promise.resolve(notFoundResponse('Unknown movie: nope'));
      await renderEdit('nope');

      // A stale link is not a record to amend. The id is asked about — a 404 is
      // an answer, and the screen only knows there is nothing to edit because it
      // looked — and then the screen is the one that adds, which is also the only
      // state in which its Save can do anything at all.
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes('/api/movies/nope')
        )
      ).toBe(true);
      expect(
        screen.getByRole('heading', { name: 'Add a movie' })
      ).toBeDefined();
      expect(titleField().value).toBe('');
    });
  });

  describe('the stored files', () => {
    it('lists the movie’s own files by filename', async () => {
      await renderEdit();

      // Story 51: it is visible what is attached before anything changes. A
      // browser never gives a path for a picked file either, so the basename is
      // what both kinds of slot show.
      expect(screen.getByText('lantern.mp4')).toBeDefined();
      expect(screen.getByText('poster.jpg')).toBeDefined();
      expect(screen.getByText('lantern.en.srt')).toBeDefined();
      expect(screen.getByText('lantern.pt.srt')).toBeDefined();
    });

    it('shows each stored track in the language it was stored in', async () => {
      await renderEdit();

      expect(languageOf('lantern.en.srt').textContent).toContain('English');
      expect(languageOf('lantern.pt.srt').textContent).toContain('Portuguese');
    });

    it('opens with Save already pressable, nothing re-picked', async () => {
      await renderEdit();

      // Story 50. The **Save gate** is a title and a film, and the film the
      // library already holds is a film — demanding it be re-picked would mean
      // re-uploading 12 GB to correct a typo.
      expect(saveChanges().disabled).toBe(false);
    });

    it('closes the gate again if the title is emptied', async () => {
      await renderEdit();

      fireEvent.change(titleField(), { target: { value: '   ' } });

      // The gate is a condition rather than a latch, in the **Edit context** as
      // much as in the **Add** one: `title` is `NOT NULL`, and an edit cannot
      // take that back.
      expect(saveChanges().disabled).toBe(true);
    });
  });

  describe('saving an edit', () => {
    it('sends a PATCH against the movie the URL named', async () => {
      await renderEdit();
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper (restored)' },
      });

      fireEvent.click(saveChanges());

      await waitFor(() => expect(patchRequests()).toHaveLength(1));
      expect(String(patchRequests()[0][0])).toBe('/api/movies/a1');
      expect(patchedFields()?.get('title')).toBe(
        'The Lantern Keeper (restored)'
      );
    });

    it('carries no bytes at all when nothing was re-picked', async () => {
      await renderEdit();
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper (restored)' },
      });

      fireEvent.click(saveChanges());

      // Story 49, end to end from the screen: a film, a poster and two tracks
      // already in the library travel as the paths they already have, so
      // correcting a typo on a 12 GB film moves nothing.
      await waitFor(() => expect(patchedFields()).toBeDefined());
      expect(patchedFiles()).toEqual([]);
      expect(patchedFields()?.get('videoPath')).toBe(
        'the-lantern-keeper-2019/lantern.mp4'
      );
    });

    it('carries only the file that was re-picked', async () => {
      await renderEdit();
      fireEvent.click(removePoster());
      const replacement = await pickPoster(posterFile('better-poster.jpg'));

      fireEvent.click(saveChanges());

      // The contrast that makes the absence above mean something: one slot
      // re-picked is one part on the wire, and the film beside it still does not
      // move.
      await waitFor(() => expect(patchedFields()).toBeDefined());
      expect(patchedFiles()).toEqual([replacement]);
      expect(patchedFields()?.get('videoPath')).toBe(
        'the-lantern-keeper-2019/lantern.mp4'
      );
    });

    it('lands on the movie’s own detail page', async () => {
      answerSave = () => Promise.resolve(okResponse(STORED));
      await renderEdit();
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper (restored)' },
      });

      fireEvent.click(saveChanges());

      // Story 48: the maintainer sees the change they just made, in context. The
      // browse home is where a *new* film is seen for the first time; an edit
      // belongs back on the page it was started from.
      await waitFor(() => expect(currentPath()).toBe('/movie/a1'));
    });

    it('says Saving… and takes no second press while the edit is in flight', async () => {
      let settle: (response: Response) => void = () => undefined;
      answerSave = () =>
        new Promise<Response>((resolve) => {
          settle = resolve;
        });
      await renderEdit();

      fireEvent.click(saveChanges());

      // The mirror of the **Add context**'s "Adding…": the label is the whole of
      // the in-flight state, and the disabled button is what stops an impatient
      // second press writing the edit twice.
      await waitFor(() => expect(saveChanges().disabled).toBe(true));
      expect(saveChanges().textContent).toContain('Saving…');
      expect(patchRequests()).toHaveLength(1);

      fireEvent.click(saveChanges());
      expect(patchRequests()).toHaveLength(1);

      await act(async () => {
        settle(okResponse(STORED));
      });
    });

    it('stays put with everything in it when the edit is refused', async () => {
      answerSave = () => Promise.resolve(serverErrorResponse());
      await renderEdit();
      fireEvent.change(titleField(), {
        target: { value: 'The Lantern Keeper (restored)' },
      });

      fireEvent.click(saveChanges());

      // The same honest answer the **Add context** gives, and for the same reason
      // — there is no snackbar yet, so the form still standing with the
      // correction still in it is the whole of what can be said.
      await waitFor(() => expect(saveChanges().disabled).toBe(false));
      expect(currentPath()).toBe('/add');
      expect(titleField().value).toBe('The Lantern Keeper (restored)');
    });

    it('sends an unrated movie back as unrated rather than as nought', async () => {
      answerMovie = () =>
        Promise.resolve(okResponse(makeMovie({ ...STORED, rating: null })));
      await renderEdit();

      fireEvent.click(saveChanges());

      // Story 58 read the other way round: a film nobody has scored survives a
      // title correction unscored. `0` is a real point on the half-star scale,
      // and an edit that flattened one into the other would score the library.
      await waitFor(() => expect(patchedFields()).toBeDefined());
      expect(patchedFields()?.get('rating')).toBe('');
    });

    it('sends a rating cleared on the picker as unrated', async () => {
      await renderEdit();

      // Pressing the segment already holding the value hands back `null`, which
      // is how a rating is removed everywhere in the app — and story 58 is that
      // **Unrated** is reachable from this form and not only from the detail
      // page. The stored 7 is 70%, so that segment is the one wearing the label.
      fireEvent.click(segment('Clear rating'));
      expect(ratingLabel()).toContain('Not rated');

      fireEvent.click(saveChanges());

      await waitFor(() => expect(patchedFields()).toBeDefined());
      expect(patchedFields()?.get('rating')).toBe('');
    });

    it('never creates a second movie', async () => {
      answerSave = () => Promise.resolve(okResponse(STORED));
      await renderEdit();

      fireEvent.click(saveChanges());

      // The whole of what "the same screen edits" has to mean: one URL, two jobs,
      // and the wrong one would leave the library with two copies of the film
      // whose title was corrected.
      await waitFor(() => expect(patchRequests()).toHaveLength(1));
      expect(saveRequests()).toEqual([]);
    });
  });

  describe('a stored track taken off the movie', () => {
    it('takes the row off the screen and leaves the other one', async () => {
      await renderEdit();

      fireEvent.click(
        screen.getByRole('button', { name: /remove lantern\.pt\.srt/i })
      );

      // Story 55: a track attached in error is detachable. The row came out of
      // the record rather than off a picker, and it is removed the same way.
      expect(screen.queryByText('lantern.pt.srt')).toBeNull();
      expect(screen.getByText('lantern.en.srt')).toBeDefined();
    });

    it('sends no field at all for the track that was removed', async () => {
      answerSave = () => Promise.resolve(okResponse(STORED));
      await renderEdit();

      fireEvent.click(
        screen.getByRole('button', { name: /remove lantern\.pt\.srt/i })
      );
      fireEvent.click(saveChanges());

      // The body is the whole of what the movie now has, so a removed track is
      // one that says nothing — no path, no language, no part. The surviving row
      // still travels as its own **Stored path**, so no bytes move for a removal
      // either.
      await waitFor(() => expect(patchedFields()).toBeDefined());
      expect(patchedFields()?.getAll('subtitlePath')).toEqual([
        'the-lantern-keeper-2019/lantern.en.srt',
      ]);
      expect(patchedFields()?.getAll('subtitleLanguage')).toEqual(['English']);
      expect(patchedFiles()).toEqual([]);
    });

    it('takes every track off the movie when both rows are removed', async () => {
      answerSave = () => Promise.resolve(okResponse(STORED));
      await renderEdit();

      fireEvent.click(
        screen.getByRole('button', { name: /remove lantern\.en\.srt/i })
      );
      fireEvent.click(
        screen.getByRole('button', { name: /remove lantern\.pt\.srt/i })
      );

      // A film with no tracks at all is a normal row — the **Save gate** is a
      // title and a film — so an edit that empties the list is still a save
      // rather than a state the form refuses.
      expect(saveChanges().disabled).toBe(false);
      fireEvent.click(saveChanges());

      await waitFor(() => expect(patchedFields()).toBeDefined());
      expect(patchedFields()?.getAll('subtitlePath')).toEqual([]);
      expect(patchedFields()?.getAll('subtitleLanguage')).toEqual([]);
    });
  });
});

// --- 13 — Bulk import, Phase 5: the Import context (issue #130) ---------------
//
// The third of the form's contexts. `/add?problem=<id>` is where the **Review
// step**'s _Resolve_ lands: the same `MovieForm`, prefilled from the **Problem
// detail** — the **Sheet row**'s fields, and every file the **Source folder**
// holds as a **Found file** in its slot — under the accent banner "Resolving
// import · {title}". The save reads _Save & continue_ and posts to the
// problem's own resolve route, found paths as text and a picked file as
// bytes; the cancel reads _Skip this one_ and dismisses; both land on
// `/import`, and so does Back — never on whatever screen was behind the form.
// The **Save gate** is unchanged: a title and a film, and a found film is a
// film.

/**
 * The detail `GET /api/import/current/problems/:id` answers for a `failed`
 * Die Hard: the row with every column filled, the matched folder, and every
 * file in it found.
 */
const DIE_HARD_FOLDER = 'C:\\Movies\\Die.Hard.1988.1080p';

const DIE_HARD: ImportProblemDetail = {
  id: 'p1',
  kind: 'failed',
  title: 'Die Hard',
  reason: "Couldn't copy the video file: EBUSY: resource busy or locked.",
  row: {
    title: 'Die Hard',
    year: 1988,
    genres: ['Action', 'Thriller'],
    director: 'John McTiernan',
    cast: ['Bruce Willis', 'Alan Rickman'],
    synopsis:
      'A New York cop takes on a tower full of thieves on Christmas Eve.',
    rating: 8,
  },
  folder: DIE_HARD_FOLDER,
  candidates: [],
  files: {
    video: `${DIE_HARD_FOLDER}\\Die.Hard.1988.1080p.mp4`,
    poster: `${DIE_HARD_FOLDER}\\poster.jpg`,
    backdrop: `${DIE_HARD_FOLDER}\\fanart.jpg`,
    subtitles: [
      {
        path: `${DIE_HARD_FOLDER}\\Die.Hard.1988.1080p.en.srt`,
        language: 'English',
      },
      {
        path: `${DIE_HARD_FOLDER}\\Die.Hard.1988.1080p.pt.srt`,
        language: 'Portuguese',
      },
    ],
  },
};

/** The movie the resolve route answers its 201 with. */
const RESOLVED: Movie = makeMovie({
  id: 'm-die-hard',
  title: 'Die Hard',
  year: 1988,
  videoPath: 'die-hard-1988/Die.Hard.1988.1080p.mp4',
});

describe('MovieForm — the Import context', () => {
  let answerProblem: () => Promise<Response>;
  let answerResolve: () => Promise<Response>;
  let answerDismiss: () => Promise<Response>;

  beforeEach(() => {
    answerProblem = () => Promise.resolve(okResponse(DIE_HARD));
    answerResolve = () => Promise.resolve(createdResponse(RESOLVED));
    answerDismiss = () => Promise.resolve(noContentResponse());

    // Three more arms, all under the problem's own route: the detail on
    // mount, the resolve on Save & continue, the dismiss on Skip this one.
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method?.toUpperCase() ?? 'GET';
      if (url.includes('/api/import/current/problems/')) {
        if (method === 'POST') {
          return answerResolve();
        }
        if (method === 'DELETE') {
          return answerDismiss();
        }
        return answerProblem();
      }
      if (method === 'POST' || method === 'PATCH') {
        return answerSave();
      }
      return url.includes('/api/genres/pool') ? answerPool() : answerMovie();
    });
  });

  /**
   * The form opened on a problem, the way _Resolve_ opens it — with the
   * Settings screen behind it, so that "lands on `/import`" is a claim about
   * where the form goes and not about where it came from.
   */
  async function renderResolve(id = DIE_HARD.id) {
    const view = render(
      <MemoryRouter
        initialEntries={['/settings', `/add?problem=${encodeURIComponent(id)}`]}
        initialIndex={1}
      >
        <ThemeProvider theme={theme}>
          <MovieForm />
          <LocationProbe />
        </ThemeProvider>
      </MemoryRouter>
    );
    await act(async () => undefined);
    return view;
  }

  /** The accent banner, or `null` when the form is not resolving anything. */
  const banner = () =>
    screen.queryAllByText(
      (_, element) =>
        element?.textContent?.replace(/\s+/g, ' ').trim() ===
        'Resolving import · Die Hard'
    )[0] ?? null;

  /** Save, in the **Import context**, under whichever label it wears. */
  const saveAndContinue = () =>
    screen.getByRole('button', {
      name: /save & continue|saving/i,
    }) as HTMLButtonElement;

  const skipThisOne = () =>
    screen.getByRole('button', {
      name: /^skip this one$/i,
    }) as HTMLButtonElement;

  /** Every problem read the form has issued. */
  const problemReads = () =>
    fetchMock.mock.calls.filter(
      ([input, init]) =>
        (init?.method ?? 'GET').toUpperCase() === 'GET' &&
        String(input).includes('/api/import/current/problems/')
    );

  /** Every resolve the form has issued. */
  const resolveRequests = () =>
    fetchMock.mock.calls.filter(
      ([input, init]) =>
        init?.method?.toUpperCase() === 'POST' &&
        String(input).includes('/api/import/current/problems/')
    );

  /** The multipart body of the resolve, or `undefined` if none was sent. */
  const resolvedFields = (): FormData | undefined =>
    resolveRequests()[0]?.[1]?.body as FormData | undefined;

  /** Every part of the resolve that carried bytes rather than a value. */
  const resolvedFiles = (): File[] => {
    const body = resolvedFields();
    return body === undefined
      ? []
      : ['video', 'poster', 'subtitle']
          .flatMap((name) => body.getAll(name))
          .filter((value): value is File => value instanceof File);
  };

  /** Every dismiss the form has issued. */
  const dismissRequests = () =>
    fetchMock.mock.calls.filter(
      ([input, init]) =>
        init?.method?.toUpperCase() === 'DELETE' &&
        String(input).includes('/api/import/current/problems/')
    );

  const foundVideo = () => screen.queryByText('Die.Hard.1988.1080p.mp4');

  describe('the banner', () => {
    it('reads Resolving import · the problem’s title, under the Add a movie heading', async () => {
      await renderResolve();

      // Story 79: the maintainer can tell this form is fixing a flagged row
      // rather than adding a film from scratch, and which row. The heading is
      // still the add's — this is an add, with a head start.
      expect(banner()).not.toBeNull();
      expect(
        screen.getByRole('heading', { name: 'Add a movie' })
      ).toBeDefined();
    });

    it('draws the banner only when resolving — not in the Add or the Edit context', async () => {
      const resolving = await renderResolve();
      expect(banner()).not.toBeNull();
      resolving.unmount();

      const adding = await renderForm();
      expect(screen.queryByText(/resolving import/i)).toBeNull();
      adding.unmount();

      await renderEdit();
      expect(screen.queryByText(/resolving import/i)).toBeNull();
    });
  });

  describe('pre-filling from the problem detail', () => {
    it('reads the problem the URL names, and no movie', async () => {
      await renderResolve();

      expect(problemReads()).toHaveLength(1);
      expect(String(problemReads()[0][0])).toContain(
        '/api/import/current/problems/p1'
      );
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes('/api/movies/')
        )
      ).toBe(false);
    });

    it('encodes the id into the path', async () => {
      await renderResolve('p 1/x');

      expect(String(problemReads()[0][0])).toContain(
        '/api/import/current/problems/p%201%2Fx'
      );
    });

    it('pre-fills every metadata field the row carries', async () => {
      await renderResolve();

      // Story 80: the sheet already said all this; the maintainer corrects,
      // never retypes. The year is in the box as text, because the box is.
      expect(titleField().value).toBe('Die Hard');
      expect(yearField().value).toBe('1988');
      expect(directorField().value).toBe('John McTiernan');
      expect(castField().value).toBe('Bruce Willis, Alan Rickman');
      expect(descriptionField().value).toBe(
        'A New York cop takes on a tower full of thieves on Christmas Eve.'
      );
    });

    it('pre-fills the genres the row names, and nothing else', async () => {
      await renderResolve();

      expect(picked('Action')).toBe('true');
      expect(picked('Thriller')).toBe('true');
      expect(picked('Comedy')).toBe('false');
    });

    it('pre-fills the rating as the stars the sheet gave it', async () => {
      await renderResolve();

      // 8 on the column's 0–10 scale is four stars.
      expect(ratingLabel()).toContain('4.0 / 5');
    });

    it('opens a row with no rating on Unrated', async () => {
      answerProblem = () =>
        Promise.resolve(
          okResponse({
            ...DIE_HARD,
            row: { ...DIE_HARD.row, rating: undefined },
          })
        );
      await renderResolve();

      // The row was read — the title says so — and "no rating" stayed "no
      // rating" rather than becoming nought stars.
      expect(titleField().value).toBe('Die Hard');
      expect(ratingLabel()).toContain('Not rated');
    });

    it('leaves the fields the row does not carry empty', async () => {
      answerProblem = () =>
        Promise.resolve(
          okResponse({
            ...DIE_HARD,
            row: { title: 'Die Hard', genres: [] },
          })
        );
      await renderResolve();

      expect(titleField().value).toBe('Die Hard');
      expect(yearField().value).toBe('');
      expect(directorField().value).toBe('');
      expect(castField().value).toBe('');
      expect(descriptionField().value).toBe('');
      expect(
        chips().filter((c) => c.getAttribute('aria-pressed') === 'true')
      ).toEqual([]);
    });
  });

  describe('the found files', () => {
    it('fills every slot the folder has, by filename', async () => {
      await renderResolve();

      // Story 81: what the scan found is already in the slots, shown the way
      // a stored file is — by its name, the only thing a slot ever shows.
      expect(foundVideo()).not.toBeNull();
      expect(screen.getByText('poster.jpg')).toBeDefined();
      expect(screen.getByText('Die.Hard.1988.1080p.en.srt')).toBeDefined();
      expect(screen.getByText('Die.Hard.1988.1080p.pt.srt')).toBeDefined();
    });

    it('shows each found track in the language the scan detected', async () => {
      await renderResolve();

      expect(languageOf('Die.Hard.1988.1080p.en.srt').textContent).toContain(
        'English'
      );
      expect(languageOf('Die.Hard.1988.1080p.pt.srt').textContent).toContain(
        'Portuguese'
      );
    });

    it('offers no picker for a slot that is filled', async () => {
      await renderResolve();

      expect(screen.queryByLabelText(/choose video file/i)).toBeNull();
      expect(screen.queryByLabelText(/choose poster image/i)).toBeNull();
    });

    it('leaves the video slot empty when the folder holds two videos', async () => {
      answerProblem = () =>
        Promise.resolve(
          okResponse({
            ...DIE_HARD,
            kind: 'no-video',
            reason: 'Folder matched, but it holds more than one video file.',
            files: { ...DIE_HARD.files, video: undefined },
          })
        );
      await renderResolve();

      // A `no-video` folder with two videos: the run would not guess, and the
      // form does not either — the picker is offered, and the rest is filled.
      expect(foundVideo()).toBeNull();
      expect(videoPicker().type).toBe('file');
      expect(screen.getByText('poster.jpg')).toBeDefined();
    });

    it('empties the slot when Remove is pressed on a found file', async () => {
      await renderResolve();

      fireEvent.click(removeVideo());

      // Story 85: a found file is treated as any other slot. Gone from the
      // slot, the picker is back.
      expect(foundVideo()).toBeNull();
      expect(videoPicker().type).toBe('file');
    });

    it('replaces a found file with a picked one', async () => {
      await renderResolve();

      fireEvent.click(removeVideo());
      await pickVideo(videoFile('better-rip.mp4'));

      expect(foundVideo()).toBeNull();
      expect(screen.getByText('better-rip.mp4')).toBeDefined();
    });

    it('takes a found track off with its ✕ and leaves the other', async () => {
      await renderResolve();

      fireEvent.click(
        screen.getByRole('button', {
          name: /remove Die\.Hard\.1988\.1080p\.pt\.srt/i,
        })
      );

      expect(screen.queryByText('Die.Hard.1988.1080p.pt.srt')).toBeNull();
      expect(screen.getByText('Die.Hard.1988.1080p.en.srt')).toBeDefined();
    });
  });

  describe('the labels', () => {
    it('says Save & continue and Skip this one', async () => {
      await renderResolve();

      // Stories 86 and 87: the two actions read as what they do to the run.
      expect(saveAndContinue().textContent).toContain('Save & continue');
      expect(skipThisOne().textContent).toContain('Skip this one');
      expect(
        screen.queryByRole('button', { name: /add to library/i })
      ).toBeNull();
      expect(screen.queryByRole('button', { name: /^cancel$/i })).toBeNull();
    });

    it('draws Save & continue first and Skip this one after it', async () => {
      await renderResolve();

      expect(
        saveAndContinue().compareDocumentPosition(skipThisOne()) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });
  });

  describe('the save gate', () => {
    it('opens on the found film and the row’s title, nothing picked', async () => {
      await renderResolve();

      // Story 89: the gate is still a title and a film, and a found film is a
      // film.
      expect(saveAndContinue().disabled).toBe(false);
    });

    it('closes again if the title is emptied', async () => {
      await renderResolve();

      fireEvent.change(titleField(), { target: { value: '   ' } });

      expect(saveAndContinue().disabled).toBe(true);
    });

    it('closes again if the found film is removed, and opens on a picked one', async () => {
      await renderResolve();

      fireEvent.click(removeVideo());
      expect(saveAndContinue().disabled).toBe(true);

      await pickVideo();
      expect(saveAndContinue().disabled).toBe(false);
    });

    it('stays shut on a no-video problem until a film is picked', async () => {
      answerProblem = () =>
        Promise.resolve(
          okResponse({
            ...DIE_HARD,
            kind: 'no-video',
            files: { ...DIE_HARD.files, video: undefined },
          })
        );
      await renderResolve();

      expect(saveAndContinue().disabled).toBe(true);
      await pickVideo();
      expect(saveAndContinue().disabled).toBe(false);
    });

    it('offers Skip this one however empty the form is', async () => {
      await renderResolve();
      fireEvent.change(titleField(), { target: { value: '' } });

      expect(skipThisOne().disabled).toBe(false);
    });
  });

  describe('Save & continue', () => {
    it('posts to the problem’s own resolve route, never to /api/movies', async () => {
      await renderResolve();

      fireEvent.click(saveAndContinue());

      await waitFor(() => expect(resolveRequests()).toHaveLength(1));
      expect(String(resolveRequests()[0][0])).toBe(
        '/api/import/current/problems/p1/resolve'
      );
      expect(saveRequests()).toEqual([]);
      expect(patchRequests()).toEqual([]);
    });

    it('sends the fields as the form holds them', async () => {
      await renderResolve();
      fireEvent.change(titleField(), { target: { value: 'Die Hard (1988)' } });

      fireEvent.click(saveAndContinue());

      await waitFor(() => expect(resolvedFields()).toBeDefined());
      const body = resolvedFields();
      expect(body?.get('title')).toBe('Die Hard (1988)');
      expect(body?.get('year')).toBe('1988');
      expect(body?.get('director')).toBe('John McTiernan');
      expect(body?.getAll('cast')).toEqual(['Bruce Willis', 'Alan Rickman']);
      expect(body?.getAll('genre')).toEqual(['Action', 'Thriller']);
      expect(body?.get('rating')).toBe('8');
    });

    it('sends every found file as its path and no bytes at all', async () => {
      await renderResolve();

      fireEvent.click(saveAndContinue());

      // Story 90 from the screen: nothing the scan found is re-uploaded. The
      // paths travel in the fields the edit route already reads, and the
      // server copies from them.
      await waitFor(() => expect(resolvedFields()).toBeDefined());
      expect(resolvedFiles()).toEqual([]);
      expect(resolvedFields()?.get('videoPath')).toBe(DIE_HARD.files.video);
      expect(resolvedFields()?.get('posterPath')).toBe(DIE_HARD.files.poster);
      expect(resolvedFields()?.getAll('subtitlePath')).toEqual(
        DIE_HARD.files.subtitles.map((track) => track.path)
      );
      expect(resolvedFields()?.getAll('subtitleLanguage')).toEqual([
        'English',
        'Portuguese',
      ]);
    });

    it('sends a picked replacement as bytes beside the found paths', async () => {
      await renderResolve();
      fireEvent.click(removePoster());
      const replacement = await pickPoster(posterFile('better-poster.jpg'));

      fireEvent.click(saveAndContinue());

      await waitFor(() => expect(resolvedFields()).toBeDefined());
      expect(resolvedFiles()).toEqual([replacement]);
      expect(resolvedFields()?.get('posterPath')).toBeNull();
      expect(resolvedFields()?.get('videoPath')).toBe(DIE_HARD.files.video);
    });

    it('lands on /import once the movie is written', async () => {
      await renderResolve();

      fireEvent.click(saveAndContinue());

      // Story 95: back to the review, one row shorter — not to the browse
      // home, and not to whatever was behind the form.
      await waitFor(() => expect(currentPath()).toBe('/import'));
    });

    it('takes no second press while the resolve is in flight', async () => {
      let settle: (response: Response) => void = () => undefined;
      answerResolve = () =>
        new Promise<Response>((resolve) => {
          settle = resolve;
        });
      await renderResolve();

      fireEvent.click(saveAndContinue());
      await waitFor(() => expect(saveAndContinue().disabled).toBe(true));
      fireEvent.click(saveAndContinue());

      expect(resolveRequests()).toHaveLength(1);
      await act(async () => {
        settle(createdResponse(RESOLVED));
      });
    });

    it('stays put with everything in it when the resolve is refused', async () => {
      answerResolve = () => Promise.resolve(serverErrorResponse());
      await renderResolve();

      fireEvent.click(saveAndContinue());

      await waitFor(() => expect(resolveRequests()).toHaveLength(1));
      await waitFor(() => expect(saveAndContinue().disabled).toBe(false));
      expect(currentPath()).toBe('/add');
      expect(titleField().value).toBe('Die Hard');
      expect(foundVideo()).not.toBeNull();
      expect(banner()).not.toBeNull();
    });

    it('dismisses nothing itself — the route does that on its 201', async () => {
      await renderResolve();

      fireEvent.click(saveAndContinue());

      await waitFor(() => expect(currentPath()).toBe('/import'));
      expect(dismissRequests()).toEqual([]);
    });
  });

  describe('Skip this one', () => {
    it('dismisses the problem and lands on /import', async () => {
      await renderResolve();

      fireEvent.click(skipThisOne());

      // Story 88: the same Skip the review row offers, from the form.
      await waitFor(() => expect(dismissRequests()).toHaveLength(1));
      expect(String(dismissRequests()[0][0])).toBe(
        '/api/import/current/problems/p1'
      );
      await waitFor(() => expect(currentPath()).toBe('/import'));
    });

    it('writes nothing', async () => {
      await renderResolve();

      fireEvent.click(skipThisOne());

      await waitFor(() => expect(currentPath()).toBe('/import'));
      expect(resolveRequests()).toEqual([]);
      expect(saveRequests()).toEqual([]);
    });
  });

  describe('Back', () => {
    it('lands on /import, not on the screen behind the form', async () => {
      await renderResolve();

      fireEvent.click(backPill());

      // Story 95. The form was reached from the review, and the review is
      // where a maintainer stepping back expects to be — whatever the history
      // says. And nothing was dismissed: the row is still there to come back
      // to.
      expect(currentPath()).toBe('/import');
      await act(async () => undefined);
      expect(dismissRequests()).toEqual([]);
      expect(resolveRequests()).toEqual([]);
    });
  });

  // --- 13 — Bulk import, Phase 5: the per-kind openings (issue #131) -----------
  //
  // The same **Import context**, opened on the kinds #130 did not exercise:
  // an `ambiguous` prefills from its first candidate and the banner names the
  // rest; a `no-folder` opens with the row's fields and every slot empty; a
  // `no-row` opens with the folder's files and a title guessed from its name.
  // And the stale link: a problem that no longer exists — dismissed, or the
  // run gone — is a `404` from the detail route, and the form is the plain Add
  // context, banner-less, with the ordinary labels; a resolve that finds the
  // problem gone falls back the same way.

  /** The first of two key-equal folders: the one the detail prefills from. */
  const HARBOR_FIRST = 'C:\\Movies\\Harbor Lights (2019)';
  /** The second: the one the banner names. */
  const HARBOR_SECOND = 'C:\\Movies\\Harbor.Lights.2019';
  const HARBOR_THIRD = 'C:\\Movies\\Harbor Lights 1080p';

  const HARBOR_AMBIGUOUS: ImportProblemDetail = {
    id: 'p2',
    kind: 'ambiguous',
    title: 'Harbor Lights',
    reason: 'Two folders look like plausible matches — pick one.',
    row: { title: 'Harbor Lights', year: 2019, genres: ['Drama'] },
    folder: HARBOR_FIRST,
    candidates: [HARBOR_FIRST, HARBOR_SECOND],
    files: {
      video: `${HARBOR_FIRST}\\Harbor Lights.mp4`,
      poster: `${HARBOR_FIRST}\\poster.jpg`,
      subtitles: [
        { path: `${HARBOR_FIRST}\\Harbor Lights.en.srt`, language: 'English' },
      ],
    },
  };

  const LANTERN_NO_FOLDER: ImportProblemDetail = {
    id: 'p3',
    kind: 'no-folder',
    title: 'The Lantern Keeper',
    reason: 'No folder found matching this spreadsheet row.',
    row: {
      title: 'The Lantern Keeper',
      year: 2019,
      genres: ['Drama'],
      director: 'Mira Okafor',
      cast: ['Ada Lin'],
      synopsis: 'A keeper and a storm.',
      rating: 7,
    },
    candidates: [],
    files: { subtitles: [] },
  };

  const HARBOR_NO_ROW: ImportProblemDetail = {
    id: 'p4',
    kind: 'no-row',
    title: 'Harbor.Lights.2019',
    reason: 'Folder found, but no spreadsheet row names it.',
    row: { title: 'Harbor Lights', genres: [] },
    folder: HARBOR_SECOND,
    candidates: [],
    files: {
      video: `${HARBOR_SECOND}\\Harbor.Lights.2019.mp4`,
      poster: `${HARBOR_SECOND}\\poster.jpg`,
      subtitles: [
        {
          path: `${HARBOR_SECOND}\\Harbor.Lights.2019.en.srt`,
          language: 'English',
        },
      ],
    },
  };

  /** The whitespace-collapsed text of an element. */
  const textOf = (element: Element | null): string =>
    element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  /**
   * The accent banner's whole text, or `null` when there is none: the
   * innermost element whose text starts with "Resolving import ·" — so a
   * wrapper around the banner never answers for it.
   */
  const bannerText = (): string | null => {
    const holders = screen.queryAllByText((_, element) =>
      /^Resolving import ·/.test(textOf(element))
    );
    const innermost = holders.filter(
      (element) =>
        !holders.some((other) => other !== element && element.contains(other))
    );
    return innermost.length === 0 ? null : textOf(innermost[0]);
  };

  /** Every language control on the form — one per subtitle row. */
  const languageControls = () =>
    screen.queryAllByRole('button', { name: /language for /i });

  describe('an ambiguous problem', () => {
    beforeEach(() => {
      answerProblem = () => Promise.resolve(okResponse(HARBOR_AMBIGUOUS));
    });

    it('names the other candidate in the banner, in the fixed phrasing', async () => {
      await renderResolve(HARBOR_AMBIGUOUS.id);

      // Story 82: the maintainer sees at once that the run was weighing
      // another folder, and which — by its name, not its whole path.
      expect(bannerText()).toBe(
        'Resolving import · Harbor Lights — also matched: Harbor.Lights.2019'
      );
    });

    it('names every other candidate when there are more, comma-separated', async () => {
      answerProblem = () =>
        Promise.resolve(
          okResponse({
            ...HARBOR_AMBIGUOUS,
            candidates: [HARBOR_FIRST, HARBOR_SECOND, HARBOR_THIRD],
          })
        );
      await renderResolve(HARBOR_AMBIGUOUS.id);

      expect(bannerText()).toBe(
        'Resolving import · Harbor Lights — also matched: Harbor.Lights.2019, Harbor Lights 1080p'
      );
    });

    it('names a candidate by its folder name whichever way its path is spelt', async () => {
      answerProblem = () =>
        Promise.resolve(
          okResponse({
            ...HARBOR_AMBIGUOUS,
            candidates: [HARBOR_FIRST, '/movies/Harbor.Lights.2019'],
          })
        );
      await renderResolve(HARBOR_AMBIGUOUS.id);

      expect(bannerText()).toBe(
        'Resolving import · Harbor Lights — also matched: Harbor.Lights.2019'
      );
    });

    it('prefills every slot from the first candidate’s files', async () => {
      await renderResolve(HARBOR_AMBIGUOUS.id);

      // A wrong first guess costs a Remove and a hand-pick, not a search.
      expect(screen.getByText('Harbor Lights.mp4')).toBeDefined();
      expect(screen.getByText('poster.jpg')).toBeDefined();
      expect(screen.getByText('Harbor Lights.en.srt')).toBeDefined();
      expect(screen.queryByText('Harbor.Lights.2019.mp4')).toBeNull();
      expect(titleField().value).toBe('Harbor Lights');
      expect(yearField().value).toBe('2019');
      expect(saveAndContinue().disabled).toBe(false);
    });

    it('names nothing after the title when a problem has no other candidate', async () => {
      answerProblem = () => Promise.resolve(okResponse(DIE_HARD));
      await renderResolve();

      expect(bannerText()).toBe('Resolving import · Die Hard');
    });
  });

  describe('a no-folder problem', () => {
    beforeEach(() => {
      answerProblem = () => Promise.resolve(okResponse(LANTERN_NO_FOLDER));
    });

    it('opens with the row’s fields filled', async () => {
      await renderResolve(LANTERN_NO_FOLDER.id);

      // Story 83: the sheet said all this; only the file is missing.
      expect(bannerText()).toBe('Resolving import · The Lantern Keeper');
      expect(titleField().value).toBe('The Lantern Keeper');
      expect(yearField().value).toBe('2019');
      expect(directorField().value).toBe('Mira Okafor');
      expect(castField().value).toBe('Ada Lin');
      expect(descriptionField().value).toBe('A keeper and a storm.');
      expect(picked('Drama')).toBe('true');
      expect(ratingLabel()).toContain('3.5 / 5');
    });

    it('opens with every slot empty, so the file can be picked from wherever it is', async () => {
      await renderResolve(LANTERN_NO_FOLDER.id);

      expect(videoPicker().type).toBe('file');
      expect(posterPicker().type).toBe('file');
      expect(languageControls()).toEqual([]);
      expect(
        screen.queryByRole('button', { name: /remove video/i })
      ).toBeNull();
    });

    it('keeps the gate shut until a film is picked', async () => {
      await renderResolve(LANTERN_NO_FOLDER.id);

      expect(saveAndContinue().disabled).toBe(true);
      await pickVideo();
      expect(saveAndContinue().disabled).toBe(false);
    });
  });

  describe('a no-row problem', () => {
    beforeEach(() => {
      answerProblem = () => Promise.resolve(okResponse(HARBOR_NO_ROW));
    });

    it('opens with the title guessed from the folder name, tail forms dropped', async () => {
      await renderResolve(HARBOR_NO_ROW.id);

      // Story 84: a film the sheet forgot is one title away from imported —
      // and the title is already typed, as the detail guessed it, not as the
      // folder spells it.
      expect(titleField().value).toBe('Harbor Lights');
      expect(yearField().value).toBe('');
      expect(
        chips().filter((c) => c.getAttribute('aria-pressed') === 'true')
      ).toEqual([]);
    });

    it('opens with the folder’s files as found files', async () => {
      await renderResolve(HARBOR_NO_ROW.id);

      expect(screen.getByText('Harbor.Lights.2019.mp4')).toBeDefined();
      expect(screen.getByText('poster.jpg')).toBeDefined();
      expect(screen.getByText('Harbor.Lights.2019.en.srt')).toBeDefined();
      expect(languageOf('Harbor.Lights.2019.en.srt').textContent).toContain(
        'English'
      );
      expect(screen.queryByLabelText(/choose video file/i)).toBeNull();
    });

    it('opens with the gate open: a found film and a guessed title', async () => {
      await renderResolve(HARBOR_NO_ROW.id);

      expect(saveAndContinue().disabled).toBe(false);
    });

    it('sends the guessed title and the found paths on Save & continue', async () => {
      await renderResolve(HARBOR_NO_ROW.id);

      fireEvent.click(saveAndContinue());

      await waitFor(() => expect(resolvedFields()).toBeDefined());
      expect(String(resolveRequests()[0][0])).toBe(
        '/api/import/current/problems/p4/resolve'
      );
      expect(resolvedFields()?.get('title')).toBe('Harbor Lights');
      expect(resolvedFields()?.get('videoPath')).toBe(
        HARBOR_NO_ROW.files.video
      );
      expect(resolvedFiles()).toEqual([]);
    });
  });

  /** What the plain Add context looks like: no banner, the ordinary labels. */
  function expectPlainAddContext() {
    expect(screen.queryByText(/resolving import/i)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Add a movie' })).toBeDefined();
    expect(save().textContent).toContain('Add to library');
    expect(cancel().textContent).toContain('Cancel');
    expect(
      screen.queryByRole('button', { name: /save & continue/i })
    ).toBeNull();
    expect(screen.queryByRole('button', { name: /skip this one/i })).toBeNull();
  }

  describe('the stale link', () => {
    it('falls back to the plain Add context for a dismissed problem', async () => {
      answerProblem = () =>
        Promise.resolve(notFoundResponse('No such problem: p1'));
      await renderResolve();

      // Story 94: a stale link is never a dead page. The problem was looked
      // for — once — and the form is the ordinary add, empty.
      expect(problemReads()).toHaveLength(1);
      expectPlainAddContext();
      expect(titleField().value).toBe('');
      expect(videoPicker().type).toBe('file');
      expect(currentPath()).toBe('/add');
    });

    it('falls back to the plain Add context when there is no run', async () => {
      answerProblem = () =>
        Promise.resolve(notFoundResponse('No import is running'));
      await renderResolve();

      expect(problemReads()).toHaveLength(1);
      expectPlainAddContext();
      expect(titleField().value).toBe('');
      expect(currentPath()).toBe('/add');
    });

    it('saves through POST /api/movies after the fallback, never the resolve route', async () => {
      answerProblem = () =>
        Promise.resolve(notFoundResponse('No such problem: p1'));
      await renderResolve();
      fireEvent.change(titleField(), { target: { value: 'Ironwood' } });
      await pickVideo();

      fireEvent.click(save());

      await waitFor(() => expect(saveRequests()).toHaveLength(1));
      expect(resolveRequests()).toEqual([]);
    });

    it('follows the app’s own Back rule after the fallback, not /import', async () => {
      answerProblem = () =>
        Promise.resolve(notFoundResponse('No such problem: p1'));
      await renderResolve();

      fireEvent.click(backPill());

      expect(currentPath()).toBe('/settings');
      expect(dismissRequests()).toEqual([]);
    });
  });

  describe('Resolve on a problem already gone', () => {
    beforeEach(() => {
      answerResolve = () =>
        Promise.resolve(notFoundResponse('No such problem: p1'));
    });

    it('falls back to the plain Add context on the 404', async () => {
      await renderResolve();
      expect(banner()).not.toBeNull();

      fireEvent.click(saveAndContinue());

      // Story 102: gone is gone. The run no longer knows this problem — it
      // was dismissed meanwhile, or the run itself is gone — so there is
      // nothing to resolve, and the form is the ordinary add, as the stale
      // link's is.
      await waitFor(() => expect(resolveRequests()).toHaveLength(1));
      await waitFor(() => expectPlainAddContext());
      expect(currentPath()).toBe('/add');
    });

    it('opens as an empty form, the found files gone from the slots', async () => {
      await renderResolve();

      fireEvent.click(saveAndContinue());

      // A found file is a path under the run's root, and the plain add sends
      // bytes only: nothing found can survive the fallback.
      await waitFor(() => expect(foundVideo()).toBeNull());
      expect(screen.queryByText('poster.jpg')).toBeNull();
      expect(languageControls()).toEqual([]);
      expect(titleField().value).toBe('');
      expect(videoPicker().type).toBe('file');
      expect(save().disabled).toBe(true);
    });

    it('dismisses nothing and lands nowhere', async () => {
      await renderResolve();

      fireEvent.click(saveAndContinue());

      await waitFor(() => expectPlainAddContext());
      expect(dismissRequests()).toEqual([]);
      expect(currentPath()).toBe('/add');
    });

    it('stays standing with everything in it on any other refusal', async () => {
      answerResolve = () => Promise.resolve(serverErrorResponse());
      await renderResolve();

      fireEvent.click(saveAndContinue());

      await waitFor(() => expect(saveAndContinue().disabled).toBe(false));
      expect(banner()).not.toBeNull();
      expect(foundVideo()).not.toBeNull();
    });
  });

  describe('/add without ?problem=', () => {
    it('is unchanged: reads no problem, draws no banner, wears the ordinary labels', async () => {
      await renderForm();

      expect(problemReads()).toEqual([]);
      expectPlainAddContext();
      expect(titleField().value).toBe('');
      expect(videoPicker().type).toBe('file');
    });

    it('still saves through POST /api/movies', async () => {
      await renderForm();
      fireEvent.change(titleField(), { target: { value: 'Ironwood' } });
      await pickVideo();

      fireEvent.click(save());

      await waitFor(() => expect(saveRequests()).toHaveLength(1));
      expect(resolveRequests()).toEqual([]);
    });
  });
});
