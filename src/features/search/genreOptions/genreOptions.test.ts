import { describe, it, expect, vi } from 'vitest';

import { genreOptions } from './genreOptions';
import type { GenreListPayload } from '@/types';

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

const noop = () => undefined;

/** The rows as the panel draws them, top to bottom. */
const labelsOf = (list: GenreListPayload, selected?: string) =>
  genreOptions(list, selected, noop).map((option) => option.label);

describe('genreOptions — the order of the list', () => {
  it('puts “All Genres” first, whatever the counts are', () => {
    // The way out of a filter is always the first thing under the finger.
    expect(labelsOf(GENRES)[0]).toBe('All Genres');
  });

  it('orders the genres by count, most first', () => {
    expect(labelsOf(GENRES)).toEqual([
      'All Genres',
      'Drama',
      'Action',
      'Adventure',
      'Comedy',
    ]);
  });

  it('breaks a tie alphabetically', () => {
    // Adventure and Comedy both hold 4; the list has to be stable enough to
    // learn, so the tie is settled by name rather than by the order the route
    // happened to send them in.
    expect(labelsOf(GENRES).slice(3)).toEqual(['Adventure', 'Comedy']);
  });

  it('leaves the list it was handed untouched', () => {
    const original = GENRES.genres.map((genre) => genre.name);

    genreOptions(GENRES, undefined, noop);

    expect(GENRES.genres.map((genre) => genre.name)).toEqual(original);
  });

  it('gives the same answer for the same list, every time', () => {
    expect(labelsOf(GENRES)).toEqual(labelsOf(GENRES));
  });
});

describe('genreOptions — the counts', () => {
  it('gives “All Genres” the library total, not the sum of the genres', () => {
    // Summing would double-count every movie tagged twice; 9 + 4 + 12 + 4 is
    // 29, and the library holds 24.
    const [all] = genreOptions(GENRES, undefined, noop);

    expect(all.count).toBe(24);
  });

  it('gives every genre its own count, so the panel can show it', () => {
    const counts = new Map(
      genreOptions(GENRES, undefined, noop).map((option) => [
        option.label,
        option.count,
      ])
    );

    expect(counts.get('Drama')).toBe(12);
    expect(counts.get('Action')).toBe(9);
    expect(counts.get('Comedy')).toBe(4);
  });

  it('shows a zero library as zero rather than as nothing', () => {
    const [all] = genreOptions({ total: 0, genres: [] }, undefined, noop);

    expect(all.count).toBe(0);
  });
});

describe('genreOptions — which row is ticked', () => {
  it('ticks “All Genres” when no genre is set', () => {
    const [all] = genreOptions(GENRES, undefined, noop);

    expect(all.selected).toBe(true);
  });

  it('ticks the genre the query is carrying', () => {
    const options = genreOptions(GENRES, 'Action', noop);

    expect(options.find((option) => option.label === 'Action')?.selected).toBe(
      true
    );
  });

  it('ticks exactly one row, and it is the current one', () => {
    const ticked = genreOptions(GENRES, 'Comedy', noop).filter(
      (option) => option.selected
    );

    expect(ticked.map((option) => option.label)).toEqual(['Comedy']);
  });

  it('unticks “All Genres” once a genre is chosen', () => {
    const [all] = genreOptions(GENRES, 'Action', noop);

    expect(all.selected).toBe(false);
  });
});

describe('genreOptions — an empty list', () => {
  it('still offers “All Genres”, so the dropdown is never empty', () => {
    const options = genreOptions({ total: 0, genres: [] }, undefined, noop);

    expect(options.map((option) => option.label)).toEqual(['All Genres']);
  });

  it('offers that one row whatever the URL is carrying', () => {
    // This is the shape a failed `/api/genres` leaves behind: the rows are gone
    // but the way out of the filter is still there to press.
    const options = genreOptions({ total: 0, genres: [] }, 'Action', noop);

    expect(options.map((option) => option.label)).toEqual(['All Genres']);
  });
});

describe('genreOptions — choosing a row', () => {
  it('reports the genre’s name when a genre is chosen', () => {
    const onSelect = vi.fn<(genre: string) => void>();
    const options = genreOptions(GENRES, undefined, onSelect);

    options.find((option) => option.label === 'Drama')?.onSelect();

    expect(onSelect).toHaveBeenCalledWith('Drama');
  });

  it('reports the empty string for “All Genres”, which is how it clears', () => {
    // "All Genres" is the absence of the filter, and the empty string is what
    // takes the parameter back off the URL.
    const onSelect = vi.fn<(genre: string) => void>();
    const [all] = genreOptions(GENRES, undefined, onSelect);

    all.onSelect();

    expect(onSelect).toHaveBeenCalledWith('');
  });

  it('reports nothing until a row is actually chosen', () => {
    const onSelect = vi.fn<(genre: string) => void>();

    genreOptions(GENRES, undefined, onSelect);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('reports the genre exactly as the library spells it', () => {
    const onSelect = vi.fn<(genre: string) => void>();
    const options = genreOptions(
      { total: 3, genres: [{ id: 'g1', name: 'Science Fiction', count: 3 }] },
      undefined,
      onSelect
    );

    options[1].onSelect();

    expect(onSelect).toHaveBeenCalledWith('Science Fiction');
  });
});
