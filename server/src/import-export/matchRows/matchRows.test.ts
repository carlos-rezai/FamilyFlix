// @vitest-environment node
//
// 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
//
// The matcher, pure: **Sheet rows** × folder scans → what can be imported
// without a human looking. In this slice it answers only its confident verdict
// — a **Match** is exactly one key-equal **Source folder** whose year agrees
// when both carry one — and anything short of that is simply not matched.
// The **Problems** the run files for those rows and folders arrive with the
// review slice, as further members of the same answer; `matched` keeps its
// shape through that.
//
// Table tests in the style of `choosePlaybackPath`: a row and a folder are
// built by name, and the assertion is on which rows came out paired with which
// folders, by identity.

import { describe, expect, it } from 'vitest';

import { matchRows } from './matchRows';
import type { SheetRow } from '../readSheet/readSheet';

/** A row as the reader answers it, with the title and year the test names. */
function row(title: string, year: number | null = null): SheetRow {
  return {
    title,
    year,
    genres: [],
    director: null,
    cast: [],
    synopsis: null,
    rating: null,
    watched: false,
  };
}

/**
 * A **Source folder** as the scanner answers it, holding one video and nothing
 * else — its name is the whole of what the matcher reads. Built untyped so the
 * scan carries exactly what `scanMovieFolder` will answer, whatever else the
 * scanner learns to report.
 */
function folder(name: string) {
  const dir = `/library/${name}`;
  return {
    dir,
    name,
    videos: [`${dir}/${name}.mkv`],
    poster: null,
    backdrop: null,
    subtitles: [],
  };
}

describe('matchRows — the confident verdict', () => {
  it('matches a row to exactly one key-equal folder', () => {
    const dieHard = row('Die Hard', 1988);
    const scan = folder('Die.Hard.1988.1080p');

    const { matched } = matchRows([dieHard], [scan]);

    expect(matched).toHaveLength(1);
    expect(matched[0].row).toBe(dieHard);
    expect(matched[0].folder).toBe(scan);
  });

  it('matches through the title key, not the spelling', () => {
    const amelie = row('Amélie', 2001);
    const scan = folder('Amelie (2001)');

    const { matched } = matchRows([amelie], [scan]);

    expect(matched.map((match) => match.folder)).toEqual([scan]);
  });

  it('does not match a folder whose year disagrees', () => {
    const { matched } = matchRows(
      [row('Die Hard', 1988)],
      [folder('Die Hard (2007)')]
    );

    expect(matched).toEqual([]);
  });

  it('matches when the row carries a year and the folder does not', () => {
    const scan = folder('Die Hard');

    const { matched } = matchRows([row('Die Hard', 1988)], [scan]);

    expect(matched.map((match) => match.folder)).toEqual([scan]);
  });

  it('matches when the folder carries a year and the row does not', () => {
    const scan = folder('Die Hard (1988)');

    const { matched } = matchRows([row('Die Hard')], [scan]);

    expect(matched.map((match) => match.folder)).toEqual([scan]);
  });

  it('does not match a row no folder answers to', () => {
    const { matched } = matchRows(
      [row('Die Hard', 1988)],
      [folder('Amelie (2001)')]
    );

    expect(matched).toEqual([]);
  });

  it('does not match a row two folders answer to', () => {
    // Two key-equal folders is the `ambiguous` **Problem** of the review slice.
    // Here it is enough that neither is imported on a guess.
    const { matched } = matchRows(
      [row('Die Hard', 1988)],
      [folder('Die Hard (1988)'), folder('Die.Hard.1988.1080p')]
    );

    expect(matched).toEqual([]);
  });

  it('pairs each of several rows with its own folder', () => {
    const dieHard = row('Die Hard', 1988);
    const amelie = row('Amélie', 2001);
    const dieHardFolder = folder('Die.Hard.1988.1080p');
    const amelieFolder = folder('Amelie (2001)');

    const { matched } = matchRows(
      [dieHard, amelie],
      [amelieFolder, dieHardFolder]
    );

    expect(matched).toHaveLength(2);
    expect(matched.find((m) => m.row === dieHard)?.folder).toBe(dieHardFolder);
    expect(matched.find((m) => m.row === amelie)?.folder).toBe(amelieFolder);
  });

  it('answers the matches in the sheet’s order', () => {
    const dieHard = row('Die Hard', 1988);
    const amelie = row('Amélie', 2001);

    const { matched } = matchRows(
      [dieHard, amelie],
      [folder('Amelie (2001)'), folder('Die.Hard.1988.1080p')]
    );

    expect(matched.map((match) => match.row)).toEqual([dieHard, amelie]);
  });

  it('matches nothing when there are no folders, and nothing when there are no rows', () => {
    expect(matchRows([row('Die Hard', 1988)], []).matched).toEqual([]);
    expect(matchRows([], [folder('Die Hard (1988)')]).matched).toEqual([]);
  });
});
