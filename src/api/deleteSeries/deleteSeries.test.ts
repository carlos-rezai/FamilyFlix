import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { deleteSeries } from './deleteSeries';
import {
  conflictResponse,
  noContentResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 47 — Manage library, Phase 4: "delete a copied title" (issue #410).
 *
 * `deleteSeries(id)`, moved up from `features/series/api/` because two
 * features now call it — the series page's Delete dialog and the **Manage
 * library page**'s. The route is unchanged: `DELETE /api/series/:id`, no
 * body. Since keep-originals (issue #477) it answers `factoryReset`'s shape,
 * `Promise<void>`: resolved on the `204`, and on a `404`, **gone is gone**,
 * as the detail page always held; rejected otherwise, a `409` too.
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

    await deleteSeries('s1');

    const request = onlyRequest();
    expect(request.url).toBe('/api/series/s1');
    expect(request.method?.toUpperCase()).toBe('DELETE');
    expect(request.body).toBeUndefined();
  });

  it('encodes an id that would otherwise break the path', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await deleteSeries('a/1 b');

    expect(onlyRequest().url).toBe('/api/series/a%2F1%20b');
  });

  it('resolves with nothing on a 204, never reading a body', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await expect(deleteSeries('s1')).resolves.toBeUndefined();
  });

  it('resolves with nothing on a 404 too: gone is gone', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('Unknown series: s1'));

    await expect(deleteSeries('s1')).resolves.toBeUndefined();
  });

  it.each([
    [409, conflictResponse()],
    [500, serverErrorResponse()],
  ])('rejects on a %i', async (status, response) => {
    fetchMock.mockResolvedValue(response);

    await expect(deleteSeries('s1')).rejects.toThrow(String(status));
  });

  it('rejects when the request itself cannot be made', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(deleteSeries('s1')).rejects.toThrow();
  });
});
