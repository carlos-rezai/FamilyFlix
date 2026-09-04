import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { postValue } from './postValue';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: 'boom' }),
  } as unknown as Response;
}

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
    contentType: (init?.headers as Record<string, string> | undefined)?.[
      'Content-Type'
    ],
    body: init?.body,
  };
}

/** What the two flag routes accept as an echo. */
function isBoolean(echoed: unknown): echoed is boolean {
  return typeof echoed === 'boolean';
}

/** What the rating route accepts — where `null` is a value, not an absence. */
function isRating(echoed: unknown): echoed is number | null {
  return typeof echoed === 'number' || echoed === null;
}

describe('postValue', () => {
  it('posts the value as JSON under a `value` key', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: true }));

    await postValue('/api/movies/m1/favorite', true, isBoolean);

    expect(onlyRequest()).toEqual({
      url: '/api/movies/m1/favorite',
      method: 'POST',
      contentType: 'application/json',
      body: JSON.stringify({ value: true }),
    });
  });

  it('answers with the value the route echoed, not the one that was sent', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: false }));

    const saved = await postValue('/api/movies/m1/watched', true, isBoolean);

    expect(saved).toBe(false);
  });

  it('falls back to what was sent when the route answers without a `value`', async () => {
    fetchMock.mockResolvedValue(okResponse({ ok: true }));

    const saved = await postValue('/api/movies/m1/watched', true, isBoolean);

    expect(saved).toBe(true);
  });

  it('falls back when the echo is not the kind of value the caller accepts', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: 'yes' }));

    const saved = await postValue('/api/movies/m1/watched', true, isBoolean);

    expect(saved).toBe(true);
  });

  it('rejects when the route answers with anything but a 2xx', async () => {
    fetchMock.mockResolvedValue(errorResponse(500));

    await expect(
      postValue('/api/movies/m1/watched', true, isBoolean)
    ).rejects.toThrow('POST /api/movies/m1/watched failed: 500');
  });

  it('rejects on a 404 too — a save to a movie that is gone is a failed save', async () => {
    fetchMock.mockResolvedValue(errorResponse(404));

    await expect(
      postValue('/api/movies/gone/rating', 7, isRating)
    ).rejects.toThrow('POST /api/movies/gone/rating failed: 404');
  });

  it('rejects when the request could not be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(
      postValue('/api/movies/m1/favorite', true, isBoolean)
    ).rejects.toThrow('offline');
  });

  describe('what counts as a usable echo', () => {
    // The one thing that genuinely differs between the three callers, which is
    // why it is an argument rather than a type check inside.

    it('believes a null echo when the caller accepts one', async () => {
      // The rating route's own rule: `null` is the route saying it cleared the
      // rating. Reading it as "no answer" would let a failed clear look like a
      // successful one.
      fetchMock.mockResolvedValue(okResponse({ value: null }));

      const saved = await postValue('/api/movies/m1/rating', 7, isRating);

      expect(saved).toBeNull();
    });

    it('does not believe a null echo when the caller does not accept one', async () => {
      fetchMock.mockResolvedValue(okResponse({ value: null }));

      const saved = await postValue('/api/movies/m1/watched', true, isBoolean);

      expect(saved).toBe(true);
    });

    it('still falls back when the `value` key is missing, null-accepting or not', async () => {
      // A missing key and a `null` value are different answers, and only the
      // first one is the route failing to say anything.
      fetchMock.mockResolvedValue(okResponse({}));

      const saved = await postValue('/api/movies/m1/rating', 7, isRating);

      expect(saved).toBe(7);
    });

    it('sends a null value through as a null, not as a missing key', async () => {
      fetchMock.mockResolvedValue(okResponse({ value: null }));

      await postValue('/api/movies/m1/rating', null, isRating);

      expect(onlyRequest().body).toBe(JSON.stringify({ value: null }));
    });
  });
});
