// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { newMovie } from './newMovie';
import { freshStorage } from '../freshStorage/freshStorage';

describe('newMovie — the minimal input', () => {
  it('supplies the two fields addMovie requires and nothing else', () => {
    // Everything else on NewMovie is optional and reads back as null or empty,
    // so a builder that filled more would hide which fields the repository
    // actually insists on.
    expect(Object.keys(newMovie()).sort()).toEqual(['title', 'videoPath']);
  });

  it('is accepted by the repository as it stands', () => {
    const storage = freshStorage();

    const added = storage.addMovie(newMovie());

    expect(added.title).toBe('Northwind');
    expect(added.year).toBeNull();
    expect(added.genres).toEqual([]);
    expect(added.subtitles).toEqual([]);
  });
});

describe('newMovie — overrides', () => {
  it('replaces a required field in place', () => {
    expect(newMovie({ title: 'Comet Season' }).title).toBe('Comet Season');
  });

  it('adds an optional field the default leaves out', () => {
    const input = newMovie({ year: 2018, genres: ['Drama'] });

    expect(input.year).toBe(2018);
    expect(input.genres).toEqual(['Drama']);
    expect(input.videoPath).toBe('Northwind (2018)/northwind.mkv');
  });

  it('composes with a second override without losing the first', () => {
    const input = newMovie({ ...newMovie({ year: 2018 }), title: 'Halfway' });

    expect(input).toEqual({
      title: 'Halfway',
      videoPath: 'Northwind (2018)/northwind.mkv',
      year: 2018,
    });
  });
});
