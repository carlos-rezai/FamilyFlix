import { describe, it, expect } from 'vitest';

import {
  okResponse,
  serverErrorResponse,
  notFoundResponse,
} from './fakeResponse';

/**
 * What the doubles promise, asserted the way `makeMovie.test.ts` asserts its
 * builder: every field a caller reads, and the one axis that varies.
 */
describe('okResponse', () => {
  it('is the response a caller treats as success', () => {
    const response = okResponse(null);

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  });

  it('resolves the body it was handed, unchanged', async () => {
    const body = { title: 'Comet Season' };

    await expect(okResponse(body).json()).resolves.toBe(body);
  });
});

describe('serverErrorResponse', () => {
  it('is a 500 a caller treats as failure', () => {
    const response = serverErrorResponse();

    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
  });

  it('carries the suite’s agreed body, which no caller reads for meaning', async () => {
    await expect(serverErrorResponse().json()).resolves.toEqual({
      error: 'boom',
    });
  });
});

describe('notFoundResponse', () => {
  it('is a 404 a caller treats as gone rather than broken', () => {
    const response = notFoundResponse();

    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });

  it('carries the server’s sentence when one is given', async () => {
    await expect(
      notFoundResponse('No video file for movie: m1').json()
    ).resolves.toEqual({ error: 'No video file for movie: m1' });
  });

  it('defaults to the API’s most common sentence', async () => {
    await expect(notFoundResponse().json()).resolves.toEqual({
      error: 'Movie not found',
    });
  });
});
