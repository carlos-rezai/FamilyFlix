import { describe, expect, it } from 'vitest';

import { okResponse } from '../fakeResponse/fakeResponse';
import { heldFetch } from './heldFetch';

/**
 * 53, Loading states (issue #490).
 *
 * The claims the busy suites lean on: a request stays open until `respond`
 * answers it, a read `pass` answers is answered at once, the calls can be
 * read off the mock, and the `fetch` found is back once the block is over.
 */
const realFetch = globalThis.fetch;
const LIST = okResponse(['Coco']);
const DONE = okResponse({ deleted: true });

/** How a request stands: still open, or answered with what. */
function watch(request: Promise<Response>) {
  const state: { response?: Response } = {};
  void request.then((response) => {
    state.response = response;
  });
  return state;
}

describe('heldFetch: inside the block that installed it', () => {
  const { fetchMock, respond } = heldFetch((url, init) =>
    url === '/api/list' && (init?.method ?? 'GET') === 'GET' ? LIST : undefined
  );

  it('holds a request open', async () => {
    const request = watch(fetch('/api/titles/m1', { method: 'DELETE' }));
    await Promise.resolve();
    await Promise.resolve();

    expect(request.response).toBeUndefined();
  });

  it('answers the latest held request on respond', async () => {
    const request = watch(fetch('/api/titles/m1', { method: 'DELETE' }));

    await respond(DONE);

    expect(request.response).toBe(DONE);
  });

  it('answers a read pass lets through at once', async () => {
    await expect(fetch('/api/list')).resolves.toBe(LIST);
  });

  it('holds a write to a passed read’s URL', async () => {
    const request = watch(fetch('/api/list', { method: 'POST' }));
    await Promise.resolve();

    expect(request.response).toBeUndefined();
  });

  it('records every call on the mock, and starts each test with none', () => {
    void fetch('/api/list');

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/api/list',
    ]);
  });
});

describe('heldFetch: after the block that installed it', () => {
  it('leaves the fetch it found behind', () => {
    expect(globalThis.fetch).toBe(realFetch);
  });
});
