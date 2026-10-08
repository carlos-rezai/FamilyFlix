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

import { describe, expect, it } from 'vitest';

import { yearSpan } from './yearSpan';

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
