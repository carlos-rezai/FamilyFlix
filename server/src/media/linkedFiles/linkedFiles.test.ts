// @vitest-environment node
//
// 47 — Manage library, Phase 1: "the list, read-only" (issue #407); a kind
// only since 52, Keep originals, phase 5 (issue #478).
//
// `linkedFiles`, pure: a title's **Linked files**, what a Delete leaves where
// it lies, off its linked videos, its **Source folder**, its **Library
// folder**'s path and reach, and every other held title's linked videos. It
// answers the kind alone, `LinkedFiles | null`, never a path:
//
// - `folder`: the Source folder holds no other held title's video and is not
//   a Library folder itself;
// - `videos`: the folder is shared (a **Collection folder**, or a show's
//   loose episodes at a Library folder's root), or the title partly linked;
// - `shared`: every one of its videos is another held title's too;
// - `unreachable`: the Library folder can't be read;
// - `null`: no linked video, a copied title.

import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { linkedFiles } from './linkedFiles';

const LIBRARY = resolve('/', 'Movies');
const reachable = { path: LIBRARY, reachable: true };
const at = (...parts: string[]) => join(LIBRARY, ...parts);

describe('linkedFiles — folder', () => {
  it('answers folder for a film alone in its Source folder', () => {
    expect(
      linkedFiles({
        videos: [at('Heat (1995)', 'Heat.1995.mkv')],
        allLinked: true,
        sourceFolder: at('Heat (1995)'),
        libraryFolder: reachable,
        others: [at('Coco (2017)', 'Coco.mkv')],
      })
    ).toBe('folder');
  });

  it('answers folder for a show whose Show folder holds nothing else', () => {
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
    ).toBe('folder');
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
    ).toBe('folder');
  });
});

describe('linkedFiles — videos', () => {
  it('answers videos for a Collection folder film', () => {
    expect(
      linkedFiles({
        videos: [at('Collection', 'Heat.mkv')],
        allLinked: true,
        sourceFolder: at('Collection'),
        libraryFolder: reachable,
        others: [at('Collection', 'Coco.mkv')],
      })
    ).toBe('videos');
  });

  it('answers videos for a show’s loose episodes at a Library folder’s root', () => {
    const episodes = [at('Harbor.S01E01.mkv'), at('Harbor.S01E02.mkv')];

    expect(
      linkedFiles({
        videos: episodes,
        allLinked: true,
        sourceFolder: LIBRARY,
        libraryFolder: reachable,
        others: [],
      })
    ).toBe('videos');
  });

  it('answers videos, never folder, for a Source folder that is the Library folder itself', () => {
    const answer = linkedFiles({
      videos: [at('Heat.mkv')],
      allLinked: true,
      sourceFolder: LIBRARY,
      libraryFolder: reachable,
      others: [],
    });

    expect(answer).toBe('videos');
  });

  it('answers videos for a mixed show', () => {
    // S01E02 was copied in: the title is only partly linked, so its Source
    // folder is not wholly its own.
    expect(
      linkedFiles({
        videos: [at('Harbor and Vine', 'Season 01', 'S01E01.mkv')],
        allLinked: false,
        sourceFolder: at('Harbor and Vine'),
        libraryFolder: reachable,
        others: [],
      })
    ).toBe('videos');
  });
});

describe('linkedFiles — unreachable and copied', () => {
  it('answers unreachable when the Library folder can’t be read', () => {
    expect(
      linkedFiles({
        videos: [at('Heat (1995)', 'Heat.1995.mkv')],
        allLinked: true,
        sourceFolder: at('Heat (1995)'),
        libraryFolder: { path: LIBRARY, reachable: false },
        others: [],
      })
    ).toBe('unreachable');
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

// 51, Library audit, slice 4 (issue #451): a video another held title plays
// is never the title's alone; when every one of its videos is shared the
// answer is `shared`.
describe('linkedFiles: shared videos', () => {
  it('answers videos while one of a show’s episodes is its own alone', () => {
    expect(
      linkedFiles({
        videos: [at('Harbor.S01E01.mkv'), at('Harbor.S01E02.mkv')],
        allLinked: true,
        sourceFolder: LIBRARY,
        libraryFolder: reachable,
        others: [at('Harbor.S01E01.mkv')],
      })
    ).toBe('videos');
  });

  it('answers shared for a Collection folder film whose video another title plays', () => {
    expect(
      linkedFiles({
        videos: [at('Collection', 'Heat.mkv')],
        allLinked: true,
        sourceFolder: at('Collection'),
        libraryFolder: reachable,
        others: [at('Collection', 'Heat.mkv'), at('Collection', 'Coco.mkv')],
      })
    ).toBe('shared');
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
    ).toBe('shared');
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
    ).toBe('shared');
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
    ).toBe('unreachable');
  });
});
