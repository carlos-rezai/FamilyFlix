// @vitest-environment node
//
// 40 — Import review, Phase 3: "Sheet differences" (issue #333).
//
// `POST /api/import/current/problems/:id/apply { choices }` reads its own body
// before the domain is called, `enrichmentBody`'s precedent: a pure function
// answers the refusal rather than sending it, so each `400`'s sentence is
// asserted here as a value. `choices` is a **SheetChoices** — a partial
// record of **Sheet field** to `'mine' | 'sheet'`. Whether the Problem is
// there is the domain's to say.

import { describe, expect, it } from 'vitest';

import { SHEET_FIELDS } from '@/types';
import { sheetChoicesBody } from './importBody';

describe('sheetChoicesBody: what it reads', () => {
  it('reads a map of field to side', () => {
    const choices = { director: 'sheet', rating: 'mine' };

    expect(sheetChoicesBody({ choices })).toEqual({ ok: true, value: choices });
  });

  it('reads every Sheet field', () => {
    const choices = Object.fromEntries(
      SHEET_FIELDS.map((field) => [field, 'sheet'])
    );

    expect(sheetChoicesBody({ choices })).toEqual({ ok: true, value: choices });
  });

  it('reads an empty map — Keep all mine by another name', () => {
    expect(sheetChoicesBody({ choices: {} })).toEqual({ ok: true, value: {} });
  });

  it('carries nothing the body said beyond the choices', () => {
    const read = sheetChoicesBody({ choices: { year: 'mine' }, extra: 1 });

    expect(read).toEqual({ ok: true, value: { year: 'mine' } });
  });
});

/** A refusal is one sentence: a capital, words, and a full stop. */
const SENTENCE = /^[A-Z][^\n]*\.$/;

describe('sheetChoicesBody: what it refuses, each in a sentence', () => {
  it.each([
    ['no body', undefined],
    ['a body that is not an object', 'director=sheet'],
    ['no choices', {}],
    ['null choices', { choices: null }],
    ['a list of choices', { choices: ['sheet'] }],
    ['choices that are a string', { choices: 'sheet' }],
  ])('refuses %s', (_name, body) => {
    const read = sheetChoicesBody(body);

    expect(read.ok).toBe(false);
    expect(!read.ok && read.error).toMatch(SENTENCE);
  });

  it('refuses a side that is neither mine nor sheet, naming the field', () => {
    const read = sheetChoicesBody({ choices: { director: 'theirs' } });

    expect(read.ok).toBe(false);
    expect(!read.ok && read.error).toMatch(SENTENCE);
    expect(!read.ok && read.error).toContain('director');
  });

  it('refuses TMDB’s side: the spreadsheet is the other side here', () => {
    const read = sheetChoicesBody({ choices: { synopsis: 'tmdb' } });

    expect(read.ok).toBe(false);
    expect(!read.ok && read.error).toMatch(SENTENCE);
  });

  it.each([
    ['the title, which is never in play', 'title'],
    ['watched, which only ever marks', 'watched'],
    ['a field that does not exist', 'colour'],
  ])('refuses %s, naming it', (_name, field) => {
    const read = sheetChoicesBody({ choices: { [field]: 'sheet' } });

    expect(read.ok).toBe(false);
    expect(!read.ok && read.error).toMatch(SENTENCE);
    expect(!read.ok && read.error).toContain(field);
  });

  it('refuses the whole body for one bad entry among good ones', () => {
    const read = sheetChoicesBody({
      choices: { director: 'sheet', rating: 'both' },
    });

    expect(read.ok).toBe(false);
  });

  it('tells the shapes apart: a missing map and a bad side read differently', () => {
    const missing = sheetChoicesBody({});
    const side = sheetChoicesBody({ choices: { director: 'theirs' } });
    const field = sheetChoicesBody({ choices: { colour: 'sheet' } });

    const errors = [missing, side, field].map((read) =>
      read.ok ? null : read.error
    );
    expect(new Set(errors).size).toBe(3);
  });
});
