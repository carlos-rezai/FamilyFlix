// @vitest-environment node
//
// 40 — Import review refactor (issue #336), Group 3: a Sheet fill becomes its
// columns in one unit, `plannedEnrichment`'s twin on the import's side.
//
// `plannedSheetFill` is pure: a **Sheet fill** → the patch `updateMovie`
// writes on a held film, or the columns `enrichSeries` writes on a held
// series — its creator in the director's place, its rating left for
// `setSeriesRating` — and _Apply choices_' fill: the sheet's side of each
// **Sheet difference** chosen `sheet`. Watched is a mark, never a column.

import { describe, expect, it } from 'vitest';

import type { SheetFill } from '../planSheetFields/planSheetFields';
import {
  chosenSheetFill,
  movieSheetPatch,
  seriesSheetPatch,
} from './plannedSheetFill';

const FULL: SheetFill = {
  synopsis: 'A ferry crew keeps the town afloat.',
  year: 2018,
  endYear: 2021,
  genres: ['Drama'],
  director: 'Ines Duarte',
  cast: ['Ada Brennan', 'Tomas Ekholm'],
  rating: 7,
  watched: true,
};

describe('movieSheetPatch: a held film', () => {
  it('writes every field the fill names, its rating among them', () => {
    expect(movieSheetPatch(FULL)).toEqual({
      synopsis: 'A ferry crew keeps the town afloat.',
      year: 2018,
      genres: ['Drama'],
      director: 'Ines Duarte',
      cast: ['Ada Brennan', 'Tomas Ekholm'],
      rating: 7,
    });
  });

  it('writes a rating of 0 — a number, not a blank', () => {
    expect(movieSheetPatch({ rating: 0 })).toEqual({ rating: 0 });
  });

  it('writes nothing from an empty fill, nor from Watched alone', () => {
    expect(movieSheetPatch({})).toEqual({});
    expect(movieSheetPatch({ watched: true })).toEqual({});
  });
});

describe('seriesSheetPatch: a held series', () => {
  it('writes its creator where a director stands, its range whole, and no rating', () => {
    expect(seriesSheetPatch(FULL)).toEqual({
      synopsis: 'A ferry crew keeps the town afloat.',
      year: 2018,
      endYear: 2021,
      genres: ['Drama'],
      creator: 'Ines Duarte',
      cast: ['Ada Brennan', 'Tomas Ekholm'],
    });
  });

  it('writes nothing from an empty fill, nor from a rating alone', () => {
    expect(seriesSheetPatch({})).toEqual({});
    expect(seriesSheetPatch({ rating: 7 })).toEqual({});
  });
});

describe('chosenSheetFill: Apply choices', () => {
  const PROPOSED: SheetFill = {
    synopsis: 'A ferry crew keeps the town afloat.',
    year: 2019,
    endYear: 2024,
    director: 'Ines Duarte',
    cast: ['Ada Brennan'],
    rating: 0,
  };

  it('takes the sheet’s side of every field chosen sheet, a year with its end', () => {
    expect(
      chosenSheetFill(PROPOSED, {
        synopsis: 'sheet',
        year: 'sheet',
        director: 'sheet',
        cast: 'sheet',
        rating: 'sheet',
      })
    ).toEqual(PROPOSED);
  });

  it('carries an open run’s cleared end year with its year', () => {
    expect(
      chosenSheetFill({ year: 2021, endYear: null }, { year: 'sheet' })
    ).toEqual({ year: 2021, endYear: null });
    expect(seriesSheetPatch({ year: 2021, endYear: null })).toEqual({
      year: 2021,
      endYear: null,
    });
  });

  it('writes nothing for a field chosen mine', () => {
    expect(
      chosenSheetFill(PROPOSED, { synopsis: 'mine', director: 'sheet' })
    ).toEqual({ director: 'Ines Duarte' });
  });

  it('writes nothing for a field the choices do not name', () => {
    expect(chosenSheetFill(PROPOSED, { cast: 'sheet' })).toEqual({
      cast: ['Ada Brennan'],
    });
  });

  it('writes nothing for a field chosen sheet that was never proposed', () => {
    expect(
      chosenSheetFill({ synopsis: 'A ferry.' }, { genres: 'sheet' })
    ).toEqual({});
  });

  it('takes an open run’s start year alone', () => {
    expect(chosenSheetFill({ year: 2021 }, { year: 'sheet' })).toEqual({
      year: 2021,
    });
  });
});
