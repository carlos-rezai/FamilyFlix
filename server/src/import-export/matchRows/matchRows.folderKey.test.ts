// @vitest-environment node
//
// 58, Folder layout, Phase 6 (issue #539): a row matched by its Folder key.
//
// The matcher reads a row's **Folder key** (its `folder`, the Folder cell or
// `Title (Year)` spelled by the reader) and matches it to the Title folder of
// that name, exactly and case folded: never by a fuzzy title, never by the
// row's Title. A key no folder holds is `no-folder`; a key two Library folders
// hold is `ambiguous`, both folders its candidates. A matched row's path
// cells, relative to the root holding the Title folder, come back resolved
// against the Library folder its key matched in.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { MATCH_REASON, matchRows } from './matchRows';
import type { SheetRow } from '../readSheet/readSheet';

/** The two Library folders a run may walk. */
const FIRST = join('/', 'library', 'films');
const SECOND = join('/', 'library', 'more');

/** A Movie row keyed `folder`, its other cells blank unless the test fills them. */
function row(
  folder: string,
  title: string,
  fields: Partial<SheetRow> = {}
): SheetRow {
  return {
    type: 'Movie',
    folder,
    season: null,
    episode: null,
    title,
    year: null,
    endYear: null,
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
    ...fields,
  };
}

/** A Title folder named `name` in the Library folder `root`, holding one video. */
function folder(name: string, root: string = FIRST) {
  const dir = join(root, name);
  return {
    dir,
    name,
    videos: [join(dir, `${name}.mkv`)],
    poster: null,
    backdrop: null,
    subtitles: [],
  };
}

describe('matchRows: by Folder key', () => {
  it('matches by the key whatever the row’s title says', () => {
    const amelie = folder('Amelie (2001)');

    const { matched } = matchRows(
      [row('Amelie (2001)', 'Le Fabuleux Destin d’Amélie Poulain')],
      [amelie]
    );

    expect(matched.map((match) => match.folder)).toEqual([amelie]);
  });

  it('folds case: a key typed in lower case matches its folder', () => {
    const dieHard = folder('Die Hard (1988)');

    const { matched } = matchRows(
      [row('die hard (1988)', 'Stirb langsam')],
      [dieHard]
    );

    expect(matched.map((match) => match.folder)).toEqual([dieHard]);
  });

  it('never matches by a fuzzy title: a release name is no folder', () => {
    const { matched, problems } = matchRows(
      [row('Die Hard (1988)', 'Die Hard', { year: 1988 })],
      [folder('Die.Hard.1988.1080p')]
    );

    expect(matched).toEqual([]);
    expect(problems.map((problem) => problem.kind)).toEqual(['no-folder']);
  });

  it('never weighs a folder whose key merely starts with the row’s', () => {
    const { problems } = matchRows(
      [row('Alien (1979)', 'Alien', { year: 1979 })],
      [folder('Aliens (1986)'), folder('Alien (1992)')]
    );

    expect(problems).toEqual([
      expect.objectContaining({
        kind: 'no-folder',
        reason: MATCH_REASON.noFolder,
        candidates: [],
      }),
    ]);
  });

  it('answers no-folder for a key no folder holds, though its title names one', () => {
    const { matched, problems, unclaimed } = matchRows(
      [row('Heat (1995)', 'Ronin', { year: 1998 })],
      [folder('Ronin (1998)')]
    );

    expect(matched).toEqual([]);
    expect(problems).toEqual([
      expect.objectContaining({ kind: 'no-folder', candidates: [] }),
    ]);
    expect(unclaimed.map((scan) => scan.name)).toEqual(['Ronin (1998)']);
  });

  it('answers ambiguous for a key two Library folders hold, both its candidates', () => {
    const inFirst = folder('Heat (1995)', FIRST);
    const inSecond = folder('Heat (1995)', SECOND);

    const { matched, problems } = matchRows(
      [row('Heat (1995)', 'Hitze')],
      [inFirst, inSecond]
    );

    expect(matched).toEqual([]);
    expect(problems).toEqual([
      expect.objectContaining({
        kind: 'ambiguous',
        reason: MATCH_REASON.twoFolders,
        candidates: [inFirst, inSecond],
      }),
    ]);
  });

  it('answers ambiguous when the two folders differ only by case', () => {
    const { problems } = matchRows(
      [row('Heat (1995)', 'Hitze')],
      [folder('Heat (1995)', FIRST), folder('HEAT (1995)', SECOND)]
    );

    expect(problems.map((problem) => problem.kind)).toEqual(['ambiguous']);
  });
});

describe('matchRows: path cells resolved against the matched Library folder', () => {
  const cells = {
    video: 'Heat (1995)/Heat.1995.1080p.mkv',
    subtitles: ['Heat (1995)/Subtitles/en.srt', 'Heat (1995)/Subtitles/nl.srt'],
    poster: 'Heat (1995)/Images/poster.jpg',
    backdrop: 'Heat (1995)/Images/backdrop.jpg',
  };

  it('resolves every path cell against the Library folder holding the Title folder', () => {
    const { matched } = matchRows(
      [
        row('Heat (1995)', 'Heat', {
          ...cells,
          year: 1995,
          endYear: 1995,
          synopsis: 'A thief and a detective.',
        }),
      ],
      [folder('Heat (1995)', SECOND)]
    );

    expect(matched).toHaveLength(1);
    expect(matched[0].row).toMatchObject({
      title: 'Heat',
      year: 1995,
      synopsis: 'A thief and a detective.',
      video: join(SECOND, 'Heat (1995)', 'Heat.1995.1080p.mkv'),
      subtitles: [
        join(SECOND, 'Heat (1995)', 'Subtitles', 'en.srt'),
        join(SECOND, 'Heat (1995)', 'Subtitles', 'nl.srt'),
      ],
      poster: join(SECOND, 'Heat (1995)', 'Images', 'poster.jpg'),
      backdrop: join(SECOND, 'Heat (1995)', 'Images', 'backdrop.jpg'),
      still: null,
    });
  });
});
