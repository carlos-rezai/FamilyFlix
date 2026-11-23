import { describe, it, expect, vi } from 'vitest';

import { genreLabel, genreOptions, type GenreSelection } from './genreOptions';
import type { GenreListPayload } from '@/types';

/**
 * 73, Header fit, Phase 2 (issue #695): the Genre dropdown's rows. Two
 * **View rows** lead, _All Genres_ (**By genre**) and the tab's _All_ row
 * (**All**), both carrying the list total; then every genre, busiest first,
 * A to Z on a tie. Exactly one row is checked: the chosen genre's, else the
 * **View row** of the tab's **Row view**.
 */

/**
 * A list whose counts are deliberately not alphabetical, and which holds a tie
 * — so neither the order the route sent nor a plain name sort can pass by
 * accident.
 */
const GENRES: GenreListPayload = {
  total: 24,
  genres: [
    { id: 'g1', name: 'Action', count: 9 },
    { id: 'g2', name: 'Comedy', count: 4 },
    { id: 'g3', name: 'Drama', count: 12 },
    { id: 'g4', name: 'Adventure', count: 4 },
  ],
};

const EMPTY: GenreListPayload = { total: 0, genres: [] };

const BY_GENRE: GenreSelection = { rowView: 'genre' };
const ALL: GenreSelection = { rowView: 'all' };

const noop = () => undefined;

/** The rows as the panel draws them, top to bottom. */
const labelsOf = (
  list: GenreListPayload,
  selection: GenreSelection = BY_GENRE,
  allTitles = 'All movies'
) =>
  genreOptions(list, selection, allTitles, noop).map((option) => option.label);

/** The labels of the checked rows. */
const checkedOf = (selection: GenreSelection, allTitles = 'All movies') =>
  genreOptions(GENRES, selection, allTitles, noop)
    .filter((option) => option.selected)
    .map((option) => option.label);

describe('genreOptions: the order of the list', () => {
  it('leads with “All Genres”, then the tab’s All row, then the genres by count', () => {
    expect(labelsOf(GENRES)).toEqual([
      'All Genres',
      'All movies',
      'Drama',
      'Action',
      'Adventure',
      'Comedy',
    ]);
  });

  it('names the All row for the Series tab with the words it is handed', () => {
    expect(labelsOf(GENRES, BY_GENRE, 'All series').slice(0, 2)).toEqual([
      'All Genres',
      'All series',
    ]);
  });

  it('keeps the View rows first whichever row is checked', () => {
    expect(labelsOf(GENRES, { genre: 'Comedy' }).slice(0, 2)).toEqual([
      'All Genres',
      'All movies',
    ]);
    expect(labelsOf(GENRES, ALL).slice(0, 2)).toEqual([
      'All Genres',
      'All movies',
    ]);
  });

  it('breaks a tie alphabetically', () => {
    // Adventure and Comedy both hold 4; the list has to be stable enough to
    // learn, so the tie is settled by name rather than by the route's order.
    expect(labelsOf(GENRES).slice(4)).toEqual(['Adventure', 'Comedy']);
  });

  it('leaves the list it was handed untouched', () => {
    const original = GENRES.genres.map((genre) => genre.name);

    genreOptions(GENRES, BY_GENRE, 'All movies', noop);

    expect(GENRES.genres.map((genre) => genre.name)).toEqual(original);
  });
});

describe('genreOptions: the counts', () => {
  it.each(['All movies', 'All series'])(
    'gives both View rows the list total, not the sum of the genres (%s)',
    (allTitles) => {
      // Summing would double-count every title tagged twice; 9 + 4 + 12 + 4
      // is 29, and the library holds 24.
      const [allGenres, allRow] = genreOptions(
        GENRES,
        BY_GENRE,
        allTitles,
        noop
      );

      expect(allGenres.count).toBe(24);
      expect(allRow.count).toBe(24);
    }
  );

  it('gives every genre its own count', () => {
    const counts = new Map(
      genreOptions(GENRES, BY_GENRE, 'All movies', noop).map((option) => [
        option.label,
        option.count,
      ])
    );

    expect(counts.get('Drama')).toBe(12);
    expect(counts.get('Action')).toBe(9);
    expect(counts.get('Comedy')).toBe(4);
  });

  it('shows a zero library as zero on both View rows', () => {
    const [allGenres, allRow] = genreOptions(
      EMPTY,
      BY_GENRE,
      'All movies',
      noop
    );

    expect(allGenres.count).toBe(0);
    expect(allRow.count).toBe(0);
  });
});

describe('genreOptions: which row is checked', () => {
  it('checks the chosen genre alone', () => {
    expect(checkedOf({ genre: 'Action' })).toEqual(['Action']);
  });

  it('checks “All Genres” alone under By genre', () => {
    expect(checkedOf(BY_GENRE)).toEqual(['All Genres']);
  });

  it('checks the tab’s All row alone under All', () => {
    expect(checkedOf(ALL)).toEqual(['All movies']);
    expect(checkedOf(ALL, 'All series')).toEqual(['All series']);
  });
});

describe('genreOptions: an empty list', () => {
  it('still offers both View rows, so the dropdown is never empty', () => {
    expect(labelsOf(EMPTY)).toEqual(['All Genres', 'All movies']);
  });

  it('offers them whatever the URL is carrying', () => {
    // The shape a failed genre list leaves behind: the genres are gone but
    // the View rows are still there to press.
    expect(labelsOf(EMPTY, { genre: 'Action' }, 'All series')).toEqual([
      'All Genres',
      'All series',
    ]);
  });
});

describe('genreOptions: choosing a row', () => {
  function chooseRow(label: string, selection: GenreSelection = BY_GENRE) {
    const onSelect = vi.fn<(selection: GenreSelection) => void>();
    genreOptions(GENRES, selection, 'All movies', onSelect)
      .find((option) => option.label === label)
      ?.onSelect();
    return onSelect;
  }

  it('reports By genre for “All Genres”', () => {
    expect(chooseRow('All Genres', { genre: 'Drama' })).toHaveBeenCalledWith({
      rowView: 'genre',
    });
  });

  it('reports All for the tab’s All row', () => {
    expect(chooseRow('All movies')).toHaveBeenCalledWith({ rowView: 'all' });
  });

  it('reports the genre’s name for a genre', () => {
    expect(chooseRow('Drama', ALL)).toHaveBeenCalledWith({ genre: 'Drama' });
  });

  it('reports the genre exactly as the library spells it', () => {
    const onSelect = vi.fn<(selection: GenreSelection) => void>();
    const options = genreOptions(
      { total: 3, genres: [{ id: 'g1', name: 'Science Fiction', count: 3 }] },
      BY_GENRE,
      'All movies',
      onSelect
    );

    options[2].onSelect();

    expect(onSelect).toHaveBeenCalledWith({ genre: 'Science Fiction' });
  });

  it('reports nothing until a row is actually chosen', () => {
    const onSelect = vi.fn<(selection: GenreSelection) => void>();

    genreOptions(GENRES, BY_GENRE, 'All movies', onSelect);

    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('genreLabel', () => {
  it('answers the genre for a chosen genre', () => {
    expect(genreLabel({ genre: 'Drama' }, 'All movies')).toBe('Drama');
  });

  it('answers “All Genres” under By genre', () => {
    expect(genreLabel(BY_GENRE, 'All movies')).toBe('All Genres');
    expect(genreLabel(BY_GENRE, 'All series')).toBe('All Genres');
  });

  it('answers the tab’s All words under All', () => {
    expect(genreLabel(ALL, 'All movies')).toBe('All movies');
    expect(genreLabel(ALL, 'All series')).toBe('All series');
  });
});
