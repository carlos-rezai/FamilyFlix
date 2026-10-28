// @vitest-environment node
//
// 51, Library audit, refactor (issue #472): the Held video rule over a list,
// spelled once.
//
// `heldByVideo(titleHolding, folder, videos, kind)` answers the first title
// of `kind` one of the found videos already belongs to, each asked of the
// **Held video** rule as a **Linked video** under the listed folder; `null`
// for none. The importer and `readShowFolder` both ask it.

import { join, parse } from 'node:path';
import { describe, expect, it } from 'vitest';

import { heldByVideo } from './heldByVideo';
import type { HeldTitle, StoredLibraryFolder } from '../../library';

const root = join(parse(process.cwd()).root, 'familyflix-held-by-video');

const folder: StoredLibraryFolder = {
  id: 'films',
  path: join(root, 'Films'),
  titleCount: 0,
  scannedAt: null,
};

/** A `titleHolding` that answers from `held`, by folder id and Linked video. */
const holding =
  (held: Record<string, HeldTitle>) =>
  (folderId: string, videoPath: string): HeldTitle | null =>
    held[`${folderId}:${videoPath}`] ?? null;

describe('heldByVideo', () => {
  it("answers the film one of the videos is a held film's", () => {
    const titleHolding = holding({
      'films:Dune 2021/dune.mkv': { kind: 'movie', id: 'dune' },
    });

    expect(
      heldByVideo(
        titleHolding,
        folder,
        [
          join(folder.path, 'Dune 2021', 'extras.mkv'),
          join(folder.path, 'Dune 2021', 'dune.mkv'),
        ],
        'movie'
      )
    ).toBe('dune');
  });

  it("answers the series one of the videos is a held episode's", () => {
    const titleHolding = holding({
      'films:Harbor/S01/e02.mkv': { kind: 'series', id: 'harbor' },
    });

    expect(
      heldByVideo(
        titleHolding,
        folder,
        [
          join(folder.path, 'Harbor', 'S01', 'e01.mkv'),
          join(folder.path, 'Harbor', 'S01', 'e02.mkv'),
        ],
        'series'
      )
    ).toBe('harbor');
  });

  it('passes over a held title of the other kind', () => {
    const titleHolding = holding({
      'films:Harbor/e01.mkv': { kind: 'movie', id: 'harbor-film' },
      'films:Harbor/e02.mkv': { kind: 'series', id: 'harbor' },
    });

    expect(
      heldByVideo(
        titleHolding,
        folder,
        [
          join(folder.path, 'Harbor', 'e01.mkv'),
          join(folder.path, 'Harbor', 'e02.mkv'),
        ],
        'series'
      )
    ).toBe('harbor');
  });

  it('answers null when no video is held', () => {
    expect(
      heldByVideo(
        holding({}),
        folder,
        [join(folder.path, 'Dune 2021', 'dune.mkv')],
        'movie'
      )
    ).toBeNull();
  });
});
