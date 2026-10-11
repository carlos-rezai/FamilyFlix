import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { deleteSeries } from './api';
import {
  noContentResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 38 — Title editing, Slice 1: "delete a series" (issue #304).
 *
 * `deleteSeries`, the series page's one call for its Delete dialog — the movie's
 * `deleteMovie` over the series' own route, with the same promise: **gone is
 * gone**, so a `204` and a `404` both resolve, and anything else rejects.
 */
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

/** The one request sent, as url, method and body. */
function onlyRequest() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [input, init] = fetchMock.mock.calls[0];
  return { url: String(input), method: init?.method, body: init?.body };
}

describe('deleteSeries', () => {
  it('sends DELETE to the series’ own route, with no body', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await deleteSeries('harbor');

    const request = onlyRequest();
    expect(request.url).toBe('/api/series/harbor');
    expect(request.method?.toUpperCase()).toBe('DELETE');
    expect(request.body).toBeUndefined();
  });

  it('encodes an id that would otherwise break the path', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await deleteSeries('a/1 b');

    expect(onlyRequest().url).toBe('/api/series/a%2F1%20b');
  });

  it('resolves on 204', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await expect(deleteSeries('harbor')).resolves.toBeUndefined();
  });

  it('resolves on 404 too — gone is gone', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('Unknown series: harbor'));

    await expect(deleteSeries('harbor')).resolves.toBeUndefined();
  });

  it('rejects on any other refusal', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(deleteSeries('harbor')).rejects.toThrow();
  });
});
