import { describe, it, expect } from 'vitest';

import { parseMinRating, RATING_CUTOFFS } from './parseMinRating';

describe('RATING_CUTOFFS', () => {
  it('knows the three cut-offs the rating filter offers, strongest first', () => {
    // Ratings are stored in 0–10 half-star units, so "4+ stars" is 8. The
    // dropdown writes one of these three or nothing at all.
    expect(RATING_CUTOFFS).toEqual([8, 6, 4]);
  });
});

describe('parseMinRating — a cut-off the control can produce', () => {
  it('reads every offered cut-off back as its number', () => {
    for (const cutoff of RATING_CUTOFFS) {
      expect(parseMinRating(String(cutoff))).toBe(cutoff);
    }
  });
});

describe('parseMinRating — the absence of a minimum', () => {
  it('reads an absent parameter as no minimum', () => {
    expect(parseMinRating(null)).toBeUndefined();
  });

  it('reads an empty value as no minimum, the way an empty “q” is no search', () => {
    expect(parseMinRating('')).toBeUndefined();
  });

  it('reads “0” as no minimum rather than a minimum of nought', () => {
    // "All ratings" is the absence of the filter. A literal minimum of zero
    // would exclude every unrated movie, which is the opposite of what the
    // words on the row promise.
    expect(parseMinRating('0')).toBeUndefined();
  });
});

describe('parseMinRating — a stale or hand-edited URL', () => {
  it('drops a value that is not a number at all', () => {
    expect(parseMinRating('four stars')).toBeUndefined();
  });

  it('drops a negative minimum', () => {
    expect(parseMinRating('-1')).toBeUndefined();
  });

  it('drops a minimum above the top of the scale', () => {
    // Ten is five stars; there is nothing beyond it to ask for.
    expect(parseMinRating('11')).toBeUndefined();
  });

  it('drops a number the dropdown has no row for', () => {
    // In range, but not a cut-off this control can produce — and the pill has
    // no words for it, so honouring it would filter the library behind a pill
    // that said "All ratings".
    expect(parseMinRating('7')).toBeUndefined();
  });

  it('drops a fractional value, since a rating is a whole half-star unit', () => {
    expect(parseMinRating('4.5')).toBeUndefined();
  });

  it('drops a blank-looking value rather than reading it as nought', () => {
    expect(parseMinRating('   ')).toBeUndefined();
  });
});
