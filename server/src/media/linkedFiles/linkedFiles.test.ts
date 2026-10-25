// @vitest-environment node
//
// 47 — Manage library, Phase 1: "the list, read-only" (issue #407).
//
// `linkedFiles`, pure: a title's **Linked files** — what a Delete would move
// to the Recycle Bin — off its linked videos, its **Source folder**, its
// **Library folder**'s path and reach, and every other held title's linked
// videos. Shared by the list read (the badge and the unreachable line) and,
// later, the delete:
//
// - `folder` — the Source folder holds no other held title's video and is not
//   a Library folder itself: the folder goes whole, its path the folder;
// - `videos` — the folder is shared (a **Collection folder**, or a show's
//   loose episodes at a Library folder's root): the title's linked videos
//   alone;
// - `unreachable` — the Library folder can't be read: no paths;
// - `null` — no linked video, a copied title.
//
// Every path is absolute, joined here the way the route joins them.

import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { linkedFiles } from './linkedFiles';

const LIBRARY = resolve('/', 'Movies');
const reachable = { path: LIBRARY, reachable: true };
const at = (...parts: string[]) => join(LIBRARY, ...parts);

describe('linkedFiles — folder', () => {
  it('answers the Source folder whole for a film alone in it', () => {
    expect(
      linkedFiles({
        videos: [at('Heat (1995)', 'Heat.1995.mkv')],
        allLinked: true,
        sourceFolder: at('Heat (1995)'),
        libraryFolder: reachable,
        others: [at('Coco (2017)', 'Coco.mkv')],
      })
    ).toEqual({ kind: 'folder', paths: [at('Heat (1995)')] });
  });

  it('answers a show’s Show folder whole when nothing else lies in it', () => {
    expect(
      linkedFiles({
        videos: [
          at('Harbor and Vine', 'Season 01', 'S01E01.mkv'),
          at('Harbor and Vine', 'Season 02', 'S02E01.mkv'),
        ],
        allLinked: true,
        sourceFolder: at('Harbor and Vine'),
        libraryFolder: reachable,
        others: [],
      })
    ).toEqual({ kind: 'folder', paths: [at('Harbor and Vine')] });
  });

  it('does not take a folder whose name only begins with the Source folder’s for a share', () => {
    expect(
      linkedFiles({
        videos: [at('Heat', 'Heat.mkv')],
        allLinked: true,
        sourceFolder: at('Heat'),
        libraryFolder: reachable,
        others: [at('Heat 2', 'Heat 2.mkv')],
      })
    ).toEqual({ kind: 'folder', paths: [at('Heat')] });
  });
});

describe('linkedFiles — videos', () => {
  it('answers a Collection folder film’s own video alone', () => {
    expect(
      linkedFiles({
        videos: [at('Collection', 'Heat.mkv')],
        allLinked: true,
        sourceFolder: at('Collection'),
        libraryFolder: reachable,
        others: [at('Collection', 'Coco.mkv')],
      })
    ).toEqual({ kind: 'videos', paths: [at('Collection', 'Heat.mkv')] });
  });

  it('answers a show’s loose episodes at a Library folder’s root as its videos', () => {
    const episodes = [at('Harbor.S01E01.mkv'), at('Harbor.S01E02.mkv')];

    expect(
      linkedFiles({
        videos: episodes,
        allLinked: true,
        sourceFolder: LIBRARY,
        libraryFolder: reachable,
        others: [],
      })
    ).toEqual({ kind: 'videos', paths: episodes });
  });

  it('never answers folder for a Source folder that is the Library folder itself', () => {
    const answer = linkedFiles({
      videos: [at('Heat.mkv')],
      allLinked: true,
      sourceFolder: LIBRARY,
      libraryFolder: reachable,
      others: [],
    });

    expect(answer?.kind).not.toBe('folder');
    expect(answer?.paths).not.toContain(LIBRARY);
  });

  it('answers a mixed show’s linked episodes only', () => {
    // S01E02 was copied in: its original in the Show folder is the family's,
    // and never trashed, so the folder cannot go whole.
    expect(
      linkedFiles({
        videos: [at('Harbor and Vine', 'Season 01', 'S01E01.mkv')],
        allLinked: false,
        sourceFolder: at('Harbor and Vine'),
        libraryFolder: reachable,
        others: [],
      })
    ).toEqual({
      kind: 'videos',
      paths: [at('Harbor and Vine', 'Season 01', 'S01E01.mkv')],
    });
  });
});

describe('linkedFiles — unreachable and copied', () => {
  it('answers unreachable, with no paths, when the Library folder can’t be read', () => {
    expect(
      linkedFiles({
        videos: [at('Heat (1995)', 'Heat.1995.mkv')],
        allLinked: true,
        sourceFolder: at('Heat (1995)'),
        libraryFolder: { path: LIBRARY, reachable: false },
        others: [],
      })
    ).toEqual({ kind: 'unreachable', paths: [] });
  });

  it('answers null for a copied title', () => {
    expect(
      linkedFiles({
        videos: [],
        allLinked: false,
        sourceFolder: at('Heat (1995)'),
        libraryFolder: reachable,
        others: [at('Coco (2017)', 'Coco.mkv')],
      })
    ).toBeNull();
  });

  it('answers null for a copied title with no Library folder at all', () => {
    expect(
      linkedFiles({
        videos: [],
        allLinked: false,
        sourceFolder: null,
        libraryFolder: null,
        others: [],
      })
    ).toBeNull();
  });
});

// 51, Library audit, slice 4 (issue #451): a Delete never trashes a video
// another held title plays. `videos` drops every path another held title
// links; when none is left the answer is `shared`, with no paths.
describe('linkedFiles: shared videos', () => {
  it('drops from videos an episode another held title links', () => {
    expect(
      linkedFiles({
        videos: [at('Harbor.S01E01.mkv'), at('Harbor.S01E02.mkv')],
        allLinked: true,
        sourceFolder: LIBRARY,
        libraryFolder: reachable,
        others: [at('Harbor.S01E01.mkv')],
      })
    ).toEqual({ kind: 'videos', paths: [at('Harbor.S01E02.mkv')] });
  });

  it('answers shared, with no paths, for a Collection folder film whose video another title plays', () => {
    expect(
      linkedFiles({
        videos: [at('Collection', 'Heat.mkv')],
        allLinked: true,
        sourceFolder: at('Collection'),
        libraryFolder: reachable,
        others: [at('Collection', 'Heat.mkv'), at('Collection', 'Coco.mkv')],
      })
    ).toEqual({ kind: 'shared', paths: [] });
  });

  it('answers shared, never folder, for a film alone in its folder whose video another title plays', () => {
    expect(
      linkedFiles({
        videos: [at('Coco (2017)', 'Coco.mkv')],
        allLinked: true,
        sourceFolder: at('Coco (2017)'),
        libraryFolder: reachable,
        others: [at('Coco (2017)', 'Coco.mkv')],
      })
    ).toEqual({ kind: 'shared', paths: [] });
  });

  it('answers shared when every one of a show’s episodes is another title’s too', () => {
    const episodes = [at('Harbor.S01E01.mkv'), at('Harbor.S01E02.mkv')];

    expect(
      linkedFiles({
        videos: episodes,
        allLinked: true,
        sourceFolder: LIBRARY,
        libraryFolder: reachable,
        others: episodes,
      })
    ).toEqual({ kind: 'shared', paths: [] });
  });

  it('still answers unreachable while the Library folder can’t be read, shared or not', () => {
    expect(
      linkedFiles({
        videos: [at('Collection', 'Heat.mkv')],
        allLinked: true,
        sourceFolder: at('Collection'),
        libraryFolder: { path: LIBRARY, reachable: false },
        others: [at('Collection', 'Heat.mkv')],
      })
    ).toEqual({ kind: 'unreachable', paths: [] });
  });
});
