// @vitest-environment node
//
// 23 — Enrichment refactor (issue #214), Group 2: the start body is the
// route's to read.
//
// `POST /api/enrichment` and _Apply choices_ parse their own bodies before the
// domain is called, as the pick, the search and `POST /import` already did. A
// pure function answers the refusal rather than sending it, `movieFormBody`'s
// precedent, so each `400`'s sentence is asserted here as a value.

import { describe, expect, it } from 'vitest';

import { ENRICH_FIELDS, type StartEnrichment } from '@/types';
import {
  conflictChoicesBody,
  decisionIdsBody,
  seasonPosterBody,
  startEnrichmentBody,
} from './enrichmentBody';

const LIBRARY: StartEnrichment = {
  scope: 'all',
  fields: [...ENRICH_FIELDS],
  writeSheet: true,
  writePosters: false,
};

describe('startEnrichmentBody: what it reads', () => {
  it('reads a library Sync', () => {
    expect(startEnrichmentBody(LIBRARY)).toEqual({ ok: true, value: LIBRARY });
  });

  it('reads a single-title Sync with its movie', () => {
    const body = { ...LIBRARY, scope: 'single', movieId: 'm1' };

    expect(startEnrichmentBody(body)).toEqual({ ok: true, value: body });
  });

  // 38 — Title editing (issue #305): a single-title Sync may name a series.
  it('reads a single-title Sync with its series', () => {
    const body = { ...LIBRARY, scope: 'single', seriesId: 's1' };

    expect(startEnrichmentBody(body)).toEqual({ ok: true, value: body });
  });

  it('reads Only what’s missing with no chip on', () => {
    expect(
      startEnrichmentBody({ ...LIBRARY, scope: 'missing', fields: [] })
    ).toEqual({
      ok: true,
      value: { ...LIBRARY, scope: 'missing', fields: [] },
    });
  });

  it('carries nothing the body said beyond the options', () => {
    const read = startEnrichmentBody({ ...LIBRARY, extra: 1 });

    expect(read.ok && Object.keys(read.value).sort()).toEqual([
      'fields',
      'scope',
      'writePosters',
      'writeSheet',
    ]);
  });
});

describe('startEnrichmentBody: each refusal keeps its sentence', () => {
  it.each([
    ['no body', undefined, 'Body must be an object'],
    ['a null body', null, 'Body must be an object'],
    ['a string body', 'all', 'Body must be an object'],
    ['an unknown scope', { ...LIBRARY, scope: 'some' }, 'Unknown scope'],
    ['no scope', { ...LIBRARY, scope: undefined }, 'Unknown scope'],
    [
      'a single Sync with no movie',
      { ...LIBRARY, scope: 'single' },
      'A single-title Sync names its movie or series',
    ],
    [
      'a single Sync with an empty movie id',
      { ...LIBRARY, scope: 'single', movieId: '' },
      'A single-title Sync names its movie or series',
    ],
    [
      'a library Sync naming a movie',
      { ...LIBRARY, movieId: 'm1' },
      'Only a single-title Sync names a movie',
    ],
    [
      'a single Sync with an empty series id',
      { ...LIBRARY, scope: 'single', seriesId: '' },
      'A single-title Sync names its movie or series',
    ],
    [
      'a single Sync naming both a movie and a series',
      { ...LIBRARY, scope: 'single', movieId: 'm1', seriesId: 's1' },
      'A single-title Sync names one title',
    ],
    [
      'a library Sync naming a series',
      { ...LIBRARY, seriesId: 's1' },
      'Only a single-title Sync names a series',
    ],
    [
      'fields that are not a list',
      { ...LIBRARY, fields: 'synopsis' },
      'Unknown field',
    ],
    [
      'an unknown field',
      { ...LIBRARY, fields: ['synopsis', 'trailer'] },
      'Unknown field',
    ],
    [
      'a missing writeSheet',
      { ...LIBRARY, writeSheet: undefined },
      'writeSheet and writePosters are booleans',
    ],
    [
      'a string writePosters',
      { ...LIBRARY, writePosters: 'true' },
      'writeSheet and writePosters are booleans',
    ],
  ])('refuses %s', (_name, body, error) => {
    expect(startEnrichmentBody(body)).toEqual({ ok: false, error });
  });

  it('answers the first refusal for a body wrong in two ways', () => {
    expect(
      startEnrichmentBody({ scope: 'single', fields: ['trailer'] })
    ).toEqual({
      ok: false,
      error: 'A single-title Sync names its movie or series',
    });
  });
});

// 54 — Scan new folders, Phase 5 (issue #496): _Just what was added_ names
// its `since`, the moment the run that brought the titles in started; no
// other scope names one. The `movieId` rule's shape.
describe('startEnrichmentBody: an added Sync and its since', () => {
  const SINCE = '2026-10-01T12:00:00.000Z';

  it('reads an added Sync with its since', () => {
    const body = { ...LIBRARY, scope: 'added', since: SINCE };

    expect(startEnrichmentBody(body)).toEqual({ ok: true, value: body });
  });

  it.each([
    [
      'an added Sync with no since',
      { ...LIBRARY, scope: 'added' },
      'An added Sync names its since',
    ],
    [
      'an added Sync with an empty since',
      { ...LIBRARY, scope: 'added', since: '' },
      'An added Sync names its since',
    ],
    [
      'an Everything Sync naming a since',
      { ...LIBRARY, scope: 'all', since: SINCE },
      'Only an added Sync names a since',
    ],
    [
      'an Only what’s missing Sync naming a since',
      { ...LIBRARY, scope: 'missing', since: SINCE },
      'Only an added Sync names a since',
    ],
    [
      'a single-title Sync naming a since',
      { ...LIBRARY, scope: 'single', movieId: 'm1', since: SINCE },
      'Only an added Sync names a since',
    ],
  ])('refuses %s', (_name, body, error) => {
    expect(startEnrichmentBody(body)).toEqual({ ok: false, error });
  });
});

describe('conflictChoicesBody', () => {
  it('reads a map of field to side', () => {
    const choices = { synopsis: 'tmdb', year: 'mine' };

    expect(conflictChoicesBody({ choices })).toEqual({
      ok: true,
      value: choices,
    });
  });

  it('reads an empty map — Keep all mine by another name', () => {
    expect(conflictChoicesBody({ choices: {} })).toEqual({
      ok: true,
      value: {},
    });
  });

  it.each([
    ['no body', undefined],
    ['no choices', {}],
    ['null choices', { choices: null }],
    ['a list of choices', { choices: ['tmdb'] }],
    ['a side that is neither', { choices: { synopsis: 'theirs' } }],
  ])('refuses %s', (_name, body) => {
    expect(conflictChoicesBody(body)).toEqual({
      ok: false,
      error: 'Choices map each field to a side',
    });
  });
});

// 41 — Review at scale, Phase 6 (issue #362): _Skip all_'s body, the ids of
// the Decisions to let go — read here, each refusal a sentence.
describe('decisionIdsBody', () => {
  it('reads a list of Decision ids, in order', () => {
    expect(decisionIdsBody({ ids: ['d2', 'd1'] })).toEqual({
      ok: true,
      value: ['d2', 'd1'],
    });
  });

  it.each([
    ['no body', undefined],
    ['no ids', {}],
    ['an empty list', { ids: [] }],
    ['a string, not a list', { ids: 'd1' }],
    ['a list holding a number', { ids: ['d1', 2] }],
  ])('refuses %s in a sentence', (_, body) => {
    const read = decisionIdsBody(body);

    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.error).toMatch(/^[A-Z].*\.$/);
  });
});

// 42 — Review at scale refactor (issue #366), Group 2: a **Season choice**'s
// body is read here, so the domain is handed a string. Whether the season
// offers the path is the domain's to say.
describe('seasonPosterBody', () => {
  it('reads the TMDB path', () => {
    expect(seasonPosterBody({ path: '/s02-a.jpg' })).toEqual({
      ok: true,
      value: { path: '/s02-a.jpg' },
    });
  });

  it.each([
    ['no body', undefined],
    ['no path', {}],
    ['a null path', { path: null }],
    ['a path that is not a string', { path: 7 }],
  ])('refuses %s in a sentence', (_, body) => {
    const read = seasonPosterBody(body);

    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.error).toMatch(/^[A-Z].*\.$/);
  });
});
