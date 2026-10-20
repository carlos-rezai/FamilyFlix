import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { deleteTitleAt } from './deleteTitleAt';
import {
  conflictResponse,
  noContentResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 47 — Manage library: `deleteTitleAt(endpoint)`, the `DELETE` `deleteMovie`
 * and `deleteSeries` share — `factoryReset`'s shape. `deleted` on the `204`,
 * and on a `404`, **gone is gone**; `refused` with the route's own sentence
 * on a `409`; and it rejects otherwise.
 */
const LOCKED =
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
  it('answers deleted on a 204, never reading a body', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await expect(deleteTitleAt(ENDPOINT)).resolves.toEqual({ kind: 'deleted' });
  });

  it('answers deleted on a 404 too — gone is gone', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('Unknown movie: m1'));

    await expect(deleteTitleAt(ENDPOINT)).resolves.toEqual({ kind: 'deleted' });
  });

  it('answers refused with the route’s own sentence on a 409', async () => {
    fetchMock.mockResolvedValue(conflictResponse(LOCKED));

    await expect(deleteTitleAt(ENDPOINT)).resolves.toEqual({
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

    await expect(deleteTitleAt(ENDPOINT)).rejects.toThrow();
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
