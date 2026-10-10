// @vitest-environment node
//
// 31 — Export options, Phase 1: "the tracer" (issue #276).
//
// The **Export name**: a date in, `familyflix-collection_DD-MM-YYYY` out — the
// one place the name is spelled, with the clock injected so a test can stand
// on any day. The date is the maintainer's own, read in local time, because
// the folder is named for the day they pressed the button on.

import { describe, expect, it } from 'vitest';

import { EXPORT_NAME_PREFIX } from '@/types';
import { exportName, exportNameRefusal } from './exportName';

describe('exportName — the prefix', () => {
  it('spells the prefix once, in the shared types', () => {
    expect(EXPORT_NAME_PREFIX).toBe('familyflix-collection');
  });

  it('carries the prefix, then an underscore, then the date', () => {
    expect(exportName(new Date(2026, 9, 8, 12, 0))).toBe(
      'familyflix-collection_08-10-2026'
    );
  });
});

describe('exportName — the date', () => {
  it('zero-pads a single-digit day and month', () => {
    expect(exportName(new Date(2026, 0, 5, 12, 0))).toBe(
      'familyflix-collection_05-01-2026'
    );
  });

  it('leaves a two-digit day and month as they are', () => {
    expect(exportName(new Date(2025, 11, 31, 12, 0))).toBe(
      'familyflix-collection_31-12-2025'
    );
  });

  it('reads the local date, not the UTC one, just after midnight', () => {
    expect(exportName(new Date(2026, 2, 1, 0, 15))).toBe(
      'familyflix-collection_01-03-2026'
    );
  });

  it('reads the local date, not the UTC one, just before midnight', () => {
    expect(exportName(new Date(2026, 2, 1, 23, 45))).toBe(
      'familyflix-collection_01-03-2026'
    );
  });
});

// 36 — Export name (issue #295).
//
// `exportNameRefusal(name)` — the reader beside the writer, `yearSpan`'s and
// `episodeTag`'s precedent: what Windows would refuse to call a folder, on
// every platform, as one kind, or `null` for a name it takes. Nothing is ever
// stripped or trimmed — this check is the only thing between the typed string
// and the `join` under the destination, so it answers the name as typed.

describe('exportNameRefusal — names it takes', () => {
  it.each([
    ['the dated name', 'familyflix-collection_08-10-2026'],
    ['a name with a year, a dash and spaces', 'Heat (1995) – kopia'],
    ['a name of exactly 200 characters', 'a'.repeat(200)],
    ['a name that only begins like a reserved one', 'CONSOLE'],
    ['a reserved word inside a longer name', 'my con'],
    ['a dot inside the name', 'backup.2026'],
    ['a leading space', ' family'],
  ])('takes %s', (_, name) => {
    expect(exportNameRefusal(name)).toBeNull();
  });
});

describe('exportNameRefusal — unnamed', () => {
  it.each([
    ['the empty string', ''],
    ['a single space', ' '],
    ['spaces and a tab', '  \t '],
  ])('refuses %s as unnamed', (_, name) => {
    expect(exportNameRefusal(name)).toBe('unnamed');
  });
});

describe('exportNameRefusal — too-long', () => {
  it('refuses 201 characters as too-long', () => {
    expect(exportNameRefusal('a'.repeat(201))).toBe('too-long');
  });
});

describe('exportNameRefusal — bad-character', () => {
  it.each([
    ['a forward slash', 'a/b'],
    ['a backspace', 'a\b'],
    ['a backslash', String.raw`a\b`],
    ['a tab', 'a\tb'],
    ['a less-than', 'a<b'],
    ['a greater-than', 'a>b'],
    ['a colon', 'a:b'],
    ['a double quote', 'a"b'],
    ['a pipe', 'a|b'],
    ['a question mark', 'a?b'],
    ['an asterisk', 'a*b'],
    ['a NUL', 'a\u0000b'],
    ['a unit separator', 'a\u001fb'],
  ])('refuses %s as bad-character', (_, name) => {
    expect(exportNameRefusal(name)).toBe('bad-character');
  });
});

describe('exportNameRefusal — bad-ending', () => {
  it.each([
    ['a lone dot', '.'],
    ['two dots', '..'],
    ['a trailing dot', 'family.'],
    ['a trailing space', 'family '],
  ])('refuses %s as bad-ending', (_, name) => {
    expect(exportNameRefusal(name)).toBe('bad-ending');
  });
});

describe('exportNameRefusal — reserved', () => {
  it.each([
    ['con.txt', 'con.txt'],
    ['Lpt9', 'Lpt9'],
    ['CON', 'CON'],
    ['prn', 'prn'],
    ['Aux', 'Aux'],
    ['NUL', 'NUL'],
    ['COM1', 'COM1'],
    ['com9', 'com9'],
    ['LPT1', 'LPT1'],
    ['nul.tar.gz', 'nul.tar.gz'],
  ])('refuses %s as reserved', (_, name) => {
    expect(exportNameRefusal(name)).toBe('reserved');
  });
});

describe('exportNameRefusal — the kinds in their order', () => {
  it('answers unnamed ahead of too-long for 201 spaces', () => {
    expect(exportNameRefusal(' '.repeat(201))).toBe('unnamed');
  });

  it('answers too-long ahead of bad-character', () => {
    expect(exportNameRefusal(`${'a'.repeat(200)}/`)).toBe('too-long');
  });

  it('answers bad-character ahead of bad-ending', () => {
    expect(exportNameRefusal('a/b.')).toBe('bad-character');
  });

  it('answers bad-character ahead of reserved', () => {
    expect(exportNameRefusal('con:')).toBe('bad-character');
  });

  it('answers bad-ending ahead of reserved', () => {
    expect(exportNameRefusal('con.')).toBe('bad-ending');
  });
});
