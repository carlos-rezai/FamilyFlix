// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { spellYearSpan } from './spellYearSpan';
import { yearSpan } from '../../../server/src/library/series/yearSpan/yearSpan';

/**
 * 38 — Title editing, the refactor (issue 311): the round-trip guard, on the
 * `readEpisodeTag` drift guard's precedent.
 *
 * The **Year range** is written on the client — the series page's label, the
 * Series edit job's field — and read on the server by `yearSpan`, which the
 * series save reads the field through. They stay two functions, so this one
 * table holds them together: every span the client writes reads back as
 * itself. The two once disagreed: an open run went out as a lone year, which
 * the server reads as a finished one.
 */
const SPANS: readonly (readonly [number, number | null])[] = [
  [2022, 2022],
  [2019, 2023],
  [2021, null],
  [1999, 2000],
];

describe('spellYearSpan ↔ yearSpan', () => {
  it.each(SPANS)(
    'reads %i–%s back as the span it was written from',
    (year, endYear) => {
      const text = spellYearSpan(year, endYear);

      expect(text).not.toBeNull();
      expect(yearSpan(text as string)).toEqual({ year, endYear });
    }
  );
});
