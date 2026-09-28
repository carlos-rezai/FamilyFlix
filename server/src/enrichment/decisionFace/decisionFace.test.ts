// @vitest-environment node
//
// 23 — Enrichment refactor (issue #214), Group 2: the picker's Candidates are
// a unit, shaped as log 23's Shapes shape them.
//
// `decisionFace` is pure: a search's results against our title and year → an
// `ambiguous` face with the top three **Candidates** by **Match score**, or a
// `missing` one with the reason it is handed. A Candidate's genre is the
// first of its `genre_ids` the **Genre pool** holds, and its language is
// upper-cased, so the line reads `1982 · Sci-Fi · EN`.

import { describe, expect, it } from 'vitest';

import { tmdbMovieResult } from '../../test-support/fakeTmdb/fakeTmdb';
import {
  ambiguousReason,
  candidatesFor,
  CANDIDATE_CAP,
  CONFLICT_REASON,
  decisionFace,
  NO_MATCH_REASON,
  noMatchFor,
  titledYear,
} from './decisionFace';

const OURS = { title: 'The Quiet Coast', year: 2004 };

describe('candidatesFor: the top three by Match score', () => {
  it('keeps the best three, best first', () => {
    const candidates = candidatesFor(OURS, [
      tmdbMovieResult(304, 'Quiet', 1971),
      tmdbMovieResult(302, 'Quiet Coast Road', 1990),
      tmdbMovieResult(301, 'The Quiet Coast', 2004),
      tmdbMovieResult(305, 'The Quiet Coast', 1980),
      tmdbMovieResult(303, 'The Quiet Coast', 2005),
    ]);

    expect(candidates).toHaveLength(CANDIDATE_CAP);
    expect(candidates[0]).toMatchObject({ tmdbId: 301, score: 100 });
    expect(candidates.map((each) => each.score)).toEqual(
      [...candidates.map((each) => each.score)].sort((a, b) => b - a)
    );
  });

  it('carries the id, the title and the release year', () => {
    const [candidate] = candidatesFor(OURS, [
      tmdbMovieResult(301, 'The Quiet Coast', 2004),
    ]);

    expect(candidate).toMatchObject({
      tmdbId: 301,
      title: 'The Quiet Coast',
      year: 2004,
    });
  });

  it('puts the poster on TMDB’s image host', () => {
    const [candidate] = candidatesFor(OURS, [
      tmdbMovieResult(301, 'The Quiet Coast', 2004),
    ]);

    expect(candidate?.posterUrl).toBe(
      'https://image.tmdb.org/t/p/w185/poster-301.jpg'
    );
  });

  it('answers no poster for a result without one', () => {
    const [candidate] = candidatesFor(OURS, [
      tmdbMovieResult(301, 'The Quiet Coast', 2004, { poster_path: null }),
    ]);

    expect(candidate?.posterUrl).toBeNull();
  });

  it('answers no year for a result with no release date', () => {
    const [candidate] = candidatesFor(OURS, [
      tmdbMovieResult(301, 'The Quiet Coast', 2004, { release_date: '' }),
    ]);

    expect(candidate?.year).toBeNull();
  });
});

describe('candidatesFor: the genre is the pool’s', () => {
  it('names Science Fiction as the pool spells it', () => {
    const [candidate] = candidatesFor(OURS, [
      tmdbMovieResult(301, 'The Quiet Coast', 2004, { genre_ids: [878] }),
    ]);

    expect(candidate?.genre).toBe('Sci-Fi');
  });

  it('passes over a genre the pool does not hold for the first one it does', () => {
    const [candidate] = candidatesFor(OURS, [
      tmdbMovieResult(301, 'The Quiet Coast', 2004, { genre_ids: [14, 18] }),
    ]);

    expect(candidate?.genre).toBe('Drama');
  });

  it('answers no genre when none of them is on the pool', () => {
    const [candidate] = candidatesFor(OURS, [
      tmdbMovieResult(301, 'The Quiet Coast', 2004, {
        genre_ids: [14, 36, 999],
      }),
    ]);

    expect(candidate?.genre).toBeNull();
  });
});

describe('candidatesFor: the language is upper-cased', () => {
  it('reads en as EN', () => {
    const [candidate] = candidatesFor(OURS, [
      tmdbMovieResult(301, 'The Quiet Coast', 2004),
    ]);

    expect(candidate?.language).toBe('EN');
  });

  it('answers no language for an empty one', () => {
    const [candidate] = candidatesFor(OURS, [
      tmdbMovieResult(301, 'The Quiet Coast', 2004, { original_language: '' }),
    ]);

    expect(candidate?.language).toBeNull();
  });
});

describe('ambiguousReason: the count spelled out', () => {
  it('names one release in the singular', () => {
    expect(ambiguousReason(1)).toBe(
      'One release shares this title — pick the right one.'
    );
  });

  it('spells out a count to twenty', () => {
    expect(ambiguousReason(2)).toBe(
      'Two releases share this title — pick the right one.'
    );
    expect(ambiguousReason(20)).toBe(
      'Twenty releases share this title — pick the right one.'
    );
  });

  it('writes a numeral past twenty', () => {
    expect(ambiguousReason(21)).toBe(
      '21 releases share this title — pick the right one.'
    );
  });
});

describe('decisionFace', () => {
  it('is ambiguous for several releases, their count its reason', () => {
    const face = decisionFace(
      OURS,
      'The Quiet Coast',
      [
        tmdbMovieResult(301, 'The Quiet Coast', 2004),
        tmdbMovieResult(303, 'The Quiet Coast', 2005),
      ],
      NO_MATCH_REASON
    );

    expect(face).toMatchObject({
      kind: 'ambiguous',
      reason: 'Two releases share this title — pick the right one.',
      query: 'The Quiet Coast',
    });
    expect(face.kind === 'ambiguous' && face.candidates).toHaveLength(2);
  });

  it('is ambiguous for one release that was not Confident', () => {
    const face = decisionFace(
      OURS,
      'The Quiet Coast',
      [tmdbMovieResult(303, 'The Quiet Coast', 2005)],
      NO_MATCH_REASON
    );

    expect(face).toMatchObject({
      kind: 'ambiguous',
      reason: 'One release shares this title — pick the right one.',
    });
  });

  it('is missing for no results, with the title’s reason', () => {
    expect(decisionFace(OURS, 'The Quiet Coast', [], NO_MATCH_REASON)).toEqual({
      kind: 'missing',
      reason: 'Nothing on TMDB matched this title.',
      query: 'The Quiet Coast',
    });
  });

  it('is missing for no results, with a typed query’s reason', () => {
    expect(
      decisionFace(OURS, 'Quiet Cost', [], noMatchFor('Quiet Cost'))
    ).toEqual({
      kind: 'missing',
      reason: 'Nothing on TMDB matched “Quiet Cost”.',
      query: 'Quiet Cost',
    });
  });
});

describe('the reasons and the scoring shape', () => {
  it('says why a conflict waits', () => {
    expect(CONFLICT_REASON).toBe(
      'TMDB has different values for fields you already filled in.'
    );
  });

  it('reads a result as its title and release year', () => {
    expect(titledYear(tmdbMovieResult(1, 'Sundial', 2004))).toEqual({
      title: 'Sundial',
      year: 2004,
    });
  });
});
