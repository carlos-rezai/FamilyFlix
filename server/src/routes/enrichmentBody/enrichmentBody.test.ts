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
import { conflictChoicesBody, startEnrichmentBody } from './enrichmentBody';

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
      'A single-title Sync names its movie',
    ],
    [
      'a single Sync with an empty movie id',
      { ...LIBRARY, scope: 'single', movieId: '' },
      'A single-title Sync names its movie',
    ],
    [
      'a library Sync naming a movie',
      { ...LIBRARY, movieId: 'm1' },
      'Only a single-title Sync names a movie',
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
    ).toEqual({ ok: false, error: 'A single-title Sync names its movie' });
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
