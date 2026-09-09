import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createMovie, fetchGenrePool } from './api';
import type {
  Movie,
  MovieFormFile,
  MovieFormSubtitle,
  MovieFormValues,
} from '@/types';
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

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The one request that was issued, as url plus the init it carried. */
function onlyRequest() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [input, init] = fetchMock.mock.calls[0];
  return {
    url: String(input),
    method: init?.method,
    headers: init?.headers as Record<string, string> | undefined,
    body: init?.body,
  };
}

/** The multipart body the call sent, as the form data it is. */
function sentFields(): FormData {
  const { body } = onlyRequest();
  expect(body).toBeInstanceOf(FormData);
  return body as FormData;
}

const CREATED: Movie = makeMovie({
  id: 'new-1',
  title: 'Rear Window',
  year: 1954,
  videoPath: '',
});

/**
 * A form filled in, with only the fields a test is about actually typed.
 *
 * Every field travels on this wire, so a call spelled out in full would restate
 * five empty strings at every call site to say something about one of them.
 * What a test writes down is what it is asserting.
 */
function typed(values: Partial<MovieFormValues> = {}): MovieFormValues {
  return {
    title: '',
    year: '',
    director: '',
    cast: '',
    description: '',
    genres: [],
    rating: null,
    // An empty **File slot**, which is what the **Add context** opens on and
    // what every test above this slice is about.
    video: null,
    poster: null,
    // No tracks attached, which is a complete answer: story 64's film with no
    // subtitles is a normal row.
    subtitles: [],
    ...values,
  };
}

/**
 * The first write of a whole record the frontend makes. Every other write in
 * the app goes through `postValue` — `{ value }` in, `{ value }` out — and this
 * one deliberately does not: it sends `multipart/form-data` from the very first
 * slice, so the wire contract is settled once and does not change under these
 * tests when the video, poster and subtitle parts land behind the same call.
 */
describe('createMovie', () => {
  it('POSTs the form values as multipart to the movies route', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(typed({ title: 'Rear Window', year: '1954' }));

    const request = onlyRequest();
    expect(request.url).toBe('/api/movies');
    expect(request.method?.toUpperCase()).toBe('POST');
  });

  it('carries the title and the year as form fields', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(typed({ title: 'Rear Window', year: '1954' }));

    const fields = sentFields();
    expect(fields.get('title')).toBe('Rear Window');
    expect(fields.get('year')).toBe('1954');
  });

  it('sends an empty year rather than omitting the field', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(typed({ title: 'Rear Window', year: '' }));

    // The server reads an empty year as "no year"; a field that vanished when
    // it was cleared would make an edit unable to say the year was removed,
    // which is the same request shape one slice from now.
    expect(sentFields().get('year')).toBe('');
  });

  it('sets no Content-Type of its own', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(typed({ title: 'Rear Window', year: '1954' }));

    // A multipart body is nothing without its boundary, and only the platform
    // knows the boundary it generated. Naming the header here would send
    // `multipart/form-data` with no boundary at all and busboy would refuse the
    // body — which is why this is asserted rather than left to chance.
    const named = Object.keys(onlyRequest().headers ?? {}).map((key) =>
      key.toLowerCase()
    );
    expect(named).not.toContain('content-type');
  });

  it('resolves the created movie the route answered with', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    const movie = await createMovie(
      typed({
        title: 'Rear Window',
        year: '1954',
      })
    );

    // The whole record, so the screen it lands on has the film without a second
    // request.
    expect(movie).toEqual(CREATED);
  });

  it('rejects when the save did not succeed', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(
      createMovie(typed({ title: 'Rear Window', year: '1954' }))
    ).rejects.toThrow();
  });

  it('rejects when the request could not be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(
      createMovie(typed({ title: 'Rear Window', year: '1954' }))
    ).rejects.toThrow();
  });

  // --- 11 — Movie form, Phase 1: the chips on the wire (issue #99) ------------

  it('sends one genre part per picked genre, in the order picked', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(
      typed({
        title: 'Rear Window',
        year: '1954',
        genres: ['Thriller', 'Sci-Fi'],
      })
    );

    // A repeated part under one name — what a set has always looked like on a
    // form wire, and what `getAll` reads back. `genres[0]` is the primary tag
    // the repository has preserved since #3, so the order is the maintainer's.
    expect(sentFields().getAll('genre')).toEqual(['Thriller', 'Sci-Fi']);
  });

  it('sends the genres in the order they are held, not the pool’s', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(
      typed({
        title: 'Rear Window',
        year: '1954',
        genres: ['Sci-Fi', 'Thriller'],
      })
    );

    // The same two names, sent the other way round. Nothing between the chips
    // and the row re-imposes the pool's order on them.
    expect(sentFields().getAll('genre')).toEqual(['Sci-Fi', 'Thriller']);
  });

  it('sends no genre part at all when none is picked', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(typed({ title: 'Rear Window', year: '1954' }));

    // Unlike `year`, an empty genre selection is an *absent* field rather than
    // an empty one: there is no such thing as a genre named `''`, so a part
    // carrying one would be a name the server would have to refuse.
    expect(sentFields().getAll('genre')).toEqual([]);
    expect(sentFields().has('genre')).toBe(false);
  });

  // --- 11 — Movie form, Phase 2: the credits on the wire (issue #100) --------
  //
  // The cast is the one value on this form whose typed shape and stored shape
  // differ: one line in the box, a list in the row. It is resolved here, on the
  // way out, by `castNames` — so the wire carries the names rather than the
  // typing, and the comma rule lives in exactly one place.

  it('carries the director and the description as form fields', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(
      typed({
        title: 'Rear Window',
        director: 'Alfred Hitchcock',
        description: 'A photographer watches his neighbours.',
      })
    );

    // `description` is the form's word for it, and the column's is `synopsis`.
    // The rename happens once, at the route — the field is named after the
    // caption the maintainer typed under.
    const fields = sentFields();
    expect(fields.get('director')).toBe('Alfred Hitchcock');
    expect(fields.get('description')).toBe(
      'A photographer watches his neighbours.'
    );
  });

  it('sends an empty director and description rather than omitting them', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(typed({ title: 'Rear Window' }));

    // `year`'s rule, over two more nullable columns: a field that vanished when
    // it was cleared could not say a director had been *removed*.
    const fields = sentFields();
    expect(fields.get('director')).toBe('');
    expect(fields.get('description')).toBe('');
  });

  it('sends one cast part per name, in the order they were typed', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(
      typed({ title: 'Rear Window', cast: 'Jane Doe, John Roe, Ana Vega' })
    );

    // The genres' own spelling, for the genres' own reason: a list on this wire
    // is one part per entry under one name. The billing order is the
    // maintainer's, and nothing between the box and the row re-sorts it.
    expect(sentFields().getAll('cast')).toEqual([
      'Jane Doe',
      'John Roe',
      'Ana Vega',
    ]);
  });

  it('sends a carelessly typed cast as the names in it', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(
      typed({ title: 'Rear Window', cast: ' Jane Doe ,, John Roe, ' })
    );

    // Trailing commas, doubled commas and stray spaces are what a field being
    // typed into looks like. None of them is a cast member.
    expect(sentFields().getAll('cast')).toEqual(['Jane Doe', 'John Roe']);
  });

  it('sends no cast part at all when the field is empty', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(typed({ title: 'Rear Window', cast: '' }));

    // The genres' rule rather than the year's, because this is a list too: an
    // untyped cast is an absent field, never one empty part that the row would
    // have to read as a person with no name.
    expect(sentFields().getAll('cast')).toEqual([]);
    expect(sentFields().has('cast')).toBe(false);
  });

  it('sends no cast part for a field holding only commas and spaces', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(typed({ title: 'Rear Window', cast: ' , , ' }));

    expect(sentFields().has('cast')).toBe(false);
  });

  // --- 11 — Movie form, Phase 2: the rating (issue #101) ---------------------

  /**
   * The one value on this form the two ends of the wire spell differently for a
   * reason that is not a rename: the picker speaks the 0–100 percent every star
   * strip in the app fills against, and the column stores 0–10 half-star units.
   * `toRatingUnits` is the boundary, and this is the boundary — so no second
   * rating representation is ever held anywhere between them.
   */
  it('carries the rating in the units the column stores, not the percent the picker speaks', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(typed({ title: 'Rear Window', rating: 80 }));

    expect(sentFields().get('rating')).toBe('8');
  });

  it('carries a half star as the half unit it is', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(typed({ title: 'Rear Window', rating: 70 }));

    // Three and a half stars is 7 of the 10 units, and it stays a whole number
    // on the wire — which is what makes the half-star scale storable at all.
    expect(sentFields().get('rating')).toBe('7');
  });

  it('sends an empty rating for an unrated movie rather than omitting the field', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(typed({ title: 'Rear Window', rating: null }));

    // `year`'s rule over the one column where getting it wrong scores the film
    // instead of erasing it: the field travels, empty, so a rating the
    // maintainer *removed* is a thing this request shape can say one slice
    // from now.
    expect(sentFields().has('rating')).toBe(true);
    expect(sentFields().get('rating')).toBe('');
  });
});

/**
 * The **Genre pool** — the twelve names a **Movie form** offers as chips,
 * including the ones no movie is tagged with yet.
 *
 * Its own call against its own endpoint, deliberately not `fetchGenreList`'s:
 * that one answers a **Filter dropdown**'s question — what is on the shelves,
 * and how much of each — and a form built on it could never create the library's
 * first Documentary.
 */
describe('fetchGenrePool', () => {
  /** What `GET /api/genres/pool` answers with, envelope and all. */
  const POOL_PAYLOAD = {
    genres: [
      { id: 'g1', name: 'Action' },
      { id: 'g2', name: 'Comedy' },
      { id: 'g3', name: 'Drama' },
    ],
  };

  it('GETs the pool endpoint, not the genre list', async () => {
    fetchMock.mockResolvedValue(okResponse(POOL_PAYLOAD));

    await fetchGenrePool();

    const request = onlyRequest();
    expect(request.url).toBe('/api/genres/pool');
    expect(request.method ?? 'GET').toMatch(/get/i);
  });

  it('asks with no query string, so the pool is never a filtered answer', async () => {
    fetchMock.mockResolvedValue(okResponse(POOL_PAYLOAD));

    await fetchGenrePool();

    expect(onlyRequest().url).not.toContain('?');
  });

  it('resolves the genres themselves, in the order the route sent them', async () => {
    fetchMock.mockResolvedValue(okResponse(POOL_PAYLOAD));

    const pool = await fetchGenrePool();

    // The envelope is the route's business. What a caller wants is the list, in
    // migration order, which is the order the chips are drawn in.
    expect(pool.map((genre) => genre.name)).toEqual([
      'Action',
      'Comedy',
      'Drama',
    ]);
    expect(pool[0].id).toBe('g1');
  });

  it('rejects when the pool could not be read', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    // Swallowing this is the hook's job, not this one's — the same division
    // `fetchGenreList` and `useGenreList` already draw.
    await expect(fetchGenrePool()).rejects.toThrow();
  });

  it('rejects when the request could not be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchGenrePool()).rejects.toThrow();
  });
});

// --- 11 — Movie form, Phase 3: the video part (issue #102) -------------------
//
// The first bytes this app ever sends. Everything above travels as a string in
// a field; a **Picked file** travels as a `File` in a part, which is the whole
// reason this call has been `multipart/form-data` since the tracer slice rather
// than JSON that would have had to be replaced here.

/** A film off the maintainer's own disk, as the browser hands it over. */
const LANTERN = new File(['video bytes'], 'lantern.mp4', { type: 'video/mp4' });

/** The video slot holding that film. */
const PICKED: MovieFormFile = {
  kind: 'picked',
  file: LANTERN,
  filename: 'lantern.mp4',
};

describe('createMovie — the video', () => {
  it('sends the picked file as the video part', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(typed({ title: 'The Lantern Keeper', video: PICKED }));

    // The `File` itself: a browser gives a name and bytes and never a path, so
    // the bytes are the only thing there is to send — and sending them is what
    // makes the managed copy possible at all.
    expect(sentFields().get('video')).toBe(LANTERN);
  });

  it('sends it as one part, whatever the film weighs', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(typed({ title: 'The Lantern Keeper', video: PICKED }));

    // One request per save. `FormData` streams the part rather than reading it
    // into the body, which is what keeps a 12 GB film out of memory on both
    // ends of the wire.
    expect(sentFields().getAll('video')).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends the video alongside the fields rather than in a second request', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(
      typed({
        title: 'The Lantern Keeper',
        year: '2019',
        genres: ['Drama'],
        video: PICKED,
      })
    );

    const fields = sentFields();
    expect(fields.get('title')).toBe('The Lantern Keeper');
    expect(fields.get('year')).toBe('2019');
    expect(fields.getAll('genre')).toEqual(['Drama']);
    expect(fields.get('video')).toBe(LANTERN);
  });

  it('sends a video part only when there is a film in the slot', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));
    await createMovie(typed({ title: 'Rear Window', video: null }));

    // The lists' rule rather than the fields': there is no file with no bytes,
    // so an empty slot sends nothing rather than an empty part the server
    // would have to refuse. The **Save gate** makes an empty one unreachable
    // from the form; a caller that is not the form can still ask for it, which
    // is why the two halves are asserted against each other.
    expect(sentFields().has('video')).toBe(false);

    fetchMock.mockClear();
    await createMovie(typed({ title: 'Rear Window', video: PICKED }));

    expect(sentFields().has('video')).toBe(true);
  });
});

// --- 11 — Movie form, Phase 4: the poster part (issue #103) ------------------
//
// A second file on the same wire, and deliberately nothing new about it: it is
// appended the way the video is, under its own name, and an empty slot sends no
// part at all. What these tests are really guarding is that the contract
// settled in the tracer slice absorbed a second file without changing shape.

/** The artwork beside the film in the same folder. */
const ARTWORK = new File(['image bytes'], 'lantern-poster.jpg', {
  type: 'image/jpeg',
});

/** The poster slot holding it. */
const PICKED_POSTER: MovieFormFile = {
  kind: 'picked',
  file: ARTWORK,
  filename: 'lantern-poster.jpg',
};

describe('createMovie — the poster', () => {
  it('sends the picked poster as the poster part', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(
      typed({ title: 'The Lantern Keeper', poster: PICKED_POSTER })
    );

    expect(sentFields().get('poster')).toBe(ARTWORK);
  });

  it('sends a poster part only when there is artwork in the slot', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(typed({ title: 'Rear Window', poster: null }));

    // The lists' rule rather than the fields': `year` travels empty so an edit
    // can say a year was removed, but there is no file with no bytes — and
    // `poster_path` is nullable, so an absent part is a complete answer.
    expect(sentFields().has('poster')).toBe(false);
  });

  it('sends the film and its artwork in the same request', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(
      typed({
        title: 'The Lantern Keeper',
        year: '2019',
        genres: ['Drama'],
        video: PICKED,
        poster: PICKED_POSTER,
      })
    );

    // Story 36 with two files in it. One request per save however many slots
    // are filled, and the fields still travel beside them.
    const fields = sentFields();
    expect(fields.get('video')).toBe(LANTERN);
    expect(fields.get('poster')).toBe(ARTWORK);
    expect(fields.get('title')).toBe('The Lantern Keeper');
    expect(fields.getAll('genre')).toEqual(['Drama']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// --- 11 — Movie form, Phase 4: the subtitle parts (issue #104) ---------------
//
// The first thing on this wire that is a **list of files**, which is what makes
// it different from the video and the poster rather than a third copy of them.
// A track is two things — bytes and the language they are in — and they travel
// as two repeated names in step: one `subtitle` part per row and one
// `subtitleLanguage` field per row, in the same order, so the i-th language
// belongs to the i-th file.
//
// That is the shape a form has always sent a set in, and the one `genre` and
// `cast` already use here. Nothing is invented for it: no index in a part name,
// no JSON smuggled into a field, and no second request.

/** An English track off the maintainer's own disk. */
const EN_SRT = new File(['cue bytes'], 'lantern.en.srt', {
  type: 'text/plain',
});

/** The Portuguese one beside it in the same folder. */
const PT_SRT = new File(['cue bytes'], 'lantern.pt.srt', {
  type: 'text/plain',
});

/**
 * One attached **Subtitle**, as the form holds it: a **Picked file**, the
 * language the maintainer chose, and the form's own stable `key`.
 *
 * The `key` never leaves the browser — it exists so a row survives its
 * neighbours being removed, and the wire has the part order for that.
 */
function attached(
  key: string,
  file: File,
  language = 'English'
): MovieFormSubtitle {
  return {
    key,
    file: { kind: 'picked', file, filename: file.name },
    language,
  };
}

describe('createMovie — the subtitles', () => {
  it('sends one subtitle part per attached track, in the order held', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(
      typed({
        title: 'The Lantern Keeper',
        video: PICKED,
        subtitles: [
          attached('s1', EN_SRT),
          attached('s2', PT_SRT, 'Portuguese'),
        ],
      })
    );

    // The `File` itself, on the video part's own rule — and the order is the
    // track order the row will be stored in.
    expect(sentFields().getAll('subtitle')).toEqual([EN_SRT, PT_SRT]);
  });

  it('sends one language field per track, in the same order', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(
      typed({
        title: 'The Lantern Keeper',
        video: PICKED,
        subtitles: [
          attached('s1', EN_SRT),
          attached('s2', PT_SRT, 'Portuguese'),
        ],
      })
    );

    // Read pairwise against the parts above: two repeated names travelling in
    // step is what pairs a language with its file, with nothing to parse.
    expect(sentFields().getAll('subtitleLanguage')).toEqual([
      'English',
      'Portuguese',
    ]);
  });

  it('sends the chosen language rather than a code for it', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(
      typed({
        title: 'The Lantern Keeper',
        video: PICKED,
        subtitles: [attached('s1', PT_SRT, 'Portuguese')],
      })
    );

    // A **Subtitle**'s language is stored as the chosen text — the **Language
    // pool** is a display vocabulary, not an entity, and nothing on either end
    // of this wire maps it to a locale.
    expect(sentFields().get('subtitleLanguage')).toBe('Portuguese');
  });

  it('sends no subtitle part at all when none is attached', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(typed({ title: 'Rear Window', subtitles: [] }));

    // The lists' rule: an empty set sends no part rather than an empty one, the
    // way an unpicked genre does. Story 64 is a row with no subtitles, not a
    // row with one that is nothing.
    const fields = sentFields();
    expect(fields.has('subtitle')).toBe(false);
    expect(fields.has('subtitleLanguage')).toBe(false);
  });

  it('sends the film, its artwork and its tracks in the same request', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie(
      typed({
        title: 'The Lantern Keeper',
        year: '2019',
        genres: ['Drama'],
        video: PICKED,
        poster: PICKED_POSTER,
        subtitles: [
          attached('s1', EN_SRT),
          attached('s2', PT_SRT, 'Portuguese'),
        ],
      })
    );

    // Story 36 with four files in it: one request per save, however many slots
    // are filled, and the fields still travel beside them.
    const fields = sentFields();
    expect(fields.get('video')).toBe(LANTERN);
    expect(fields.get('poster')).toBe(ARTWORK);
    expect(fields.getAll('subtitle')).toHaveLength(2);
    expect(fields.get('title')).toBe('The Lantern Keeper');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
