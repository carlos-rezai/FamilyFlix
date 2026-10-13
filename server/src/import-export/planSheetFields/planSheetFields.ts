import type { SheetDifference, SheetField, WatchStatus } from '@/types';
import { spellYearSpan } from '../../library/series/yearSpan/yearSpan';
import type { SheetRow } from '../readSheet/readSheet';

/**
 * A held title's values in the sheet's shape: a film's or a series' fields
 * the sheet can name, its genres by name, a series' creator as `director`.
 * `status` is a film's watch state; a series reads as `unwatched`.
 */
export interface HeldValues {
  title: string;
  year: number | null;
  endYear: number | null;
  genres: string[];
  director: string | null;
  cast: string[];
  synopsis: string | null;
  rating: number | null;
  status: WatchStatus;
}

/**
 * The **Sheet fills**: each empty held field the row fills, in the row's
 * values. A series' `year` brings its `endYear` with it; `watched` is only
 * ever a mark on an unwatched film.
 */
export interface SheetFill {
  synopsis?: string;
  year?: number;
  endYear?: number;
  genres?: string[];
  director?: string;
  cast?: string[];
  rating?: number;
  watched?: true;
}

export interface SheetPlan {
  fill: SheetFill;
  differences: SheetDifference[];
}

const LABELS: Readonly<Record<SheetField, string>> = {
  synopsis: 'Synopsis',
  year: 'Year',
  genres: 'Genres',
  director: 'Director',
  cast: 'Cast',
  rating: 'Rating',
};

/**
 * A rating in half-star units spelled for reading, as stars: `5` → `★★½`,
 * `8` → `★★★★`, and `0` in words, since no stars draws nothing.
 */
const stars = (units: number): string =>
  units <= 0
    ? 'No stars'
    : `${'★'.repeat(Math.floor(units / 2))}${units % 2 === 1 ? '½' : ''}`;

/** Text as it is compared: trimmed and case-blind. */
const norm = (text: string): string => text.trim().toLowerCase();

/** A text value, or `null` when blank. */
const text = (value: string | null): string | null =>
  value === null || value.trim() === '' ? null : value.trim();

/** A list's members trimmed, the blank ones dropped. */
const members = (values: readonly string[]): string[] =>
  values.map((value) => value.trim()).filter((value) => value !== '');

const sameSet = (a: string[], b: string[]): boolean => {
  const left = new Set(a.map(norm));
  const right = new Set(b.map(norm));
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
};

/**
 * Plan what a **Sheet row** does to a title the library already holds: an
 * empty field the row fills is a **Sheet fill**; a field filled on both sides
 * that differs is a **Sheet difference**, never a fill. Text is compared
 * trimmed and case-blind, cast and genres as sets, the rating as a number,
 * a series' year as its spelled **Year range**. A film's year never differs,
 * the title is never in play, and Watched only marks an unwatched film. The
 * row's genres arrive already read onto the **Genre pool**.
 */
export function planSheetFields(
  current: HeldValues,
  row: SheetRow,
  kind: 'movie' | 'series'
): SheetPlan {
  const fill: SheetFill = {};
  const differences: SheetDifference[] = [];
  const differ = (field: SheetField, mine: string, sheet: string): void => {
    differences.push({
      field,
      label:
        field === 'director' && kind === 'series'
          ? 'Created by'
          : LABELS[field],
      mine,
      sheet,
    });
  };

  const textField = (
    field: 'synopsis' | 'director',
    mine: string | null,
    theirs: string | null
  ): void => {
    const held = text(mine);
    const sheet = text(theirs);
    if (sheet === null) {
      return;
    }
    if (held === null) {
      fill[field] = sheet;
    } else if (norm(held) !== norm(sheet)) {
      differ(field, held, sheet);
    }
  };

  const setField = (
    field: 'genres' | 'cast',
    mine: readonly string[],
    theirs: readonly string[]
  ): void => {
    const held = members(mine);
    const sheet = members(theirs);
    if (sheet.length === 0) {
      return;
    }
    if (held.length === 0) {
      fill[field] = sheet;
    } else if (!sameSet(held, sheet)) {
      differ(field, held.join(', '), sheet.join(', '));
    }
  };

  textField('synopsis', current.synopsis, row.synopsis);

  if (row.year !== null) {
    if (current.year === null) {
      fill.year = row.year;
      if (kind === 'series' && row.endYear !== null) {
        fill.endYear = row.endYear;
      }
    } else if (kind === 'series') {
      const mine = spellYearSpan(current.year, current.endYear) ?? '';
      const sheet = spellYearSpan(row.year, row.endYear) ?? '';
      if (mine !== sheet) {
        differ('year', mine, sheet);
      }
    }
  }

  setField('genres', current.genres, row.genres);
  textField('director', current.director, row.director);
  setField('cast', current.cast, row.cast);

  if (row.rating !== null) {
    if (current.rating === null) {
      fill.rating = row.rating;
    } else if (current.rating !== row.rating) {
      differ('rating', stars(current.rating), stars(row.rating));
    }
  }

  if (kind === 'movie' && row.watched && current.status === 'unwatched') {
    fill.watched = true;
  }

  return { fill, differences };
}
