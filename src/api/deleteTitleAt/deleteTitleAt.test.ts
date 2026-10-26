import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { deleteTitleAt } from './deleteTitleAt';
import {
  conflictResponse,
  noContentResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 52, Keep originals, Phase 4 (issue #477): `deleteTitleAt(route)`, the
 * `DELETE` `deleteMovie` and `deleteSeries` share, back in Factory reset's
 * shape, `Promise<void>`. Any `2xx` resolves, and so does a `404`: **gone is
 * gone**. Anything else rejects, a `409` too: a Delete keeps originals, so
 * no route refuses one any more. The request is the route itself, a plain
 * `DELETE` with no query and no body.
 */
const SENTENCE =
  'Couldn’t move E:\\Movies\\Coco (2017) to the Recycle Bin. Close anything playing it and try again.';

const ENDPOINT = '/api/movies/m1';

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

describe('deleteTitleAt', () => {
  it('sends a plain DELETE to the route, with no query and no body', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await deleteTitleAt(ENDPOINT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0]!;
    expect(String(input)).toBe(ENDPOINT);
    expect(init?.method?.toUpperCase()).toBe('DELETE');
    expect(init?.body).toBeUndefined();
  });

  it('resolves with nothing on a 204, never reading a body', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await expect(deleteTitleAt(ENDPOINT)).resolves.toBeUndefined();
  });

  it('resolves with nothing on a 404 too: gone is gone', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('Unknown movie: m1'));

    await expect(deleteTitleAt(ENDPOINT)).resolves.toBeUndefined();
  });

  it('rejects a 409, even one naming its reason', async () => {
    fetchMock.mockResolvedValue(conflictResponse(SENTENCE));

    await expect(deleteTitleAt(ENDPOINT)).rejects.toThrow(/409/);
  });

  it('rejects on a 500', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(deleteTitleAt(ENDPOINT)).rejects.toThrow(/500/);
  });

  it('rejects when the request itself cannot be made', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(deleteTitleAt(ENDPOINT)).rejects.toThrow();
  });
});
