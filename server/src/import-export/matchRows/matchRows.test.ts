// @vitest-environment node
//
// 13, Bulk import, Phase 2: "the tracer bullet" (issue #125) and Phase 4:
// "problems and review" (issue #129); 58, Folder layout, Phase 6 (issue
// #539): matched by **Folder key**.
//
// The matcher, pure: **Sheet rows** × folder scans → what can be imported
// without a human looking, and what cannot. A **Match** is the one Title
// folder whose name is the row's Folder key, case folded, holding one video.
// Two such folders are `ambiguous`; none `no-folder`; the one folder holding
// no video, or more than one, `no-video` with its own two reasons. A folder no
// row claimed is `unclaimed`, the run's `no-row`. The key itself, and what is
// never a match, is `matchRows.folderKey.test.ts`'s.
//
// Table tests in the style of `choosePlaybackPath`: a row and a folder are
// built by name, and the assertion is on which rows came out paired with which
// folders.

import { describe, expect, it } from 'vitest';

import { MATCH_REASON, matchRows } from './matchRows';
import type { SheetRow } from '../readSheet/readSheet';

/** A Movie row keyed `Title (Year)`, as the reader spells a sheet with no Folder column. */
function row(title: string, year: number): SheetRow {
  return {
    type: 'Movie',
    folder: `${title} (${year})`,
    season: null,
    episode: null,
    title,
    year,
    endYear: year,
    airDate: null,
    runtime: null,
    genres: [],
    director: null,
    cast: [],
    synopsis: null,
    rating: null,
    tmdbScore: null,
    tmdbId: null,
    watched: false,
    favorite: false,
    video: null,
    subtitles: [],
    poster: null,
    backdrop: null,
    still: null,
  };
}

/**
 * A **Title folder** in the Library folder `root`, holding the videos it
 * names (one by default): its name is the whole of what the matcher reads.
 */
function folder(
  name: string,
  videos: string[] = [`${name}.mkv`],
  root = '/library'
) {
  const dir = `${root}/${name}`;
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
  it('pairs each of several rows with its own folder', () => {
    const dieHardFolder = folder('Die Hard (1988)');
    const amelieFolder = folder('Amelie (2001)');

    const { matched } = matchRows(
      [row('Die Hard', 1988), row('Amelie', 2001)],
      [amelieFolder, dieHardFolder]
    );

    expect(matched.map((match) => [match.row.title, match.folder])).toEqual([
      ['Die Hard', dieHardFolder],
      ['Amelie', amelieFolder],
    ]);
  });

  it('matches nothing when there are no folders, and nothing when there are no rows', () => {
    expect(matchRows([row('Die Hard', 1988)], []).matched).toEqual([]);
    expect(matchRows([], [folder('Die Hard (1988)')]).matched).toEqual([]);
  });
});

describe('matchRows — the ambiguous verdict', () => {
  it('lists every folder of the key, in the folders’ order, under the first reason', () => {
    const first = folder('Die Hard (1988)', undefined, '/library/films');
    const second = folder('Die Hard (1988)', undefined, '/library/more');
    const third = folder('die hard (1988)', undefined, '/library/old');

    const { matched, problems } = matchRows(
      [row('Die Hard', 1988)],
      [first, second, third]
    );

    expect(matched).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      kind: 'ambiguous',
      reason: MATCH_REASON.twoFolders,
      candidates: [first, second, third],
    });
  });

  it('answers ambiguous, not no-video, when one of the two holds two videos', () => {
    const { problems } = matchRows(
      [row('Die Hard', 1988)],
      [
        folder('Die Hard (1988)', ['a.mkv', 'b.mkv']),
        folder('Die Hard (1988)', undefined, '/library/more'),
      ]
    );

    expect(problems.map((problem) => problem.kind)).toEqual(['ambiguous']);
  });
});

describe('matchRows — the no-folder verdict', () => {
  it('answers no-folder for every row when there are no folders', () => {
    const { problems } = matchRows(
      [row('Die Hard', 1988), row('Amelie', 2001)],
      []
    );

    expect(problems).toEqual([
      expect.objectContaining({
        kind: 'no-folder',
        reason: MATCH_REASON.noFolder,
        candidates: [],
      }),
      expect.objectContaining({ kind: 'no-folder' }),
    ]);
  });
});

describe('matchRows — the no-video verdict', () => {
  it('answers no-video, with its first reason, for the one folder holding no video', () => {
    const empty = folder('Die Hard (1988)', []);

    const { matched, problems } = matchRows([row('Die Hard', 1988)], [empty]);

    expect(matched).toEqual([]);
    expect(problems).toEqual([
      expect.objectContaining({
        kind: 'no-video',
        reason: MATCH_REASON.noVideo,
        candidates: [empty],
      }),
    ]);
  });

  it('answers no-video, with its second reason, for the one folder holding two', () => {
    const two = folder('Die Hard (1988)', ['Die Hard.mkv', 'Die Hard.avi']);

    const { matched, problems } = matchRows([row('Die Hard', 1988)], [two]);

    expect(matched).toEqual([]);
    expect(problems).toEqual([
      expect.objectContaining({
        kind: 'no-video',
        reason: MATCH_REASON.manyVideos,
        candidates: [two],
      }),
    ]);
  });
});

describe('matchRows — the unclaimed folders', () => {
  it('answers a folder no row claimed as unclaimed, and not a matched one', () => {
    const unlisted = folder('Ironwood (2018)');

    const { unclaimed } = matchRows(
      [row('Die Hard', 1988)],
      [folder('Die Hard (1988)'), unlisted]
    );

    expect(unclaimed).toEqual([unlisted]);
  });

  it('does not count the candidates of an ambiguous row, or a no-video row’s folder, as unclaimed', () => {
    const { unclaimed } = matchRows(
      [row('Die Hard', 1988), row('Amelie', 2001)],
      [
        folder('Die Hard (1988)'),
        folder('Die Hard (1988)', undefined, '/library/more'),
        folder('Amelie (2001)', []),
      ]
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
  it('lists the problems in the sheet’s order, the matches beside them', () => {
    const { matched, problems, unclaimed } = matchRows(
      [
        row('The Lantern Keeper', 2019),
        row('Amelie', 2001),
        row('Die Hard', 1988),
      ],
      [
        folder('Die Hard (1988)'),
        folder('Die Hard (1988)', undefined, '/library/more'),
        folder('Amelie (2001)'),
        folder('Ironwood (2018)'),
      ]
    );

    expect(matched.map((match) => match.row.title)).toEqual(['Amelie']);
    expect(
      problems.map((problem) => [problem.row.title, problem.kind])
    ).toEqual([
      ['The Lantern Keeper', 'no-folder'],
      ['Die Hard', 'ambiguous'],
    ]);
    expect(unclaimed.map((scan) => scan.name)).toEqual(['Ironwood (2018)']);
  });
});
