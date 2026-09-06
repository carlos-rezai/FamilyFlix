import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createMovie } from './api';
import type { Movie } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  createdResponse,
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

    await createMovie({ title: 'Rear Window', year: '1954' });

    const request = onlyRequest();
    expect(request.url).toBe('/api/movies');
    expect(request.method?.toUpperCase()).toBe('POST');
  });

  it('carries the title and the year as form fields', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie({ title: 'Rear Window', year: '1954' });

    const fields = sentFields();
    expect(fields.get('title')).toBe('Rear Window');
    expect(fields.get('year')).toBe('1954');
  });

  it('sends an empty year rather than omitting the field', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie({ title: 'Rear Window', year: '' });

    // The server reads an empty year as "no year"; a field that vanished when
    // it was cleared would make an edit unable to say the year was removed,
    // which is the same request shape one slice from now.
    expect(sentFields().get('year')).toBe('');
  });

  it('sets no Content-Type of its own', async () => {
    fetchMock.mockResolvedValue(createdResponse(CREATED));

    await createMovie({ title: 'Rear Window', year: '1954' });

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

    const movie = await createMovie({ title: 'Rear Window', year: '1954' });

    // The whole record, so the screen it lands on has the film without a second
    // request.
    expect(movie).toEqual(CREATED);
  });

  it('rejects when the save did not succeed', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(
      createMovie({ title: 'Rear Window', year: '1954' })
    ).rejects.toThrow();
  });

  it('rejects when the request could not be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(
      createMovie({ title: 'Rear Window', year: '1954' })
    ).rejects.toThrow();
  });
});
