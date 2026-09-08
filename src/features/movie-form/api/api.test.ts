import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createMovie, fetchGenrePool } from './api';
import type { Movie, MovieFormFile, MovieFormValues } from '@/types';
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
