// @vitest-environment node
//
// 64, Rescan a folder, Phase 6 (issue #623): a row finds a folder named by its
// title alone.
//
// The matcher tries a row's **Folder key** first, as ever. When no folder holds
// that key and the row has a year, it weighs the folders whose key folds equal
// to the row's title alone, with the verdicts any key gets: one folder with
// one video is a Match, two are `ambiguous`, none is `no-folder`, and the one
// folder holding no video or several is `no-video`. The title is never tried
// when a folder holds the spelled key, and a row without a year gets no
// fallback.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { MATCH_REASON, matchRows } from './matchRows';
import type { SheetRow } from '../readSheet/readSheet';

/** The two Library folders a run may walk. */
const FIRST = join('/', 'library', 'films');
const SECOND = join('/', 'library', 'more');

/** A Movie row keyed `folder`, its other cells blank unless the test fills them. */
function row(folder: string, title: string, year: number | null): SheetRow {
  return {
    type: 'Movie',
    folder,
    season: null,
    episode: null,
    title,
    year,
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
  };
}

/** A Title folder named `name` in `root`, holding `videos` videos (one by default). */
function folder(name: string, root: string = FIRST, videos = 1) {
  const dir = join(root, name);
  return {
    dir,
    name,
    videos: Array.from({ length: videos }, (_, n) =>
      join(dir, `${name} ${n + 1}.mkv`)
    ),
    poster: null,
    backdrop: null,
    subtitles: [],
  };
}

/** A hand-made `Heat`, `1995` row: no Folder cell, so its key is spelled. */
const heat = (): SheetRow => row('Heat (1995)', 'Heat', 1995);

describe('matchRows: the bare-title fallback', () => {
  it('matches a Heat, 1995 row to a Heat folder when no Heat (1995) exists', () => {
    const bare = folder('Heat');

    const { matched, problems, unclaimed } = matchRows(
      [heat()],
      [folder('Ronin (1998)'), bare]
    );

    expect(matched.map((match) => match.folder)).toEqual([bare]);
    expect(problems).toEqual([]);
    expect(unclaimed.map((scan) => scan.name)).toEqual(['Ronin (1998)']);
  });

  it('folds case: a heat folder is the Heat row’s', () => {
    const bare = folder('heat');

    const { matched } = matchRows([heat()], [bare]);

    expect(matched.map((match) => match.folder)).toEqual([bare]);
  });

  it('matches Heat (1995) rather than Heat when both exist', () => {
    const spelled = folder('Heat (1995)');
    const bare = folder('Heat');

    const { matched, problems, unclaimed } = matchRows(
      [heat()],
      [bare, spelled]
    );

    expect(matched.map((match) => match.folder)).toEqual([spelled]);
    expect(problems).toEqual([]);
    expect(unclaimed).toEqual([bare]);
  });

  it('never tries the title when the spelled key’s folder holds no video', () => {
    const spelled = folder('Heat (1995)', FIRST, 0);

    const { matched, problems } = matchRows(
      [heat()],
      [spelled, folder('Heat')]
    );

    expect(matched).toEqual([]);
    expect(problems).toEqual([
      expect.objectContaining({
        kind: 'no-video',
        reason: MATCH_REASON.noVideo,
        candidates: [spelled],
      }),
    ]);
  });

  it('never tries the title when two folders hold the spelled key', () => {
    const inFirst = folder('Heat (1995)', FIRST);
    const inSecond = folder('Heat (1995)', SECOND);

    const { problems } = matchRows(
      [heat()],
      [inFirst, folder('Heat'), inSecond]
    );

    expect(problems).toEqual([
      expect.objectContaining({
        kind: 'ambiguous',
        candidates: [inFirst, inSecond],
      }),
    ]);
  });

  it('answers ambiguous when the bare title matches two folders, both its candidates', () => {
    const inFirst = folder('Heat', FIRST);
    const inSecond = folder('HEAT', SECOND);

    const { matched, problems, unclaimed } = matchRows(
      [heat()],
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
    expect(unclaimed).toEqual([]);
  });

  it('answers no-folder when neither the key nor the bare title is a folder', () => {
    const { matched, problems } = matchRows(
      [heat()],
      [folder('Heat (1986)'), folder('Heat 2')]
    );

    expect(matched).toEqual([]);
    expect(problems).toEqual([
      expect.objectContaining({
        kind: 'no-folder',
        reason: MATCH_REASON.noFolder,
        candidates: [],
      }),
    ]);
  });

  it('answers no-video for the one bare-title folder holding no video', () => {
    const bare = folder('Heat', FIRST, 0);

    const { matched, problems } = matchRows([heat()], [bare]);

    expect(matched).toEqual([]);
    expect(problems).toEqual([
      expect.objectContaining({
        kind: 'no-video',
        reason: MATCH_REASON.noVideo,
        candidates: [bare],
      }),
    ]);
  });

  it('answers no-video for the one bare-title folder holding several', () => {
    const bare = folder('Heat', FIRST, 2);

    const { matched, problems } = matchRows([heat()], [bare]);

    expect(matched).toEqual([]);
    expect(problems).toEqual([
      expect.objectContaining({
        kind: 'no-video',
        reason: MATCH_REASON.manyVideos,
        candidates: [bare],
      }),
    ]);
  });

  it('gives a row without a year no fallback', () => {
    const bare = folder('Heat');

    const { matched, problems, unclaimed } = matchRows(
      [row('Heat Director’s Cut', 'Heat', null)],
      [bare]
    );

    expect(matched).toEqual([]);
    expect(problems).toEqual([
      expect.objectContaining({ kind: 'no-folder', candidates: [] }),
    ]);
    expect(unclaimed).toEqual([bare]);
  });
});
