// @vitest-environment node
//
// 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125) and Phase 4:
// "problems and review" (issue #129).
//
// The matcher, pure: **Sheet rows** × folder scans → what can be imported
// without a human looking, and what cannot. The confident verdict — a
// **Match** is exactly one key-equal **Source folder** whose year agrees when
// both carry one — came with the tracer bullet; issue #129 adds the other
// verdicts as `problems` and `unclaimed` beside `matched`, whose shape does
// not change. Two or more key-equal folders are `ambiguous` with the first
// reason; none, but one or more whose key starts with the row's, `ambiguous`
// with the second; none at all `no-folder`; the one folder holding no video,
// or more than one, `no-video` with its own two reasons. A folder no row
// claimed is `unclaimed` — the run's `no-row`.
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
function folder(name: string, videos: string[] = [`${name}.mkv`]) {
  const dir = `/library/${name}`;
  return {
    dir,
    name,
    videos: videos.map((video) => `${dir}/${video}`),
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

/** The five reason strings the matcher fixes, verbatim from the prototype. */
const REASON = {
  twoFolders: 'Two folders look like plausible matches — pick one.',
  nearName: "One folder looks like a match, but the name isn't exact.",
  noFolder: 'No folder found matching this spreadsheet row.',
  noVideo: 'Folder matched, but no video file was found.',
  manyVideos: 'Folder matched, but it holds more than one video file.',
} as const;

describe('matchRows — the ambiguous verdict', () => {
  it('answers ambiguous, with the first reason, for a row two key-equal folders answer to', () => {
    const dieHard = row('Die Hard', 1988);
    const first = folder('Die Hard (1988)');
    const second = folder('Die.Hard.1988.1080p');

    const { matched, problems } = matchRows([dieHard], [first, second]);

    expect(matched).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe('ambiguous');
    expect(problems[0].reason).toBe(REASON.twoFolders);
    expect(problems[0].row).toBe(dieHard);
  });

  it('answers the same for three', () => {
    const { problems } = matchRows(
      [row('Die Hard', 1988)],
      [
        folder('Die Hard (1988)'),
        folder('Die.Hard.1988.1080p'),
        folder('Die_Hard'),
      ]
    );

    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe('ambiguous');
    expect(problems[0].reason).toBe(REASON.twoFolders);
    expect(problems[0].candidates).toHaveLength(3);
  });

  it('answers ambiguous, with the second reason, when no key is equal but one starts with the row’s', () => {
    const alien = row('Alien', 1979);
    const aliens = folder('Aliens (1986)');

    const { matched, problems } = matchRows([alien], [aliens]);

    expect(matched).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe('ambiguous');
    expect(problems[0].reason).toBe(REASON.nearName);
    expect(problems[0].row).toBe(alien);
    expect(problems[0].candidates).toEqual([aliens]);
  });

  it('lists every folder whose key starts with the row’s, under the second reason', () => {
    const aliens = folder('Aliens (1986)');
    const alienResurrection = folder('Alien Resurrection (1997)');

    const { problems } = matchRows(
      [row('Alien', 1979)],
      [aliens, folder('Amelie (2001)'), alienResurrection]
    );

    expect(problems).toHaveLength(1);
    expect(problems[0].reason).toBe(REASON.nearName);
    expect(problems[0].candidates).toEqual([aliens, alienResurrection]);
  });

  it('prefers the exact folder over the ones that merely start with the row’s key', () => {
    const alien = folder('Alien (1979)');

    const { matched, problems } = matchRows(
      [row('Alien', 1979)],
      [folder('Aliens (1986)'), alien]
    );

    expect(matched.map((match) => match.folder)).toEqual([alien]);
    expect(problems).toEqual([]);
  });
});

describe('matchRows — the no-folder verdict', () => {
  it('answers no-folder for a row nothing answers to', () => {
    const dieHard = row('Die Hard', 1988);

    const { matched, problems } = matchRows(
      [dieHard],
      [folder('Amelie (2001)')]
    );

    expect(matched).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe('no-folder');
    expect(problems[0].reason).toBe(REASON.noFolder);
    expect(problems[0].row).toBe(dieHard);
    expect(problems[0].candidates).toEqual([]);
  });

  it('answers no-folder for every row when there are no folders', () => {
    const { problems } = matchRows(
      [row('Die Hard', 1988), row('Amélie', 2001)],
      []
    );

    expect(problems.map((problem) => problem.kind)).toEqual([
      'no-folder',
      'no-folder',
    ]);
  });

  it('does not take a folder whose key merely contains the row’s rather than starting with it', () => {
    const { problems } = matchRows(
      [row('Hard', 1988)],
      [folder('Die Hard (1988)')]
    );

    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe('no-folder');
  });
});

describe('matchRows — the no-video verdict', () => {
  it('answers no-video, with its first reason, for the one folder holding no video', () => {
    const dieHard = row('Die Hard', 1988);
    const empty = folder('Die Hard (1988)', []);

    const { matched, problems } = matchRows([dieHard], [empty]);

    expect(matched).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe('no-video');
    expect(problems[0].reason).toBe(REASON.noVideo);
    expect(problems[0].row).toBe(dieHard);
    expect(problems[0].candidates).toEqual([empty]);
  });

  it('answers no-video, with its second reason, for the one folder holding two', () => {
    const dieHard = row('Die Hard', 1988);
    const two = folder('Die Hard (1988)', ['Die Hard.mkv', 'Die Hard.avi']);

    const { matched, problems } = matchRows([dieHard], [two]);

    expect(matched).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe('no-video');
    expect(problems[0].reason).toBe(REASON.manyVideos);
    expect(problems[0].candidates).toEqual([two]);
  });

  it('answers ambiguous, not no-video, when two folders are key-equal and one holds two videos', () => {
    const { problems } = matchRows(
      [row('Die Hard', 1988)],
      [folder('Die Hard (1988)', ['a.mkv', 'b.mkv']), folder('Die_Hard')]
    );

    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe('ambiguous');
  });
});

describe('matchRows — the unclaimed folders', () => {
  it('answers a folder no row claimed as unclaimed — the run’s no-row', () => {
    const unlisted = folder('Ironwood (2018)');

    const { unclaimed } = matchRows(
      [row('Die Hard', 1988)],
      [folder('Die.Hard.1988.1080p'), unlisted]
    );

    expect(unclaimed).toEqual([unlisted]);
  });

  it('does not count a matched folder as unclaimed', () => {
    const { unclaimed } = matchRows(
      [row('Die Hard', 1988)],
      [folder('Die.Hard.1988.1080p')]
    );

    expect(unclaimed).toEqual([]);
  });

  it('does not count the candidates of an ambiguous row as unclaimed', () => {
    const { unclaimed } = matchRows(
      [row('Die Hard', 1988), row('Alien', 1979)],
      [folder('Die Hard (1988)'), folder('Die_Hard'), folder('Aliens (1986)')]
    );

    expect(unclaimed).toEqual([]);
  });

  it('does not count the one folder of a no-video row as unclaimed', () => {
    const { unclaimed } = matchRows(
      [row('Die Hard', 1988)],
      [folder('Die Hard (1988)', [])]
    );

    expect(unclaimed).toEqual([]);
  });

  it('answers every folder as unclaimed when there are no rows, in the folders’ order', () => {
    const second = folder('Die Hard (1988)');
    const first = folder('Amelie (2001)');

    const { unclaimed } = matchRows([], [first, second]);

    expect(unclaimed).toEqual([first, second]);
  });
});

describe('matchRows — the order of things', () => {
  it('lists an ambiguous row’s candidates in the folders’ order', () => {
    const later = folder('Die.Hard.1988.1080p');
    const earlier = folder('Die Hard (1988)');

    const { problems } = matchRows([row('Die Hard', 1988)], [later, earlier]);

    expect(problems[0].candidates).toEqual([later, earlier]);
  });

  it('lists the problems in the sheet’s order', () => {
    const lantern = row('The Lantern Keeper', 2019);
    const dieHard = row('Die Hard', 1988);
    const alien = row('Alien', 1979);

    const { problems } = matchRows(
      [lantern, dieHard, alien],
      [folder('Die Hard (1988)'), folder('Die_Hard'), folder('Aliens (1986)')]
    );

    expect(problems.map((problem) => problem.row)).toEqual([
      lantern,
      dieHard,
      alien,
    ]);
    expect(problems.map((problem) => problem.kind)).toEqual([
      'no-folder',
      'ambiguous',
      'ambiguous',
    ]);
  });

  it('keeps the matches beside the problems: a settled row is not also a problem', () => {
    const amelie = row('Amélie', 2001);
    const amelieFolder = folder('Amelie (2001)');

    const { matched, problems, unclaimed } = matchRows(
      [amelie, row('The Lantern Keeper', 2019)],
      [amelieFolder, folder('Ironwood (2018)')]
    );

    expect(matched.map((match) => match.row)).toEqual([amelie]);
    expect(problems.map((problem) => problem.row.title)).toEqual([
      'The Lantern Keeper',
    ]);
    expect(unclaimed.map((scan) => scan.name)).toEqual(['Ironwood (2018)']);
  });
});
