// @vitest-environment node
//
// 23 — Enrichment, Phase 1: "the TMDB key" (issue #203).
//
// `tmdbAuth` — pure: a key → how to send it. themoviedb.org → Settings → API
// hands out two things side by side, and the maintainer may paste either: a
// v4 **Read Access Token**, a JWT, sent as `Authorization: Bearer`; and a v3
// **API key**, 32 hex characters, sent as the `api_key` query parameter.
// Told apart by shape alone — a JWT-shaped string is v4, anything else v3.

import { describe, expect, it } from 'vitest';

import { tmdbAuth } from './tmdbAuth';

/** A v4 Read Access Token's shape: three base64url segments, `eyJ…` first. */
const V4_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIwMTIzNDU2Nzg5YWJjZGVmIiwic2NvcGVzIjpbImFwaV9yZWFkIl19.Zm9vYmFyYmF6cXV4LXNpZ25hdHVyZQ';

/** A v3 API key's shape: 32 hex characters. */
const V3_KEY = '0123456789abcdef0123456789abcdef';

describe('tmdbAuth', () => {
  it('reads a JWT-shaped string as a v4 token, sent as a Bearer header', () => {
    expect(tmdbAuth(V4_TOKEN)).toEqual({ version: 'v4', bearer: V4_TOKEN });
  });

  it.each([
    ['a v3 API key', V3_KEY],
    ['a short string', 'abc'],
    ['a dotted string that is not a JWT', 'not.a.token'],
    ['two segments only', 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJ4In0'],
  ])('reads %s as a v3 key, sent as api_key', (_label, key) => {
    expect(tmdbAuth(key)).toEqual({ version: 'v3', apiKey: key });
  });
});
