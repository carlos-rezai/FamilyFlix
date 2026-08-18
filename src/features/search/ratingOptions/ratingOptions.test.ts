import { describe, it, expect, vi } from 'vitest';

import { ALL_RATINGS, ratingLabel, ratingOptions } from './ratingOptions';

/** The panel's rows in the prototype's order (`FamilyFlix.dc.html:162`). */
const RATING_ROWS = ['All ratings', '4+ stars', '3+ stars', '2+ stars'];

/** The rows paired with the minimum each one reports, in stored half-star units. */
const ROW_MINIMUMS = [
  ['All ratings', 0],
  ['4+ stars', 8],
  ['3+ stars', 6],
  ['2+ stars', 4],
] as const;

/** The options built for a given minimum, with nothing listening. */
const optionsFor = (selected?: number) =>
  ratingOptions(selected, () => undefined);

describe('ratingOptions — the rows', () => {
  it('lists “All ratings” first, then the cut-offs strongest first', () => {
    expect(optionsFor().map((option) => option.label)).toEqual(RATING_ROWS);
  });

  it('writes every cut-off in stars, so nobody has to know how a rating is stored', () => {
    // The parent reads "3+ stars"; the 6 that goes on the wire never reaches
    // the screen.
    const cutoffs = optionsFor().filter(
      (option) => option.label !== ALL_RATINGS
    );

    expect(cutoffs).toHaveLength(3);
    for (const option of cutoffs) {
      expect(option.label).toMatch(/^\d\+ stars$/);
    }
  });

  it('carries no count, unlike the genre list', () => {
    // There is no tally to put beside a cut-off — the rows are a scale, not a
    // set of shelves.
    for (const option of optionsFor()) {
      expect(option.count).toBeUndefined();
    }
  });
});

describe('ratingOptions — what choosing a row asks for', () => {
  it('reports the minimum each row stands for', () => {
    for (const [label, minimum] of ROW_MINIMUMS) {
      const onSelect = vi.fn<(minRating: number) => void>();
      const option = ratingOptions(undefined, onSelect).find(
        (candidate) => candidate.label === label
      );

      option?.onSelect();

      expect(onSelect).toHaveBeenCalledWith(minimum);
    }
  });

  it('reports nought for “All ratings”, which is what takes the filter off', () => {
    const onSelect = vi.fn<(minRating: number) => void>();

    ratingOptions(8, onSelect)[0].onSelect();

    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('tells nobody anything until a row is actually chosen', () => {
    const onSelect = vi.fn<(minRating: number) => void>();

    ratingOptions(undefined, onSelect);

    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('ratingOptions — which row reads as chosen', () => {
  it('marks “All ratings” when no minimum is set', () => {
    const selected = optionsFor().filter((option) => option.selected);

    expect(selected.map((option) => option.label)).toEqual([ALL_RATINGS]);
  });

  it('marks the row for the minimum that is set', () => {
    const selected = optionsFor(6).filter((option) => option.selected);

    expect(selected.map((option) => option.label)).toEqual(['3+ stars']);
  });

  it('marks exactly one row for every cut-off it offers', () => {
    for (const [, minimum] of ROW_MINIMUMS) {
      const chosen = ratingOptions(
        minimum === 0 ? undefined : minimum,
        () => undefined
      ).filter((option) => option.selected);

      expect(chosen).toHaveLength(1);
    }
  });

  it('falls back to “All ratings” for a minimum it has no row for', () => {
    // A URL the parser would have dropped anyway — the panel must still show
    // exactly one chosen row rather than none.
    const selected = optionsFor(7).filter((option) => option.selected);

    expect(selected.map((option) => option.label)).toEqual([ALL_RATINGS]);
  });
});

describe('ratingLabel — what the pill shows', () => {
  it('says “All ratings” when no minimum is set', () => {
    expect(ratingLabel(undefined)).toBe(ALL_RATINGS);
  });

  it('names the cut-off that is set, in stars', () => {
    expect(ratingLabel(8)).toBe('4+ stars');
    expect(ratingLabel(6)).toBe('3+ stars');
    expect(ratingLabel(4)).toBe('2+ stars');
  });

  it('says “All ratings” for a minimum it has no words for', () => {
    // The pill can never fall back to showing a number.
    expect(ratingLabel(7)).toBe(ALL_RATINGS);
    expect(ratingLabel(0)).toBe(ALL_RATINGS);
  });

  it('agrees with the row the panel marks as chosen', () => {
    for (const [label, minimum] of ROW_MINIMUMS) {
      expect(ratingLabel(minimum === 0 ? undefined : minimum)).toBe(label);
    }
  });
});

describe('ratingOptions — purity', () => {
  it('builds the same rows every time it is asked', () => {
    expect(optionsFor(6).map((option) => option.label)).toEqual(
      optionsFor(8).map((option) => option.label)
    );
  });

  it('hands back a list a caller can sort without changing the next one', () => {
    optionsFor().reverse();

    expect(optionsFor().map((option) => option.label)).toEqual(RATING_ROWS);
  });
});
