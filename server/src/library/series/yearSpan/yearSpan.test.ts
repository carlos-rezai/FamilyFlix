// @vitest-environment node
//
// 29 — Add a series, Phase 3 (issue #263): `yearSpan`, the one reader of a
// series' **Year range**.
//
// Extracted from `readSheet`'s private `cellYears`, so the sheet and the
// series route read a year the same way: text in, `{ year, endYear }` out, or
// `null` for anything it cannot read. A lone year is a span of one; an open
// span — a show still running — has no end. `readSheet`'s own year cases are
// left exactly as they are, and still pass through it.
//
// 31 — Export options refactor (issue 283): `spellYearSpan`, its writer, beside
// it on `spellEpisodeTag`'s precedent — `exportRows`' private `yearRange`
// moved here — and the round trip: every spelling reads back as its span.

import { describe, expect, it } from 'vitest';

import { spellYearSpan, yearSpan } from './yearSpan';

describe('yearSpan', () => {
  it('reads a lone year as a span of one', () => {
    expect(yearSpan('2019')).toEqual({ year: 2019, endYear: 2019 });
  });

  it('reads a span written with an en dash', () => {
    expect(yearSpan('2019–2023')).toEqual({ year: 2019, endYear: 2023 });
  });

  it('reads a span written with a hyphen', () => {
    expect(yearSpan('2019-2023')).toEqual({ year: 2019, endYear: 2023 });
  });

  it('reads an open span as a start with no end', () => {
    expect(yearSpan('2021–')).toEqual({ year: 2021, endYear: null });
    expect(yearSpan('2021-')).toEqual({ year: 2021, endYear: null });
  });

  it.each([
    [''],
    ['abc'],
    ['19'],
    ['20190'],
    ['2019–23'],
    ['–2023'],
    ['2019–2023–'],
  ])('answers null for %j', (text) => {
    expect(yearSpan(text)).toBeNull();
  });
});

describe('spellYearSpan', () => {
  it('spells a run of one year as the lone year', () => {
    expect(spellYearSpan(2022, 2022)).toBe('2022');
  });

  it('spells a finished run with an en dash', () => {
    expect(spellYearSpan(2019, 2023)).toBe('2019–2023');
  });

  it('spells an open run as its start and the dash', () => {
    expect(spellYearSpan(2021, null)).toBe('2021–');
  });

  it('spells nothing with no year', () => {
    expect(spellYearSpan(null, null)).toBeNull();
    expect(spellYearSpan(null, 2023)).toBeNull();
  });

  it.each([
    [{ year: 2022, endYear: 2022 }],
    [{ year: 2019, endYear: 2023 }],
    [{ year: 2021, endYear: null }],
  ])('reads back through yearSpan as the span it came from: %j', (span) => {
    const spelled = spellYearSpan(span.year, span.endYear);

    expect(spelled).not.toBeNull();
    expect(yearSpan(spelled ?? '')).toEqual(span);
  });
});
