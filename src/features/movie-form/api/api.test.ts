import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createMovie, fetchGenrePool } from './api';
import type { Movie } from '@/types';
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
 * The first write of a whole record the frontend makes. Every other write in
 * the app goes through `postValue` — `{ value }` in, `{ value }` out — and this
 * one deliberately does not: it sends `multipart/form-data` from the very first
 * slice, so the wire contract is settled once and does not change under these
 * tests when the video, poster and subtitle parts land behind the same call.
 */
describe('createMovie', () => {
  it('POSTs the form values as multipart to the movies route', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie({ title: 'Rear Window', year: '1954', genres: [] });

    const request = onlyRequest();
    expect(request.url).toBe('/api/movies');
    expect(request.method?.toUpperCase()).toBe('POST');
  });

  it('carries the title and the year as form fields', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie({ title: 'Rear Window', year: '1954', genres: [] });

    const fields = sentFields();
    expect(fields.get('title')).toBe('Rear Window');
    expect(fields.get('year')).toBe('1954');
  });

  it('sends an empty year rather than omitting the field', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie({ title: 'Rear Window', year: '', genres: [] });

    // The server reads an empty year as "no year"; a field that vanished when
    // it was cleared would make an edit unable to say the year was removed,
    // which is the same request shape one slice from now.
    expect(sentFields().get('year')).toBe('');
  });

  it('sets no Content-Type of its own', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie({ title: 'Rear Window', year: '1954', genres: [] });

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

    const movie = await createMovie({
      title: 'Rear Window',
      year: '1954',
      genres: [],
    });

    // The whole record, so the screen it lands on has the film without a second
    // request.
    expect(movie).toEqual(CREATED);
  });

  it('rejects when the save did not succeed', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(
      createMovie({ title: 'Rear Window', year: '1954', genres: [] })
    ).rejects.toThrow();
  });

  it('rejects when the request could not be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(
      createMovie({ title: 'Rear Window', year: '1954', genres: [] })
    ).rejects.toThrow();
  });

  // --- 11 — Movie form, Phase 1: the chips on the wire (issue #99) ------------

  it('sends one genre part per picked genre, in the order picked', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie({
      title: 'Rear Window',
      year: '1954',
      genres: ['Thriller', 'Sci-Fi'],
    });

    // A repeated part under one name — what a set has always looked like on a
    // form wire, and what `getAll` reads back. `genres[0]` is the primary tag
    // the repository has preserved since #3, so the order is the maintainer's.
    expect(sentFields().getAll('genre')).toEqual(['Thriller', 'Sci-Fi']);
  });

  it('sends the genres in the order they are held, not the pool’s', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie({
      title: 'Rear Window',
      year: '1954',
      genres: ['Sci-Fi', 'Thriller'],
    });

    // The same two names, sent the other way round. Nothing between the chips
    // and the row re-imposes the pool's order on them.
    expect(sentFields().getAll('genre')).toEqual(['Sci-Fi', 'Thriller']);
  });

  it('sends no genre part at all when none is picked', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie({ title: 'Rear Window', year: '1954', genres: [] });

    // Unlike `year`, an empty genre selection is an *absent* field rather than
    // an empty one: there is no such thing as a genre named `''`, so a part
    // carrying one would be a name the server would have to refuse.
    expect(sentFields().getAll('genre')).toEqual([]);
    expect(sentFields().has('genre')).toBe(false);
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
