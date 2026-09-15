import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { dismissProblem } from './dismissProblem';
import {
  noContentResponse,
  notFoundResponse,
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
  };
}

describe('dismissProblem', () => {
  it('DELETEs the problem’s route, by id', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await dismissProblem('p1');

    const request = onlyRequest();
    expect(request.url).toBe('/api/import/current/problems/p1');
    expect(request.method?.toUpperCase()).toBe('DELETE');
  });

  it('encodes the id into the path', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await dismissProblem('p 1/x?y');

    expect(onlyRequest().url).toBe(
      '/api/import/current/problems/p%201%2Fx%3Fy'
    );
  });

  it('resolves on the 204, reading no body', async () => {
    // `noContentResponse` rejects on `json()`: a call that reached for the
    // body would reject here.
    fetchMock.mockResolvedValue(noContentResponse());

    await expect(dismissProblem('p1')).resolves.toBeUndefined();
  });

  it('resolves on a 404 too — a problem already gone is gone', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('No such problem'));

    await expect(dismissProblem('p1')).resolves.toBeUndefined();
  });

  it('rejects when the server fell over', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(dismissProblem('p1')).rejects.toThrow();
  });

  it('rejects when the request could not be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(dismissProblem('p1')).rejects.toThrow();
  });
});
