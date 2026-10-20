import { describe, expect, it } from 'vitest';

import { refusalSentence } from './refusalSentence';
import { conflictResponse } from '@/test-support/fakeResponse/fakeResponse';

/**
 * 47 — Manage library: `refusalSentence(response)`, the one reader of a
 * route's refusal — the `error` of `{ error: string }`, else `null`, never
 * rejecting.
 */
function responseWith(json: () => Promise<unknown>): Response {
  return { ok: false, status: 409, json } as unknown as Response;
}

describe('refusalSentence', () => {
  it('answers the route’s own sentence', async () => {
    await expect(
      refusalSentence(conflictResponse('A sync is running.'))
    ).resolves.toBe('A sync is running.');
  });

  it('answers null for a response with no body', async () => {
    await expect(
      refusalSentence(
        responseWith(() => Promise.reject(new SyntaxError('no body')))
      )
    ).resolves.toBeNull();
  });

  it('answers null for a body that is not JSON', async () => {
    await expect(
      refusalSentence(new Response('<html>busy</html>', { status: 409 }))
    ).resolves.toBeNull();
  });

  it('answers null for an error that is not a string', async () => {
    await expect(
      refusalSentence(responseWith(() => Promise.resolve({ error: 409 })))
    ).resolves.toBeNull();
  });
});
