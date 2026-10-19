import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { deleteMovie } from './deleteMovie';
import {
  conflictResponse,
  noContentResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 47 — Manage library, Phase 4: "delete a copied title" (issue #410).
 *
 * `deleteMovie(id)`, moved up from `features/movie-detail/api/` because two
 * features now call it — the movie page's Delete dialog and the **Manage
 * library page**'s. The route is unchanged: `DELETE /api/movies/:id`, no
 * body. It answers `factoryReset`'s shape: `deleted` on the `204` — and on a
 * `404`, **gone is gone**, as the detail page always held — `refused` with
 * the route's own sentence on a `409`, and rejects otherwise.
 */
const LOCKED =
  'Couldn’t move E:\Movies\Coco (2017) to the Recycle Bin. Close anything playing it and try again.';

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

describe('deleteMovie', () => {
  it('sends DELETE to the movie’s own route, with no body', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await deleteMovie('m1');

    const request = onlyRequest();
    expect(request.url).toBe('/api/movies/m1');
    expect(request.method?.toUpperCase()).toBe('DELETE');
    expect(request.body).toBeUndefined();
  });

  it('encodes an id that would otherwise break the path', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await deleteMovie('a/1 b');

    expect(onlyRequest().url).toBe('/api/movies/a%2F1%20b');
  });

  it('answers deleted on a 204, never reading a body', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await expect(deleteMovie('m1')).resolves.toEqual({ kind: 'deleted' });
  });

  it('answers deleted on a 404 too — gone is gone', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('Unknown movie: m1'));

    await expect(deleteMovie('m1')).resolves.toEqual({ kind: 'deleted' });
  });

  it('answers refused with the route’s own sentence on a 409', async () => {
    fetchMock.mockResolvedValue(conflictResponse(LOCKED));

    await expect(deleteMovie('m1')).resolves.toEqual({
      kind: 'refused',
      sentence: LOCKED,
    });
  });

  it('rejects a 409 that names no reason', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({}),
    } as unknown as Response);

    await expect(deleteMovie('m1')).rejects.toThrow();
  });

  it('rejects on a 500', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(deleteMovie('m1')).rejects.toThrow(/500/);
  });

  it('rejects when the request itself cannot be made', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(deleteMovie('m1')).rejects.toThrow();
  });
});
