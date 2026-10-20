import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { deleteMovie } from './deleteMovie';
import { noContentResponse } from '@/test-support/fakeResponse/fakeResponse';

/**
 * 47 — Manage library, Phase 4: "delete a copied title" (issue #410).
 *
 * `deleteMovie(id)`, moved up from `features/movie-detail/api/` because two
 * features now call it — the movie page's Delete dialog and the **Manage
 * library page**'s. The route is unchanged: `DELETE /api/movies/:id`, no
 * body. Its outcomes are `deleteTitleAt`'s, pinned in that suite.
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
});
