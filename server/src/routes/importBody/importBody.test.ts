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

import { IMPORT_MODES, SCAN_SCOPES, SHEET_FIELDS } from '@/types';
import {
  folderScanBody,
  importStartBody,
  pickFolderBody,
  problemIdsBody,
  sheetChoicesBody,
} from './importBody';

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

// 40 — Import review, Phase 4: "the Folder picker" (issue #334).
//
// `POST /api/import/current/problems/:id/pick { folder }` reads its body the
// same way: `folder` is the **Candidate folder** pressed, a non-empty string.
// Whether it is one of the Problem's candidates is the domain's to say.

describe('pickFolderBody: what it reads', () => {
  it('reads the folder pressed', () => {
    expect(pickFolderBody({ folder: '/films/Die Hard (1988)' })).toEqual({
      ok: true,
      value: '/films/Die Hard (1988)',
    });
  });

  it('carries nothing the body said beyond the folder', () => {
    expect(pickFolderBody({ folder: '/films/Heat', extra: 1 })).toEqual({
      ok: true,
      value: '/films/Heat',
    });
  });
});

describe('pickFolderBody: what it refuses, each in a sentence', () => {
  it.each([
    ['no body', undefined],
    ['a body that is not an object', 'folder=/films/Heat'],
    ['no folder', {}],
    ['a null folder', { folder: null }],
    ['an empty folder', { folder: '' }],
    ['a folder of spaces', { folder: '   ' }],
    ['a folder that is a number', { folder: 7 }],
    ['a list of folders', { folder: ['/films/Heat'] }],
  ])('refuses %s', (_name, body) => {
    const read = pickFolderBody(body);

    expect(read.ok).toBe(false);
    expect(!read.ok && read.error).toMatch(SENTENCE);
  });
});

// 41 — Link or copy, Slice 3: "a linked film plays" (issue #343).
//
// `POST /api/library-folders/scan { enrich, mode }` and `POST /api/import
// { sheetPath, enrich, mode }` read those two fields here, one read for both
// starts: `enrich` true only when it is `true`,
// as before, and `mode` one of **IMPORT_MODES** — a missing or unknown mode
// refused in a sentence.
describe('importStartBody: the Import mode', () => {
  it('names the two modes, Link first', () => {
    expect(IMPORT_MODES).toEqual(['link', 'copy']);
  });

  it.each(['link', 'copy'] as const)('reads mode %s', (mode) => {
    expect(importStartBody({ enrich: false, mode })).toEqual({
      ok: true,
      value: { enrich: false, mode },
    });
  });

  it('reads enrich true', () => {
    expect(importStartBody({ enrich: true, mode: 'link' })).toEqual({
      ok: true,
      value: { enrich: true, mode: 'link' },
    });
  });

  it.each([
    ['missing', { mode: 'copy' }],
    ['a string', { enrich: 'true', mode: 'copy' }],
    ['a number', { enrich: 1, mode: 'copy' }],
  ])('reads enrich false when it is %s', (_name, body) => {
    expect(importStartBody(body)).toEqual({
      ok: true,
      value: { enrich: false, mode: 'copy' },
    });
  });

  it.each([
    ['no body', undefined],
    ['no mode', { enrich: false }],
    ['a null mode', { enrich: false, mode: null }],
    ['an unknown mode', { enrich: false, mode: 'move' }],
    ['a mode in capitals', { enrich: false, mode: 'Link' }],
    ['a mode that is not a string', { enrich: false, mode: 1 }],
  ])('refuses %s in a sentence', (_name, body) => {
    const read = importStartBody(body);

    expect(read.ok).toBe(false);
    expect(!read.ok && read.error).toMatch(SENTENCE);
  });
});

// 42 — Review at scale refactor (issue #366): the bulk presses' body, one line
// over `idListBody` — its refusals are that reader's suite; this is the
// sentence the Review step's routes answer in.
describe('problemIdsBody', () => {
  it('reads a list of Problem ids, and refuses anything else in its sentence', () => {
    expect(problemIdsBody({ ids: ['p2', 'p1'] })).toEqual({
      ok: true,
      value: ['p2', 'p1'],
    });
    expect(problemIdsBody({ ids: [] })).toEqual({
      ok: false,
      error: 'Ids must be a list of problem ids.',
    });
  });
});

// 54, Scan new folders, Phase 4 (issue #495): the **Scan scope**.
// `POST /api/library-folders/scan { enrich, mode, scope }` reads its three
// fields through `folderScanBody`: `enrich` and `mode` as `importStartBody`
// reads them, and `scope` one of **SCAN_SCOPES**, required: a missing or
// unknown one refused with _Scope must be new or all._
describe('folderScanBody: the Scan scope', () => {
  it('names the two scopes, new first', () => {
    expect(SCAN_SCOPES).toEqual(['new', 'all']);
  });

  it.each(['new', 'all'] as const)(
    'reads scope %s with enrich and mode',
    (scope) => {
      expect(folderScanBody({ enrich: true, mode: 'copy', scope })).toEqual({
        ok: true,
        value: { enrich: true, mode: 'copy', scope },
      });
    }
  );

  it('reads enrich false when it is not true', () => {
    expect(
      folderScanBody({ enrich: 'true', mode: 'link', scope: 'new' })
    ).toEqual({
      ok: true,
      value: { enrich: false, mode: 'link', scope: 'new' },
    });
  });

  it.each([
    ['no scope', { enrich: false, mode: 'link' }],
    ['a null scope', { enrich: false, mode: 'link', scope: null }],
    ['an unknown scope', { enrich: false, mode: 'link', scope: 'added' }],
    ['a scope in capitals', { enrich: false, mode: 'link', scope: 'New' }],
  ])('refuses %s with its sentence', (_name, body) => {
    expect(folderScanBody(body)).toEqual({
      ok: false,
      error: 'Scope must be new or all.',
    });
  });

  it.each([
    ['no mode', { enrich: false, scope: 'all' }],
    ['an unknown mode', { enrich: false, mode: 'move', scope: 'new' }],
  ])('refuses %s as importStartBody refuses it', (_name, body) => {
    expect(folderScanBody(body)).toEqual(importStartBody(body));
    expect(folderScanBody(body)).toEqual({
      ok: false,
      error: 'Mode must be link or copy.',
    });
  });
});
