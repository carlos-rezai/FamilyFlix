import { describe, it, expect } from 'vitest';

import { spellYearSpan } from './spellYearSpan';

/**
 * 38 — Title editing, the refactor (issue 311): the **Year range** spelled
 * once on the client, for the series page and the Series edit job alike.
 */
describe('spellYearSpan', () => {
  it('writes a run inside one year as the year alone', () => {
    expect(spellYearSpan(2022, 2022)).toBe('2022');
  });

  it('writes a finished run with both ends', () => {
    expect(spellYearSpan(2019, 2023)).toBe('2019–2023');
  });

  it('writes a run still open with its dash and no end', () => {
    expect(spellYearSpan(2021, null)).toBe('2021–');
  });

  it('writes nothing without a year', () => {
    expect(spellYearSpan(null, null)).toBeNull();
    expect(spellYearSpan(null, 2023)).toBeNull();
  });
});
