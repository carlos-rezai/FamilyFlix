// @vitest-environment node
//
// 42 — Review at scale refactor (issue #366), Group 2: the route layer's one
// reader of a bulk press's id list, which `importBody` and `enrichmentBody`
// each word their own refusal over.

import { describe, expect, it } from 'vitest';

import { idListBody } from './idListBody';

const SENTENCE = 'Ids must be a list of row ids.';

describe('idListBody', () => {
  it('reads a list of ids, in order', () => {
    expect(idListBody({ ids: ['b', 'a'] }, SENTENCE)).toEqual({
      ok: true,
      value: ['b', 'a'],
    });
  });

  it.each([
    ['a missing body', undefined],
    ['a body with no ids', {}],
    ['ids that are not a list', { ids: 'a' }],
    ['an empty list', { ids: [] }],
    ['a list holding a non-string', { ids: ['a', 2] }],
  ])('refuses %s in the caller’s sentence', (_, body) => {
    expect(idListBody(body, SENTENCE)).toEqual({
      ok: false,
      error: SENTENCE,
    });
  });
});
